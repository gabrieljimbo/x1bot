import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { EventBusModule } from './event-bus/event-bus.module';
import { AuthModule } from './auth/auth.module';
import { WorkflowModule } from './workflow/workflow.module';
import { ExecutionModule } from './execution/execution.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { WebsocketModule } from './websocket/websocket.module';
import { WorkerModule } from './worker/worker.module';
import { TenantModule } from './tenant/tenant.module';
import { UserModule } from './user/user.module';
import { StorageModule } from './storage/storage.module';
import { InboxModule } from './inbox/inbox.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    RedisModule,
    EventBusModule,
    AuthModule,
    WorkflowModule,
    ExecutionModule,
    WhatsappModule,
    WebsocketModule,
    WorkerModule,
    TenantModule,
    UserModule,
    StorageModule,
    InboxModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule { }

