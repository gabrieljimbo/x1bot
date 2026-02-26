import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { WhatsappSessionManager } from '../whatsapp/whatsapp-session-manager.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { ExecutionService } from '../execution/execution.service';
import { ExecutionEngineService } from '../execution/execution-engine.service';
import { EventType } from '@n9n/shared';
// We assume we cast the Prisma Enums or matching @n9n/shared enums.
// The Prisma schemas use String for statuses or Enums. Let's use the Prisma generated enum format.
import { ConversationStatus as PrismaConvStatus, MessageStatus as PrismaMsgStatus, Conversation, Message } from '@prisma/client';

export interface GetConversationsOptions {
    sessionId?: string;
    status?: PrismaConvStatus;
    label?: string;
    type?: 'individual' | 'group';
    page: number;
    limit: number;
}

@Injectable()
export class InboxService {
    constructor(
        private prisma: PrismaService,
        private whatsappService: WhatsappService,
        @Inject(forwardRef(() => WhatsappSessionManager))
        private whatsappSessionManager: WhatsappSessionManager,
        private eventBus: EventBusService,
        private executionService: ExecutionService,
        private executionEngine: ExecutionEngineService,
    ) { }

    async getInboxStats(tenantId: string) {
        const [totalUnread, openCount, pendingCount] = await Promise.all([
            this.prisma.conversation.aggregate({
                where: { tenantId, unreadCount: { gt: 0 } },
                _sum: { unreadCount: true }
            }),
            this.prisma.conversation.count({ where: { tenantId, status: PrismaConvStatus.OPEN } }),
            this.prisma.conversation.count({ where: { tenantId, status: PrismaConvStatus.PENDING } }),
        ]);

        return {
            totalUnread: totalUnread._sum.unreadCount || 0,
            openCount,
            pendingCount
        };
    }

    async getConversations(tenantId: string, filters: GetConversationsOptions) {
        const { sessionId, status, label, type, page, limit } = filters;

        // Build where clause
        const where: any = { tenantId };
        if (sessionId) where.sessionId = sessionId;
        if (status) where.status = status;
        if (type === 'group') where.isGroup = true;
        if (type === 'individual') where.isGroup = false;
        if (label) where.labels = { has: label };

        const skip = (page - 1) * limit;

        const [conversations, total] = await Promise.all([
            this.prisma.conversation.findMany({
                where,
                include: {
                    session: { select: { name: true } },
                },
                orderBy: { lastMessageAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.conversation.count({ where }),
        ]);

        return {
            data: conversations,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async getConversation(tenantId: string, id: string) {
        const conversation = await this.prisma.conversation.findFirst({
            where: { id, tenantId },
            include: {
                session: { select: { name: true } },
            },
        });

        if (!conversation) {
            throw new NotFoundException('Conversation not found');
        }

        return conversation;
    }

    async getMessages(tenantId: string, conversationId: string, options: { cursor?: string; limit: number }) {
        // Verify conversation belongs to tenant
        await this.getConversation(tenantId, conversationId);

        const findOptions: any = {
            where: { conversationId },
            take: options.limit,
            orderBy: { timestamp: 'desc' }, // Fetch newest first to paginate backwards
        };

        if (options.cursor) {
            findOptions.take = options.limit + 1; // +1 to know if there are more
            findOptions.cursor = { id: options.cursor };
            findOptions.skip = 1; // Skip the cursor itself
        }

        const messages = await this.prisma.message.findMany(findOptions);

        let nextCursor: typeof options.cursor | undefined = undefined;
        if (messages.length > options.limit) {
            const nextItem = messages.pop();
            nextCursor = nextItem!.id;
        }

        // Return messages in chronological order (oldest to newest) for the UI
        return {
            data: messages.reverse(),
            nextCursor,
        };
    }

    async sendMessage(tenantId: string, conversationId: string, body: { text?: string; mediaUrl?: string; mediaType?: 'image' | 'video' | 'audio' | 'document' }) {
        const conversation = await this.getConversation(tenantId, conversationId);

        if (body.mediaUrl && body.mediaType) {
            await this.whatsappSessionManager.sendMedia(
                conversation.sessionId,
                conversation.contactPhone,
                body.mediaType,
                body.mediaUrl,
                { caption: body.text, bypassDelay: true }
            );
        } else if (body.text) {
            await this.whatsappSessionManager.sendMessage(
                conversation.sessionId,
                conversation.contactPhone,
                body.text,
                true
            );
        } else {
            throw new Error('Message content or media required');
        }

        const newMessage = await this.prisma.message.create({
            data: {
                conversationId,
                content: body.text || '',
                mediaUrl: body.mediaUrl,
                mediaType: body.mediaType,
                fromMe: true,
                timestamp: new Date(),
                status: PrismaMsgStatus.SENT,
            },
        });

        await this.prisma.conversation.update({
            where: { id: conversationId },
            data: {
                lastMessage: body.text || (body.mediaType ? `[${body.mediaType}]` : ''),
                lastMessageAt: new Date(),
                // Sending manual message interrupts any bot workflow usually
                status: PrismaConvStatus.OPEN,
            },
        });

        // Broadcast update
        await this.eventBus.emit({
            type: 'inbox:conversation-updated' as any,
            tenantId,
            conversationId: conversation.id,
            timestamp: new Date(),
        } as any);

        return newMessage;
    }

    async triggerFlow(tenantId: string, conversationId: string, workflowId: string) {
        const conversation = await this.getConversation(tenantId, conversationId);

        const workflow = await this.prisma.workflow.findFirst({
            where: { id: workflowId, tenantId, isActive: true },
        });

        if (!workflow) throw new NotFoundException('Active workflow not found');

        // Cancel existing active executions
        const activeExecution = await this.executionService.getActiveExecution(
            tenantId,
            conversation.sessionId,
            conversation.contactPhone,
        );

        if (activeExecution) {
            // @ts-ignore - Some versions might omit the reason parameter or require just execution
            await this.executionEngine.expireExecution({ ...activeExecution, currentNodeId: null });
        }

        // Create a normalized payload mimicking an initial trigger event
        const mockPayload = {
            messageId: `manual-${Date.now()}`,
            from: conversation.contactPhone,
            fromMe: false,
            type: 'text',
            text: '/iniciar_manual',
            timestamp: Date.now(),
            media: null,
        };

        const execution = await this.executionService.createExecution(
            tenantId,
            workflowId,
            conversation.sessionId,
            conversation.contactPhone,
            { variables: {}, input: mockPayload }
        );

        // Start asynchronously
        this.executionEngine.startExecution(
            tenantId,
            workflowId,
            conversation.sessionId,
            conversation.contactPhone,
            mockPayload.text,
            mockPayload
        );

        await this.prisma.conversation.update({
            where: { id: conversationId },
            data: {
                status: PrismaConvStatus.BOT,
                activeFlowId: workflowId,
            },
        });

        await this.eventBus.emit({
            type: 'inbox:conversation-updated' as any,
            tenantId,
            conversationId: conversation.id,
            timestamp: new Date(),
        } as any);

        return { success: true };
    }

    async updateStatus(tenantId: string, conversationId: string, status: PrismaConvStatus) {
        const conversation = await this.prisma.conversation.updateMany({
            where: { id: conversationId, tenantId },
            data: { status },
        });

        if (conversation.count === 0) throw new NotFoundException();

        await this.eventBus.emit({
            type: 'inbox:conversation-updated' as any,
            tenantId,
            conversationId,
            timestamp: new Date(),
        } as any);

        return { success: true };
    }

    async markAsRead(tenantId: string, conversationId: string) {
        const res = await this.prisma.conversation.updateMany({
            where: { id: conversationId, tenantId },
            data: { unreadCount: 0 },
        });

        if (res.count === 0) throw new NotFoundException();

        await this.eventBus.emit({
            type: 'inbox:conversation-updated' as any,
            tenantId,
            conversationId,
            timestamp: new Date(),
        } as any);

        return { success: true };
    }

    async upsertConversation(tenantId: string, sessionId: string, contactPhone: string, data: Partial<Conversation>) {
        const isGroup = contactPhone.endsWith('@g.us');

        const conversation = await this.prisma.conversation.upsert({
            where: {
                sessionId_contactPhone: {
                    sessionId,
                    contactPhone,
                },
            },
            update: {
                ...data,
                tenantId,
            },
            create: {
                tenantId,
                sessionId,
                contactPhone,
                phoneNumber: contactPhone.split('@')[0],
                isGroup,
                status: PrismaConvStatus.OPEN,
                ...data,
            },
        });

        await this.eventBus.emit({
            type: 'inbox:conversation-updated' as any,
            tenantId,
            conversationId: conversation.id,
            timestamp: new Date(),
        } as any);

        return conversation;
    }

    async saveMessage(conversationId: string, data: Partial<Message>) {
        const conversation = await this.prisma.conversation.findUnique({
            where: { id: conversationId },
            select: { tenantId: true }
        });

        if (!conversation) throw new NotFoundException('Conversation not found');

        const message = await this.prisma.message.create({
            data: {
                conversationId,
                content: data.content || '',
                mediaUrl: data.mediaUrl,
                mediaType: data.mediaType,
                fromMe: data.fromMe ?? false,
                timestamp: data.timestamp || new Date(),
                status: data.status || PrismaMsgStatus.SENT,
            },
        });

        await this.eventBus.emit({
            type: 'inbox:message-received' as any,
            tenantId: conversation.tenantId,
            conversationId,
            timestamp: new Date(),
        } as any);

        return message;
    }
}
