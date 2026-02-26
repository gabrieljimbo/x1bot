import {
    Controller,
    Get,
    Post,
    Body,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/types/roles.enum';

@Controller('api/whatsapp')
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
}
