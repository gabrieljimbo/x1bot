import { Controller, Get, Delete, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProductsService } from './products.service';


@Controller('api/products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('search')
  async search(
    @Req() req: any,
    @Query('keyword') keyword?: string,
    @Query('sortType') sortType?: string,
    @Query('sortBy') sortBy?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('minDiscount') minDiscount?: string,
    @Query('minRating') minRating?: string,
    @Query('catId') catId?: string,
    @Query('extraCommissionOnly') extraCommissionOnly?: string,
  ) {
    const tenantId: string = req.user.tenantId;
    return this.productsService.searchProducts(tenantId, {
      keyword,
      sortType: sortType ? parseInt(sortType, 10) : undefined,
      sortBy,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      minDiscount: minDiscount ? parseFloat(minDiscount) : undefined,
      minRating: minRating ? parseFloat(minRating) : undefined,
      catId: catId ? parseInt(catId, 10) : undefined,
      extraCommissionOnly: extraCommissionOnly === 'true',
    });
  }

  @Delete('cache')
  async clearCache(@Req() req: any) {
    const tenantId: string = req.user.tenantId;
    const deleted = await this.productsService.clearCache(tenantId);
    return { deleted };
  }
}
