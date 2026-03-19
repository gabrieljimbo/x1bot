import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApiConfigsService {
    constructor(private prisma: PrismaService) {}

    async getAll(tenantId: string) {
        return this.prisma.tenantApiConfig.findMany({
            where: { tenantId },
            orderBy: { provider: 'asc' },
            select: { id: true, provider: true, appId: true, isActive: true, createdAt: true, updatedAt: true },
            // never return secret in list
        });
    }

    async getByProvider(tenantId: string, provider: string) {
        return this.prisma.tenantApiConfig.findUnique({
            where: { tenantId_provider: { tenantId, provider } },
        });
    }

    async findByProviderFlexible(tenantId: string, provider: string) {
        // 1. Try exact match first (standard)
        const exact = await this.getByProvider(tenantId, provider);
        if (exact) return exact;

        // 2. Try case-insensitive search or partial match
        const configs = await this.prisma.tenantApiConfig.findMany({
            where: {
                tenantId,
                provider: {
                    contains: provider,
                    mode: 'insensitive',
                },
            },
        });

        // Return the first active one, or just the first one
        return configs.find(c => c.isActive) || configs[0] || null;
    }

    async upsert(tenantId: string, provider: string, appId: string, secret: string) {
        const keepSecret = secret === '__keep__';
        if (keepSecret) {
            // Update only appId, keep existing secret
            return this.prisma.tenantApiConfig.upsert({
                where: { tenantId_provider: { tenantId, provider } },
                update: { appId, isActive: true, updatedAt: new Date() },
                create: { tenantId, provider, appId, secret: '' },
            });
        }
        return this.prisma.tenantApiConfig.upsert({
            where: { tenantId_provider: { tenantId, provider } },
            update: { appId, secret, isActive: true, updatedAt: new Date() },
            create: { tenantId, provider, appId, secret },
        });
    }

    async setActive(tenantId: string, provider: string, isActive: boolean) {
        return this.prisma.tenantApiConfig.update({
            where: { tenantId_provider: { tenantId, provider } },
            data: { isActive },
        });
    }

    async delete(tenantId: string, provider: string) {
        return this.prisma.tenantApiConfig.delete({
            where: { tenantId_provider: { tenantId, provider } },
        });
    }

    async getPushcutNotifications(tenantId: string) {
        const config = await this.getByProvider(tenantId, 'pushcut');
        if (!config || !config.secret || !config.isActive) {
            throw new Error('Pushcut API Key not configured or inactive');
        }

        try {
            const response = await fetch('https://api.pushcut.io/v1/notifications', {
                headers: { 'API-Key': config.secret },
            });

            if (!response.ok) {
                throw new Error(`Pushcut API error: ${response.statusText}`);
            }

            return await response.json();
        } catch (error: any) {
            console.error('[PUSHCUT] Error fetching notifications:', error.message);
            throw error;
        }
    }

    async getPushcutDevices(tenantId: string) {
        const config = await this.getByProvider(tenantId, 'pushcut');
        if (!config || !config.secret || !config.isActive) {
            throw new Error('Pushcut API Key not configured or inactive');
        }

        try {
            const response = await fetch('https://api.pushcut.io/v1/devices', {
                headers: { 'API-Key': config.secret },
            });

            if (!response.ok) {
                throw new Error(`Pushcut API error: ${response.statusText}`);
            }

            return await response.json();
        } catch (error: any) {
            console.error('[PUSHCUT] Error fetching devices:', error.message);
            throw error;
        }
    }

    async getOpenRouterModels(tenantId: string) {
        const config = await this.findByProviderFlexible(tenantId, 'openrouter');
        const apiKey = (config?.isActive && config.secret) ? config.secret : process.env.OPENROUTER_API_KEY;
        
        if (!apiKey) {
            throw new Error('OpenRouter API Key not configured and no global key available');
        }

        try {
            const response = await fetch('https://openrouter.ai/api/v1/models', {
                headers: { 
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://x1bot.cloud',
                    'X-Title': 'X1Bot PIX AI',
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenRouter API error (${response.status}): ${errorText || response.statusText}`);
            }

            const data = await response.json();
            
            // Filter models that support vision (images) or files (PDFs)
            return data.data
                .filter((m: any) => 
                    m.architecture?.modality?.includes('image') || 
                    m.architecture?.modality?.includes('file') ||
                    m.id.includes('vision') ||
                    m.id.includes('gemini') || // Some gemini models don't have modality set correctly but all support vision
                    m.id.includes('gpt-4o')
                )
                .map((m: any) => ({
                    id: m.id,
                    name: m.name,
                    pricing: m.pricing,
                    context_length: m.context_length,
                    description: m.description
                }))
                .sort((a: any, b: any) => {
                    // Feature specific popular models first
                    const priority = ['google/gemini-2.0-flash-001', 'google/gemini-1.5-flash', 'openai/gpt-4o-mini'];
                    const aIdx = priority.indexOf(a.id);
                    const bIdx = priority.indexOf(b.id);
                    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
                    if (aIdx !== -1) return -1;
                    if (bIdx !== -1) return 1;
                    return a.name.localeCompare(b.name);
                });
        } catch (error: any) {
            console.error('[OPENROUTER] Error fetching models:', error.message);
            throw error;
        }
    }
}
