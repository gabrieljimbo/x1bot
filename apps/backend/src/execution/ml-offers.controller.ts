import { Controller, Post, Get } from '@nestjs/common';
import { MlOffersService } from './ml-offers.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('ml-offers')
export class MlOffersController {
    constructor(private readonly mlOffersService: MlOffersService) { }

    @Public()
    @Post('refresh')
    async refresh() {
        await this.mlOffersService.refreshDailyOffers();
        return { message: 'Scraping concluído' };
    }

    @Public()
    @Get('stats')
    async stats() {
        return this.mlOffersService.getCacheStats();
    }
}
