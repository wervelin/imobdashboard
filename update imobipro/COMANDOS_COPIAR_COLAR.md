# COMANDOS PRONTOS PARA COPIAR E COLAR

## SUPABASE - COPIAR E COLAR SQL

**Acessar:**
1. https://app.supabase.com
2. Seu projeto → SQL Editor
3. Novo Query
4. **COPIAR TODO O CÓDIGO ABAIXO:**

```sql
-- ============================================================================
-- FASE 1: OTIMIZAÇÕES IMEDIATAS SUPABASE
-- ============================================================================

-- 1. AUMENTAR CONNECTION POOL
ALTER SYSTEM SET max_connections = 100;
ALTER SYSTEM SET shared_buffers = '4GB';
SELECT pg_reload_conf();

-- 2. ÍNDICES CRÍTICOS (copiar tudo)
CREATE INDEX IF NOT EXISTS idx_imobipro_messages_session_id ON imobipro_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_imobipro_messages_instancia ON imobipro_messages(instancia);
CREATE INDEX IF NOT EXISTS idx_imobipro_messages_created_at ON imobipro_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_imobipro_messages_session_created ON imobipro_messages(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_chat_instance ON user_profiles(chat_instance);
CREATE INDEX IF NOT EXISTS idx_oncall_events_user_id ON oncall_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oncall_events_date_range ON oncall_events(event_date);
CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_contracts_property_id ON contracts(property_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);

-- 3. VACUUM E ANALYZE
VACUUM ANALYZE;

-- 4. CONFIRMAR
SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public';
SHOW max_connections;
```

5. Clicar **RUN**
6. Esperado: "Query executed successfully"

---

## VPS / DOCKER - COMANDOS

### Copiar RabbitMQ (docker-compose.yml)
```bash
# SSH na VPS:
ssh root@seu_ip_vps

# Editar docker-compose.yml:
nano docker-compose.yml

# Adicionar ao final (manter indentação):
---
rabbitmq:
  image: rabbitmq:3.12-management
  container_name: rabbitmq
  ports:
    - "5672:5672"
    - "15672:15672"
  environment:
    RABBITMQ_DEFAULT_USER: guest
    RABBITMQ_DEFAULT_PASS: guest
  volumes:
    - rabbitmq_data:/var/lib/rabbitmq
  networks:
    - app_network

volumes:
  rabbitmq_data:
---

# Salvar: CTRL+O, ENTER, CTRL+X

# Subir RabbitMQ:
docker-compose up -d rabbitmq

# Verificar:
docker logs rabbitmq | tail -20

# Acessar UI: http://seu_ip:15672 (guest/guest)
```

### Setup RabbitMQ (Exchanges e Queues)
```bash
# SSH na VPS:

# Criar user admin:
docker exec rabbitmq rabbitmqctl add_user admin admin

# Dar permissões:
docker exec rabbitmq rabbitmqctl set_permissions -p / admin ".*" ".*" ".*"

# Criar exchange:
docker exec rabbitmq rabbitmqctl declare_exchange evolution_messages topic

# Criar queue:
docker exec rabbitmq rabbitmqctl declare_queue message_send_queue

# Binder queue ao exchange:
docker exec rabbitmq rabbitmqctl bind_queue message_send_queue evolution_messages "#"

# Verificar tudo:
docker exec rabbitmq rabbitmqctl list_exchanges
docker exec rabbitmq rabbitmqctl list_queues
```

### Testar RabbitMQ
```bash
# Ver conexões ativas:
curl -i -u guest:guest http://localhost:15672/api/connections

# Ver queues:
curl -i -u guest:guest http://localhost:15672/api/queues

# Testar publicação (se tiver amqp-tools):
amqp-publish -u guest -p guest -H localhost -e evolution_messages -r "#" -b '{"test":true}'
```

---

## PROJETO LOCAL - COPIAR ARQUIVOS

```bash
# No seu projeto (pasta raiz):

# 1. Copiar serviços:
cp /caminho/dos/arquivos/googleCalendarCache.ts src/services/
cp /caminho/dos/arquivos/retryService.ts src/services/
cp /caminho/dos/arquivos/useOptimizedAgenda.ts src/hooks/

# 2. Instalar tipos se não tiver:
npm install --save-dev @types/node

# 3. Build:
npm run build

# 4. Dev (testar):
npm run dev
```

---

## N8N - CÓDIGO PARA COPIAR

### Nó CODE - Cache Check
```javascript
const cacheKey = `gcal_${$input.all().calendarIds?.join('_') || 'default'}_${new Date().toISOString().split('T')[0]}`;
const cache = await this.getWorkflowStaticData('calendar_cache') || {};

if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp < 5 * 60 * 1000)) {
  return cache[cacheKey].data;
}
return null;
```

### Nó CODE - Save Cache
```javascript
const cacheKey = `gcal_${$input.all().calendarIds?.join('_') || 'default'}_${new Date().toISOString().split('T')[0]}`;
const cache = await this.getWorkflowStaticData('calendar_cache') || {};

cache[cacheKey] = {
  data: $input.all(),
  timestamp: Date.now()
};

Object.keys(cache).forEach(key => {
  if (Date.now() - cache[key].timestamp > 60 * 60 * 1000) {
    delete cache[key];
  }
});

await this.setWorkflowStaticData('calendar_cache', cache);
return $input.all();
```

### Nó RESPOND TO WEBHOOK
```
HTTP Status: 200
Body (JSON):
{
  "status": "processing",
  "id": "{{ $json.id }}",
  "message": "Sua requisição está sendo processada"
}
```

### Nó RABBITMQ - Publish
```
Exchange: evolution_messages
Routing Key: #
Message Body:
{
  "to": "{{ $json.phone }}",
  "message": "{{ $json.text }}",
  "instanceId": "{{ $env.EVOLUTION_INSTANCE_ID }}",
  "retryCount": 0
}
```

---

## TESTES - COPIAR E COLAR

### Teste 1: Cache Google Calendar
```bash
# SSH na VPS ou localhost:

# Medir primeira chamada (com API):
time curl -X GET http://localhost:3000/api/calendar \
  -H "Authorization: Bearer YOUR_TOKEN"

# Próximas (com cache):
for i in {1..5}; do
  echo "=== Teste $i ==="
  time curl -X GET http://localhost:3000/api/calendar \
    -H "Authorization: Bearer YOUR_TOKEN"
  sleep 2
done

# Esperado: 1ª = 5-10s, 2-5 = <500ms
```

### Teste 2: Evolution API Message Loss
```bash
# Simular 30 mensagens:
for i in {1..30}; do
  curl -X POST http://localhost:3000/api/send-message \
    -H "Content-Type: application/json" \
    -d '{
      "to":"5511999999999",
      "message":"Teste '$i'",
      "instanceId":"seu_instance_id"
    }' &
  sleep 0.1
done

# Verificar fila no RabbitMQ:
docker exec rabbitmq rabbitmqctl list_queues name messages

# Esperado: 30 mensagens enfileiradas, nenhuma perdida
```

### Teste 3: Webhook Response Time
```bash
# Medir resposta:
time curl -X POST http://localhost:3000/webhook/agenda-update \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "id":"test123",
    "action":"test"
  }'

# Esperado: real <100ms
```

### Teste 4: Supabase Connection Pool
```bash
# SSH na VPS, conectar ao Supabase:
psql -h seu_host_supabase -U postgres -c "SHOW max_connections;"

# Verificar índices:
psql -h seu_host_supabase -U postgres -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public';"

# Esperado: 
# max_connections = 100
# COUNT = 12+ (novos índices)
```

### Teste 5: Carga Paralela
```bash
# Simular 10 requisições paralelas:
for i in {1..10}; do
  curl -X POST http://localhost:3000/webhook/test &
done
wait

# Verificar se todas passaram (sem ECONNREFUSED)
# Esperado: 10/10 sucesso
```

---

## VERIFICAÇÃO FINAL

```bash
# SSH na VPS:

# 1. Verificar RabbitMQ:
docker ps | grep rabbitmq
docker exec rabbitmq rabbitmqctl status

# 2. Verificar Supabase:
curl -s https://seu_supabase.com/health | jq

# 3. Verificar N8N:
curl -s http://seu_n8n/health | jq

# 4. Verificar logs (últimas 100 linhas):
docker logs imobdashboard-app -n 100 | tail -50

# 5. Ver uso de memória:
docker stats --no-stream

# Tudo verde? Próxima fase!
```

---

## ROLLBACK (se der problema)

```bash
# Supabase (remover índices):
DROP INDEX idx_imobipro_messages_session_id;
DROP INDEX idx_imobipro_messages_instancia;
# ... etc

# RabbitMQ (para container):
docker-compose down rabbitmq
docker volume rm rabbitmq_data

# N8N (voltar workflow anterior):
# Ir em N8N → Workflow → Restore version
```

---

## CHECKPOINTS

- ✅ SQL Supabase executado
- ✅ RabbitMQ rodando (`docker ps`)
- ✅ N8N credenciais RabbitMQ adicionadas
- ✅ Fluxos N8N modificados
- ✅ Código TypeScript copiado
- ✅ Build passou (`npm run build`)
- ✅ Testes passaram (nenhum erro)
- ✅ Logs limpos (sem ECONNREFUSED, sem timeouts)

Se tudo ✅, você completou a FASE 1 com sucesso!

Próximo: FASE 2 (Redis + mais otimizações)
