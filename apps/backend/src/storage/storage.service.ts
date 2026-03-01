import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { randomUUID } from 'crypto';
import * as path from 'path';

// Map MIME type prefix to subfolder
const MEDIA_FOLDERS: Record<string, string> = {
  image: 'media/images',
  video: 'media/video',
  audio: 'media/audio',
  application: 'media/documents',
};

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client;
  private bucket: string;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get('MINIO_BUCKET', 'x1bot');

    const endpoint = this.configService.get('MINIO_ENDPOINT')?.replace(/_/g, '-') || '10.0.1.9';
    const port = Number(this.configService.get('MINIO_PORT', '9000'));
    const useSSL = this.configService.get('MINIO_USE_SSL', 'false') === 'true';

    this.logger.log(
      `Initializing MinIO client: ${endpoint}:${port} (SSL: ${useSSL}) bucket: ${this.bucket}`,
    );

    this.client = new Minio.Client({
      endPoint: endpoint,
      port: port,
      useSSL: useSSL,
      accessKey: this.configService.get('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.configService.get('MINIO_SECRET_KEY', 'minioadmin123'),
      pathStyle: true,
      region: 'us-east-1',
      partSize: 5 * 1024 * 1024,
    });
  }

  async onModuleInit() {
    try {
      await this.ensureBucketExists();
      this.isInitialized = true;
    } catch (error) {
      this.logger.error('Failed to initialize MinIO bucket on startup');
      this.logger.error(
        'MinIO operations will be attempted lazily on first use',
      );
    }
  }

  /**
   * Ensure bucket exists (with lazy initialization)
   */
  private async ensureBucketExists(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doEnsureBucketExists();
    try {
      await this.initializationPromise;
      this.isInitialized = true;
    } catch (error) {
      this.initializationPromise = null;
      throw error;
    }
  }

  private async doEnsureBucketExists(): Promise<void> {
    this.logger.log(`Checking bucket "${this.bucket}"...`);

    try {
      const exists = await this.client.bucketExists(this.bucket);

      if (exists) {
        this.logger.log(`Bucket "${this.bucket}" exists, ready to use`);
      } else {
        this.logger.warn(
          `Bucket "${this.bucket}" does not exist. It should be pre-created.`,
        );
      }
    } catch (error: any) {
      // In Docker, hostname resolution may cause issues with bucketExists
      // Assume bucket exists and proceed
      this.logger.warn(
        `Could not verify bucket "${this.bucket}": ${error.message}. Assuming it exists.`,
      );
    }
  }

  /**
   * Get the subfolder for a given MIME type
   */
  private getSubfolderForMimeType(mimeType: string): string {
    const prefix = mimeType.split('/')[0];
    return MEDIA_FOLDERS[prefix] || 'media/documents';
  }

  /**
   * Get public URL for an object
   */
  getPublicUrl(objectName: string): string {
    const ngrokUrl = this.configService.get('NGROK_URL');
    const backendUrl = this.configService.get('BACKEND_URL');
    const minioPublicUrl = this.configService.get('MINIO_PUBLIC_URL');

    // Extract just the filename for backend proxy routes
    const filename = objectName.split('/').pop() || objectName;

    if (ngrokUrl) {
      this.logger.debug(`Using ngrok URL: ${ngrokUrl}`);
      return `${ngrokUrl}/media/files/${filename}`;
    }

    if (backendUrl) {
      return `${backendUrl}/media/files/${filename}`;
    }

    if (minioPublicUrl) {
      return `${minioPublicUrl}/${this.bucket}/${objectName}`;
    }

    // Fallback: direct MinIO URL with full bucket/path
    const endpoint = this.configService.get('MINIO_ENDPOINT')?.replace(/_/g, '-') || '10.0.1.9';
    const port = Number(this.configService.get('MINIO_PORT', '9000'));
    const useSSL = this.configService.get('MINIO_USE_SSL', 'false') === 'true';
    const protocol = useSSL ? 'https' : 'http';

    return `${protocol}://${endpoint}:${port}/${this.bucket}/${objectName}`;
  }

  /**
   * Upload file to MinIO
   */
  async uploadFile(
    buffer: Buffer,
    objectName: string,
    mimeType: string,
  ): Promise<string> {
    await this.ensureBucketExists();

    await this.client.putObject(
      this.bucket,
      objectName,
      buffer,
      buffer.length,
      {
        'Content-Type': mimeType,
      },
    );

    return this.getPublicUrl(objectName);
  }

  /**
   * Check if file exists
   */
  async fileExists(objectName: string): Promise<boolean> {
    try {
      await this.ensureBucketExists();
      await this.client.statObject(this.bucket, objectName);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file stream
   */
  async getFileStream(objectName: string): Promise<NodeJS.ReadableStream> {
    await this.ensureBucketExists();
    return await this.client.getObject(this.bucket, objectName);
  }

  /**
   * Upload media file to MinIO with folder structure based on type
   * Saves to: media/images/, media/audio/, media/video/, or media/documents/
   */
  async uploadMedia(
    buffer: Buffer,
    mimeType: string,
    originalFileName?: string,
  ): Promise<{ url: string; fileName: string; objectName: string; size: number }> {
    await this.ensureBucketExists();

    // Generate unique filename
    const extension = this.getExtensionFromMimeType(mimeType) ||
      this.getExtensionFromFileName(originalFileName) ||
      'bin';
    const fileName = `${randomUUID()}.${extension}`;

    // Determine subfolder based on MIME type
    const subfolder = this.getSubfolderForMimeType(mimeType);
    const objectName = `${subfolder}/${fileName}`;

    this.logger.log(`Uploading to ${this.bucket}/${objectName} (${mimeType}, ${buffer.length} bytes)`);

    // Upload to MinIO
    await this.client.putObject(
      this.bucket,
      objectName,
      buffer,
      buffer.length,
      {
        'Content-Type': mimeType,
      },
    );

    // Return public URL
    const url = this.getPublicUrl(objectName);

    return {
      url,
      fileName: originalFileName || fileName,
      objectName,
      size: buffer.length,
    };
  }

  /**
   * Delete media file from MinIO
   */
  async deleteMedia(objectName: string): Promise<void> {
    await this.ensureBucketExists();
    this.logger.log(`Deleting ${this.bucket}/${objectName}`);
    await this.client.removeObject(this.bucket, objectName);
  }

  /**
   * Get extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string | null {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/mpeg': 'mpeg',
      'video/quicktime': 'mov',
      'video/x-msvideo': 'avi',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/ogg': 'ogg',
      'audio/aac': 'aac',
      'audio/wav': 'wav',
      'audio/webm': 'webm',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    };

    return mimeToExt[mimeType.toLowerCase()] || null;
  }

  /**
   * Get extension from filename
   */
  private getExtensionFromFileName(fileName?: string): string | null {
    if (!fileName) return null;
    const ext = path.extname(fileName).slice(1);
    return ext || null;
  }
}
