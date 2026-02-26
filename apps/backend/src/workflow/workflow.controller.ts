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
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { TagService, CreateTagDto, UpdateTagDto } from './tag.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { WhatsappSessionManager } from '../whatsapp/whatsapp-session-manager.service';
import { ExecutionService } from '../execution/execution.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { Tenant } from '../auth/decorators/tenant.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class WorkflowController {
  constructor(
    private workflowService: WorkflowService,
    private tagService: TagService,
    private whatsappService: WhatsappService,
    private whatsappSessionManager: WhatsappSessionManager,
    private executionService: ExecutionService,
    private eventBus: EventBusService,
  ) { }

  // Health check
  @Get('health')
  @Public()
  @HttpCode(HttpStatus.OK)
  async healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'n9n-backend',
    };
  }

  // Workflows

  @Get('workflows')
  async getWorkflows(@Tenant() tenantId: string) {
    return this.workflowService.getWorkflows(tenantId);
  }

  @Get('workflows/:id')
  async getWorkflow(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.workflowService.getWorkflow(tenantId, id);
  }

  @Post('workflows')
  async createWorkflow(
    @Tenant() tenantId: string,
    @Body() body: { name: string; description?: string },
  ) {
    return this.workflowService.createWorkflow(tenantId, body.name, body.description);
  }

  @Put('workflows/:id')
  async updateWorkflow(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.workflowService.updateWorkflow(tenantId, id, body);
  }

  @Delete('workflows/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWorkflow(@Tenant() tenantId: string, @Param('id') id: string) {
    await this.workflowService.deleteWorkflow(tenantId, id);
  }

  @Post('workflows/:id/trigger-manual')
  async triggerManualExecution(
    @Tenant() tenantId: string,
    @Param('id') workflowId: string,
    @Body() body: { nodeId: string },
  ) {
    return this.workflowService.triggerManualExecution(
      tenantId,
      workflowId,
      body.nodeId,
    );
  }

  @Post('workflows/:id/test-node')
  async testNodeFromContext(
    @Tenant() tenantId: string,
    @Param('id') workflowId: string,
    @Body() body: { nodeId: string; executionId?: string; nodeConfig?: any },
  ) {
    return this.workflowService.testNodeFromContext(
      tenantId,
      workflowId,
      body.nodeId,
      body.executionId,
      body.nodeConfig,
    );
  }

  @Post('workflows/:id/duplicate')
  async duplicateWorkflow(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.workflowService.duplicateWorkflow(tenantId, id);
  }

  // WhatsApp Sessions

  @Get('whatsapp/sessions')
  async getSessions(@Tenant() tenantId: string) {
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
  async getSession(@Tenant() tenantId: string, @Param('id') id: string) {
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
  async createSession(@Tenant() tenantId: string, @Body() body: { name: string }) {
    const session = await this.whatsappService.createSession(tenantId, body.name);

    // Initialize WhatsApp client
    await this.whatsappSessionManager.initializeSession(tenantId, session.id);

    return session;
  }

  @Post('whatsapp/sessions/:id/reconnect')
  async reconnectSession(@Tenant() tenantId: string, @Param('id') id: string) {
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
  async deleteSession(@Tenant() tenantId: string, @Param('id') id: string) {
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
    @Body() body: { contactPhone: string; message: string },
  ) {
    await this.whatsappSessionManager.sendMessage(sessionId, body.contactPhone, body.message);
    return { success: true };
  }

  @Post('whatsapp/sessions/:id/send-media')
  async sendMedia(
    @Param('id') sessionId: string,
    @Body() body: {
      contactPhone: string;
      mediaType: 'image' | 'video' | 'audio' | 'document';
      mediaUrl: string;
      caption?: string;
      fileName?: string;
      sendAudioAsVoice?: boolean;
    },
  ) {
    await this.whatsappSessionManager.sendMedia(
      sessionId,
      body.contactPhone,
      body.mediaType,
      body.mediaUrl,
      {
        caption: body.caption,
        fileName: body.fileName,
        sendAudioAsVoice: body.sendAudioAsVoice,
      },
    );
    return { success: true };
  }

  // Group Management

  @Get('whatsapp/sessions/:id/groups')
  async getGroupConfigs(@Param('id') sessionId: string) {
    return this.whatsappService.getGroupConfigs(sessionId);
  }

  @Post('whatsapp/sessions/:id/groups/sync')
  async syncGroups(@Param('id') sessionId: string) {
    return this.whatsappSessionManager.syncGroups(sessionId);
  }

  @Put('whatsapp/sessions/:id/groups/:configId')
  async updateGroupConfig(
    @Param('configId') configId: string,
    @Body() body: { enabled: boolean; workflowIds: string[] },
  ) {
    return this.whatsappService.updateGroupConfig(configId, body);
  }

  // Executions

  @Get('workflows/:workflowId/executions')
  async getWorkflowExecutions(
    @Tenant() tenantId: string,
    @Param('workflowId') workflowId: string,
  ) {
    const executions = await this.executionService.getWorkflowExecutions(tenantId, workflowId);
    return executions;
  }

  @Get('executions')
  async getExecutions(@Tenant() tenantId: string) {
    // This would need pagination in production
    return { message: 'Use specific execution endpoints' };
  }

  @Get('executions/:id')
  async getExecution(@Tenant() tenantId: string, @Param('id') id: string) {
    const execution = await this.executionService.getExecution(tenantId, id);
    if (!execution) {
      throw new NotFoundException('Execution not found');
    }
    return execution;
  }

  @Get('executions/:id/logs')
  async getExecutionLogs(@Tenant() tenantId: string, @Param('id') id: string) {
    const logs = await this.eventBus.getExecutionLogs(tenantId, id);
    return logs;
  }

  // ==================== TAG ENDPOINTS ====================

  @Get('tags')
  async getTags(@Tenant() tenantId: string) {
    return this.tagService.getTags(tenantId);
  }

  @Get('tags/:id')
  async getTag(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.tagService.getTag(tenantId, id);
  }

  @Post('tags')
  async createTag(@Tenant() tenantId: string, @Body() data: CreateTagDto) {
    return this.tagService.createTag(tenantId, data);
  }

  @Put('tags/:id')
  async updateTag(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() data: UpdateTagDto,
  ) {
    return this.tagService.updateTag(tenantId, id, data);
  }

  @Delete('tags/:id')
  async deleteTag(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.tagService.deleteTag(tenantId, id);
  }

  @Get('tags/:id/usage')
  async getTagUsage(@Tenant() tenantId: string, @Param('id') id: string) {
    const tag = await this.tagService.getTag(tenantId, id);
    if (!tag) {
      return { count: 0 };
    }
    const count = await this.tagService.getTagUsageCount(tenantId, tag.name);
    return { count };
  }

  // Workflow Sharing

  @Post('workflows/:id/share')
  async shareWorkflow(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.workflowService.shareWorkflow(id, user.id);
  }

  @Get('workflows/import/:shareId')
  @Public()
  async getSharedWorkflowPreview(@Param('shareId') shareId: string) {
    return this.workflowService.getSharedWorkflowPreview(shareId);
  }

  @Post('workflows/import/:shareId')
  async importWorkflow(
    @Tenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('shareId') shareId: string,
  ) {
    return this.workflowService.importWorkflow(shareId, tenantId, user.id);
  }

  @Get('workflows/:id/share/stats')
  async getWorkflowShareStats(
    @Tenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.workflowService.getWorkflowShareStats(tenantId, id);
  }
}

