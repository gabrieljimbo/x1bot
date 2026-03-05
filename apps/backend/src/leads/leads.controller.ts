import { Controller, Get, Post, Put, Delete, Patch, Body, Query, UseGuards, Request, Param } from '@nestjs/common';
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

    @Get('pixels')
    async findAllPixels(@Request() req: any) {
        return this.leadsService.findAllPixels(req.user.tenantId);
    }

    @Post('pixels')
    async createPixel(@Request() req: any, @Body() dto: any) {
        return this.leadsService.createPixel(req.user.tenantId, dto);
    }

    @Put('pixels/:id')
    async updatePixel(
        @Request() req: any,
        @Param('id') id: string,
        @Body() dto: any,
    ) {
        return this.leadsService.updatePixel(req.user.tenantId, id, dto);
    }

    @Delete('pixels/:id')
    async deletePixel(@Request() req: any, @Param('id') id: string) {
        return this.leadsService.deletePixel(req.user.tenantId, id);
    }

    @Patch('pixels/:id/default')
    async setDefaultPixel(@Request() req: any, @Param('id') id: string) {
        return this.leadsService.setDefaultPixel(req.user.tenantId, id);
    }

    @Get('pixel-config')
    async getPixelConfig(@Request() req: any) {
        // Compatibility endpoint, returns default pixel
        return this.leadsService.getDefaultPixel(req.user.tenantId);
    }
}
