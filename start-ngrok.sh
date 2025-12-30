#!/bin/bash

echo "🚀 Iniciando ngrok para N9N..."
echo ""
echo "⚠️  IMPORTANTE: Configure o CORS no backend primeiro!"
echo ""
echo "Expondo:"
echo "  - Frontend (porta 3000)"
echo "  - Backend (porta 3001)"
echo ""

ngrok start --all --config=ngrok.yml



