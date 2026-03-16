import { Module, forwardRef } from '@nestjs/common';
import { CampaignsController, ContactListsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { ContactListsService } from './contact-lists.service';
import { ContactReputationService } from './contact-reputation.service';
import { CampaignSettingsService } from './campaign-settings.service';
import { QueueDiagnosticService } from './queue-diagnostic.service';
import { EmergencyModeService } from './emergency-mode.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [forwardRef(() => WhatsappModule), StorageModule],
  controllers: [CampaignsController, ContactListsController],
  providers: [CampaignsService, ContactListsService, ContactReputationService, CampaignSettingsService, QueueDiagnosticService, EmergencyModeService],
  exports: [CampaignsService, ContactListsService, ContactReputationService, CampaignSettingsService, QueueDiagnosticService, EmergencyModeService],
})
// Note: SessionHealthMonitorService is provided by WhatsappModule (exported) — available via injection
export class CampaignsModule {}
