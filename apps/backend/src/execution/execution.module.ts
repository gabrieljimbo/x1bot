import { Module, Global } from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { ExecutionEngineService } from './execution-engine.service';
import { NodeExecutorService } from './node-executor.service';
import { ContextService } from './context.service';
import { WhatsappSenderService } from './whatsapp-sender.service';
import { ContactTagsService } from './contact-tags.service';
import { ScheduleWorker } from '../worker/schedule.worker';
import { OCRService } from './ocr.service';
import { BullModule } from '@nestjs/bullmq';
import { RmktProcessor } from './rmkt.processor';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'rmkt',
    }),
    PrismaModule,
  ],
  providers: [
    ExecutionService,
    ExecutionEngineService,
    NodeExecutorService,
    ContextService,
    WhatsappSenderService,
    ContactTagsService,
    ScheduleWorker,
    OCRService,
    RmktProcessor,
  ],
  exports: [
    ExecutionService,
    ExecutionEngineService,
    NodeExecutorService,
    WhatsappSenderService,
    ContactTagsService,
    OCRService,
  ],
})
export class ExecutionModule { }

