# TROUBLESHOOTING - SOLUÇÕES RÁPIDAS

## ERRO: ECONNREFUSED no Supabase

**Sintoma:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
Unable to connect to database
```

**Solução:**
```bash
# 1. Verificar pool de conexões aumentou:
psql -h seu_host -U postgres -c "SHOW max_connections;"
# Deve ser: 100 (não 10)

# 2. Se ainda for 10, rodar SQL novamente:
# Supabase → SQL Editor → Copiar optimize_indexes.sql inteiro
# Clicar RUN

# 3. Reiniciar conexões N8N:
# N8N → Settings → Credentials → Supabase → Test
# Deve passar

# 4. Se persistir, aumentar manualmente:
# Supabase → Settings → Database → Connection Pooling
# Aumentar para: 50-100
```

---

## ERRO: Google Calendar 429 Too Many Requests

**Sintoma:**
```json
{
  "error": {
    "code": 429,
    "message": "Rate Limit Exceeded"
  }
}
```

**Solução:**
```bash
# 1. Verificar se cache está ativo em N8N:
# Fluxo "Busca/Agenda Visita" → Nó "Cache Check"
# Deve ter o código JavaScript do cache

# 2. Se não tiver, copiar código:
# Ver em COMANDOS_COPIAR_COLAR.md → Nó CODE - Cache Check

# 3. Aumentar TTL do cache se necessário:
# No nó CODE - Cache Check, mudar:
# < 5 * 60 * 1000  (5 minutos)
# Para:
# < 10 * 60 * 1000 (10 minutos)

# 4. Verificar quota Google Cloud:
# https://console.cloud.google.com → Quotas
# Credential usado deve ter quota alta

# 5. Se tudo ok, problema é volume:
# Implementar batching (agrupar 5 calendários por call)
```

---

## ERRO: RabbitMQ Connection Refused

**Sintoma:**
```
Error: connect ECONNREFUSED 127.0.0.1:5672
```

**Solução:**
```bash
# 1. Verificar container está rodando:
docker ps | grep rabbitmq
# Se não aparecer, rodar:
docker-compose up -d rabbitmq

# 2. Aguarde 30 segundos (inicialização):
sleep 30

# 3. Verificar logs:
docker logs rabbitmq | tail -20
# Procure por: "completed with code 0" ou "epmd running"

# 4. Testar conexão:
telnet localhost 5672
# Esperado: resposta (CTRL+C para sair)

# 5. Verificar credenciais em N8N:
# N8N → Settings → Credentials → RabbitMQ (nueva)
# Hostname: localhost (ou IP da VPS)
# Port: 5672
# Username: guest
# Password: guest
# Test Connection: deve passar

# 6. Se tudo ok mas N8N ainda falha:
docker restart rabbitmq
docker-compose down rabbitmq
docker-compose up -d rabbitmq
```

---

## ERRO: N8N "Unauthorized" no Webhook

**Sintoma:**
```json
{
  "message": "Unauthorized",
  "request_id": "ef107621134a5a48bba4992b2e0fa00c"
}
```

**Solução:**
```bash
# 1. Verificar se webhook exige autenticação:
# N8N → Fluxo → Nó Webhook → Settings
# Procure por "Authentication"
# Se tiver, anotar a senha

# 2. Testar com autenticação:
curl -X POST http://seu_n8n/webhook/seu_webhook \
  -H "X-N8N-Webhook-Auth: sua_senha" \
  -d '{"test":true}'
# Deve responder com 200

# 3. Se for Bearer Token:
curl -X POST http://seu_n8n/webhook/seu_webhook \
  -H "Authorization: Bearer seu_token" \
  -d '{"test":true}'

# 4. Se ainda falhar, desativar auth temporariamente:
# N8N → Webhook node → Settings → Authentication: OFF
# Salvar e testar
# Ativar novamente depois
```

---

## ERRO: Evolution API Message Queue Vazia

**Sintoma:**
```bash
docker exec rabbitmq rabbitmqctl list_queues
# message_send_queue não aparece ou está vazia
```

**Solução:**
```bash
# 1. Verificar se queue existe:
docker exec rabbitmq rabbitmqctl list_queues | grep message_send_queue
# Se não aparecer, recriar:
docker exec rabbitmq rabbitmqctl declare_queue message_send_queue

# 2. Verificar binding:
docker exec rabbitmq rabbitmqctl list_bindings | grep evolution_messages
# Se vazio, recriar:
docker exec rabbitmq rabbitmqctl bind_queue message_send_queue evolution_messages "#"

# 3. Verificar se N8N está publicando:
# N8N → Fluxo → Nó RabbitMQ (Publish)
# Verificar:
# - Exchange: evolution_messages ✓
# - Queue: message_send_queue ✓
# - Message body tem JSON válido ✓

# 4. Testar publicação manual:
docker exec rabbitmq bash -c 'echo "{\"test\":true}" | rabbitmqctl publish_message evolution_messages "#" "test message"'

# 5. Se ainda não funcionar:
docker-compose down rabbitmq
docker volume rm rabbitmq_data
docker-compose up -d rabbitmq
sleep 30
# Recriar queues novamente
```

---

## ERRO: Webhook Timeout (>30 segundos)

**Sintoma:**
```
HTTP 408: Request Timeout
```

**Solução:**
```bash
# 1. Verificar se "Respond to Webhook" está no início:
# N8N → Fluxo
# 2º nó DEVE ser "Respond to Webhook"
# Se está mais abaixo, mover para 2º lugar

# 2. Verificar status da resposta:
# Nó "Respond to Webhook" → Status deve ser 200
# Body: JSON com status

# 3. Adicionar Wait após responder:
# Nó "Respond to Webhook"
# Nó "Wait" → 100ms
# Resto do fluxo

# 4. Se fluxo é muito longo (>100 nós):
# Implementar RabbitMQ (ver FASE 2)
# Responder imediato, processar em background

# 5. Verificar logs N8N:
docker logs n8n | grep -i timeout | tail -20

# 6. Aumentar timeout do servidor N8N:
# docker-compose.yml → environment:
environment:
  WEBHOOK_TUNNEL_URL: https://seu_n8n
  GENERIC_TIMEOUT_ENABLED: "true"
  GENERIC_TIMEOUT: "30000"
# Aumentar para: "60000" (60 segundos)
```

---

## ERRO: Supabase Query Muito Lenta (>5 segundos)

**Sintoma:**
```bash
# Query que antes levava 500ms agora leva 5000ms
```

**Solução:**
```bash
# 1. Verificar se índices foram criados:
psql -h seu_host -U postgres -c \
  "SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public';"
# Deve ser 12+ (foi 0 antes)

# 2. Se índices não existem, rodar SQL novamente:
# Supabase → SQL Editor
# Copiar optimize_indexes.sql
# Clicar RUN

# 3. Vacuum e analyze:
psql -h seu_host -U postgres -c "VACUUM ANALYZE;"

# 4. Verificar plano de execução:
psql -h seu_host -U postgres << 'EOF'
EXPLAIN ANALYZE SELECT * FROM imobipro_messages 
WHERE session_id = 'seu_session_id' 
LIMIT 50;
EOF
# Procure por: "Index Scan" (bom) vs "Seq Scan" (ruim)

# 5. Se ainda lento, adicionar índice específico:
CREATE INDEX idx_temp ON imobipro_messages(session_id) WHERE deleted_at IS NULL;

# 6. Problema pode ser N+1 queries:
# Ver logs N8N e contar quantas vezes mesma query aparece
# Se >1, otimizar fluxo N8N (batch queries)
```

---

## ERRO: Supabase Quota Excedida

**Sintoma:**
```json
{
  "code": "23505",
  "message": "duplicate key value violates unique constraint"
}
```

**Solução:**
```bash
# 1. Verificar storage usado:
# Supabase → Billing → Storage
# Se próximo de limite, deletar dados antigos:
psql -h seu_host -U postgres << 'EOF'
-- Deletar messages com >30 dias
DELETE FROM imobipro_messages 
WHERE created_at < now() - interval '30 days';

-- Deletar eventos antigas
DELETE FROM oncall_events 
WHERE event_date < now() - interval '90 days';

VACUUM;
EOF

# 2. Aumentar quota se necessário:
# Supabase → Settings → Billing
# Upgrade plan (se for possível)

# 3. Implementar limpeza automática:
# Criar trigger em Supabase para deletar dados antigos:
CREATE OR REPLACE FUNCTION cleanup_old_records()
RETURNS void AS $$
BEGIN
  DELETE FROM imobipro_messages 
  WHERE created_at < now() - interval '60 days';
  
  DELETE FROM oncall_events 
  WHERE event_date < now() - interval '180 days';
END;
$$ LANGUAGE plpgsql;

-- Agendar para rodar todo dia:
SELECT cron.schedule('cleanup-old-records', '0 3 * * *', 'SELECT cleanup_old_records()');
```

---

## ERRO: Cache Não Está Sendo Usado

**Sintoma:**
```bash
# Toda requisição leva 10+ segundos
# Parece que cache não está funcionando
```

**Solução:**
```bash
# 1. Verificar se N8N cache está habilitado:
# N8N → Settings → Settings
# Procure por: "Cache Settings"
# Deve estar ON

# 2. Verificar TTL do cache em N8N:
# Nó "Cache Check" deve ter:
# < 5 * 60 * 1000  (5 minutos)
# Se não estiver, atualizar

# 3. Verificar se dados estão sendo salvos:
# Nó "Save Cache" deve executar após coletar dados
# Ordem: Get data → Save Cache → Respond

# 4. Testar manualmente:
# N8N → Execution
# Rodar fluxo 2x seguidas
# 1ª deve levar 10s, 2ª <1s
# Se 2ª ainda leva 10s, cache não funciona

# 5. Limpar cache forçado:
# N8N → Fluxo → Settings → Clear persistent data
# Executar fluxo novamente

# 6. Se problema persistir, usar Redis:
# Ver FASE 3: implementar Redis para cache distribuído
```

---

## ERRO: Messages Sendo Perdidas

**Sintoma:**
```bash
# Enviar 100 mensagens, só 70 chegam
```

**Solução:**
```bash
# 1. Verificar fila RabbitMQ:
docker exec rabbitmq rabbitmqctl list_queues name messages consumer

# 2. Verificar se há Dead Letter Queue:
# Se há mensagens em DLQ, significa que falharam permanentemente
docker exec rabbitmq rabbitmqctl list_queues | grep dead

# 3. Aumentar retry:
# N8N → Nó Evolution API Send → Error handling
# Aumentar "Max Retries" de 3 para 5

# 4. Verificar logs de erro:
docker logs n8n | grep -i "evolution\|error" | tail -50

# 5. Verificar credenciais Evolution API:
# N8N → Settings → Credentials → Evolution API
# Testar conexão
# Verificar se instance_id está correto

# 6. Se tudo ok, problema é rate limit:
# Aumentar delay entre mensagens:
# Nó Wait (antes de Evolution API Send)
# Aumentar de 100ms para 500ms ou 1000ms
```

---

## PERFORMANCE: Tudo Lento Mesmo Depois de Otimizações

**Sintoma:**
```bash
# Aplicativo inteiro lento
# Não só agenda
```

**Solução:**
```bash
# 1. Verificar recursos:
docker stats --no-stream
# Ver CPU, Memory usage
# Se >80%, aumentar recursos

# 2. Verificar logs de erro:
docker logs imobdashboard-app -n 100 | grep -i error | head -20

# 3. Verificar conexões ativas:
docker exec rabbitmq rabbitmqctl list_connections | wc -l
# Se >100, problema de pool

# 4. Verificar índices criados:
psql -h seu_host -U postgres -c \
  "SELECT * FROM pg_stat_user_indexes ORDER BY idx_scan;"
# Se idx_scan=0, índice não está sendo usado

# 5. Fazer analyze:
psql -h seu_host -U postgres -c "VACUUM ANALYZE;"

# 6. Verificar queries lentas:
psql -h seu_host -U postgres << 'EOF'
SELECT query, mean_exec_time FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;
EOF

# 7. Escalar: FASE 3 (Redis, monitoring, etc)
```

---

## CHECKLIST RÁPIDO - SE NADA FUNCIONA

- [ ] RabbitMQ está rodando? `docker ps | grep rabbitmq`
- [ ] Supabase conexão ok? `psql -h seu_host -U postgres -c "SELECT 1;"`
- [ ] N8N está rodando? `curl http://localhost:3000/health`
- [ ] Índices foram criados? `psql -c "SELECT COUNT(*) FROM pg_indexes;"`
- [ ] Cache está ativo? N8N → Fluxo → Nó "Cache Check" existe?
- [ ] RabbitMQ credentials em N8N? Settings → Credentials → Test
- [ ] Webhooks têm autenticação? Se sim, está sendo passado no header?
- [ ] Logs têm erros? `docker logs -f imobdashboard-app`

Se tudo acima estiver ✓, problema é em detalhes específicos.
Rodar: `bash test-suite.sh` para diagnóstico automático.
