import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { RedisService } from '../redis/redis.service';
import { ApiConfigsService } from '../api-configs/api-configs.service';

const CACHE_TTL = 600; // 10 minutes

export interface ProductSearchFilters {
  keyword?: string;
  sortType?: number; // 2=sold desc (default), 1=most recent, 5=price asc, 6=price desc
  page?: number;
  limit?: number;
  minDiscount?: number;
  minRating?: number;
  catId?: number;
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
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly redis: RedisService,
    private readonly apiConfigsService: ApiConfigsService,
  ) {}

  async searchProducts(
    tenantId: string,
    filters: ProductSearchFilters,
  ): Promise<{ products: ShopeeProduct[]; fromCache: boolean; hasNextPage: boolean }> {
    const cacheKey = this.buildCacheKey(tenantId, filters);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return { ...JSON.parse(cached), fromCache: true };
    }

    const apiCreds = await this.apiConfigsService.getByProvider(tenantId, 'shopee');
    if (!apiCreds?.isActive) {
      throw new Error('Credenciais Shopee não configuradas. Acesse Configurações > APIs.');
    }

    const keyword = filters.keyword || '';
    const sortType = filters.sortType ?? 2;
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 30, 100);
    const catArg = filters.catId && filters.catId > 0 ? `, catId: ${filters.catId}` : '';

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

    const result = { products, hasNextPage };
    await this.redis.setWithTTL(cacheKey, JSON.stringify(result), CACHE_TTL);

    return { ...result, fromCache: false };
  }

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
