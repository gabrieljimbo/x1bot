import { Module } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { TenantMeController } from './tenant-me.controller';
import { TenantService } from './tenant.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TenantController, TenantMeController],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}

