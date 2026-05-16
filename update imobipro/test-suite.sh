#!/bin/bash
# TESTE PRÁTICO - IMOBDASHBOARD API
# Executar no servidor onde está rodando o app

echo "╔═════════════════════════════════════════════════════════════════╗"
echo "║     TESTES DE VALIDAÇÃO - ImobiDashboard (Ambiente Real)       ║"
echo "╚═════════════════════════════════════════════════════════════════╝"

# Variáveis - AJUSTE CONFORME SEU AMBIENTE
API_URL="http://localhost:3000"  # Mude se não for localhost
N8N_URL="https://n8n.seudominio.com"  # URL do N8N
SUPABASE_URL="https://supabase.seudominio.com"
AUTH_TOKEN=""  # Token JWT válido do seu sistema

echo ""
echo "⚙️  CONFIGURAÇÕES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "API URL: $API_URL"
echo "N8N URL: $N8N_URL"
echo "Supabase: $SUPABASE_URL"
echo ""

# =============================================================================
# TESTE 1: VERIFICAR CONECTIVIDADE
# =============================================================================

echo "📡 TESTE 1: Conectividade básica"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" 2>/dev/null | grep -q "200\|404\|500"; then
    echo "✅ API respondendo"
else
    echo "❌ API não respondendo - verificar:"
    echo "   1. Se o servidor está rodando"
    echo "   2. Se a porta está correta"
    echo "   3. Se o firewall permite acesso"
    exit 1
fi

# =============================================================================
# TESTE 2: AUTENTICAÇÃO
# =============================================================================

echo ""
echo "🔐 TESTE 2: Autenticação"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Tentar fazer login
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123"
  }')

if echo "$LOGIN_RESPONSE" | grep -q "token\|error"; then
    echo "✅ Endpoint de autenticação encontrado"
    
    # Extrair token se disponível
    if TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4); then
        AUTH_TOKEN=$TOKEN
        echo "✅ Token obtido: ${TOKEN:0:20}..."
    fi
else
    echo "⚠️  Autenticação pode estar configurada diferente"
    echo "   Resposta: $(echo "$LOGIN_RESPONSE" | head -c 100)"
fi

# =============================================================================
# TESTE 3: WEBHOOK RESPONSIVENESS
# =============================================================================

echo ""
echo "⏱️  TESTE 3: Webhook Response Time"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Testar resposta de webhook simples
echo "Medindo tempo de resposta do webhook..."

HEADER=""
if [ -n "$AUTH_TOKEN" ]; then
    HEADER="-H 'Authorization: Bearer $AUTH_TOKEN'"
fi

START_TIME=$(date +%s%N)

RESPONSE=$(eval "curl -s -X POST '$API_URL/webhook/test-agenda' \
  -H 'Content-Type: application/json' \
  $HEADER \
  -d '{\"action\":\"test\"}' \
  -w '\\n%{http_code}'")

END_TIME=$(date +%s%N)
DURATION=$((($END_TIME - $START_TIME) / 1000000))

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)

echo "HTTP Code: $HTTP_CODE"
echo "Tempo: ${DURATION}ms"
echo "Body: $(echo "$BODY" | head -c 100)"

if [ "$DURATION" -lt 200 ]; then
    echo "✅ Resposta rápida (<200ms)"
elif [ "$DURATION" -lt 1000 ]; then
    echo "⚠️  Resposta normal (< 1s)"
else
    echo "❌ Resposta lenta (>1s)"
    echo "   Pode indicar problema em processamento"
fi

# =============================================================================
# TESTE 4: SUPABASE CONNECTIVITY
# =============================================================================

echo ""
echo "🗄️  TESTE 4: Supabase Connection"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Testar endpoint que acessa Supabase
SUPABASE_TEST=$(eval "curl -s -X GET '$API_URL/api/messages/recent' \
  -H 'Accept: application/json' \
  $HEADER")

if echo "$SUPABASE_TEST" | grep -q "error\|Error"; then
    echo "⚠️  Possível erro ao acessar Supabase:"
    echo "    $(echo "$SUPABASE_TEST" | head -c 150)"
elif echo "$SUPABASE_TEST" | grep -q "\[\|{"; then
    echo "✅ Supabase acessível"
    echo "    Respondeu: $(echo "$SUPABASE_TEST" | head -c 100)"
else
    echo "⚠️  Resposta inesperada do Supabase"
fi

# =============================================================================
# TESTE 5: GOOGLE CALENDAR
# =============================================================================

echo ""
echo "📅 TESTE 5: Google Calendar Integration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

GCAL_TEST=$(eval "curl -s -X POST '$API_URL/api/google-calendar/check' \
  -H 'Content-Type: application/json' \
  $HEADER")

if echo "$GCAL_TEST" | grep -qi "401\|unauthorized"; then
    echo "⚠️  Google Calendar: Autenticação expirada"
    echo "   Ação: Renovar credenciais no dashboard"
elif echo "$GCAL_TEST" | grep -qi "429\|quota"; then
    echo "❌ Google Calendar: Rate limit atingido"
    echo "   Ação: Implementar cache (veja N8N_IMPLEMENTATION_GUIDE.md)"
elif echo "$GCAL_TEST" | grep -q "success\|ok"; then
    echo "✅ Google Calendar: OK"
else
    echo "⚠️  Google Calendar: Sem resposta clara"
fi

# =============================================================================
# TESTE 6: EVOLUTION API
# =============================================================================

echo ""
echo "💬 TESTE 6: Evolution API Integration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

EVOLUTION_TEST=$(eval "curl -s -X POST '$API_URL/api/evolution/send' \
  -H 'Content-Type: application/json' \
  $HEADER \
  -d '{\"test\":true}'")

if echo "$EVOLUTION_TEST" | grep -qi "queue\|queued\|processing"; then
    echo "✅ Evolution API: Pronto"
elif echo "$EVOLUTION_TEST" | grep -qi "error\|failed"; then
    echo "⚠️  Evolution API: Erro na requisição"
    echo "    $(echo "$EVOLUTION_TEST" | head -c 150)"
else
    echo "⚠️  Evolution API: Resposta indefinida"
fi

# =============================================================================
# TESTE 7: LOAD TEST - SIMULAR CARGA
# =============================================================================

echo ""
echo "⚡ TESTE 7: Teste de Carga Simples"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "Enviando 5 requisições sequenciais..."

SUCCESS=0
FAIL=0
TIMES=()

for i in {1..5}; do
    START=$(date +%s%N)
    
    RESPONSE=$(eval "curl -s -X POST '$API_URL/webhook/test' \
      -H 'Content-Type: application/json' \
      $HEADER \
      -w '\\n%{http_code}'")
    
    END=$(date +%s%N)
    DURATION=$((($END - $START) / 1000000))
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    
    TIMES+=($DURATION)
    
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
        SUCCESS=$((SUCCESS + 1))
    else
        FAIL=$((FAIL + 1))
    fi
    
    printf "  Req $i: ${DURATION}ms (HTTP $HTTP_CODE)\n"
    sleep 0.5  # Delay entre requisições
done

echo ""
echo "Resumo: $SUCCESS sucesso, $FAIL falhas"

# Calcular média
if [ ${#TIMES[@]} -gt 0 ]; then
    SUM=0
    for t in "${TIMES[@]}"; do
        SUM=$((SUM + t))
    done
    AVG=$((SUM / ${#TIMES[@]}))
    echo "Tempo médio: ${AVG}ms"
fi

# =============================================================================
# TESTE 8: WEBHOOK HEADERS
# =============================================================================

echo ""
echo "📋 TESTE 8: Webhook Headers Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "Verificando headers da resposta..."

HEADERS=$(eval "curl -s -I '$API_URL/webhook/test' \
  -H 'Content-Type: application/json' \
  $HEADER")

if echo "$HEADERS" | grep -qi "Content-Type"; then
    echo "✅ Content-Type: $(echo "$HEADERS" | grep -i 'Content-Type' | cut -d' ' -f2-)"
fi

if echo "$HEADERS" | grep -qi "Access-Control"; then
    echo "✅ CORS: Habilitado"
else
    echo "⚠️  CORS: Não detectado"
fi

if echo "$HEADERS" | grep -qi "X-RateLimit"; then
    echo "✅ Rate Limit: $(echo "$HEADERS" | grep -i 'X-RateLimit')"
fi

# =============================================================================
# RESUMO FINAL
# =============================================================================

echo ""
echo "╔═════════════════════════════════════════════════════════════════╗"
echo "║                    RESUMO DOS TESTES                           ║"
echo "╚═════════════════════════════════════════════════════════════════╝"

echo ""
echo "✅ Testes completados"
echo ""
echo "PRÓXIMOS PASSOS:"
echo "  1. Se houver erros de autenticação:"
echo "     → Adicionar token válido: AUTH_TOKEN=\"seu_token\""
echo ""
echo "  2. Se houver erros de conectividade:"
echo "     → Verificar URL da API (atualmente: $API_URL)"
echo "     → Verificar firewall/proxy"
echo ""
echo "  3. Se houver lentidão (>1s):"
echo "     → Implementar Fase 1 do roadmap"
echo "     → Executar optimize_indexes.sql"
echo ""
echo "  4. Para teste de carga mais robusto:"
echo "     → Usar: ab -n 100 -c 10 http://localhost:3000/webhook/test"
echo "     → Ou: wrk -t4 -c100 -d30s http://localhost:3000/webhook/test"
echo ""

# =============================================================================
# TESTE AVANÇADO - OPCIONALMENTE ATIVAR
# =============================================================================

echo ""
echo "💡 TESTES OPCIONAIS DISPONÍVEIS:"
echo ""
echo "Para testar CACHE de Google Calendar (após implementação):"
echo "  for i in {1..10}; do"
echo "    echo \"Teste \$i:\" && time curl -s http://localhost:3000/api/calendar | head -c 50"
echo "    sleep 1"
echo "  done"
echo ""
echo "Para testar RETRY com simular falha:"
echo "  # Com curl, simular timeout:"
echo "  curl --max-time 1 http://localhost:3000/slow-endpoint"
echo ""
echo "Para testar CIRCUIT BREAKER:"
echo "  # Enviar 10 requisições sequenciais a endpoint com erro"
echo "  for i in {1..10}; do curl -X POST http://localhost:3000/bad-endpoint; done"
echo ""

exit 0
