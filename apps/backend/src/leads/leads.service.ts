import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LeadsService {
    constructor(private prisma: PrismaService) { }

    async getOrigins(tenantId: string, query: {
        period?: 'today' | '7d' | '30d';
        sessionId?: string;
        origin?: 'all' | 'ad' | 'organic';
        state?: string;
        startDate?: string;
        endDate?: string;
    }) {
        const now = new Date();
        let startDate: Date;

        if (query.startDate) {
            startDate = new Date(query.startDate);
        } else {
            switch (query.period) {
                case 'today':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case '7d':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30d':
                default:
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            }
        }

        const endDate = query.endDate ? new Date(query.endDate) : now;

        const where: any = {
            tenantId,
            receivedAt: { gte: startDate, lte: endDate },
        };

        if (query.sessionId) where.sessionId = query.sessionId;
        if (query.origin === 'ad') where.isFromAd = true;
        if (query.origin === 'organic') where.isFromAd = false;
        if (query.state) where.contactState = query.state;

        const leads = await (this.prisma as any).leadOrigin.findMany({
            where,
            orderBy: { receivedAt: 'desc' },
        });

        // Compute stats
        const total = leads.length;
        const fromAd = leads.filter((l: any) => l.isFromAd).length;
        const organic = total - fromAd;

        // State distribution
        const stateCounts: Record<string, number> = {};
        for (const lead of leads) {
            const s = lead.contactState || 'Desconhecido';
            stateCounts[s] = (stateCounts[s] || 0) + 1;
        }
        const stateDistribution = Object.entries(stateCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([state, count]) => ({ state, count, percentage: total > 0 ? Math.round(count / total * 100) : 0 }));

        // Ad title distribution
        const adCounts: Record<string, { count: number; title: string }> = {};
        for (const lead of leads.filter((l: any) => l.isFromAd && l.adTitle)) {
            const key = lead.adTitle;
            if (!adCounts[key]) adCounts[key] = { count: 0, title: key };
            adCounts[key].count++;
        }
        const adDistribution = Object.values(adCounts).sort((a, b) => b.count - a.count);

        // Daily trend (last 30 days buckets)
        const dailyMap: Record<string, { total: number; date: string }> = {};
        for (const lead of leads) {
            const day = lead.receivedAt.toISOString().substring(0, 10);
            if (!dailyMap[day]) dailyMap[day] = { total: 0, date: day };
            dailyMap[day].total++;
        }
        const dailyTrend = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

        // Mask phone for privacy
        const recentLeads = leads.slice(0, 50).map((l: any) => ({
            ...l,
            contactPhone: l.contactPhone
                ? l.contactPhone.replace(/(\d{4})\d+(\d{4})/, '$1****$2')
                : null,
        }));

        return {
            stats: {
                total,
                fromAd,
                organic,
                fromAdPercent: total > 0 ? Math.round(fromAd / total * 100) : 0,
                organicPercent: total > 0 ? Math.round(organic / total * 100) : 0,
                topStates: stateDistribution.slice(0, 3),
            },
            stateDistribution,
            adDistribution,
            dailyTrend,
            recentLeads,
        };
    }

    async getPixelConfig(tenantId: string) {
        const config = await (this.prisma as any).tenantPixelConfig.findUnique({
            where: { tenantId },
        });
        return config || { tenantId, pixelId: null, accessToken: null, testEventCode: null, autoSendLead: false, includeState: true };
    }

    async updatePixelConfig(tenantId: string, dto: {
        pixelId?: string;
        accessToken?: string;
        testEventCode?: string;
        autoSendLead?: boolean;
        includeState?: boolean;
    }) {
        return (this.prisma as any).tenantPixelConfig.upsert({
            where: { tenantId },
            create: { tenantId, ...dto },
            update: dto,
        });
    }
}
