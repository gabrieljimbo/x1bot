import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) { }

  /**
   * Run daily at 3 AM to clean up orphaned media files
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleDailyCleanup() {
    this.logger.log('Starting daily orphaned media cleanup...');
    await this.cleanupOrphanedMedia();
    this.logger.log('Daily orphaned media cleanup completed.');
  }

  async cleanupOrphanedMedia() {
    try {
      // 1. Get all media files registered in DB
      const mediaFiles = await this.prisma.mediaFile.findMany();
      let deletedCount = 0;

      for (const media of mediaFiles) {
        let isOrphaned = false;

        // If it has no workflowId, it's definitely an orphan (since we only use it for workflows/campaigns for now)
        if (!media.workflowId) {
          isOrphaned = true;
        } else {
          // Check if it belongs to a Campaign or a regular Workflow
          const [campaignWorkflow, regularWorkflow] = await Promise.all([
            this.prisma.campaignWorkflow.findUnique({
              where: { campaignId: media.workflowId },
              select: { nodes: true }
            }),
            this.prisma.workflow.findUnique({
              where: { id: media.workflowId },
              select: { nodes: true }
            })
          ]);

          const workflow = campaignWorkflow || regularWorkflow;

          if (!workflow) {
            // Workflow no longer exists
            isOrphaned = true;
          } else {
            // Workflow exists, check if any node still uses this specific media ID
            const nodes = (workflow.nodes || []) as any[];
            const isUsed = nodes.some(node => node.config?.uploadedMediaId === media.id);
            
            if (!isUsed) {
              isOrphaned = true;
            }
          }
        }

        if (isOrphaned) {
          try {
            this.logger.debug(`Deleting orphaned media: ${media.id} (${media.objectName})`);
            await this.storageService.deleteMedia(media.objectName);
            await this.prisma.mediaFile.delete({ where: { id: media.id } });
            deletedCount++;
          } catch (err) {
            this.logger.error(`Failed to delete orphaned media ${media.id}:`, err);
          }
        }
      }

      if (deletedCount > 0) {
        this.logger.log(`Cleanup finished: deleted ${deletedCount} orphaned media files.`);
      }
    } catch (error) {
      this.logger.error('Error during global orphaned media cleanup:', error);
    }
  }
}
