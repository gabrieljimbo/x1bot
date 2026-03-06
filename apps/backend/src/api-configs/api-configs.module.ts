import { Module } from '@nestjs/common';
import { ApiConfigsService } from './api-configs.service';
import { ApiConfigsController } from './api-configs.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
    controllers: [ApiConfigsController],
    providers: [ApiConfigsService, PrismaService],
    exports: [ApiConfigsService],
})
export class ApiConfigsModule {}
