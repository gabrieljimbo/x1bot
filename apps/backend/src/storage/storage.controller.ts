import {
  Controller, Get, Post, Delete, Param, Res, Query,
  NotFoundException, BadRequestException,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { StorageService } from './storage.service';
import { PrismaService } from '../prisma/prisma.service';

// File size limits per media type (in bytes)
const SIZE_LIMITS: Record<string, number> = {
  image: 5 * 1024 * 1024,     // 5MB
  audio: 10 * 1024 * 1024,    // 10MB
  video: 50 * 1024 * 1024,    // 50MB
  document: 20 * 1024 * 1024, // 20MB
};

// Allowed MIME types per media type
const ALLOWED_MIMES: Record<string, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp'],
  audio: ['audio/mpeg', 'audio/ogg', 'audio/aac', 'audio/mp4', 'audio/wav'],
  video: ['video/mp4'],
  document: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ],
};

@Controller('media')
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
  ) { }

  /**
   * Upload a media file to MinIO
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadMedia(
    @UploadedFile() file: any,
    @Query('tenantId') tenantId: string,
    @Query('mediaType') mediaType: string,
    @Query('nodeId') nodeId?: string,
    @Query('workflowId') workflowId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }

    if (!mediaType || !SIZE_LIMITS[mediaType]) {
      throw new BadRequestException('Invalid mediaType. Use: image, audio, video, document');
    }

    // Validate MIME type
    const allowedMimes = ALLOWED_MIMES[mediaType];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type "${file.mimetype}" for ${mediaType}. Allowed: ${allowedMimes.join(', ')}`,
      );
    }

    // Validate file size
    const maxSize = SIZE_LIMITS[mediaType];
    if (file.size > maxSize) {
      const maxMB = Math.round(maxSize / (1024 * 1024));
      throw new BadRequestException(
        `File too large (${Math.round(file.size / (1024 * 1024))}MB). Maximum for ${mediaType}: ${maxMB}MB`,
      );
    }

    // If replacing a file for the same nodeId, delete the old one
    if (nodeId) {
      const existing = await this.prisma.mediaFile.findFirst({
        where: { nodeId, tenantId },
      });
      if (existing) {
        try {
          await this.storageService.deleteMedia(existing.objectName);
        } catch (e) {
          // Ignore delete errors for old files
        }
        await this.prisma.mediaFile.delete({ where: { id: existing.id } });
      }
    }

    // Upload to MinIO
    const result = await this.storageService.uploadMedia(
      file.buffer,
      file.mimetype,
      file.originalname,
    );

    // Extract objectName from the URL for later deletion
    const urlParts = result.url.split('/');
    const objectName = `media/${urlParts[urlParts.length - 1]}`;

    // Save to DB
    const mediaFile = await this.prisma.mediaFile.create({
      data: {
        tenantId,
        url: result.url,
        objectName,
        filename: result.fileName,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        nodeId: nodeId || null,
        workflowId: workflowId || null,
      },
    });

    return {
      id: mediaFile.id,
      url: mediaFile.url,
      filename: mediaFile.filename,
      originalName: mediaFile.originalName,
      size: mediaFile.size,
      mimeType: mediaFile.mimeType,
    };
  }

  /**
   * Delete a media file from MinIO and DB
   */
  @Delete(':id')
  async deleteMedia(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }

    const mediaFile = await this.prisma.mediaFile.findFirst({
      where: { id, tenantId },
    });

    if (!mediaFile) {
      throw new NotFoundException('Media file not found');
    }

    // Delete from MinIO
    try {
      await this.storageService.deleteMedia(mediaFile.objectName);
    } catch (e) {
      // Log but continue with DB deletion
      console.warn(`[MEDIA] Failed to delete from MinIO: ${mediaFile.objectName}`, e);
    }

    // Delete from DB
    await this.prisma.mediaFile.delete({ where: { id } });

    return { success: true };
  }

  /**
   * Serve a file from MinIO (existing endpoint)
   */
  @Get('files/:filename')
  async getFile(@Param('filename') filename: string, @Res() res: Response) {
    try {
      const objectName = `media/${filename}`;

      const exists = await this.storageService.fileExists(objectName);
      if (!exists) {
        throw new NotFoundException(`File ${filename} not found`);
      }

      const stream = await this.storageService.getFileStream(objectName);

      res.setHeader('Content-Type', this.getContentType(filename));
      res.setHeader('Cache-Control', 'public, max-age=31536000');

      stream.pipe(res);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException(`File ${filename} not found`);
    }
  }

  private getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      mp4: 'video/mp4',
      mpeg: 'video/mpeg',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      mp3: 'audio/mpeg',
      m4a: 'audio/mp4',
      ogg: 'audio/ogg',
      wav: 'audio/wav',
      webm: 'audio/webm',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }
}
