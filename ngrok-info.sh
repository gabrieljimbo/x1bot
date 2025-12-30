#!/bin/bash

cat << "EOF"
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║              🌐 N9N - Compartilhar via Ngrok 🌐              ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

📋 CHECKLIST RÁPIDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Passo 1: Instalar ngrok
   brew install ngrok

✅ Passo 2: Configurar authtoken
   1. Crie conta: https://ngrok.com/
   2. Pegue token: https://dashboard.ngrok.com/get-started/your-authtoken
   3. Configure: ngrok config add-authtoken SEU_TOKEN

✅ Passo 3: Iniciar serviços
   Terminal 1: cd apps/backend && pnpm dev
   Terminal 2: cd apps/frontend && pnpm dev

✅ Passo 4: Expor com ngrok
   Terminal 3: ./start-ngrok-simple.sh

✅ Passo 5: Compartilhar URL
   Envie a URL https://xxxxx.ngrok-free.app para seu amigo!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 MAIS INFORMAÇÕES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📖 Guia completo:    COMPARTILHAR.md
🔧 Setup técnico:    NGROK_SETUP.md
🚀 Script simples:   ./start-ngrok-simple.sh
🔍 Monitor:          http://localhost:4040

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  IMPORTANTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Conta gratuita: 1 túnel por vez (só frontend OK!)
• URL muda toda vez que reinicia
• Túnel expira após 2 horas
• Não desligue seu computador!
• Pode ter latência (servidor nos EUA)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EOF

read -p "Pressione ENTER para continuar..."



