import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import { TenantService } from './tenant.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';

@Controller('api/tenant')
@UseGuards(JwtAuthGuard)
export class TenantMeController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('me')
  getMyTenant(@CurrentUser() user: any) {
    return this.tenantService.findOne(user.tenantId);
  }
}
