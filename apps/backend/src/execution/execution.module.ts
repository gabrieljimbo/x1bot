import { Module, Global } from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { ExecutionEngineService } from './execution-engine.service';
import { NodeExecutorService } from './node-executor.service';
import { ContextService } from './context.service';
import { WhatsappSenderService } from './whatsapp-sender.service';
import { ContactTagsService } from './contact-tags.service';
import { ScheduleWorker } from '../worker/schedule.worker';
import { OCRService } from './ocr.service';

@Global()
@Module({
  providers: [
    ExecutionService,
    ExecutionEngineService,
    NodeExecutorService,
    ContextService,
    WhatsappSenderService,
    ContactTagsService,
    ScheduleWorker,
    OCRService,
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

