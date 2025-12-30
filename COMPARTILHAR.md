# 🌐 Como Compartilhar N9N com Ngrok

## ⚡ Forma Mais Rápida (Recomendado)

### 1. Configure o ngrok (só precisa fazer uma vez)

```bash
# Instalar ngrok (se não tiver)
brew install ngrok

# Pegar seu token em: https://dashboard.ngrok.com/get-started/your-authtoken
# Depois configure:
ngrok config add-authtoken SEU_TOKEN_AQUI
```

### 2. Certifique-se que tudo está rodando

```bash
# Terminal 1 - Backend
cd apps/backend
pnpm dev

# Terminal 2 - Frontend
cd apps/frontend  
pnpm dev
```

### 3. Execute o script

```bash
./start-ngrok-simple.sh
```

### 4. Você verá algo assim:

```
Session Status                online
Forwarding                    https://abc123.ngrok-free.app -> http://localhost:3000
```

### 5. Compartilhe a URL

Envie para seu amigo: `https://abc123.ngrok-free.app`

**Pronto! Ele pode acessar pelo navegador!** 🎉

---

## ⚠️ Limitações da Conta Gratuita

- ✅ **Funciona perfeitamente** para testar com 1-2 pessoas
- ⏰ Túnel expira após 2 horas (precisa reiniciar)
- 🔄 URL muda toda vez que reinicia
- 🐌 Pode ter latência (servidor nos EUA)
- 📊 Limite de 40 conexões/minuto

---

## 🔧 Se quiser expor Backend também (opcional)

**ATENÇÃO**: Conta gratuita só permite 1 túnel. Para 2 túneis simultâneos você precisa:

### Opção A: 2 terminais (gratuito)

```bash
# Terminal 1 - Expor frontend
ngrok http 3000

# Terminal 2 - Expor backend  
ngrok http 3001
```

Depois configure no frontend:

```bash
cd apps/frontend
echo "NEXT_PUBLIC_API_URL=https://xyz789.ngrok-free.app" > .env.local
pnpm dev  # Reiniciar
```

### Opção B: Ngrok pago ($8/mês)

```bash
./start-ngrok-helper.sh  # Expõe ambos automaticamente
```

---

## 🎯 Monitorar Requisições

Enquanto o ngrok estiver rodando, acesse:

**http://localhost:4040**

Você verá em tempo real:
- Todas as requisições HTTP
- Headers
- Body
- Response
- Timing

---

## 🚨 Problemas Comuns

### "ERR_NGROK_108" ou erro de túnel

```bash
# Sua sessão expirou, reinicie:
# Ctrl+C no ngrok
./start-ngrok-simple.sh
```

### Frontend não carrega ou fica em branco

```bash
# O frontend pode estar fazendo requests para localhost
# Configure a URL do backend:
cd apps/frontend
echo "NEXT_PUBLIC_API_URL=https://seu-backend.ngrok-free.app" > .env.local
pnpm dev
```

### Aviso "Visit Site" do ngrok

É normal! Ngrok mostra um aviso de segurança na primeira vez.
Seu amigo só precisa clicar em "Visit Site".

---

## 💡 Alternativas Gratuitas ao Ngrok

Se precisar de algo mais permanente:

1. **Cloudflare Tunnel** (gratuito, ilimitado)
   ```bash
   brew install cloudflare/cloudflare/cloudflared
   cloudflared tunnel --url localhost:3000
   ```

2. **LocalTunnel** (gratuito, open source)
   ```bash
   npx localtunnel --port 3000
   ```

3. **Tailscale** (gratuito, VPN)
   - Mais seguro, só quem você autorizar acessa
   - https://tailscale.com/

---

## 🎓 Dicas Profissionais

1. **Performance**: Para produção, use um servidor real (Vercel, Railway, etc)
2. **Sessões WhatsApp**: O QR code é gerado no SEU computador, não no do seu amigo
3. **Banco de dados**: Tudo fica no seu PostgreSQL local
4. **Não desligue o computador**: Se desligar, o ngrok para!

---

## 📚 Mais Informações

- Documentação Ngrok: https://ngrok.com/docs
- Dashboard Ngrok: https://dashboard.ngrok.com/
- Status Ngrok: https://status.ngrok.com/



