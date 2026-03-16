import { Controller, Post, Delete, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PushNotificationService } from './push-notification.service';

@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly pushService: PushNotificationService) {}

  @Post('subscribe')
  subscribe(
    @Request() req: any,
    @Body() body: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    return this.pushService.subscribe(req.user.tenantId, req.user.id ?? req.user.userId, body);
  }

  @Delete('unsubscribe')
  unsubscribe(@Request() req: any, @Body() body: { endpoint: string }) {
    return this.pushService.unsubscribe(req.user.tenantId, body.endpoint);
  }
}
