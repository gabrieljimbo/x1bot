import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionEngineService } from './execution-engine.service';
import { WhatsappSenderService } from './whatsapp-sender.service';
import { ContextService } from './context.service';
import { RmktConfig, ExecutionStatus } from '@n9n/shared';

@Processor('rmkt')
@Injectable()
export class RmktProcessor extends WorkerHost {
    private readonly logger = new Logger(RmktProcessor.name);

    constructor(
        private prisma: PrismaService,
        @Inject(forwardRef(() => ExecutionEngineService))
        private executionEngine: ExecutionEngineService,
        private whatsappSender: WhatsappSenderService,
        private contextService: ContextService,
    ) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        const { tenantId, executionId, nodeId, config } = job.data;
        const rmktConfig = config as RmktConfig;

        this.logger.log(`Processing RMKT job for execution ${executionId}, node ${nodeId}`);

        // 1. Get execution and verify status
        const execution = await this.prisma.workflowExecution.findUnique({
            where: { id: executionId },
        });

        if (!execution) {
            this.logger.warn(`Execution ${executionId} not found, skipping job`);
            return;
        }

        // If status is not WAITING, it means it was either cancelled or already finished/errored
        if (execution.status !== ExecutionStatus.WAITING) {
            this.logger.log(`Execution ${executionId} is no longer WAITING (status: ${execution.status}), skipping RMKT`);
            return;
        }

        const context = execution.context as any;

        try {
            // 2. Prepare dynamic variables
            // Find conversation for the contact name
            const conversation = await this.prisma.conversation.findFirst({
                where: {
                    sessionId: execution.sessionId,
                    contactPhone: execution.contactPhone,
                    tenantId: execution.tenantId
                },
            });

            context.variables = context.variables || {};
            context.variables.nome = conversation?.contactName || execution.contactPhone;
            context.variables.telefone = execution.contactPhone;
            context.variables.sessao = execution.sessionId;

            // 3. Send message
            if (rmktConfig.messageType === 'text') {
                const text = this.contextService.interpolate(rmktConfig.text || '', context);

                // Humanization: Show typing for 3-5 seconds
                await this.whatsappSender.sendPresence(execution.sessionId, execution.contactPhone, 'composing');
                await new Promise(resolve => setTimeout(resolve, 3000));

                await this.whatsappSender.sendMessage(execution.sessionId, execution.contactPhone, text);
            } else {
                const mediaUrl = this.contextService.interpolate(rmktConfig.mediaUrl || '', context);
                const caption = rmktConfig.caption ? this.contextService.interpolate(rmktConfig.caption, context) : undefined;

                // Humanization: Show "recording" or "typing" depending on media
                const presence = rmktConfig.messageType === 'audio' ? 'recording' : 'composing';
                await this.whatsappSender.sendPresence(execution.sessionId, execution.contactPhone, presence);
                await new Promise(resolve => setTimeout(resolve, 3000));

                await this.whatsappSender.sendMedia(
                    execution.sessionId,
                    execution.contactPhone,
                    rmktConfig.messageType as any,
                    mediaUrl,
                    {
                        caption,
                        sendAudioAsVoice: rmktConfig.sendAudioAsVoice,
                    },
                );
            }

            // 4. Update status to ENVIADO
            await this.updateRmktStatus(executionId, 'ENVIADO', context);

            // 5. Resume execution
            const workflowData = await this.prisma.workflow.findUnique({
                where: { id: execution.workflowId },
            });

            if (workflowData) {
                const workflow = {
                    ...workflowData,
                    nodes: workflowData.nodes as any,
                    edges: workflowData.edges as any,
                } as any;

                // Move to next node
                const edges = workflow.edges;
                const nextEdge = edges.find((e: any) => e.source === nodeId);

                // Update local object for continueExecution
                const executionToResume = {
                    ...execution,
                    currentNodeId: nextEdge ? nextEdge.target : null,
                    status: ExecutionStatus.RUNNING,
                    context: context,
                };

                await this.executionEngine.continueExecution(executionToResume as any, workflow);
            }
        } catch (error) {
            this.logger.error(`Failed to process RMKT for execution ${executionId}: ${error.message}`);

            // If this was the last attempt, mark as FALHOU
            if (job.attemptsMade + 1 >= (job.opts.attempts || 1)) {
                await this.updateRmktStatus(executionId, 'FALHOU', context);
            }

            throw error; // Re-throw to trigger Bull retry
        }
    }

    private async updateRmktStatus(executionId: string, status: string, context: any) {
        context.variables = context.variables || {};
        context.variables.rmktStatus = status;
        await this.prisma.workflowExecution.update({
            where: { id: executionId },
            data: {
                context: context as any,
            },
        });
    }
}
