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

  @Get('trending')
  async trending(
    @Req() req: any,
    @Query('niche') niche?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('minCommission') minCommission?: string,
    @Query('extraCommissionOnly') extraCommissionOnly?: string,
    @Query('sortBy') sortBy?: string,
    @Query('period') period?: string,
  ) {
    const tenantId: string = req.user.tenantId;
    return this.productsService.searchTrendingProducts(tenantId, {
      niche,
      limit: limit ? parseInt(limit, 10) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      minCommission: minCommission ? parseFloat(minCommission) : undefined,
      extraCommissionOnly: extraCommissionOnly === 'true',
      sortBy,
      period,
    });
  }

  @Delete('trending/cache')
  async clearTrendingCache(@Req() req: any) {
    const tenantId: string = req.user.tenantId;
    const deleted = await this.productsService.clearTrendingCache(tenantId);
    return { deleted };
  }

  @Get('videos')
  async videos(
    @Req() req: any,
    @Query('niche') niche?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('minCommission') minCommission?: string,
    @Query('extraCommissionOnly') extraCommissionOnly?: string,
    @Query('sortBy') sortBy?: string,
    @Query('period') period?: string,
    @Query('minSales') minSales?: string,
    @Query('maxAffiliates') maxAffiliates?: string,
    @Query('catId') catId?: string,
  ) {
    const tenantId: string = req.user.tenantId;
    return this.productsService.searchVideoProducts(tenantId, {
      niche,
      limit: limit ? parseInt(limit, 10) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      minCommission: minCommission ? parseFloat(minCommission) : undefined,
      extraCommissionOnly: extraCommissionOnly === 'true',
      sortBy,
      period,
      minSales: minSales ? parseInt(minSales, 10) : undefined,
      maxAffiliates: maxAffiliates ? parseInt(maxAffiliates, 10) : undefined,
      catId: catId ? parseInt(catId, 10) : undefined,
    });
  }

  @Delete('videos/cache')
  async clearVideosCache(@Req() req: any) {
    const tenantId: string = req.user.tenantId;
    const deleted = await this.productsService.clearVideosCache(tenantId);
    return { deleted };
  }
}
