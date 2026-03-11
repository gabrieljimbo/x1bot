import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { InboxService } from './inbox.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConversationStatus } from '@prisma/client';

@Controller('inbox')
@UseGuards(JwtAuthGuard)
export class InboxController {
    constructor(private readonly inboxService: InboxService) { }

    @Get('stats')
    async getStats(@Request() req: any) {
        return this.inboxService.getInboxStats(req.user.tenantId);
    }

    @Get()
    async getConversations(
        @Request() req: any,
        @Query('sessionId') sessionId?: string,
        @Query('status') status?: ConversationStatus,
        @Query('label') label?: string,
        @Query('type') type?: 'individual' | 'group',
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '20',
    ) {
        const filters = { sessionId, status, label, type, page: Number(page), limit: Number(limit) };
        return this.inboxService.getConversations(req.user.tenantId, filters);
    }

    @Get(':id')
    async getConversation(@Request() req: any, @Param('id') conversationId: string) {
        return this.inboxService.getConversation(req.user.tenantId, conversationId);
    }

    @Get(':id/messages')
    async getMessages(
        @Request() req: any,
        @Param('id') conversationId: string,
        @Query('cursor') cursor?: string,
        @Query('limit') limit: string = '50',
    ) {
        return this.inboxService.getMessages(req.user.tenantId, conversationId, { cursor, limit: Number(limit) });
    }

    @Post(':id/send')
    async sendMessage(
        @Request() req: any,
        @Param('id') conversationId: string,
        @Body() body: { text?: string; mediaUrl?: string; mediaType?: 'image' | 'video' | 'audio' | 'document' }
    ) {
        return this.inboxService.sendMessage(req.user.tenantId, conversationId, body);
    }

    @Post(':id/trigger-flow')
    async triggerFlow(
        @Request() req: any,
        @Param('id') conversationId: string,
        @Body('workflowId') workflowId: string,
    ) {
        return this.inboxService.triggerFlow(req.user.tenantId, conversationId, workflowId);
    }

    @Patch(':id/status')
    async updateStatus(
        @Request() req: any,
        @Param('id') conversationId: string,
        @Body('status') status: ConversationStatus,
    ) {
        return this.inboxService.updateStatus(req.user.tenantId, conversationId, status);
    }

    @Patch(':id/read')
    async markAsRead(@Request() req: any, @Param('id') conversationId: string) {
        return this.inboxService.markAsRead(req.user.tenantId, conversationId);
    }
}
