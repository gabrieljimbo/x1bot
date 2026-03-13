import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';

/**
 * Minimum age (in hours) a media file must be before it can be considered
 * orphaned and deleted. Protects files that were just uploaded but whose
 * parent workflow has not been saved yet.
 */
const ORPHAN_GRACE_PERIOD_HOURS = 6;

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) { }

  /**
   * Run daily at 3 AM to clean up orphaned media files.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleDailyCleanup() {
    this.logger.log('Starting daily orphaned media cleanup...');
    const result = await this.cleanupOrphanedMedia();
    this.logger.log(
      `Daily cleanup finished: ${result.deleted} deleted, ${result.skipped} skipped (grace period), ${result.errors} errors.`,
    );
  }

  /**
   * Recursively collect every uploadedMediaId found anywhere inside an object/array.
   * Mirrors the same logic used in WorkflowService.cleanupOrphanedMedia so that
   * nested configs (e.g. GroupMessageConfig.mensagem.uploadedMediaId) are found.
   */
  private collectMediaIds(obj: any, ids: Set<string>): void {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      for (const item of obj) this.collectMediaIds(item, ids);
      return;
    }

    if (obj.uploadedMediaId && typeof obj.uploadedMediaId === 'string') {
      ids.add(obj.uploadedMediaId);
    }

    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val && typeof val === 'object') {
        this.collectMediaIds(val, ids);
      }
    }
  }

  /**
   * Main cleanup routine.
   *
   * Rules (in order):
   *  1. Files younger than ORPHAN_GRACE_PERIOD_HOURS are never deleted.
   *  2. Files whose workflowId points to a workflow/campaign that still exists
   *     AND whose ID is referenced (recursively) somewhere in that workflow's
   *     nodes are kept.
   *  3. Everything else (no workflowId, workflow deleted, no node references)
   *     is deleted from MinIO and from the DB.
   */
  async cleanupOrphanedMedia(): Promise<{ deleted: number; skipped: number; errors: number }> {
    let deleted = 0;
    let skipped = 0;
    let errors = 0;

    try {
      const graceCutoff = new Date(Date.now() - ORPHAN_GRACE_PERIOD_HOURS * 60 * 60 * 1000);

      // Load all registered media files
      const mediaFiles = await this.prisma.mediaFile.findMany({
        select: {
          id: true,
          objectName: true,
          workflowId: true,
          createdAt: true,
        },
      });

      // Group files by workflowId so we query each workflow only once
      const byWorkflow = new Map<string, typeof mediaFiles>();
      const noWorkflow: typeof mediaFiles = [];

      for (const media of mediaFiles) {
        // Grace period: never delete recently-uploaded files
        if (media.createdAt > graceCutoff) {
          skipped++;
          continue;
        }

        if (!media.workflowId) {
          noWorkflow.push(media);
        } else {
          const list = byWorkflow.get(media.workflowId) ?? [];
          list.push(media);
          byWorkflow.set(media.workflowId, list);
        }
      }

      // Files with no workflowId are always orphaned
      for (const media of noWorkflow) {
        const ok = await this.deleteOne(media.id, media.objectName);
        ok ? deleted++ : errors++;
      }

      // Files that belong to a workflow — check if the workflow still exists
      // and whether the file is still referenced in a node
      for (const [workflowId, files] of byWorkflow) {
        // Try regular Workflow and CampaignWorkflow in parallel
        const [regularWf, campaignWf] = await Promise.all([
          this.prisma.workflow.findUnique({
            where: { id: workflowId },
            select: { nodes: true },
          }).catch(() => null),
          this.prisma.campaignWorkflow.findUnique({
            where: { campaignId: workflowId },
            select: { nodes: true },
          }).catch(() => null),
        ]);

        const workflow = regularWf ?? campaignWf;

        if (!workflow) {
          // Workflow no longer exists → all its files are orphaned
          for (const media of files) {
            const ok = await this.deleteOne(media.id, media.objectName);
            ok ? deleted++ : errors++;
          }
          continue;
        }

        // Workflow exists → collect all referenced IDs (recursive, any depth)
        const usedIds = new Set<string>();
        const nodes = (workflow.nodes ?? []) as any[];
        for (const node of nodes) {
          this.collectMediaIds(node.config, usedIds);
        }

        for (const media of files) {
          if (!usedIds.has(media.id)) {
            // No node references this file anymore
            const ok = await this.deleteOne(media.id, media.objectName);
            ok ? deleted++ : errors++;
          }
        }
      }
    } catch (error: any) {
      this.logger.error(`Cleanup aborted with unexpected error: ${error.message}`, error.stack);
      errors++;
    }

    return { deleted, skipped, errors };
  }

  /**
   * Delete a single media file from MinIO and from the DB.
   * Returns true on success, false if an error occurred.
   */
  private async deleteOne(mediaId: string, objectName: string): Promise<boolean> {
    try {
      // Remove from object storage first; if MinIO returns 404 (already gone)
      // we still want to clean the DB record.
      await this.storageService.deleteMedia(objectName).catch((err: any) => {
        const msg: string = err?.message ?? '';
        // Ignore "not found" errors — the file is already gone from storage
        if (!msg.includes('NoSuchKey') && !msg.includes('404') && !msg.includes('not found')) {
          throw err;
        }
        this.logger.debug(`Object ${objectName} already absent from storage, removing DB record only.`);
      });

      await this.prisma.mediaFile.delete({ where: { id: mediaId } });
      this.logger.debug(`Deleted orphaned media ${mediaId} (${objectName})`);
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to delete media ${mediaId} (${objectName}): ${err.message}`);
      return false;
    }
  }
}
