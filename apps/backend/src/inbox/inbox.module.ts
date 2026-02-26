import { Module } from '@nestjs/common';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { ExecutionModule } from '../execution/execution.module';
import { EventBusModule } from '../event-bus/event-bus.module';

@Module({
    imports: [PrismaModule, WhatsappModule, ExecutionModule, EventBusModule],
    controllers: [InboxController],
    providers: [InboxService],
    exports: [InboxService],
})
export class InboxModule { }
