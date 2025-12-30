#!/bin/bash

echo "🔧 N9N - Setup Ngrok Helper"
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok não está instalado!"
    echo ""
    echo "Instale com:"
    echo "  brew install ngrok"
    echo ""
    exit 1
fi

# Check if authtoken is configured
if grep -q "YOUR_NGROK_AUTHTOKEN_HERE" ngrok.yml; then
    echo "⚠️  ATENÇÃO: Você precisa configurar seu authtoken!"
    echo ""
    echo "1. Acesse: https://dashboard.ngrok.com/get-started/your-authtoken"
    echo "2. Copie seu authtoken"
    echo "3. Execute: ngrok config add-authtoken SEU_TOKEN_AQUI"
    echo ""
    echo "OU edite o arquivo ngrok.yml manualmente"
    echo ""
    exit 1
fi

echo "✅ Ngrok configurado!"
echo ""

# Check if services are running
echo "🔍 Verificando serviços..."
echo ""

# Check backend
if curl -s http://localhost:3001/api/health &> /dev/null; then
    echo "✅ Backend rodando (porta 3001)"
else
    echo "❌ Backend NÃO está rodando!"
    echo "   Execute: cd apps/backend && pnpm dev"
    echo ""
fi

# Check frontend
if curl -s http://localhost:3000 &> /dev/null; then
    echo "✅ Frontend rodando (porta 3000)"
else
    echo "❌ Frontend NÃO está rodando!"
    echo "   Execute: cd apps/frontend && pnpm dev"
    echo ""
fi

echo ""
echo "📚 Para mais informações, leia: NGROK_SETUP.md"
echo ""
echo "🚀 Iniciando ngrok em 3 segundos..."
sleep 3

ngrok start --all --config=ngrok.yml



