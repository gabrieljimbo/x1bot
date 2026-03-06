import { Controller, Post, Get } from '@nestjs/common';
import { MlOffersService } from './ml-offers.service';

@Controller('api/ml-offers')
export class MlOffersController {
    constructor(private readonly mlOffersService: MlOffersService) { }

    @Post('refresh')
    async refresh() {
        this.mlOffersService.refreshDailyOffers(); // sem await, roda em background
        return { message: 'Scraping iniciado em background' };
    }

    @Get('stats')
    async stats() {
        return this.mlOffersService.getCacheStats();
    }
}
