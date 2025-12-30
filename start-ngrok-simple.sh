#!/bin/bash

echo "🚀 N9N - Ngrok Quick Start"
echo ""
echo "Este script irá expor suas portas 3000 (frontend) e 3001 (backend)"
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok não está instalado!"
    echo ""
    echo "Instale com: brew install ngrok"
    exit 1
fi

# Check if configured
if ! ngrok config check &> /dev/null; then
    echo "⚠️  Configure seu authtoken primeiro:"
    echo ""
    echo "1. Crie uma conta gratuita: https://ngrok.com/"
    echo "2. Pegue seu token: https://dashboard.ngrok.com/get-started/your-authtoken"
    echo "3. Execute: ngrok config add-authtoken SEU_TOKEN_AQUI"
    echo ""
    exit 1
fi

echo "✅ Ngrok configurado!"
echo ""

# Check services
BACKEND_OK=false
FRONTEND_OK=false

if curl -s http://localhost:3001/api/health &> /dev/null || nc -z localhost 3001 2>/dev/null; then
    echo "✅ Backend detectado na porta 3001"
    BACKEND_OK=true
else
    echo "⚠️  Backend não detectado na porta 3001"
    echo "   Execute em outro terminal: cd apps/backend && pnpm dev"
fi

if curl -s http://localhost:3000 &> /dev/null || nc -z localhost 3000 2>/dev/null; then
    echo "✅ Frontend detectado na porta 3000"
    FRONTEND_OK=true
else
    echo "⚠️  Frontend não detectado na porta 3000"
    echo "   Execute em outro terminal: cd apps/frontend && pnpm dev"
fi

echo ""

if [ "$BACKEND_OK" = false ] || [ "$FRONTEND_OK" = false ]; then
    echo "⚠️  AVISO: Alguns serviços não estão rodando!"
    echo ""
    read -p "Continuar mesmo assim? (s/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "📡 Iniciando ngrok..."
echo ""
echo "🎯 Você verá 2 URLs:"
echo "   - Frontend: Para compartilhar com seu amigo"
echo "   - Backend: Para configurar no frontend (.env.local)"
echo ""
echo "🔍 Monitor de requisições: http://localhost:4040"
echo ""
echo "⏸️  Para parar: Pressione Ctrl+C"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

sleep 2

# Start ngrok with both ports
# Note: This requires ngrok paid plan for multiple tunnels
# For free plan, you need to run two separate ngrok instances
echo "⚠️  ATENÇÃO: Conta gratuita do ngrok permite apenas 1 túnel por vez!"
echo ""
echo "Opção 1 (Recomendado): Expor apenas o FRONTEND"
echo "  O backend ficará acessível via localhost no seu computador"
echo ""
echo "Opção 2: Expor ambos (requer plano pago ou 2 instâncias separadas)"
echo ""
read -p "Expor apenas FRONTEND? (S/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo ""
    echo "🚀 Expondo FRONTEND na porta 3000..."
    echo ""
    ngrok http 3000
else
    echo ""
    echo "🚀 Tentando expor AMBOS (requer plano pago)..."
    echo ""
    echo "Se der erro, expor apenas frontend é suficiente!"
    echo ""
    sleep 2
    ngrok start --all --config=ngrok.yml 2>/dev/null || ngrok http 3000
fi



