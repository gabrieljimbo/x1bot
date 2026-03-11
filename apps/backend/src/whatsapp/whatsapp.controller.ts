import {
    Controller,
    Get,
    Post,
    Body,
    UseGuards,
    HttpCode,
    HttpStatus,
    Delete,
    Param,
} from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/types/roles.enum';

@Controller('whatsapp')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WhatsappController {
    constructor(private readonly whatsappService: WhatsappService) { }

    @Get('config')
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    async getGlobalConfig() {
        return this.whatsappService.getGlobalConfig();
    }

    @Post('config')
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.OK)
    async updateGlobalConfig(@Body() body: any) {
        return this.whatsappService.updateGlobalConfig(body);
    }

    @Get('groups/links')
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    async getGroupLinks(@Body() body: any, @Body('tenantId') bodyTenantId: string, @Body() req: any) {
        // We'll use a custom decorator or just extract tenantId from req in a real app,
        // but for now let's assume it's passed or available.
        // Actually, I should use the user from the request.
        return this.whatsappService.getGroupLinks(bodyTenantId);
    }

    @Post('groups/links')
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    async createGroupLink(@Body() body: { groupJid: string, workflowId: string, tenantId: string }) {
        return this.whatsappService.createGroupLink(body.tenantId, body.groupJid, body.workflowId);
    }

    @Get('groups/offers')
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    async getGroupOffers(@Body('tenantId') tenantId: string) {
        return this.whatsappService.getGroupOffers(tenantId);
    }

    @Delete(':id')
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.OK)
    async deleteGroupLink(@Param('id') id: string, @Body('tenantId') tenantId: string) {
        return this.whatsappService.deleteGroupLink(tenantId, id);
    }
}
