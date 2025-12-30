# 🌐 Compartilhar N9N com Ngrok

## 📋 Pré-requisitos

1. Ter uma conta no ngrok (gratuita): https://ngrok.com/
2. Pegar seu authtoken em: https://dashboard.ngrok.com/get-started/your-authtoken

## 🚀 Como usar

### 1. Configure o authtoken

Edite o arquivo `ngrok.yml` e substitua `YOUR_NGROK_AUTHTOKEN_HERE` pelo seu token:

```bash
nano ngrok.yml
```

OU execute:

```bash
ngrok config add-authtoken SEU_TOKEN_AQUI
```

### 2. Certifique-se que o backend e frontend estão rodando

```bash
# Terminal 1 - Backend
cd apps/backend
pnpm dev

# Terminal 2 - Frontend  
cd apps/frontend
pnpm dev
```

### 3. Inicie o ngrok

```bash
./start-ngrok.sh
```

OU manualmente:

```bash
ngrok start --all --config=ngrok.yml
```

### 4. Você verá algo assim:

```
Session Status                online
Account                       Seu Nome (Plan: Free)
Version                       3.x.x
Region                        United States (us)
Latency                       50ms
Web Interface                 http://127.0.0.1:4040

Forwarding                    https://abc123.ngrok-free.app -> http://localhost:3000
Forwarding                    https://xyz789.ngrok-free.app -> http://localhost:3001
```

### 5. Configure as variáveis de ambiente

Crie um arquivo `.env.local` no frontend:

```bash
cd apps/frontend
echo "NEXT_PUBLIC_API_URL=https://xyz789.ngrok-free.app" > .env.local
```

### 6. Reinicie o frontend

```bash
# No terminal do frontend
# Ctrl+C para parar
pnpm dev
```

### 7. Compartilhe com seu amigo

Envie para seu amigo a URL do **frontend** (primeira URL do ngrok):

```
https://abc123.ngrok-free.app
```

⚠️ **IMPORTANTE**: 
- As URLs do ngrok mudam toda vez que você reinicia
- Conta gratuita tem limite de conexões simultâneas
- Pode aparecer um aviso de segurança do ngrok (é normal)

## 🔍 Monitorar requisições

Acesse: http://localhost:4040

Você verá todas as requisições HTTP em tempo real!

## 🛑 Para parar

Pressione `Ctrl+C` no terminal do ngrok

## 💡 Dicas

1. **Performance**: Ngrok gratuito pode ser lento, seja paciente
2. **Sessões WhatsApp**: O QR code ainda será gerado no seu computador
3. **Banco de dados**: Todos os dados ficam no seu PostgreSQL local
4. **URLs dinâmicas**: A cada restart do ngrok, as URLs mudam

## 🎯 Alternativa: Ngrok com domínio fixo (plano pago)

Se quiser URLs fixas, considere o plano pago do ngrok ou use:
- Cloudflare Tunnel (gratuito)
- LocalTunnel (gratuito)
- Tailscale (gratuito)



