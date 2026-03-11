import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { LicenseBanner } from '@/components/LicenseBanner'
import { ExpiredAccountScreen } from '@/components/ExpiredAccountScreen'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: "X1Bot — Automação de WhatsApp para Vendas no Digital",
  description: "Escale suas vendas no WhatsApp com automação inteligente. Ideal para grupos de achadinhos, Shopee, Mercado Livre, infoprodutos e low ticket. Fluxos com IA, disparo em massa, funil automático e integração com Meta Ads.",
  keywords: "automação whatsapp, bot whatsapp, grupos achadinhos, shopee whatsapp, mercado livre whatsapp, whatsapp marketing, infoproduto, low ticket, disparo whatsapp, funil whatsapp, chatbot whatsapp, vendas whatsapp, escalar vendas, whatsapp bot brasil, automação digital",
  authors: [{ name: "X1Bot" }],
  robots: "index, follow",
  other: {
    "og:type": "website",
    "og:url": "https://x1bot.cloud",
    "og:title": "X1Bot — Automação de WhatsApp para Vendas no Digital",
    "og:description": "Escale suas vendas no WhatsApp com automação inteligente. Ideal para grupos de achadinhos, Shopee, Mercado Livre, infoprodutos e low ticket.",
    "og:image": "/logo-escrita.png",
    "og:locale": "pt_BR",
    "og:site_name": "X1Bot",
    "twitter:card": "summary_large_image",
    "twitter:title": "X1Bot — Automação de WhatsApp para Vendas",
    "twitter:description": "Bot de WhatsApp para quem quer viver e vender no digital. Achadinhos, Shopee, ML, infoprodutos e mais.",
    "twitter:image": "/logo-escrita.png",
  },
  alternates: {
    canonical: "https://x1bot.cloud",
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="icon" href="/logo.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <LicenseBanner />
          <ExpiredAccountScreen />
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
