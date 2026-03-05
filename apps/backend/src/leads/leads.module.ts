import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { PrismaService } from '../prisma/prisma.service';
import { PixelProcessor } from './pixel-processor.service';
import { EventBusService } from '../event-bus/event-bus.service';

@Module({
    controllers: [LeadsController],
    providers: [LeadsService, PrismaService, PixelProcessor, EventBusService],
    exports: [LeadsService],
})
export class LeadsModule { }
