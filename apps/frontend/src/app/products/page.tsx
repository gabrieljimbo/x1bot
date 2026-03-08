'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Star, Tag, RefreshCw, Download, Copy, Send, FileText, ChevronLeft, ChevronRight, AlertCircle, ShoppingBag, Loader2, X } from 'lucide-react'
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
  const commission = parseFloat(product.commissionRate || '0')
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
          <p className="text-amber-400 text-xs font-medium flex items-center gap-1">
            💵 Comissão: {commission.toFixed(1)}%
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

function ProductsPageContent() {
  const [keyword, setKeyword] = useState('')
  const [commissionActive, setCommissionActive] = useState(false)
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
  }, [keyword, commissionActive, baseSort, minDiscount, minRating])

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
  }, [commissionActive, baseSort, minDiscount, minRating])

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
      </div>
    </div>
  )
}

export default function ProductsPage() {
  return <AuthGuard><ProductsPageContent /></AuthGuard>
}
