import { Module } from '@nestjs/common';
import { ExpirationWorker } from './expiration.worker';
import { ExecutionModule } from '../execution/execution.module';

@Module({
  imports: [ExecutionModule],
  providers: [ExpirationWorker],
})
export class WorkerModule {}




