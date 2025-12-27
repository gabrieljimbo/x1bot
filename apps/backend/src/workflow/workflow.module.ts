import { Module } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { ExecutionModule } from '../execution/execution.module';

@Module({
  imports: [WhatsappModule, ExecutionModule],
  providers: [WorkflowService],
  controllers: [WorkflowController],
})
export class WorkflowModule {}


