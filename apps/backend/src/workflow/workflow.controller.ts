import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { WhatsappSessionManager } from '../whatsapp/whatsapp-session-manager.service';
import { ExecutionService } from '../execution/execution.service';
import { EventBusService } from '../event-bus/event-bus.service';

@Controller('api')
export class WorkflowController {
  constructor(
    private workflowService: WorkflowService,
    private whatsappService: WhatsappService,
    private whatsappSessionManager: WhatsappSessionManager,
    private executionService: ExecutionService,
    private eventBus: EventBusService,
  ) {}

  // Workflows

  @Get('workflows')
  async getWorkflows(@Query('tenantId') tenantId: string) {
    return this.workflowService.getWorkflows(tenantId);
  }

  @Get('workflows/:id')
  async getWorkflow(@Query('tenantId') tenantId: string, @Param('id') id: string) {
    return this.workflowService.getWorkflow(tenantId, id);
  }

  @Post('workflows')
  async createWorkflow(
    @Body() body: { tenantId: string; name: string; description?: string },
  ) {
    return this.workflowService.createWorkflow(body.tenantId, body.name, body.description);
  }

  @Put('workflows/:id')
  async updateWorkflow(
    @Query('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.workflowService.updateWorkflow(tenantId, id, body);
  }

  @Delete('workflows/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWorkflow(@Query('tenantId') tenantId: string, @Param('id') id: string) {
    await this.workflowService.deleteWorkflow(tenantId, id);
  }

  // WhatsApp Sessions

  @Get('whatsapp/sessions')
  async getSessions(@Query('tenantId') tenantId: string) {
    const sessions = await this.whatsappService.getSessions(tenantId);
    
    // Update real-time status for each session
    const updatedSessions = await Promise.all(
      sessions.map(async (session) => {
        const realTimeStatus = this.whatsappSessionManager.getSessionStatus(session.id);
        
        // If session is not in memory but DB says it's connected, update to disconnected
        if (realTimeStatus === null && session.status === 'CONNECTED') {
          await this.whatsappService.updateSession(session.id, {
            status: 'DISCONNECTED' as any,
          });
          return { ...session, status: 'DISCONNECTED' };
        }

        // Return session with real-time status if available
        return {
          ...session,
          status: realTimeStatus || session.status,
        };
      })
    );

    return updatedSessions;
  }

  @Get('whatsapp/sessions/:id')
  async getSession(@Query('tenantId') tenantId: string, @Param('id') id: string) {
    const session = await this.whatsappService.getSession(tenantId, id);
    
    if (!session) {
      return null;
    }

    // Check real-time status from session manager
    const realTimeStatus = this.whatsappSessionManager.getSessionStatus(id);
    
    // If session is not in memory but DB says it's connected, it's actually disconnected
    if (realTimeStatus === null && session.status === 'CONNECTED') {
      await this.whatsappService.updateSession(id, {
        status: 'DISCONNECTED' as any,
      });
      return { ...session, status: 'DISCONNECTED' };
    }

    // Return session with real-time status if available
    return {
      ...session,
      status: realTimeStatus || session.status,
    };
  }

  @Post('whatsapp/sessions')
  async createSession(@Body() body: { tenantId: string; name: string }) {
    const session = await this.whatsappService.createSession(body.tenantId, body.name);
    
    // Initialize WhatsApp client
    await this.whatsappSessionManager.initializeSession(body.tenantId, session.id);
    
    return session;
  }

  @Post('whatsapp/sessions/:id/reconnect')
  async reconnectSession(@Query('tenantId') tenantId: string, @Param('id') id: string) {
    const session = await this.whatsappService.getSession(tenantId, id);
    
    if (!session) {
      return { error: 'Session not found' };
    }

    // Disconnect if already connected
    await this.whatsappSessionManager.disconnectSession(id);
    
    // Reinitialize
    await this.whatsappSessionManager.initializeSession(tenantId, id);
    
    return { success: true, message: 'Session reconnection started' };
  }

  @Delete('whatsapp/sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSession(@Query('tenantId') tenantId: string, @Param('id') id: string) {
    await this.whatsappSessionManager.disconnectSession(id);
    await this.whatsappService.deleteSession(tenantId, id);
  }

  @Get('whatsapp/sessions/:id/labels')
  async getSessionLabels(@Param('id') sessionId: string) {
    try {
      const labels = await this.whatsappSessionManager.getAllLabels(sessionId);
      return labels;
    } catch (error) {
      console.error('Error getting session labels:', error);
      return [];
    }
  }

  @Post('whatsapp/sessions/:id/send')
  async sendMessage(
    @Param('id') sessionId: string,
    @Body() body: { contactId: string; message: string },
  ) {
    await this.whatsappSessionManager.sendMessage(sessionId, body.contactId, body.message);
    return { success: true };
  }

  // Executions

  @Get('workflows/:workflowId/executions')
  async getWorkflowExecutions(
    @Query('tenantId') tenantId: string,
    @Param('workflowId') workflowId: string,
  ) {
    return this.executionService.getWorkflowExecutions(tenantId, workflowId);
  }

  @Get('executions')
  async getExecutions(@Query('tenantId') tenantId: string) {
    // This would need pagination in production
    return { message: 'Use specific execution endpoints' };
  }

  @Get('executions/:id')
  async getExecution(@Query('tenantId') tenantId: string, @Param('id') id: string) {
    return this.executionService.getExecution(tenantId, id);
  }

  @Get('executions/:id/logs')
  async getExecutionLogs(@Query('tenantId') tenantId: string, @Param('id') id: string) {
    return this.eventBus.getExecutionLogs(tenantId, id);
  }
}

