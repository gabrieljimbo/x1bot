import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CampaignProtectionSettings {
  autoBlacklistOptOut: boolean;
  autoBlacklistBadNumbers: boolean;
  exposureLimitsEnabled: boolean;
  reputationQuarantineEnabled: boolean;
  sessionHealthFilterEnabled: boolean;
  timingOptimizationEnabled: boolean;
}

const DEFAULTS: CampaignProtectionSettings = {
  autoBlacklistOptOut: true,
  autoBlacklistBadNumbers: true,
  exposureLimitsEnabled: true,
  reputationQuarantineEnabled: true,
  sessionHealthFilterEnabled: true,
  timingOptimizationEnabled: false,
};

@Injectable()
export class CampaignSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(tenantId: string): Promise<CampaignProtectionSettings> {
    const record = await this.prisma.campaignSettings.findUnique({
      where: { tenantId },
    });
    if (!record) return { ...DEFAULTS };
    return {
      autoBlacklistOptOut: record.autoBlacklistOptOut,
      autoBlacklistBadNumbers: record.autoBlacklistBadNumbers,
      exposureLimitsEnabled: record.exposureLimitsEnabled,
      reputationQuarantineEnabled: record.reputationQuarantineEnabled,
      sessionHealthFilterEnabled: record.sessionHealthFilterEnabled,
      timingOptimizationEnabled: record.timingOptimizationEnabled,
    };
  }

  async updateSettings(
    tenantId: string,
    updates: Partial<CampaignProtectionSettings>,
  ): Promise<CampaignProtectionSettings> {
    const record = await this.prisma.campaignSettings.upsert({
      where: { tenantId },
      update: updates,
      create: { tenantId, ...DEFAULTS, ...updates },
    });
    return {
      autoBlacklistOptOut: record.autoBlacklistOptOut,
      autoBlacklistBadNumbers: record.autoBlacklistBadNumbers,
      exposureLimitsEnabled: record.exposureLimitsEnabled,
      reputationQuarantineEnabled: record.reputationQuarantineEnabled,
      sessionHealthFilterEnabled: record.sessionHealthFilterEnabled,
      timingOptimizationEnabled: record.timingOptimizationEnabled,
    };
  }
}
