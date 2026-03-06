import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MlOffersService {
    private readonly logger = new Logger(MlOffersService.name);
    private isScraping = false;

    constructor(private prisma: PrismaService) { }

    @Cron('0 2 * * *')
    async refreshDailyOffers() {
        if (this.isScraping) {
            this.logger.warn('[ML_OFFERS] Scraping já em andamento, ignorando.');
            return;
        }

        this.isScraping = true;
        this.logger.log('[ML_OFFERS] Iniciando scraping das ofertas do dia...');

        try {
            const browserlessUrl = process.env.BROWSERLESS_URL || 'http://browserless:3000';
            const browserlessToken = process.env.BROWSERLESS_TOKEN || 'x1bot_browserless_token';

            const allProducts: any[] = [];
            const totalPages = 13;

            for (let page = 1; page <= totalPages; page++) {
                try {
                    this.logger.log(`[ML_OFFERS] Scraping página ${page}/${totalPages}...`);

                    const fnCode = `
export default async function ({ page }) {
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1366, height: 768 });
  await page.goto("https://www.mercadolivre.com.br/ofertas?page=${page}", { waitUntil: "domcontentloaded", timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));

  const results = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll("[class*='poly-card']"));
    return items.map(item => {
      const title = item.querySelector(".poly-component__title")?.textContent?.trim();
      const link = item.querySelector("a.poly-component__title")?.href;
      const img = item.querySelector("img.poly-component__picture")?.src;
      const seller = item.querySelector(".poly-component__seller")?.textContent?.replace(/por\\s+/i, '')?.trim();
      const rating = item.querySelector(".poly-reviews__rating")?.textContent?.trim();
      const reviews = item.querySelector(".poly-reviews__total")?.textContent?.replace(/\\D/g, '')?.trim();
      const fractions = item.querySelectorAll("[class*='andes-money-amount__fraction']");
      const price = fractions[0] ? parseFloat(fractions[0].textContent.replace(/\\D/g, '')) : 0;
      const discountBadge = item.querySelector("[class*='andes-badge']")?.textContent?.trim();
      const discountMatch = discountBadge ? discountBadge.match(/(\\d+)\\s*%/) : null;
      const discountFromBadge = discountMatch ? parseInt(discountMatch[1]) : 0;
      const oldPriceEl = item.querySelector("[class*='andes-money-amount--previous'] [class*='andes-money-amount__fraction']");
      const originalPrice = oldPriceEl ? parseFloat(oldPriceEl.textContent.replace(/\\D/g, '')) : price;
      const discountFromPrice = originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
      const discount = Math.max(discountFromBadge, discountFromPrice);
      return { title, productUrl: link, imageUrl: img, seller, rating: rating ? parseFloat(rating) : 0, reviewCount: reviews ? parseInt(reviews) : 0, price, originalPrice, discount };
    }).filter(p => p.title && p.productUrl && p.price > 0);
  });

  return { data: results, type: "application/json" };
}
`;

                    const response = await fetch(`${browserlessUrl}/function?token=${browserlessToken}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/javascript' },
                        body: fnCode,
                    });

                    if (!response.ok) throw new Error(`Browserless error: ${response.statusText}`);

                    const result = await response.json() as any;
                    const products = Array.isArray(result) ? result : (result.data || []);
                    allProducts.push(...products);

                    this.logger.log(`[ML_OFFERS] Página ${page}: ${products.length} produtos`);

                    await new Promise(r => setTimeout(r, 3000));

                } catch (e: any) {
                    this.logger.error(`[ML_OFFERS] Erro na página ${page}: ${e.message}`);
                }
            }

            if (allProducts.length === 0) {
                this.logger.warn('[ML_OFFERS] Nenhum produto encontrado, mantendo cache atual.');
                return;
            }

            const expiresAt = new Date();
            expiresAt.setHours(23, 59, 59, 999);

            await this.prisma.$transaction([
                this.prisma.mlDailyOffer.deleteMany(),
                this.prisma.mlDailyOffer.createMany({
                    data: allProducts.map(p => ({
                        title: p.title,
                        price: p.price,
                        originalPrice: p.originalPrice || p.price,
                        discount: p.discount || 0,
                        rating: p.rating || 0,
                        reviewCount: p.reviewCount || 0,
                        imageUrl: p.imageUrl || null,
                        productUrl: p.productUrl,
                        seller: p.seller || 'Mercado Livre',
                        expiresAt,
                    })),
                }),
            ]);

            this.logger.log(`[ML_OFFERS] Cache atualizado com ${allProducts.length} produtos.`);

        } catch (e: any) {
            this.logger.error(`[ML_OFFERS] Erro geral: ${e.message}`);
        } finally {
            this.isScraping = false;
        }
    }

    async searchOffers(keywords: string[], minDiscount = 0, minRating = 0, limit = 5): Promise<any[]> {
        const now = new Date();

        const cached = await this.prisma.mlDailyOffer.findMany({
            where: {
                expiresAt: { gte: now },
                ...(minDiscount > 0 ? { discount: { gte: minDiscount } } : {}),
                rating: { gte: minRating },
            },
            orderBy: { discount: 'desc' },
        });

        if (cached.length === 0) {
            this.logger.warn('[ML_OFFERS] Cache vazio, retornando lista vazia. Aguarde o scraping das 2h ou dispare /api/ml-offers/refresh manualmente.');
            return [];
        }

        const filtered = keywords.length > 0
            ? cached.filter((p: any) => keywords.some(kw => p.title.toLowerCase().includes(kw.toLowerCase())))
            : cached;

        return filtered.slice(0, limit);
    }

    async getCacheStats() {
        const count = await this.prisma.mlDailyOffer.count();
        const oldest = await this.prisma.mlDailyOffer.findFirst({ orderBy: { scrapedAt: 'asc' } });
        return { count, scrapedAt: oldest?.scrapedAt };
    }
}
