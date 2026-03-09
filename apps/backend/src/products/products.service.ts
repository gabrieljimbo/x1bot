import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { RedisService } from '../redis/redis.service';
import { ApiConfigsService } from '../api-configs/api-configs.service';
import { PrismaService } from '../prisma/prisma.service';

const CACHE_TTL = 600; // 10 minutes

export interface TrendingFilters {
  niche?: string;
  limit?: number;
  page?: number;
  minCommission?: number;
  extraCommissionOnly?: boolean;
  sortBy?: string;   // 'rank'|'commission'|'affiliates'|'sales'
  period?: string;   // 'today'|'week'|'month'
}

export interface VideoFilters {
  niche?: string;
  limit?: number;
  page?: number;
  minCommission?: number;
  extraCommissionOnly?: boolean;
  sortBy?: string;         // 'opportunity'|'sales'|'commission'|'affiliates'|'price_asc'
  period?: string;         // 'today'|'week'|'month'
  minSales?: number;       // min sales volume filter
  maxAffiliates?: number;  // max affiliate count filter
  catId?: number;          // Shopee category ID
}

export interface ProductSearchFilters {
  keyword?: string;
  sortType?: number; // 2=sold desc (default), 1=most recent, 5=price asc, 6=price desc
  sortBy?: string;   // e.g. 'sales'|'recent'|'price_asc'|'price_desc'|'commission_desc'|'commission_desc+price_asc'|...
  page?: number;
  limit?: number;
  minDiscount?: number;
  minRating?: number;
  catId?: number;
  extraCommissionOnly?: boolean;
}

export interface ShopeeProduct {
  itemId: string;
  productName: string;
  priceMin: string;
  priceMax: string;
  imageUrl: string;
  offerLink: string;
  ratingStar: string;
  priceDiscountRate: string;
  sales: string;
  commissionRate: string;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly redis: RedisService,
    private readonly apiConfigsService: ApiConfigsService,
    private readonly prisma: PrismaService,
  ) { }

  async searchProducts(
    tenantId: string,
    filters: ProductSearchFilters,
  ): Promise<{ products: ShopeeProduct[]; fromCache: boolean; hasNextPage: boolean }> {
    const cacheKey = this.buildCacheKey(tenantId, filters);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return { ...JSON.parse(cached), fromCache: true };
    }

    const apiCreds = await this.apiConfigsService.findByProviderFlexible(tenantId, 'shopee');
    if (!apiCreds?.isActive) {
      throw new Error('Credenciais Shopee não configuradas. Acesse Configurações > APIs.');
    }

    const keyword = filters.keyword || '';
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 30, 100);
    const catArg = filters.catId && filters.catId > 0 ? `, catId: ${filters.catId}` : '';

    // Derive sortType from sortBy string, falling back to legacy sortType field
    let sortType = filters.sortType ?? 2;
    if (filters.sortBy) {
      if (filters.sortBy.includes('price_asc')) sortType = 5;
      else if (filters.sortBy.includes('price_desc')) sortType = 6;
      else if (filters.sortBy.includes('recent')) sortType = 1;
      else sortType = 2;
    }

    const payload = JSON.stringify({
      query: `{
  productOfferV2(keyword: ${JSON.stringify(keyword)}, sortType: ${sortType}, page: ${page}, limit: ${limit}${catArg}) {
    nodes {
      itemId
      productName
      priceMin
      priceMax
      imageUrl
      offerLink
      ratingStar
      priceDiscountRate
      sales
      commissionRate
    }
    pageInfo { hasNextPage }
  }
}`,
    });

    const appId = apiCreds.appId;
    const secret = apiCreds.secret;
    const timestamp = Math.floor(Date.now() / 1000);
    const signatureFactor = `${appId}${timestamp}${payload}${secret}`;
    const signature = createHash('sha256').update(signatureFactor).digest('hex');
    const authHeader = `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;

    const response = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: payload,
    });

    if (!response.ok) {
      throw new Error(`Shopee API error: ${response.status} ${response.statusText}`);
    }

    const json = (await response.json()) as any;
    if (json.errors?.length) {
      throw new Error(`Shopee API: ${json.errors[0].message}`);
    }

    let products: ShopeeProduct[] = json.data?.productOfferV2?.nodes || [];
    const hasNextPage: boolean = json.data?.productOfferV2?.pageInfo?.hasNextPage ?? false;

    // DEBUG: log real available fields from ProductOfferV2 to identify extra commission flag
    if (products.length > 0) {
      console.log('[SHOPEE DEBUG] ProductOfferV2 sample fields:', Object.keys(products[0] || {}));
    }

    // Apply client-side filters
    if (filters.minDiscount && filters.minDiscount > 0) {
      products = products.filter(
        (p) => parseFloat(p.priceDiscountRate || '0') >= filters.minDiscount!,
      );
    }
    if (filters.minRating && filters.minRating > 0) {
      products = products.filter(
        (p) => parseFloat(p.ratingStar || '0') >= filters.minRating!,
      );
    }

    // Extra commission filter (heuristic: commission >= 15% as fallback)
    if (filters.extraCommissionOnly) {
      products = products.filter((p) => {
        const commissionRate = parseFloat(p.commissionRate || '0');
        const isExtraCommission = commissionRate >= 15; // fallback heuristic
        return isExtraCommission;
      });
    }

    // Apply commission sort if requested (secondary sort — Shopee handled primary)
    if (filters.sortBy?.includes('commission_desc')) {
      products.sort(
        (a, b) => parseFloat(b.commissionRate || '0') - parseFloat(a.commissionRate || '0'),
      );
    }

    const result = { products, hasNextPage };
    await this.redis.setWithTTL(cacheKey, JSON.stringify(result), CACHE_TTL);

    return { ...result, fromCache: false };
  }

  // ─── Trending ────────────────────────────────────────────────────────────

  async searchTrendingProducts(
    tenantId: string,
    filters: TrendingFilters,
  ): Promise<{ products: any[]; fromCache: boolean }> {
    const period = filters.period || 'today';
    const periodTtl: Record<string, number> = { today: 3600, week: 21600, month: 43200 };
    const ttl = periodTtl[period] ?? 3600;
    const cacheKey = `products:trending:${tenantId}:${filters.niche || '_'}:${period}:${filters.page || 1}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return { ...JSON.parse(cached), fromCache: true };

    const apiCreds = await this.apiConfigsService.findByProviderFlexible(tenantId, 'shopee');
    if (!apiCreds?.isActive) throw new Error('Credenciais Shopee não configuradas.');

    const keyword = filters.niche || '';
    const limit = Math.min(filters.limit ?? 30, 100);
    const page = filters.page ?? 1;

    const payload = JSON.stringify({
      query: `{
  productOfferV2(keyword: ${JSON.stringify(keyword)}, sortType: 2, page: ${page}, limit: ${limit}) {
    nodes {
      itemId productName priceMin priceMax imageUrl offerLink
      ratingStar priceDiscountRate sales commissionRate
      affiliateCount commissionPerSale
    }
  }
}`,
    });

    const appId = apiCreds.appId;
    const secret = apiCreds.secret;
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHash('sha256').update(`${appId}${timestamp}${payload}${secret}`).digest('hex');
    const authHeader = `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;

    const response = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: payload,
    });
    if (!response.ok) throw new Error(`Shopee API error: ${response.status}`);
    const json = (await response.json()) as any;
    if (json.errors?.length) throw new Error(`Shopee API: ${json.errors[0].message}`);

    const nodes: any[] = json.data?.productOfferV2?.nodes || [];

    // Map nodes → trending products with rankPosition + trend
    const trendingRaw = await Promise.all(
      nodes.map(async (p: any, idx: number) => {
        const commissionRaw = parseFloat(p.commissionRate || '0');
        const commission = commissionRaw < 1 ? commissionRaw * 100 : commissionRaw;
        const price = parseFloat(p.priceMin || '0');
        const commissionPerSale = p.commissionPerSale ? parseFloat(p.commissionPerSale) : (price * commission / 100);
        const discount = parseFloat(p.priceDiscountRate || '0');
        const originalPrice = discount > 0 && discount < 100 ? String(price / (1 - discount / 100)) : null;

        const rankResult = await this.calculateTrend(tenantId, String(p.itemId), 'shopee', keyword, idx + 1);

        return {
          itemId: String(p.itemId),
          title: p.productName,
          price: p.priceMin,
          originalPrice,
          discount,
          imageUrl: p.imageUrl,
          productUrl: p.offerLink,
          commissionRate: commission,
          commissionPerSale,
          isExtraCommission: commission >= 15, // fallback heuristic
          affiliateCount: p.affiliateCount ? parseInt(p.affiliateCount, 10) : 0,
          salesVolume: p.sales,
          rating: parseFloat(p.ratingStar || '0'),
          rankPosition: idx + 1,
          previousPosition: rankResult.previousPosition,
          positionChange: rankResult.positionChange,
          trend: rankResult.trend,
        };
      }),
    );

    // Apply client-side filters
    let products = trendingRaw;
    if (filters.minCommission && filters.minCommission > 0)
      products = products.filter(p => p.commissionRate >= filters.minCommission!);
    if (filters.extraCommissionOnly)
      products = products.filter(p => p.isExtraCommission);

    // Apply sort
    if (filters.sortBy === 'commission') products.sort((a, b) => b.commissionRate - a.commissionRate);
    else if (filters.sortBy === 'affiliates') products.sort((a, b) => b.affiliateCount - a.affiliateCount);
    else if (filters.sortBy === 'sales') products.sort((a, b) => parseInt(b.salesVolume || '0', 10) - parseInt(a.salesVolume || '0', 10));
    // default: rank order (already sorted by rankPosition)

    const result = { products };
    await this.redis.setWithTTL(cacheKey, JSON.stringify(result), ttl);
    return { ...result, fromCache: false };
  }

  async calculateTrend(
    tenantId: string,
    productId: string,
    source: string,
    niche: string,
    currentPosition: number,
  ): Promise<{ trend: 'rising' | 'stable' | 'falling'; previousPosition: number | null; positionChange: number }> {
    try {
      const previous = await this.prisma.productRanking.findFirst({
        where: {
          tenantId,
          productId,
          source,
          niche,
          recordedAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
        },
        orderBy: { recordedAt: 'desc' },
      });

      await this.prisma.productRanking.create({
        data: { tenantId, productId, source, niche, position: currentPosition },
      });

      // Prune history older than 7 days
      await this.prisma.productRanking.deleteMany({
        where: { tenantId, productId, recordedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      });

      if (!previous) return { trend: 'stable', previousPosition: null, positionChange: 0 };

      const change = previous.position - currentPosition;
      return {
        trend: change > 0 ? 'rising' : change < 0 ? 'falling' : 'stable',
        previousPosition: previous.position,
        positionChange: Math.abs(change),
      };
    } catch {
      return { trend: 'stable', previousPosition: null, positionChange: 0 };
    }
  }

  async clearTrendingCache(tenantId: string): Promise<number> {
    const pattern = `products:trending:${tenantId}:*`;
    const client = this.redis.getClient();
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [next, batch] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next; keys.push(...batch);
    } while (cursor !== '0');
    if (keys.length > 0) await client.del(...keys);
    return keys.length;
  }

  // ─── Videos ──────────────────────────────────────────────────────────────

  async searchVideoProducts(
    tenantId: string,
    filters: VideoFilters,
  ): Promise<{ products: any[]; fromCache: boolean }> {
    const period = filters.period || 'today';
    const periodTtl: Record<string, number> = { today: 3600, week: 21600, month: 43200 };
    const ttl = periodTtl[period] ?? 3600;
    const cacheKey = `products:videos:${tenantId}:${filters.niche || '_'}:${period}:${filters.catId || '0'}:${filters.page || 1}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return { ...JSON.parse(cached), fromCache: true };

    const apiCreds = await this.apiConfigsService.findByProviderFlexible(tenantId, 'shopee');
    if (!apiCreds?.isActive) throw new Error('Credenciais Shopee não configuradas.');

    const keyword = filters.niche || '';
    const limit = Math.min(filters.limit ?? 30, 100);
    const page = filters.page ?? 1;
    const catArg = filters.catId && filters.catId > 0 ? `, catId: ${filters.catId}` : '';

    const payload = JSON.stringify({
      query: `{
  productOfferV2(keyword: ${JSON.stringify(keyword)}, sortType: 2, page: ${page}, limit: ${limit}${catArg}) {
    nodes {
      itemId productName priceMin priceMax imageUrl offerLink
      ratingStar priceDiscountRate sales commissionRate
      affiliateCount videoCount
    }
  }
}`,
    });

    const appId = apiCreds.appId;
    const secret = apiCreds.secret;
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHash('sha256').update(`${appId}${timestamp}${payload}${secret}`).digest('hex');
    const authHeader = `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;

    const response = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: payload,
    });
    if (!response.ok) throw new Error(`Shopee API error: ${response.status}`);
    const json = (await response.json()) as any;
    if (json.errors?.length) throw new Error(`Shopee API: ${json.errors[0].message}`);

    const nodes: any[] = json.data?.productOfferV2?.nodes || [];

    const mapped = nodes.map((p: any) => {
      const commissionRaw = parseFloat(p.commissionRate || '0');
      const commission = commissionRaw < 1 ? commissionRaw * 100 : commissionRaw;
      const price = parseFloat(p.priceMin || '0');
      const commissionPerSale = p.commissionPerSale ? parseFloat(p.commissionPerSale) : (price * commission / 100);
      const discount = parseFloat(p.priceDiscountRate || '0');
      const originalPrice = discount > 0 && discount < 100 ? String(price / (1 - discount / 100)) : null;
      const salesVolume = parseInt(p.sales || '0', 10);
      const affiliateCount = p.affiliateCount ? parseInt(p.affiliateCount, 10) : 0;

      // Opportunity score: high sales / few affiliates = good opportunity
      const ratio = salesVolume / (affiliateCount + 1);
      const opportunityScore: 'alta' | 'media' | 'baixa' = ratio > 50 ? 'alta' : ratio > 10 ? 'media' : 'baixa';

      return {
        itemId: String(p.itemId),
        title: p.productName,
        price: p.priceMin,
        originalPrice,
        discount,
        imageUrl: p.imageUrl,
        productUrl: p.offerLink,
        commissionRate: commission,
        commissionPerSale,
        isExtraCommission: commission >= 15, // fallback heuristic
        affiliateCount,
        salesVolume,
        videoCount: p.videoCount ? parseInt(p.videoCount, 10) : 0,
        opportunityScore,
        creatorVideos: [],
      };
    });

    let products = mapped;
    if (filters.minCommission && filters.minCommission > 0)
      products = products.filter(p => p.commissionRate >= filters.minCommission!);
    if (filters.extraCommissionOnly)
      products = products.filter(p => p.isExtraCommission);
    if (filters.minSales && filters.minSales > 0)
      products = products.filter(p => p.salesVolume >= filters.minSales!);
    if (filters.maxAffiliates && filters.maxAffiliates > 0)
      products = products.filter(p => p.affiliateCount <= filters.maxAffiliates!);

    const oppOrder: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
    if (!filters.sortBy || filters.sortBy === 'opportunity')
      products.sort((a, b) => oppOrder[a.opportunityScore] - oppOrder[b.opportunityScore]);
    else if (filters.sortBy === 'sales') products.sort((a, b) => b.salesVolume - a.salesVolume);
    else if (filters.sortBy === 'commission') products.sort((a, b) => b.commissionRate - a.commissionRate);
    else if (filters.sortBy === 'affiliates') products.sort((a, b) => a.affiliateCount - b.affiliateCount); // fewer = better
    else if (filters.sortBy === 'price_asc') products.sort((a, b) => parseFloat(a.price || '0') - parseFloat(b.price || '0'));

    const result = { products };
    await this.redis.setWithTTL(cacheKey, JSON.stringify(result), ttl);
    return { ...result, fromCache: false };
  }

  async clearVideosCache(tenantId: string): Promise<number> {
    const pattern = `products:videos:${tenantId}:*`;
    const client = this.redis.getClient();
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [next, batch] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next; keys.push(...batch);
    } while (cursor !== '0');
    if (keys.length > 0) await client.del(...keys);
    return keys.length;
  }

  // ─── Cache (regular search) ───────────────────────────────────────────────

  async clearCache(tenantId: string): Promise<number> {
    const pattern = `products:search:${tenantId}:*`;
    const client = this.redis.getClient();
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, batch] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    if (keys.length > 0) {
      await client.del(...keys);
    }
    return keys.length;
  }

  private buildCacheKey(tenantId: string, filters: ProductSearchFilters): string {
    const filterStr = JSON.stringify(filters);
    const hash = createHash('md5').update(filterStr).digest('hex');
    return `products:search:${tenantId}:${hash}`;
  }
}
