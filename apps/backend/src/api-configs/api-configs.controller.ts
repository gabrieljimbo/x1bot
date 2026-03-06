import { Controller, Get, Post, Delete, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiConfigsService } from './api-configs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/api-configs')
@UseGuards(JwtAuthGuard)
export class ApiConfigsController {
    constructor(private service: ApiConfigsService) {}

    /** List all configured providers (secrets omitted) */
    @Get()
    getAll(@Request() req: any) {
        return this.service.getAll(req.user.tenantId);
    }

    /** Get config for a specific provider (with secret) — for internal use / testing */
    @Get(':provider')
    getByProvider(@Request() req: any, @Param('provider') provider: string) {
        return this.service.getByProvider(req.user.tenantId, provider);
    }

    /** Create or update credentials for a provider */
    @Post(':provider')
    upsert(
        @Request() req: any,
        @Param('provider') provider: string,
        @Body() body: { appId: string; secret: string },
    ) {
        return this.service.upsert(req.user.tenantId, provider, body.appId, body.secret);
    }

    /** Enable/disable a provider */
    @Patch(':provider/active')
    setActive(
        @Request() req: any,
        @Param('provider') provider: string,
        @Body() body: { isActive: boolean },
    ) {
        return this.service.setActive(req.user.tenantId, provider, body.isActive);
    }

    /** Remove credentials for a provider */
    @Delete(':provider')
    delete(@Request() req: any, @Param('provider') provider: string) {
        return this.service.delete(req.user.tenantId, provider);
    }
}
