# Guia de Testes - N9N

## ✅ Sistema Configurado

O backend e frontend já estão rodando. Agora você pode testar o sistema completo!

## 🚀 Como Testar

### 1. Acessar o Frontend

Abra no navegador: **http://localhost:3000**

Você verá o dashboard com:
- Lista de Workflows
- Lista de WhatsApp Sessions

### 2. Conectar uma Sessão WhatsApp

1. Clique em **"Connect"** na seção WhatsApp Sessions
2. Digite um nome para a sessão (ex: "Meu WhatsApp")
3. Clique em **"Create Session"**
4. Um QR Code será gerado
5. **Abra o WhatsApp no seu celular**:
   - Vá em **Menu** → **Aparelhos conectados**
   - Toque em **"Conectar um aparelho"**
   - Escaneie o QR Code na tela
6. Aguarde a conexão (status mudará para "CONNECTED")
7. Você será redirecionado para o dashboard

### 3. Criar um Workflow

1. No dashboard, clique em **"Create"** na seção Workflows
2. Preencha:
   - **Nome**: "Bot de Boas-vindas"
   - **Descrição**: "Bot simples que saúda usuários"
3. Clique em **"Create Workflow"**
4. Você será levado ao editor visual

### 4. Construir o Fluxo (No Editor Visual)

**Nota**: O editor visual está pronto, mas para testar rapidamente, vamos ativar o workflow de exemplo que já foi criado no seed.

### 5. Ativar o Workflow de Exemplo

1. Volte ao dashboard (http://localhost:3000)
2. Você verá o workflow "Welcome Flow"
3. Clique nele
4. Clique no botão **"Inactive"** para ativar
5. O botão ficará verde: **"Active"**

### 6. Testar o Bot no WhatsApp

Agora envie uma mensagem para o número conectado:

1. **Envie**: `hello`
2. **Bot responde**: "Hello! 👋 Welcome to our service. What's your name?"
3. **Você responde**: "João"
4. **Bot responde**: "Nice to meet you, João! How can I help you today?"

### 7. Monitorar em Tempo Real

Enquanto testa, observe:

- **No terminal do backend**: Logs de execução
- **No editor de workflow**: Nodes sendo destacados em verde
- **No navegador**: Status da execução

## 🔍 Verificar Logs

### Backend Logs

No terminal onde o backend está rodando, você verá:

```
Initializing WhatsApp session...
QR Code generated for session...
WhatsApp session is ready and connected!
Message received from +55...
Execution started...
Node executed: send-1
Execution waiting...
Message received from +55...
Execution resumed...
Node executed: send-2
Execution completed!
```

### Frontend (Console do Navegador)

Abra o DevTools (F12) e veja eventos WebSocket em tempo real.

## 📊 Verificar no Banco de Dados

```bash
cd apps/backend
npx prisma studio
```

Isso abre uma interface visual onde você pode ver:
- Workflows criados
- Execuções em andamento
- Logs de eventos
- Sessões WhatsApp

## 🧪 Cenários de Teste

### Teste 1: Fluxo Completo
✅ Enviar "hello" e completar a conversa

### Teste 2: Timeout
1. Enviar "hello"
2. NÃO responder por 5 minutos
3. Verificar que a execução expirou

### Teste 3: Múltiplas Conversas
1. Enviar "hello" de dois números diferentes
2. Cada um deve ter sua própria execução isolada

### Teste 4: Workflow Inativo
1. Desativar o workflow
2. Enviar "hello"
3. Não deve iniciar execução

## 🐛 Troubleshooting

### QR Code não aparece

**Solução**:
```bash
# Parar o backend
# Deletar cache do WhatsApp
rm -rf apps/backend/.wwebjs_auth
# Reiniciar o backend
```

### Mensagem não é recebida

**Verificar**:
1. Sessão está CONNECTED?
2. Workflow está ACTIVE?
3. Pattern do trigger está correto?
4. Logs do backend mostram a mensagem?

### Execução não retoma

**Verificar**:
1. Status da execução no banco (deve ser WAITING)
2. Logs do backend
3. expiresAt não passou

## 📱 Testar Envio de Mensagens

Você também pode enviar mensagens via API:

```bash
curl -X POST http://localhost:3001/api/whatsapp/sessions/{SESSION_ID}/send \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": "5511999999999",
    "message": "Olá! Esta é uma mensagem de teste."
  }'
```

## 🎯 Próximos Passos

Após testar com sucesso:

1. ✅ Criar workflows mais complexos
2. ✅ Adicionar condições (CONDITION nodes)
3. ✅ Testar timeouts
4. ✅ Criar múltiplas sessões
5. ✅ Implementar autenticação (se necessário)

## 🎉 Sucesso!

Se você conseguiu:
- ✅ Conectar WhatsApp
- ✅ Ativar workflow
- ✅ Receber e responder mensagens
- ✅ Ver execução em tempo real

**Parabéns! O N9N está funcionando perfeitamente!** 🚀

---

## 📞 Comandos Úteis

```bash
# Ver logs do backend
cd apps/backend
pnpm dev

# Ver logs do frontend
cd apps/frontend
pnpm dev

# Abrir Prisma Studio
cd apps/backend
npx prisma studio

# Resetar banco de dados
cd apps/backend
npx prisma migrate reset
npx ts-node prisma/seed.ts
```


