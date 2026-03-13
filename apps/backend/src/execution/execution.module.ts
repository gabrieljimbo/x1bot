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
import { MlOffersService } from './ml-offers.service';
import { ScheduleModule } from '@nestjs/schedule';
import { MlOffersController } from './ml-offers.controller';
import { ApiConfigsService } from '../api-configs/api-configs.service';
import { StorageModule } from '../storage/storage.module';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'rmkt',
    }),
    PrismaModule,
    ScheduleModule.forRoot(),
    StorageModule,
  ],
  controllers: [MlOffersController],
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
    MlOffersService,
    ApiConfigsService,
  ],
  exports: [
    ExecutionService,
    ExecutionEngineService,
    NodeExecutorService,
    WhatsappSenderService,
    ContactTagsService,
    OCRService,
    MlOffersService,
  ],
})
export class ExecutionModule { }

