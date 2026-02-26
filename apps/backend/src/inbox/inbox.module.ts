import { Module, forwardRef } from '@nestjs/common';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';
import { PrismaModule } from '../prisma/prisma.service'; // Fix path if needed, usually it's prisma.service but module is PrismaModule
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { ExecutionModule } from '../execution/execution.module';
import { EventBusModule } from '../event-bus/event-bus.module';

@Module({
    imports: [
        PrismaModule,
        forwardRef(() => WhatsappModule),
        ExecutionModule,
        EventBusModule
    ],
    controllers: [InboxController],
    providers: [InboxService],
    exports: [InboxService],
})
export class InboxModule { }
