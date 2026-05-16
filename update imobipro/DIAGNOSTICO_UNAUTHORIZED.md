# 🔐 DIAGNÓSTICO - Erro "Unauthorized" nos Webhooks

**Erro Observado:**
```json
{
  "message": "Unauthorized",
  "request_id": "ef107621134a5a48bba4992b2e0fa00c"
}
```

---

## 🔍 Causa Raiz

O erro `Unauthorized` significa que a API está rejeitando a requisição por falta de autenticação. Existem várias causas possíveis:

### **Opção 1: Webhook Precisa de Autenticação (MAIS PROVÁVEL)**

O webhook está configurado para exigir token JWT/Bearer, mas você não está enviando:

```bash
# ❌ ERRADO
curl http://localhost:8000/webhook/test-agenda

# ✅ CORRETO
curl http://localhost:8000/webhook/test-agenda \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🛠️ SOLUÇÃO - PASSO A PASSO

### **PASSO 1: Verificar se Webhook Exige Autenticação**

Verificar no código qual é a política de autenticação:

```bash
# Encontrar arquivo de rota do webhook
grep -r "test-agenda" /opt/imobdashboard/src --include="*.ts"

# Ou verificar em N8N (se estiver usando N8N para webhook)
# Acessar: https://n8n.seudominio.com → Workflows → test-agenda
# Settings → Autenticação → Verificar se está "true"
```

### **PASSO 2: Obter Token Válido**

Se é aplicação React/Node, fazer login primeiro:

```bash
# 1. Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seu@email.com",
    "password": "sua_senha"
  }' | jq '.token'

# Resultado: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
TOKEN="seu_token_aqui"

# 2. Usar token em requisição autenticada
curl -X POST http://localhost:8000/webhook/test-agenda \
  -H "Authorization: Bearer $TOKEN"
```

### **PASSO 3: Se for N8N - Verificar Autenticação do Webhook**

Em N8N:
1. Abrir fluxo: "test-agenda"
2. Nó "Webhook"
3. Settings → "Authentication"
4. Verificar se está ativado
5. Se sim, copiar senha/token
6. Usar na requisição:

```bash
curl -X POST http://n8n.seudominio.com/webhook/test-agenda \
  -H "X-N8N-Webhook-Auth: sua_senha"
```

---

## 📋 CHECKLIST - POR TIPO DE AUTENTICAÇÃO

### **Se é JWT/Bearer Token:**
```bash
✅ CORRIGIR:
curl http://localhost:8000/webhook/test-agenda \
  -H "Authorization: Bearer $TOKEN"
```

### **Se é N8N Webhook:**
```bash
✅ CORRIGIR:
curl http://localhost:8000/webhook/test-agenda \
  -H "X-N8N-Webhook-Auth: webhook_password"
```

### **Se é API Key:**
```bash
✅ CORRIGIR:
curl http://localhost:8000/webhook/test-agenda \
  -H "X-API-Key: sua_chave_api"
```

### **Se é Basic Auth:**
```bash
✅ CORRIGIR:
curl -u usuario:senha http://localhost:8000/webhook/test-agenda
```

### **Se é CORS/Preflight:**
```bash
✅ CORRIGIR:
curl -X OPTIONS http://localhost:8000/webhook/test-agenda \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST"
```

---

## 🔧 TESTE RÁPIDO - SEM AUTENTICAÇÃO

Se você quer testar **sem autenticação**, pode:

### **Opção A: Remover Autenticação do Webhook**

**Em N8N:**
1. Nó Webhook
2. Settings → "Authentication: OFF"
3. Salvar
4. Testar

**Em código Node/Express:**
```typescript
// Remover temporariamente para teste
router.post('/webhook/test-agenda', (req, res) => {
  // Sem middleware de autenticação
  res.json({ message: "OK" });
});
```

### **Opção B: Usar Token Inválido para Ver Resposta**

```bash
# Ver mensagem de erro mais detalhada
curl -v http://localhost:8000/webhook/test-agenda \
  -H "Authorization: Bearer invalid_token"

# Vai mostrar qual é o problema exato no header X-Debug ou resposta
```

---

## 📊 DIAGNÓSTICO - VERIFICAR CADA ENDPOINT

```bash
#!/bin/bash

# Testar 3 endpoints
ENDPOINTS=(
  "http://localhost:8000/webhook/test-agenda"
  "http://localhost:8000/api/health"
  "http://localhost:8000/api/messages"
)

for endpoint in "${ENDPOINTS[@]}"; do
  echo "Testando: $endpoint"
  
  # Teste 1: Sem autenticação
  echo "  Sem auth:"
  curl -s -w "HTTP %{http_code}\n" -o /dev/null "$endpoint"
  
  # Teste 2: Com token
  echo "  Com token:"
  curl -s -w "HTTP %{http_code}\n" -o /dev/null "$endpoint" \
    -H "Authorization: Bearer test_token"
  
  echo ""
done
```

---

## 🚨 CASO COMUM - N8N WEBHOOK

Se está usando **N8N**, o erro é comum porque:

1. **N8N Webhook requer método HTTP correto**
   - GET vs POST vs PUT
   - Headers específicos

2. **N8N pode exigir autenticação**
   - Ao criar webhook, há opção "Authenticate"
   - Se ativado, precisa password

**Solução para N8N:**

```bash
# Copiar URL exata do webhook
WEBHOOK_URL="https://n8n.seudominio.com/webhook/1234abcd"

# Se "Authenticate" está OFF:
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Se "Authenticate" está ON:
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-N8N-Webhook-Auth: coloque_a_senha_aqui" \
  -d '{"test": true}'
```

---

## ✅ APÓS CORRIGIR

Depois de adicionar autenticação correta, você deve ver:

```bash
# Resposta esperada:
{
  "status": "processing",
  "id": "abc123",
  "message": "Webhook processado com sucesso"
}
```

Não mais `Unauthorized`!

---

## 📞 SE AINDA NÃO FUNCIONAR

Coletar informações para debug:

```bash
# 1. Ver headers completos
curl -v http://localhost:8000/webhook/test-agenda \
  -H "Authorization: Bearer test_token" \
  2>&1 | head -30

# 2. Ver logs do servidor
docker logs imobdashboard-app 2>&1 | tail -50

# 3. Ver configuração do N8N (se usar)
curl -X GET "https://n8n.seudominio.com/api/v1/workflows" \
  -H "Authorization: Bearer n8n_token"

# 4. Verificar credenciais Supabase
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY
```

---

## 📌 RESUMO

| Cenário | Solução |
|---------|----------|
| N8N Webhook | Adicionar `-H "X-N8N-Webhook-Auth: password"` |
| JWT/Bearer | Adicionar `-H "Authorization: Bearer $TOKEN"` |
| API Key | Adicionar `-H "X-API-Key: sua_chave"` |
| Sem Autenticação | Remover middleware de auth ou desativar em N8N |
| Teste Rápido | Usar: `curl -X POST http://localhost:3000/webhook --data '{}'` |

---

## 🎯 PRÓXIMO PASSO

1. ✅ Identificar qual tipo de autenticação está usando
2. ✅ Obter token/senha válida
3. ✅ Adicionar no header da requisição
4. ✅ Testar novamente

**Se ainda não funcionar:**
→ Compartilhe a resposta completa de `-v` (verbose) para análise detalhada
