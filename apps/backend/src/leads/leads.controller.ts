import { Controller, Get, Patch, Body, Query, UseGuards, Request } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
    constructor(private leadsService: LeadsService) { }

    @Get('origins')
    async getOrigins(
        @Request() req: any,
        @Query('period') period?: 'today' | '7d' | '30d',
        @Query('sessionId') sessionId?: string,
        @Query('origin') origin?: 'all' | 'ad' | 'organic',
        @Query('state') state?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.leadsService.getOrigins(req.user.tenantId, {
            period: period || '30d',
            sessionId,
            origin,
            state,
            startDate,
            endDate,
        });
    }

    @Get('pixel-config')
    async getPixelConfig(@Request() req: any) {
        return this.leadsService.getPixelConfig(req.user.tenantId);
    }

    @Patch('pixel-config')
    async updatePixelConfig(
        @Request() req: any,
        @Body() dto: {
            pixelId?: string;
            accessToken?: string;
            testEventCode?: string;
            autoSendLead?: boolean;
            includeState?: boolean;
        },
    ) {
        return this.leadsService.updatePixelConfig(req.user.tenantId, dto);
    }
}
