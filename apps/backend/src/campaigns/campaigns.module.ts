import { Module, forwardRef } from '@nestjs/common';
import { CampaignsController, ContactListsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { ContactListsService } from './contact-lists.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [forwardRef(() => WhatsappModule)],
  controllers: [CampaignsController, ContactListsController],
  providers: [CampaignsService, ContactListsService],
  exports: [CampaignsService, ContactListsService],
})
export class CampaignsModule {}
