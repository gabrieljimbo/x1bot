import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CleanupService } from './cleanup.service';

@Module({
  imports: [PrismaModule],
  controllers: [StorageController],
  providers: [StorageService, CleanupService],
  exports: [StorageService, CleanupService],
})
export class StorageModule { }
