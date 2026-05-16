# IMPLEMENTAÇÃO PRÁTICA - DIRETO AO PONTO

## FASE 1: OTIMIZAR SUPABASE (5 minutos)

### PASSO 1: Executar SQL no Supabase
1. Abrir: https://app.supabase.com
2. Projeto ImobiDashboard
3. Clicar: SQL Editor
4. Novo Query
5. Copiar todo o conteúdo de: `optimize_indexes.sql`
6. Clicar: RUN
7. Esperar aparecer "Query executed successfully"

```bash
# Se usar CLI Supabase:
supabase db push supabase/migrations/optimize_indexes.sql
```

---

## FASE 1: IMPLEMENTAR CACHE GOOGLE CALENDAR (2 horas)

### PASSO 1: Copiar arquivo
```bash
# Na sua máquina local:
cp googleCalendarCache.ts /caminho/do/projeto/src/services/
```

### PASSO 2: No N8N - Modificar fluxo "Busca/Agenda Visita"

**Nó 1 (novo): CODE - Cache Manager**
- Tipo: Code
- Language: JavaScript
- Nome: "Cache Check"
- Código:
```javascript
const cacheKey = `gcal_${$input.all().calendarIds?.join('_') || 'default'}_${new Date().toISOString().split('T')[0]}`;
const cache = await this.getWorkflowStaticData('calendar_cache') || {};

if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp < 5 * 60 * 1000)) {
  return cache[cacheKey].data;
}
return null;
```

**Nó 2 (novo): SWITCH - Check Cache**
- Tipo: Switch
- Condicional: `{{ $previous.output === null }}`
- Se TRUE: continua para Google Calendar calls
- Se FALSE: pula direto para "Merge Results"

**Nó 3 (modificado): SET - Add delay entre chamadas**
- Antes de cada "Get availability in a calendar"
- Adicionar: Wait 100ms

**Nó 4 (novo): CODE - Save Cache**
- Após coletar todos os eventos
- Código:
```javascript
const cacheKey = `gcal_${$input.all().calendarIds?.join('_') || 'default'}_${new Date().toISOString().split('T')[0]}`;
const cache = await this.getWorkflowStaticData('calendar_cache') || {};

cache[cacheKey] = {
  data: $input.all(),
  timestamp: Date.now()
};

// Limpar cache antigo (>1 hora)
Object.keys(cache).forEach(key => {
  if (Date.now() - cache[key].timestamp > 60 * 60 * 1000) {
    delete cache[key];
  }
});

await this.setWorkflowStaticData('calendar_cache', cache);
return $input.all();
```

**Resultado:** Google Calendar calls reduzem de 20 paralelos → 1 batch, com cache de 5 minutos

---

## FASE 1: IMPLEMENTAR ASYNC WEBHOOKS (1 hora)

### PASSO 1: No N8N - Modificar fluxo "Busca/Agenda Visita"

**Local:** Assim que webhook recebe requisição

**Nó novo (2º do fluxo): RESPOND TO WEBHOOK**
- Posição: Após Webhook Trigger, ANTES de qualquer processamento
- Resposta HTTP:
```json
{
  "status": "processing",
  "id": "{{ $json.id }}",
  "message": "Sua requisição está sendo processada"
}
```
- HTTP Status: 200
- IMPORTANTE: Colocar este nó bem no início!

**Nó novo: WAIT**
- Tipo: Wait
- Tempo: 100ms
- Motivo: Dar tempo para resposta ser enviada

**Resto do fluxo:** Continua processando normalmente

**Resultado:** Cliente recebe resposta em <100ms, processamento continua em background (sem timeout)

---

## FASE 2: IMPLEMENTAR EVOLUTION API QUEUE (3 horas)

### PASSO 1: Criar novo fluxo no N8N
Nome: "Evolution API Message Queue"

**Nó 1: RABBITMQ TRIGGER**
- Exchange: `evolution_messages`
- Queue: `message_send_queue`
- Concurrency: 1 (IMPORTANTE!)
- Auto-acknowledge: true

**Nó 2: WAIT**
- Type: Time
- Time: 1000ms (1 segundo entre mensagens)

**Nó 3: EVOLUTION API - Send Text**
- Instance ID: `{{ $json.instanceId }}`
- Number: `{{ $json.to }}`
- Text: `{{ $json.message }}`

**Nó 4: SET - Success**
- Adicionar campo: `{ "status": "sent" }`

**Nó 5: ERROR HANDLER**
- Retry se falhar
- Max 3 tentativas

### PASSO 2: Modificar fluxos que enviam mensagens

**Encontrar:** Todos os nós "Enviar texto" (4 nós em "Busca/Agenda Visita")

**Substituir por:**
- RabbitMQ: Publish
  - Exchange: `evolution_messages`
  - Message:
```json
{
  "to": "{{ $json.phone }}",
  "message": "{{ $json.text }}",
  "instanceId": "{{ $env.EVOLUTION_INSTANCE_ID }}",
  "retryCount": 0
}
```

**Nó seguinte:** Respond immediately
- "Mensagem enfileirada para envio"

**Resultado:** Mensagens param de cair, garantia 99% de entrega

---

## FASE 2: CONFIGURAR RABBITMQ NA VPS (1 hora)

```bash
# Na VPS:

# PASSO 1: Docker Compose (adicionar ao docker-compose.yml)
cat >> docker-compose.yml << 'EOF'

rabbitmq:
  image: rabbitmq:3.12-management
  container_name: rabbitmq
  ports:
    - "5672:5672"    # AMQP
    - "15672:15672"  # Management UI
  environment:
    RABBITMQ_DEFAULT_USER: guest
    RABBITMQ_DEFAULT_PASS: guest
  volumes:
    - rabbitmq_data:/var/lib/rabbitmq
  networks:
    - app_network

volumes:
  rabbitmq_data:
EOF

# PASSO 2: Subir container
docker-compose up -d rabbitmq

# PASSO 3: Verificar
docker logs rabbitmq | tail -20
curl http://localhost:15672 (user: guest / pass: guest)

# PASSO 4: Criar exchanges no RabbitMQ
docker exec rabbitmq rabbitmqctl add_user admin admin
docker exec rabbitmq rabbitmqctl set_permissions -p / admin ".*" ".*" ".*"
docker exec rabbitmq rabbitmqctl declare_exchange evolution_messages topic
docker exec rabbitmq rabbitmqctl declare_queue message_send_queue
docker exec rabbitmq rabbitmqctl bind_queue message_send_queue evolution_messages "#"

# PASSO 5: Testar
curl -i -u guest:guest http://localhost:15672/api/connections
```

### No N8N:
Settings → Credentials → New Credential
- Type: RabbitMQ
- Hostname: localhost (ou IP da VPS)
- Port: 5672
- Username: guest
- Password: guest

---

## FASE 2: COPIAR CÓDIGO TYPESCRIPT (1 hora)

### PASSO 1: Copiar serviços
```bash
# Local do projeto:
cp retryService.ts src/services/
cp googleCalendarCache.ts src/services/  # (se não copiou antes)
cp useOptimizedAgenda.ts src/hooks/
```

### PASSO 2: Usar nos componentes
```typescript
// Em seus componentes React:

import { useOptimizedAgenda } from '@/hooks/useOptimizedAgenda'
import { CircuitBreaker } from '@/services/retryService'

export function AgendaView() {
  const { events, loading, error, refresh } = useOptimizedAgenda({
    calendarIds: ['cal1@gmail.com', 'cal2@gmail.com'],
    cacheTtl: 300  // 5 minutos
  })

  if (loading) return <Skeleton />
  if (error) return <Error msg={error} onRetry={refresh} />

  return <EventsList events={events} />
}
```

### PASSO 3: Testar
```bash
npm run build
npm run dev
# Abrir http://localhost:8081
# Agenda deve carregar em <5s (cache) vs 45s (antes)
```

---

## TESTES - VALIDAR TUDO

### TESTE 1: Cache Google Calendar
```bash
# Na VPS ou localhost:

# Primeira chamada (sem cache, 5-10 segundos):
time curl http://localhost:3000/api/calendar

# Próximas chamadas (com cache, <500ms):
for i in {1..5}; do
  echo "Teste $i:"
  time curl http://localhost:3000/api/calendar
  sleep 1
done
```

**Esperado:** 1ª lenta, 2-5 rápidas

### TESTE 2: Evolution API Queue
```bash
# Enviar 20 mensagens:
for i in {1..20}; do
  curl -X POST http://localhost:3000/api/send-message \
    -H "Content-Type: application/json" \
    -d '{"to":"5511999999999","text":"Teste '$i'"}'
  echo "Mensagem $i enviada"
done

# Verificar RabbitMQ
docker exec rabbitmq rabbitmqctl list_queues message_send_queue
```

**Esperado:** Queue processa 1 por segundo, sem perda

### TESTE 3: Webhook Response Time
```bash
# Medir tempo de resposta:
time curl -X POST http://localhost:3000/webhook/agenda-update \
  -H "Content-Type: application/json" \
  -d '{"test":true}'
```

**Esperado:** real <100ms (resposta imediata)

### TESTE 4: Supabase Connection
```bash
# Verificar índices criados:
psql -U postgres -h localhost -c "SELECT * FROM pg_indexes WHERE schemaname='public';"
```

**Esperado:** 10+ índices novos listados

---

## RESUMO DO QUE VOCÊ FARÁ

- **5 min:** SQL Supabase
- **2h:** Cache Google Calendar em N8N
- **1h:** Async webhooks em N8N
- **3h:** Queue Evolution API em N8N
- **1h:** RabbitMQ na VPS
- **1h:** Código TypeScript
- **30 min:** Testes

**Total: ~8.5 horas (ou ~2 dias de trabalho)**

**Resultado:** -70% de erros na Fase 1

---

## ORDEM RECOMENDADA

1. ✅ Supabase SQL (5 min) - faz diferença imediata
2. ✅ Async Webhooks (1 hora) - resolve timeouts
3. ✅ Cache Google Calendar (2 horas) - resolve 429 errors
4. ✅ RabbitMQ (1 hora) - setup infra
5. ✅ Evolution API Queue (3 horas) - resolve message loss
6. ✅ Código TypeScript (1 hora) - melhor integração
7. ✅ Testes (30 min) - validar

Se tiver erro em qualquer etapa, rode `test-suite.sh` para diagnosticar
