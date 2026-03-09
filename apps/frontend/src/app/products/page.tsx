'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Star, Tag, RefreshCw, Download, Copy, Send, FileText, ChevronLeft, ChevronRight, AlertCircle, ShoppingBag, Loader2, X, TrendingUp, TrendingDown, Minus, Video, Users, Play } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { AuthGuard } from '@/components/AuthGuard'
import AppHeader from '@/components/AppHeader'

interface Product {
  itemId: string
  productName: string
  priceMin: string
  priceMax: string
  imageUrl: string
  offerLink: string
  ratingStar: string
  priceDiscountRate: string
  sales: string
  commissionRate: string
  is_extra_commission?: boolean
  extra_commission?: boolean
  commission_type?: string
}

// Regular sort options (mutually exclusive among themselves)
const BASE_SORT_OPTIONS = [
  { key: 'sales', label: 'Mais Vendidos' },
  { key: 'recent', label: 'Mais Recentes' },
  { key: 'price_asc', label: 'Menor Preço' },
  { key: 'price_desc', label: 'Maior Preço' },
]

function formatPrice(raw: string | undefined): string {
  const n = parseFloat(raw || '0')
  if (!n) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatSales(raw: string | undefined): string {
  const n = parseInt(raw || '0', 10)
  if (!n) return '0'
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function calcOriginalPrice(priceMin: string, discountRate: string): string | null {
  const price = parseFloat(priceMin || '0')
  const discount = parseFloat(discountRate || '0')
  if (!price || !discount || discount <= 0 || discount >= 100) return null
  return String(price / (1 - discount / 100))
}

function SkeletonCard() {
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden animate-pulse">
      <div className="w-full aspect-square bg-white/5" />
      <div className="p-4 space-y-2">
        <div className="h-3 bg-white/5 rounded w-full" />
        <div className="h-3 bg-white/5 rounded w-3/4" />
        <div className="h-4 bg-white/5 rounded w-1/2 mt-3" />
        <div className="flex gap-2 mt-3">
          <div className="h-8 bg-white/5 rounded flex-1" />
          <div className="h-8 bg-white/5 rounded flex-1" />
        </div>
      </div>
    </div>
  )
}

function ProductCard({ product }: { product: Product }) {
  const [copied, setCopied] = useState(false)
  const [imgError, setImgError] = useState(false)

  const discount = parseFloat(product.priceDiscountRate || '0')
  const rating = parseFloat(product.ratingStar || '0')
  const commissionRaw = parseFloat(product.commissionRate || '0')
  // API may return decimal (0.08) or percent (8) — normalize to percent
  const commission = !isNaN(commissionRaw) && commissionRaw > 0
    ? (commissionRaw < 1 ? commissionRaw * 100 : commissionRaw)
    : 0
  const isExtraCommission =
    product.is_extra_commission === true ||
    product.extra_commission === true ||
    product.commission_type === 'extra'
  const originalPrice = calcOriginalPrice(product.priceMin, product.priceDiscountRate)

  const copyLink = () => {
    navigator.clipboard.writeText(product.offerLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const generatePost = () => {
    const currentPrice = formatPrice(product.priceMin)
    const origPrice = originalPrice ? formatPrice(originalPrice) : null
    const discLine = discount > 0 ? `${Math.round(discount)}% de desconto! 😱\n` : ''
    const priceLine = origPrice
      ? `De ${origPrice} por apenas ${currentPrice}\n`
      : `Por apenas ${currentPrice}\n`
    const text =
      `🔥 ACHADO DO DIA!\n\n` +
      `${product.productName}\n\n` +
      priceLine +
      discLine +
      `\n✅ Link na bio para comprar\n\n` +
      `#achados #promoção #nicho #desconto`
    navigator.clipboard.writeText(text)
    alert('Post copiado para a área de transferência!')
  }

  const downloadImage = async () => {
    try {
      const response = await fetch(product.imageUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `produto-${product.itemId}.jpg`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      window.open(product.imageUrl, '_blank')
    }
  }

  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition flex flex-col">
      {/* Image */}
      <div className="relative aspect-square bg-[#111] overflow-hidden group">
        {!imgError ? (
          <img
            src={product.imageUrl}
            alt={product.productName}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag size={40} className="text-gray-700" />
          </div>
        )}
        {discount > 0 && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            -{Math.round(discount)}% OFF
          </span>
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
          <button
            onClick={downloadImage}
            title="Baixar imagem"
            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition text-white"
          >
            <Download size={16} />
          </button>
          <a
            href={product.offerLink}
            target="_blank"
            rel="noopener noreferrer"
            title="Ver produto"
            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition text-white"
          >
            <Send size={16} />
          </a>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex-1 flex flex-col gap-2">
        <p className="text-white text-sm font-medium line-clamp-2 leading-snug">{product.productName}</p>

        <div className="flex items-center gap-3 text-xs text-gray-500">
          {rating > 0 && (
            <span className="flex items-center gap-0.5 text-amber-400">
              <Star size={11} fill="currentColor" /> {rating.toFixed(1)}
            </span>
          )}
          <span>{formatSales(product.sales)} vendidos</span>
        </div>

        {/* Prices */}
        <div className="mt-auto">
          {originalPrice && (
            <p className="text-gray-500 text-xs line-through">{formatPrice(originalPrice)}</p>
          )}
          <p className="text-[#00ff88] font-bold text-lg leading-tight">{formatPrice(product.priceMin)}</p>
        </div>

        {/* Commission */}
        {commission > 0 && (
          <p className="text-amber-400 text-xs font-medium flex items-center gap-1 flex-wrap">
            💵 Comissão: {commission.toFixed(1)}%
            {isExtraCommission && (
              <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 border border-orange-500/40 rounded text-[10px] font-bold tracking-wide">
                EXTRA
              </span>
            )}
          </p>
        )}

        <div className="flex gap-2 mt-1">
          <button
            onClick={copyLink}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition ${
              copied
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/10'
            }`}
          >
            <Copy size={12} />
            {copied ? 'Copiado!' : 'Copiar link'}
          </button>
          <button
            onClick={generatePost}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#00ff88]/10 text-[#00ff88] hover:bg-[#00ff88]/20 border border-[#00ff88]/20 rounded-lg text-xs font-medium transition"
          >
            <FileText size={12} />
            Gerar post
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Trending interfaces & components ────────────────────────────────────────

interface TrendingProduct {
  itemId: string; title: string; price: string; originalPrice: string | null
  discount: number; imageUrl: string; productUrl: string
  commissionRate: number; commissionPerSale: number; isExtraCommission: boolean
  affiliateCount: number; salesVolume: string; rating: number
  rankPosition: number; previousPosition: number | null
  positionChange: number; trend: 'rising' | 'stable' | 'falling'
}

interface VideoProduct {
  itemId: string; title: string; price: string; originalPrice: string | null
  discount: number; imageUrl: string; productUrl: string
  commissionRate: number; commissionPerSale: number; isExtraCommission: boolean
  affiliateCount: number; salesVolume: number; videoCount: number
  opportunityScore: 'alta' | 'media' | 'baixa'
  creatorVideos: { thumbnailUrl: string; videoUrl: string; creatorName: string; views: number }[]
}

function TrendBadge({ trend, positionChange, previousPosition }: Pick<TrendingProduct, 'trend' | 'positionChange' | 'previousPosition'>) {
  if (previousPosition === null)
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">🆕 NOVO</span>
  if (trend === 'rising')
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-0.5"><TrendingUp size={10} />+{positionChange}</span>
  if (trend === 'falling')
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-0.5"><TrendingDown size={10} />-{positionChange}</span>
  return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-gray-500 border border-white/10 flex items-center gap-0.5"><Minus size={10} />Estável</span>
}

function TrendingCard({ product }: { product: TrendingProduct }) {
  const [copied, setCopied] = useState(false)
  const [imgError, setImgError] = useState(false)

  const copyLink = () => {
    navigator.clipboard.writeText(product.productUrl)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  const generatePost = () => {
    const text = `🔥 EM ALTA AGORA!\n\n${product.title}\n\nPor apenas ${formatPrice(product.price)}\n` +
      (product.discount > 0 ? `${Math.round(product.discount)}% de desconto! 😱\n` : '') +
      `\n✅ Link na bio para comprar\n\n#emalta #shopee #promoção`
    navigator.clipboard.writeText(text)
    alert('Post copiado!')
  }

  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition flex flex-col">
      <div className="relative aspect-square bg-[#111] overflow-hidden group">
        {!imgError
          ? <img src={product.imageUrl} alt={product.title} className="w-full h-full object-cover" onError={() => setImgError(true)} />
          : <div className="w-full h-full flex items-center justify-center"><ShoppingBag size={40} className="text-gray-700" /></div>
        }
        {/* Position badge */}
        <span className="absolute top-2 left-2 bg-amber-500 text-black text-xs font-black px-2 py-0.5 rounded-full shadow">
          #{product.rankPosition}
        </span>
        {product.discount > 0 && (
          <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            -{Math.round(product.discount)}% OFF
          </span>
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
          <a href={product.productUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition text-white"><Send size={16} /></a>
        </div>
      </div>
      <div className="p-3 flex-1 flex flex-col gap-1.5">
        {/* Trend badge */}
        <div className="flex items-center gap-1.5">
          <TrendBadge trend={product.trend} positionChange={product.positionChange} previousPosition={product.previousPosition} />
        </div>
        <p className="text-white text-xs font-medium line-clamp-2 leading-snug">{product.title}</p>
        <div className="mt-auto">
          {product.originalPrice && <p className="text-gray-500 text-[10px] line-through">{formatPrice(product.originalPrice)}</p>}
          <p className="text-[#00ff88] font-bold text-base leading-tight">{formatPrice(product.price)}</p>
        </div>
        {product.commissionRate > 0 && (
          <p className="text-amber-400 text-[10px] font-medium flex items-center gap-1 flex-wrap">
            💵 {product.commissionRate.toFixed(1)}%
            {product.commissionPerSale > 0 && <span className="text-gray-500">· R$ {product.commissionPerSale.toFixed(2)}/venda</span>}
            {product.isExtraCommission && <span className="px-1 py-0.5 bg-orange-500/20 text-orange-400 border border-orange-500/40 rounded text-[9px] font-bold">EXTRA</span>}
          </p>
        )}
        {product.affiliateCount > 0 && <p className="text-gray-500 text-[10px]">👥 {product.affiliateCount.toLocaleString('pt-BR')} afiliados</p>}
        {product.rating > 0 && <p className="text-gray-500 text-[10px]">⭐ {product.rating.toFixed(1)} · {formatSales(product.salesVolume)} vendidos</p>}
        <div className="flex gap-1.5 mt-1">
          <button onClick={copyLink} className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-medium transition ${copied ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/10'}`}>
            <Copy size={10} />{copied ? 'Copiado!' : 'Copiar'}
          </button>
          <button onClick={generatePost} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#00ff88]/10 text-[#00ff88] hover:bg-[#00ff88]/20 border border-[#00ff88]/20 rounded-lg text-[10px] font-medium transition">
            <FileText size={10} />Post
          </button>
        </div>
      </div>
    </div>
  )
}

const OPP_BADGE: Record<string, { label: string; cls: string }> = {
  alta:  { label: '🏆 ALTA',  cls: 'bg-green-500/20 text-green-400 border-green-500/40' },
  media: { label: '⚡ MÉDIA', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' },
  baixa: { label: '📉 BAIXA', cls: 'bg-red-500/20 text-red-400 border-red-500/40' },
}

function VideoCard({ product }: { product: VideoProduct }) {
  const [copied, setCopied] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [showCreators, setShowCreators] = useState(false)

  const opp = OPP_BADGE[product.opportunityScore] ?? OPP_BADGE.baixa

  const copyLink = () => {
    navigator.clipboard.writeText(product.productUrl)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  const generatePost = () => {
    const text = `🎬 PRODUTO EM ALTA!\n\n${product.title}\n\nPor apenas ${formatPrice(product.price)}\n` +
      (product.discount > 0 ? `${Math.round(product.discount)}% de desconto! 😱\n` : '') +
      `\n✅ Link na bio para comprar\n\n#shopee #promoção`
    navigator.clipboard.writeText(text)
    alert('Post copiado!')
  }

  return (
    <>
      <div className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition flex flex-col">
        <div className="relative aspect-square bg-[#111] overflow-hidden group">
          {!imgError
            ? <img src={product.imageUrl} alt={product.title} className="w-full h-full object-cover" onError={() => setImgError(true)} />
            : <div className="w-full h-full flex items-center justify-center"><ShoppingBag size={40} className="text-gray-700" /></div>
          }
          {product.discount > 0 && (
            <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              -{Math.round(product.discount)}% OFF
            </span>
          )}
          {/* Opportunity badge */}
          <span className={`absolute top-2 right-2 text-[9px] font-black px-1.5 py-0.5 rounded border ${opp.cls}`}>
            {opp.label}
          </span>
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
            <a href={product.productUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition text-white"><Send size={16} /></a>
          </div>
        </div>
        <div className="p-3 flex-1 flex flex-col gap-1.5">
          <p className="text-white text-xs font-medium line-clamp-2 leading-snug">{product.title}</p>
          <div className="mt-auto">
            {product.originalPrice && <p className="text-gray-500 text-[10px] line-through">{formatPrice(product.originalPrice)}</p>}
            <p className="text-[#00ff88] font-bold text-base leading-tight">{formatPrice(product.price)}</p>
          </div>
          {product.commissionRate > 0 && (
            <p className="text-amber-400 text-[10px] font-medium flex items-center gap-1 flex-wrap">
              💵 Comissão: {product.commissionRate.toFixed(1)}%
              {product.commissionPerSale > 0 && <span className="text-gray-500">· R$ {product.commissionPerSale.toFixed(2)}/venda</span>}
              {product.isExtraCommission && <span className="px-1 py-0.5 bg-orange-500/20 text-orange-400 border border-orange-500/40 rounded text-[9px] font-bold">EXTRA</span>}
            </p>
          )}
          {product.salesVolume > 0 && <p className="text-orange-400 text-[10px]">🔥 {formatSales(String(product.salesVolume))} vendas</p>}
          {product.affiliateCount > 0
            ? <p className="text-gray-500 text-[10px]">👥 apenas {product.affiliateCount.toLocaleString('pt-BR')} afiliados</p>
            : <p className="text-gray-600 text-[10px]">👥 afiliados: —</p>
          }
          {product.videoCount > 0 && <p className="text-purple-400 text-[10px]">🎬 {product.videoCount.toLocaleString('pt-BR')} vídeos criados</p>}
          <div className="flex gap-1.5 mt-1 flex-col">
            <div className="flex gap-1.5">
              <button onClick={copyLink} className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-medium transition ${copied ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/10'}`}>
                <Copy size={10} />{copied ? 'Copiado!' : 'Copiar'}
              </button>
              <button onClick={generatePost} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#00ff88]/10 text-[#00ff88] hover:bg-[#00ff88]/20 border border-[#00ff88]/20 rounded-lg text-[10px] font-medium transition">
                <FileText size={10} />Post
              </button>
            </div>
            <button onClick={() => setShowCreators(true)} className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg text-[10px] font-medium transition">
              <Play size={10} />🎬 Ver Vídeos
            </button>
          </div>
        </div>
      </div>

      {/* Creators modal */}
      {showCreators && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setShowCreators(false)}>
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold flex items-center gap-2"><Video size={16} className="text-purple-400" />Vídeos de Criadores — {product.title.slice(0, 40)}...</h3>
              <button onClick={() => setShowCreators(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            {product.creatorVideos && product.creatorVideos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {product.creatorVideos.map((v, i) => (
                  <a key={i} href={v.videoUrl} target="_blank" rel="noopener noreferrer" className="bg-[#111] rounded-lg overflow-hidden hover:ring-1 hover:ring-purple-500 transition group">
                    <div className="relative aspect-video bg-[#0a0a0a] flex items-center justify-center">
                      {v.thumbnailUrl
                        ? <img src={v.thumbnailUrl} alt={v.creatorName} className="w-full h-full object-cover" />
                        : <Play size={24} className="text-gray-600" />
                      }
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <Play size={20} className="text-white" fill="white" />
                      </div>
                    </div>
                    <div className="p-2">
                      <p className="text-white text-[10px] font-medium truncate">{v.creatorName}</p>
                      {v.views > 0 && <p className="text-gray-500 text-[9px]">👁 {v.views >= 1000 ? `${(v.views / 1000).toFixed(1)}k` : v.views} views</p>}
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Play size={32} className="mx-auto mb-3 text-gray-700" />
                <p className="text-sm">Vídeos não disponíveis para este produto ainda.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ─── Niche options shared by both new tabs ────────────────────────────────────
const NICHE_OPTIONS = [
  { value: '', label: 'Todos os nichos' },
  { value: 'confeitaria', label: '🎂 Confeitaria' },
  { value: 'beleza', label: '💄 Beleza' },
  { value: 'fitness', label: '🏋️ Fitness' },
  { value: 'cozinha', label: '🍳 Cozinha' },
  { value: 'celular', label: '📱 Celular' },
  { value: 'informatica', label: '💻 Informática' },
  { value: 'pet', label: '🐾 Pet Shop' },
  { value: 'moda', label: '👗 Moda' },
  { value: 'casa', label: '🏠 Casa e Decoração' },
  { value: 'bebe', label: '🧸 Bebê' },
]

const COMMISSION_OPTIONS = [
  { value: 0, label: 'Qualquer' },
  { value: 5, label: '5%+' },
  { value: 8, label: '8%+' },
  { value: 10, label: '10%+' },
  { value: 15, label: '15%+' },
  { value: 20, label: '20%+' },
]

// ─── Em Alta tab ──────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: 'today', label: '📅 Hoje', ttlLabel: '1h' },
  { value: 'week',  label: '📅 Esta Semana', ttlLabel: '6h' },
  { value: 'month', label: '📅 Este Mês', ttlLabel: '12h' },
]

const MIN_SALES_OPTIONS = [
  { value: 0, label: 'Qualquer' },
  { value: 100, label: '100+' },
  { value: 500, label: '500+' },
  { value: 1000, label: '1k+' },
  { value: 5000, label: '5k+' },
  { value: 10000, label: '10k+' },
]

const MAX_AFFILIATES_OPTIONS = [
  { value: 0, label: 'Qualquer' },
  { value: 50, label: 'até 50' },
  { value: 100, label: 'até 100' },
  { value: 500, label: 'até 500' },
  { value: 1000, label: 'até 1k' },
  { value: 5000, label: 'até 5k' },
]

function EmAltaTab() {
  const [niche, setNiche] = useState('')
  const [period, setPeriod] = useState('today')
  const [minCommission, setMinCommission] = useState(0)
  const [extraOnly, setExtraOnly] = useState(false)
  const [sortBy, setSortBy] = useState('rank')
  const [products, setProducts] = useState<TrendingProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [searched, setSearched] = useState(false)

  const doSearch = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await apiClient.searchTrendingProducts({
        niche: niche || undefined,
        minCommission: minCommission > 0 ? minCommission : undefined,
        extraCommissionOnly: extraOnly || undefined,
        sortBy: sortBy !== 'rank' ? sortBy : undefined,
        period,
        limit: 30,
      })
      setProducts(res.products as TrendingProduct[])
      setFromCache(res.fromCache)
      setSearched(true)
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Erro ao buscar Em Alta')
    } finally {
      setLoading(false)
    }
  }, [niche, period, minCommission, extraOnly, sortBy])

  useEffect(() => {
    if (searched) doSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [niche, period, minCommission, extraOnly, sortBy])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 bg-[#111] border border-white/5 rounded-xl p-4">
        {/* Period selector */}
        <div className="flex flex-col gap-1 w-full">
          <label className="text-[10px] text-gray-500 uppercase tracking-wider">Período</label>
          <div className="flex gap-2">
            {PERIOD_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setPeriod(o.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${period === o.value ? 'bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/30' : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-[10px] text-gray-500 uppercase tracking-wider">Nicho</label>
          <select value={niche} onChange={e => setNiche(e.target.value)} className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#00ff88]/50">
            {NICHE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 min-w-[130px]">
          <label className="text-[10px] text-gray-500 uppercase tracking-wider">Comissão mín.</label>
          <select value={minCommission} onChange={e => setMinCommission(Number(e.target.value))} className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#00ff88]/50">
            {COMMISSION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 min-w-[130px]">
          <label className="text-[10px] text-gray-500 uppercase tracking-wider">Ordenar por</label>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#00ff88]/50">
            <option value="rank">📊 Posição no Ranking</option>
            <option value="commission">💵 Maior Comissão</option>
            <option value="affiliates">👥 Mais Afiliados</option>
            <option value="sales">🔥 Mais Vendidos</option>
          </select>
        </div>
        <div className="flex flex-col gap-1 justify-end">
          <button onClick={() => setExtraOnly(p => !p)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${extraOnly ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'}`}>
            🏅 Apenas Comissão Extra
          </button>
        </div>
        <div className="flex flex-col gap-1 justify-end">
          <button onClick={doSearch} disabled={loading} className="px-4 py-1.5 bg-[#00ff88] text-black font-bold rounded-lg text-xs hover:bg-[#00dd77] transition disabled:opacity-50 flex items-center gap-1.5">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}Buscar
          </button>
        </div>
      </div>

      {fromCache && searched && !loading && (
        <p className="text-xs text-gray-600 flex items-center gap-1"><RefreshCw size={10} />Resultados do cache (30 min)</p>
      )}
      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          <AlertCircle size={16} />{error}
        </div>
      )}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}
      {!loading && searched && products.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <TrendingUp size={48} className="text-gray-700 mb-4" />
          <p className="text-gray-400 font-medium">Nenhum produto em alta encontrado</p>
          <p className="text-gray-600 text-sm mt-1">Tente outro nicho ou ajuste os filtros</p>
        </div>
      )}
      {!loading && !searched && !error && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <TrendingUp size={48} className="text-gray-700 mb-4" />
          <p className="text-gray-400 font-medium">Produtos em alta na Shopee</p>
          <p className="text-gray-600 text-sm mt-1">Selecione um nicho e clique em Buscar</p>
        </div>
      )}
      {!loading && products.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {products.map(p => <TrendingCard key={p.itemId} product={p} />)}
        </div>
      )}
    </div>
  )
}

// ─── Shopee Vídeos tab ────────────────────────────────────────────────────────

const VIDEO_CAT_OPTIONS = [
  { value: 0, label: '📂 Todas as categorias' },
  { value: 100013, label: '📱 Celulares' },
  { value: 11000582, label: '💻 Eletrônicos' },
  { value: 100015, label: '🏠 Casa e Decoração' },
  { value: 100006, label: '💄 Beleza' },
  { value: 100008, label: '👗 Moda Feminina' },
  { value: 100019, label: '⚽ Esportes' },
  { value: 100007, label: '🧸 Brinquedos' },
  { value: 100003, label: '🍕 Alimentos' },
  { value: 100017, label: '🐾 Pet Shop' },
]

function VideosTab() {
  const [niche, setNiche] = useState('')
  const [period, setPeriod] = useState('today')
  const [catId, setCatId] = useState(0)
  const [minSales, setMinSales] = useState(0)
  const [maxAffiliates, setMaxAffiliates] = useState(0)
  const [minCommission, setMinCommission] = useState(0)
  const [extraOnly, setExtraOnly] = useState(false)
  const [sortBy, setSortBy] = useState('opportunity')
  const [products, setProducts] = useState<VideoProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [searched, setSearched] = useState(false)

  const doSearch = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await apiClient.searchVideoProducts({
        niche: niche || undefined,
        minCommission: minCommission > 0 ? minCommission : undefined,
        extraCommissionOnly: extraOnly || undefined,
        sortBy,
        period,
        minSales: minSales > 0 ? minSales : undefined,
        maxAffiliates: maxAffiliates > 0 ? maxAffiliates : undefined,
        catId: catId > 0 ? catId : undefined,
        limit: 30,
      })
      setProducts(res.products as VideoProduct[])
      setFromCache(res.fromCache)
      setSearched(true)
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Erro ao buscar Shopee Vídeos')
    } finally {
      setLoading(false)
    }
  }, [niche, period, catId, minSales, maxAffiliates, minCommission, extraOnly, sortBy])

  useEffect(() => {
    if (searched) doSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [niche, period, catId, minSales, maxAffiliates, minCommission, extraOnly, sortBy])

  const periodTtlLabel = PERIOD_OPTIONS.find(p => p.value === period)?.ttlLabel ?? '1h'

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 bg-[#111] border border-white/5 rounded-xl p-4">
        {/* Period */}
        <div className="flex flex-col gap-1 w-full">
          <label className="text-[10px] text-gray-500 uppercase tracking-wider">Período (cache: {periodTtlLabel})</label>
          <div className="flex gap-2">
            {PERIOD_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setPeriod(o.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${period === o.value ? 'bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/30' : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-[10px] text-gray-500 uppercase tracking-wider">Nicho / Termo</label>
          <select value={niche} onChange={e => setNiche(e.target.value)} className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#00ff88]/50">
            {NICHE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-[10px] text-gray-500 uppercase tracking-wider">Categoria</label>
          <select value={catId} onChange={e => setCatId(Number(e.target.value))} className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#00ff88]/50">
            {VIDEO_CAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 min-w-[130px]">
          <label className="text-[10px] text-gray-500 uppercase tracking-wider">🔥 Vendas mín.</label>
          <select value={minSales} onChange={e => setMinSales(Number(e.target.value))} className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#00ff88]/50">
            {MIN_SALES_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 min-w-[130px]">
          <label className="text-[10px] text-gray-500 uppercase tracking-wider">👥 Máx. afiliados</label>
          <select value={maxAffiliates} onChange={e => setMaxAffiliates(Number(e.target.value))} className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#00ff88]/50">
            {MAX_AFFILIATES_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 min-w-[130px]">
          <label className="text-[10px] text-gray-500 uppercase tracking-wider">💵 Comissão mín.</label>
          <select value={minCommission} onChange={e => setMinCommission(Number(e.target.value))} className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#00ff88]/50">
            {COMMISSION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 min-w-[170px]">
          <label className="text-[10px] text-gray-500 uppercase tracking-wider">📊 Ordenar por</label>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#00ff88]/50">
            <option value="opportunity">🏆 Melhor Oportunidade</option>
            <option value="sales">🔥 Mais Vendidos</option>
            <option value="commission">💵 Maior Comissão</option>
            <option value="affiliates">👥 Menos Afiliados</option>
            <option value="price_asc">💰 Menor Preço</option>
          </select>
        </div>
        <div className="flex flex-col gap-1 justify-end">
          <button onClick={() => setExtraOnly(p => !p)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${extraOnly ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'}`}>
            🏅 Apenas Comissão Extra
          </button>
        </div>
        <div className="flex flex-col gap-1 justify-end">
          <button onClick={doSearch} disabled={loading} className="px-4 py-1.5 bg-[#00ff88] text-black font-bold rounded-lg text-xs hover:bg-[#00dd77] transition disabled:opacity-50 flex items-center gap-1.5">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}Buscar
          </button>
        </div>
      </div>

      {fromCache && searched && !loading && (
        <p className="text-xs text-gray-600 flex items-center gap-1"><RefreshCw size={10} />Resultados do cache (30 min)</p>
      )}
      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          <AlertCircle size={16} />{error}
        </div>
      )}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}
      {!loading && searched && products.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Video size={48} className="text-gray-700 mb-4" />
          <p className="text-gray-400 font-medium">Nenhum produto com vídeos encontrado</p>
          <p className="text-gray-600 text-sm mt-1">Tente outro nicho ou ajuste os filtros</p>
        </div>
      )}
      {!loading && !searched && !error && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Video size={48} className="text-gray-700 mb-4" />
          <p className="text-gray-400 font-medium">Produtos com conteúdo de vídeo</p>
          <p className="text-gray-600 text-sm mt-1">Selecione um nicho e clique em Buscar</p>
        </div>
      )}
      {!loading && products.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {products.map(p => <VideoCard key={p.itemId} product={p} />)}
        </div>
      )}
    </div>
  )
}

// ─── Main page content ────────────────────────────────────────────────────────

function ProductsPageContent() {
  const [tab, setTab] = useState<'produtos' | 'emalta' | 'videos'>('produtos')

  // Cleanup: clear all caches on unmount
  useEffect(() => {
    return () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('n9n_token') : null
      if (!token) return
      const headers = { Authorization: `Bearer ${token}` }
      fetch('/api/products/cache', { method: 'DELETE', headers })
      fetch('/api/products/trending/cache', { method: 'DELETE', headers })
      fetch('/api/products/videos/cache', { method: 'DELETE', headers })
    }
  }, [])

  const [keyword, setKeyword] = useState('')
  const [commissionActive, setCommissionActive] = useState(false)
  const [extraCommissionOnly, setExtraCommissionOnly] = useState(false)
  const [baseSort, setBaseSort] = useState<string | null>(null)
  const [minDiscount, setMinDiscount] = useState(0)
  const [minRating, setMinRating] = useState(0)
  const [page, setPage] = useState(1)

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [fromCache, setFromCache] = useState(false)
  const [clearingCache, setClearingCache] = useState(false)
  const [searched, setSearched] = useState(false)

  // Derive effective sortBy from commission + baseSort state
  const effectiveSortBy = commissionActive
    ? (baseSort ? `commission_desc+${baseSort}` : 'commission_desc')
    : (baseSort || 'sales')

  const doSearch = useCallback(async (pg = 1) => {
    setLoading(true)
    setError(null)
    try {
      const sortBy = commissionActive
        ? (baseSort ? `commission_desc+${baseSort}` : 'commission_desc')
        : (baseSort || 'sales')

      const res = await apiClient.searchProducts({
        keyword: keyword.trim() || undefined,
        sortBy,
        page: pg,
        limit: 30,
        minDiscount: minDiscount > 0 ? minDiscount : undefined,
        minRating: minRating > 0 ? minRating : undefined,
        extraCommissionOnly: extraCommissionOnly || undefined,
      })
      setProducts(res.products)
      setHasNextPage(res.hasNextPage)
      setFromCache(res.fromCache)
      setPage(pg)
      setSearched(true)
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Erro ao buscar produtos')
    } finally {
      setLoading(false)
    }
  }, [keyword, commissionActive, extraCommissionOnly, baseSort, minDiscount, minRating])

  const handleClearCache = async () => {
    setClearingCache(true)
    try {
      const res = await apiClient.clearProductsCache()
      alert(`Cache limpo! ${res.deleted} entradas removidas.`)
      if (searched) doSearch(1)
    } catch {
      alert('Erro ao limpar cache')
    } finally {
      setClearingCache(false)
    }
  }

  const handleBaseSort = (key: string) => {
    setBaseSort(prev => prev === key ? null : key)
  }

  const handleCommissionToggle = () => {
    setCommissionActive(prev => !prev)
  }

  const clearCombinedSort = () => {
    setCommissionActive(false)
    setBaseSort(null)
  }

  // Auto-search on sort/filter change if already searched
  useEffect(() => {
    if (searched) doSearch(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commissionActive, extraCommissionOnly, baseSort, minDiscount, minRating])

  const showComboBadge = commissionActive && baseSort !== null

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <AppHeader />
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ShoppingBag size={24} className="text-[#00ff88]" />
              Vitrine de Produtos
            </h1>
            <p className="text-gray-400 text-sm mt-1">Busque e curade produtos da Shopee para seus grupos</p>
          </div>
          <button
            onClick={handleClearCache}
            disabled={clearingCache}
            title="Limpar cache de busca"
            className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-white/5 border border-white/10 rounded-lg text-sm transition disabled:opacity-50"
          >
            <RefreshCw size={14} className={clearingCache ? 'animate-spin' : ''} />
            Limpar cache
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-white/10 mb-6">
          {[
            { id: 'produtos', label: '🛍️ Produtos' },
            { id: 'emalta', label: '🔥 Em Alta' },
            { id: 'videos', label: '🎬 Shopee Vídeos' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`px-5 py-2.5 text-sm font-medium transition whitespace-nowrap ${tab === t.id ? 'text-[#00ff88] border-b-2 border-[#00ff88]' : 'text-gray-400 hover:text-gray-200'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'emalta' && <EmAltaTab />}
        {tab === 'videos' && <VideosTab />}

        {tab === 'produtos' && (<>
        {/* Search bar */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch(1)}
              placeholder="Buscar produto... (ex: tênis, fone bluetooth, caneca)"
              className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none focus:border-[#00ff88]/50 placeholder:text-gray-600"
            />
          </div>
          <button
            onClick={() => doSearch(1)}
            disabled={loading}
            className="px-6 py-3 bg-[#00ff88] text-black font-bold rounded-xl text-sm hover:bg-[#00dd77] transition disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Buscar
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6 bg-[#111] border border-white/5 rounded-xl p-4">
          {/* Sort */}
          <div className="flex flex-col gap-2 min-w-[200px]">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Ordenar por</label>

            {/* Combined badge when commission + base are both active */}
            {showComboBadge && (
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  💵 Maior Comissão + {BASE_SORT_OPTIONS.find(o => o.key === baseSort)?.label}
                  <button onClick={clearCombinedSort} className="ml-1 hover:text-white transition">
                    <X size={12} />
                  </button>
                </span>
              </div>
            )}

            <div className="flex flex-wrap gap-1">
              {/* Commission button */}
              <button
                onClick={handleCommissionToggle}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  commissionActive
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'
                }`}
              >
                💵 Maior Comissão
              </button>

              {/* Regular sort buttons */}
              {BASE_SORT_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => handleBaseSort(opt.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                    baseSort === opt.key
                      ? 'bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/30'
                      : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Discount */}
          <div className="flex flex-col gap-1 min-w-[180px]">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Tag size={10} />
              Desconto mínimo: <span className="text-white">{minDiscount > 0 ? `${minDiscount}%` : 'Qualquer'}</span>
            </label>
            <input
              type="range"
              min={0}
              max={90}
              step={5}
              value={minDiscount}
              onChange={e => setMinDiscount(Number(e.target.value))}
              className="accent-[#00ff88] w-full"
            />
          </div>

          {/* Rating */}
          <div className="flex flex-col gap-1 min-w-[180px]">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Star size={10} />
              Avaliação mínima: <span className="text-white">{minRating > 0 ? `${minRating}★` : 'Qualquer'}</span>
            </label>
            <input
              type="range"
              min={0}
              max={5}
              step={0.5}
              value={minRating}
              onChange={e => setMinRating(Number(e.target.value))}
              className="accent-[#00ff88] w-full"
            />
          </div>

          {/* Extra Commission toggle */}
          <div className="flex flex-col gap-1 justify-center">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Tipo de comissão</label>
            <button
              onClick={() => setExtraCommissionOnly(prev => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                extraCommissionOnly
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                  : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'
              }`}
            >
              🏅 Apenas Comissão Extra
            </button>
          </div>

          {/* Active sort indicator */}
          {!showComboBadge && effectiveSortBy !== 'sales' && (
            <div className="flex items-end">
              <span className="text-xs text-gray-500">
                Ordem: <span className="text-gray-300">
                  {commissionActive ? '💵 Maior Comissão' : BASE_SORT_OPTIONS.find(o => o.key === baseSort)?.label}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Cache indicator */}
        {fromCache && searched && !loading && (
          <p className="text-xs text-gray-600 mb-4 flex items-center gap-1">
            <RefreshCw size={10} /> Resultados do cache (até 10 min)
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 text-red-400 text-sm">
            <AlertCircle size={16} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {!loading && searched && products.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <ShoppingBag size={48} className="text-gray-700 mb-4" />
            <p className="text-gray-400 font-medium">Nenhum produto encontrado</p>
            <p className="text-gray-600 text-sm mt-1">Tente outros termos ou ajuste os filtros</p>
          </div>
        )}

        {/* Initial state */}
        {!loading && !searched && !error && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <ShoppingBag size={48} className="text-gray-700 mb-4" />
            <p className="text-gray-400 font-medium">Busque produtos da Shopee</p>
            <p className="text-gray-600 text-sm mt-1">Digite um termo e pressione Buscar</p>
          </div>
        )}

        {/* Products grid */}
        {!loading && products.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {products.map(p => <ProductCard key={p.itemId} product={p} />)}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                onClick={() => doSearch(page - 1)}
                disabled={page <= 1 || loading}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-gray-400 hover:text-white rounded-lg text-sm transition disabled:opacity-30"
              >
                <ChevronLeft size={16} /> Anterior
              </button>
              <span className="text-gray-500 text-sm">Página {page}</span>
              <button
                onClick={() => doSearch(page + 1)}
                disabled={!hasNextPage || loading}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-gray-400 hover:text-white rounded-lg text-sm transition disabled:opacity-30"
              >
                Próxima <ChevronRight size={16} />
              </button>
            </div>
          </>
        )}
        </>)}
      </div>
    </div>
  )
}

export default function ProductsPage() {
  return <AuthGuard><ProductsPageContent /></AuthGuard>
}
