# IMPLEMENTAÇÃO N8N - GUIA PRÁTICO

## 🎯 SOLUÇÃO 1: GOOGLE CALENDAR RATE LIMIT

### Problema Atual
```
Fluxo: Busca/Agenda Visita #ImobiPro
- 20 nós "Get availability in a calendar" em paralelo
- Google Calendar API limit: 1000 req/100s por usuário
- Resultado: 429 Too Many Requests em 50% das execuções
```

### Solução: Implementar Cache + Batch

**Passo 1: Adicionar nó Code (Node.js)**
```javascript
// Nome: Cache Manager - Calendarios

const cacheKey = `gcal_${$input.all().calendarIds.join('_')}_${
  new Date().toISOString().split('T')[0]
}`;

// Verificar cache do N8N
const cached = await this.getWorkflowStaticData('calendar_cache') || {};

if (cached[cacheKey] && 
    (Date.now() - cached[cacheKey].timestamp < 5 * 60 * 1000)) {
  // Cache válido
  return cached[cacheKey].data;
}

// Não tem cache, passar adiante
return null;
```

**Passo 2: Adicionar nó Switch**
```
Condicional: {{ $previous.output }}
- SE cache existe: Return cache
- SE cache não existe: Continuar para buscar no Google Calendar
```

**Passo 3: Agrupar Google Calendar calls em 1 nó**

ANTES:
```
Nó 1: Get calendar 1
Nó 2: Get calendar 2
Nó 3: Get calendar 3
... (20 nós em paralelo)
```

DEPOIS:
```
Nó 1: Code - Batch request
{
  "items": [
    { "calendarId": "cal1@...", "timeMin": "2024-01-01T00:00:00Z" },
    { "calendarId": "cal2@...", "timeMin": "2024-01-01T00:00:00Z" }
  ]
}

Nó 2: Loop - For each calendar
  Nó 2.1: Get availability (1 por vez, com delay)
  Nó 2.2: Wait 100ms entre chamadas

Nó 3: Merge results
```

**Passo 4: Salvar em cache após buscar**
```javascript
// Nome: Save Cache

const cacheKey = `gcal_${...}_${...}`;
const cached = await this.getWorkflowStaticData('calendar_cache') || {};

cached[cacheKey] = {
  data: $input.all(),
  timestamp: Date.now()
};

// Limpar cache antigo (>1 hora)
Object.keys(cached).forEach(key => {
  if (Date.now() - cached[key].timestamp > 60 * 60 * 1000) {
    delete cached[key];
  }
});

await this.setWorkflowStaticData('calendar_cache', cached);

return $input.all();
```

---

## 🎯 SOLUÇÃO 2: EVOLUTION API THROTTLING

### Problema Atual
```
Fluxos: Busca/Agenda Visita, Recepção, Match Imóveis
- 31 nós Evolution API
- Enviando em paralelo: 10+ mensagens/segundo
- Evolution limit: 60 requests/minuto = 1 req/segundo
- Resultado: Message queue overflow, 30% mensagens perdidas
```

### Solução: RabbitMQ Queue + Rate Limiter

**Passo 1: Criar novo fluxo - "Evolution API Queue"**

```
Nó 1: RabbitMQ Trigger
  - Exchange: "evolution_messages"
  - Queue: "message_send_queue"
  - Concurrency: 1 (processa 1 por vez)

Nó 2: Wait - Add delay
  - Delay: 1000ms (1 segunda)
  - Garante rate limit

Nó 3: Evolution API - Send Text
  - number: {{ $json.to }}
  - text: {{ $json.message }}
  - instanceId: {{ $json.instanceId }}

Nó 4: Handle Success
  - Update Supabase
  - Mark message as sent

Nó 5: Handle Error (Error Trigger)
  - Retry logic
  - Log error
```

**Passo 2: Modificar fluxos que enviam mensagens**

ANTES:
```
Nó X: Evolution API - Send Text (direto)
```

DEPOIS:
```
Nó X: RabbitMQ - Publish
  - Exchange: "evolution_messages"
  - Message: {
      "to": "{{ $json.phone }}",
      "message": "{{ $json.text }}",
      "instanceId": "{{ $env.EVOLUTION_INSTANCE_ID }}",
      "retryCount": 0
    }

Nó X+1: Continue (Webhook respond imediato)
  "Mensagem enfileirada para envio"
```

**Passo 3: Configure RabbitMQ no N8N**
```
Settings → Credentials → New
- Type: RabbitMQ
- Hostname: rabbitmq.seudominio.com
- Port: 5672
- Username: guest
- Password: ****
```

---

## 🎯 SOLUÇÃO 3: SUPABASE CONNECTION POOL

### Problema Atual
```
12 fluxos rodando → Pool de 10 conexões ESGOTA
Error: connect ECONNREFUSED
Timeouts aleatórios
```

### Solução: Aumentar pool + Batch queries

**Passo 1: Executar SQL no Supabase (Dashboard → SQL)**
```sql
-- Arquivo: supabase/migrations/optimize_indexes.sql
-- Rodará: ALTER SYSTEM SET max_connections = 100
-- E adicionar índices
```

**Passo 2: Modificar Supabase calls em N8N**

ANTES:
```
Nó: Supabase - Insert rows
  Table: imobipro_messages
  Rows: 1 (insere 1 linha por vez)
  // PROBLEMA: 12 fluxos × 1 insert = 12 conexões
```

DEPOIS:
```
Nó: Code - Batch inserts

const rows = [
  { session_id: $json.session_1, content: "..." },
  { session_id: $json.session_2, content: "..." },
  ...
];

// Agrupar em batches de 10
const batches = [];
for (let i = 0; i < rows.length; i += 10) {
  batches.push(rows.slice(i, i + 10));
}

return batches;

// Nó: Loop - For each batch
  Nó Loop.1: Supabase - Insert rows
    Table: imobipro_messages
    Rows: {{ $json }}
    // Insere 10 linhas de uma vez
```

**Passo 3: Adicionar Connection Timeout**

```
Nó: Supabase - [qualquer operação]
  Error handling: Add
  - Retry on timeout
  - Max retries: 3
  - Backoff: exponential
```

---

## 🎯 SOLUÇÃO 4: WEBHOOK TIMEOUT

### Problema Atual
```
Webhook timeout em 30 segundos
Fluxo: Busca/Agenda Visita tem 160 nós = leva 60+ segundos
Resultado: "Request timeout" para o usuário
```

### Solução: Resposta Imediata + Background Job

**Passo 1: Modificar fluxo principal**

ANTES:
```
Nó 1: Webhook Trigger

Nó 2-160: Processar (60+ segundos)

Nó 161: Respond to Webhook
```

DEPOIS:
```
Nó 1: Webhook Trigger
  - Extract: id, phone, message

Nó 2: NOVO - Respond to Webhook (RESPONDER IMEDIATO)
  Response code: 200
  Body: { "status": "processing", "id": "$json.id" }
  // Cliente recebe resposta em <100ms

Nó 3: NOVO - Enqueue to RabbitMQ
  - Queue: "background_jobs"
  - Message: { 
      "jobId": "uuid()",
      "type": "agenda_visita_processing",
      "payload": $json
    }

Nó 4: Continue (sem esperar resposta)
  // Processamento continua em background
```

**Passo 2: Criar novo fluxo - Background Job Processor**

```
Nó 1: RabbitMQ Trigger
  Queue: "background_jobs"

Nó 2-159: Seu processamento original
  (buscar calendários, enviar mensagens, etc)

Nó 160: Supabase - Update job status
  Table: background_jobs
  Update: status = "completed"
```

---

## 🎯 SOLUÇÃO 5: AI NODES TIMEOUT

### Problema Atual
```
LangChain + OpenAI levando 15-45 segundos
Chat com IA ficando travado
```

### Solução: Timeout + Fallback

**Modificar nó LM Chat OpenAI:**

```
Nó: LM Chat OpenAI
  ...
  Timeout: 10000 (10 segundos)
  Error handling: Add
    - On timeout:
      - Return fallback message:
        "Desculpe, não consegui processar sua pergunta. 
         Por favor, tente novamente ou 
         entre em contato com o suporte."
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### FASE 1: IMEDIATO (Esta semana)
- [ ] Executar SQL: `supabase/migrations/optimize_indexes.sql`
- [ ] Implementar Google Calendar cache (Passo 1-4 acima)
- [ ] Adicionar timeout em Evolution API nós
- [ ] Adicionar Respond to Webhook imediato em fluxos longos

**Tempo:** 4 horas
**Teste:** Rodar 10 fluxos em paralelo → 0 timeouts

### FASE 2: CURTO PRAZO (Próxima semana)
- [ ] Configurar RabbitMQ
- [ ] Implementar Evolution API queue
- [ ] Converter fluxos para background jobs
- [ ] Adicionar retry logic em HTTP calls

**Tempo:** 8 horas
**Teste:** Enviar 100 mensagens → 100% entregues

### FASE 3: MÉDIO PRAZO (2 semanas)
- [ ] Implementar circuit breaker
- [ ] Add monitoring/alerting
- [ ] Otimizar queries com índices
- [ ] Implementar caching distribuído

**Tempo:** 12 horas
**Teste:** Performance +300%

---

## 🧪 TESTES VALIDAÇÃO

### Teste 1: Google Calendar Cache
```
POST http://localhost:8000/webhook/test-agenda
{
  "calendarIds": ["cal1@google.com", "cal2@google.com", ...],
  "action": "fetch"
}

ESPERADO:
- Primeira chamada: 5-10 segundos (busca API)
- Segunda chamada (5 min depois): <500ms (cache)
- Terceira chamada: <500ms (cache)
```

### Teste 2: Evolution API Throttling
```
// Enviar 100 mensagens em 1 minuto
for i in {1..100}; do
  curl -X POST http://localhost:8000/send-message \
    -d '{"to":"55119999999", "text":"msg"}'
done

ESPERADO:
- Taxa: 1 mensagem/segundo (throttled)
- Taxa real: 60 mensagens/min
- Entrega: 100/100 (0% perda)
```

### Teste 3: Webhook Timeout
```
POST http://localhost:8000/webhook/agenda-update

ESPERADO:
- Response time: <200ms
- Status: 200 "processing"
- Processamento: Continua em background
```

---

## 📊 MÉTRICAS ESPERADAS

| Métrica | Antes | Depois | Ganho |
|---------|-------|--------|-------|
| Google Calendar calls | 20 paralelo | 1 batch | 95% ↓ |
| Evolution API success | 70% | 99% | 29% ↑ |
| Webhook timeout rate | 40% | 0% | 100% ↓ |
| Agenda load time | 15-45s | 2-5s | 80% ↓ |
| Supabase errors | 40% | 2% | 95% ↓ |
| LLM response time | 30s | 10s | 67% ↓ |

**ROI:** -95% de erros, +300% performance

---

## 🆘 TROUBLESHOOTING

### Problema: Ainda vendo "429 Too Many Requests"
```
Solução:
1. Verificar se cache está ativo
2. Aumentar TTL do cache (300s → 600s)
3. Verificar rate limit via Google Cloud Console
4. Implementar quota manager
```

### Problema: RabbitMQ connection refused
```
Solução:
1. Verificar se RabbitMQ está rodando
2. Confirmar credenciais
3. Verificar firewall/rules
4. Ver logs: docker logs rabbitmq
```

### Problema: Circuit breaker sempre OPEN
```
Solução:
1. Aumentar timeout
2. Verificar API externas disponíveis
3. Aumentar reset time (60s → 120s)
4. Adicionar logging detalhado
```

---

## 📞 SUPORTE

Documentação Completa:
- `N8N_ISSUES_ANALYSIS.md` - Análise detalhada
- `optimize_indexes.sql` - SQL para otimizações
- `googleCalendarCache.ts` - Serviço TypeScript
- `retryService.ts` - Retry + Circuit breaker
- `useOptimizedAgenda.ts` - Exemplo de implementação
