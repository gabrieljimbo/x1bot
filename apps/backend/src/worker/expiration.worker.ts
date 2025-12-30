import { Injectable, OnModuleInit } from '@nestjs/common';
import { ExecutionService } from '../execution/execution.service';
import { ExecutionEngineService } from '../execution/execution-engine.service';

@Injectable()
export class ExpirationWorker implements OnModuleInit {
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private executionService: ExecutionService,
    private executionEngine: ExecutionEngineService,
  ) {}

  onModuleInit() {
    // Run every minute
    this.intervalId = setInterval(() => {
      this.processExpiredExecutions();
    }, 60 * 1000);

    // Run immediately on startup
    this.processExpiredExecutions();
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  /**
   * Process expired executions
   */
  private async processExpiredExecutions(): Promise<void> {
    try {
      const expiredExecutions = await this.executionService.getExpiredExecutions();

      for (const execution of expiredExecutions) {
        try {
          await this.executionEngine.expireExecution(execution);
        } catch (error) {
          console.error(`Failed to expire execution ${execution.id}:`, error);
        }
      }

      if (expiredExecutions.length > 0) {
        console.log(`Expired ${expiredExecutions.length} execution(s)`);
      }
    } catch (error) {
      console.error('Error processing expired executions:', error);
    }
  }
}




