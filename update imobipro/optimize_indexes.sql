-- ============================================================================
-- OTIMIZAÇÕES SUPABASE - RESOLVER CONNECTION POOL E PERFORMANCE
-- ============================================================================

-- 1. AUMENTAR LIMITES DE CONEXÃO
ALTER SYSTEM SET max_connections = 100;
ALTER SYSTEM SET shared_buffers = '4GB';
ALTER SYSTEM SET effective_cache_size = '12GB';
ALTER SYSTEM SET work_mem = '10MB';
ALTER SYSTEM SET maintenance_work_mem = '1GB';

-- Reload configuration
SELECT pg_reload_conf();

-- ============================================================================
-- 2. ADICIONAR ÍNDICES CRÍTICOS (Faltando nos fluxos N8N)
-- ============================================================================

-- Índices para imobipro_messages (usado em 12 fluxos)
CREATE INDEX IF NOT EXISTS idx_imobipro_messages_session_id 
ON imobipro_messages(session_id);

CREATE INDEX IF NOT EXISTS idx_imobipro_messages_instancia 
ON imobipro_messages(instancia);

CREATE INDEX IF NOT EXISTS idx_imobipro_messages_created_at 
ON imobipro_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_imobipro_messages_session_created 
ON imobipro_messages(session_id, created_at DESC);

-- Índices para user_profiles (filtros frequentes)
CREATE INDEX IF NOT EXISTS idx_user_profiles_role 
ON user_profiles(role);

CREATE INDEX IF NOT EXISTS idx_user_profiles_chat_instance 
ON user_profiles(chat_instance);

-- Índices para calendários/agenda
CREATE INDEX IF NOT EXISTS idx_oncall_events_user_id 
ON oncall_events(user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_oncall_events_date_range 
ON oncall_events(event_date);

-- Índices para properties/imóveis
CREATE INDEX IF NOT EXISTS idx_properties_owner_id 
ON properties(owner_id);

CREATE INDEX IF NOT EXISTS idx_properties_status 
ON properties(status);

-- Índices para contracts
CREATE INDEX IF NOT EXISTS idx_contracts_property_id 
ON contracts(property_id);

CREATE INDEX IF NOT EXISTS idx_contracts_status 
ON contracts(status);

-- ============================================================================
-- 3. ANALISAR E OTIMIZAR QUERIES (VACUUMDB)
-- ============================================================================

VACUUM ANALYZE;

-- Mostrar tamanho de tabelas
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================================================
-- 4. HABILITAR QUERY STATISTICS
-- ============================================================================

-- Ver queries lentas
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Top 10 queries mais lentas
SELECT 
    query,
    calls,
    mean_exec_time,
    total_exec_time,
    rows
FROM pg_stat_statements
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- ============================================================================
-- 5. CONFIGURAR PREPARED STATEMENTS (Reduz parsing)
-- ============================================================================

-- Exemplo de prepared statement otimizado para N8N:
PREPARE get_messages_optimized(UUID, INT) AS
  SELECT id, session_id, content, created_at, sender
  FROM imobipro_messages
  WHERE session_id = $1
  ORDER BY created_at DESC
  LIMIT $2;

PREPARE get_user_profile(UUID) AS
  SELECT id, full_name, role, chat_instance, created_at
  FROM user_profiles
  WHERE id = $1;

-- ============================================================================
-- 6. MONITORAMENTO - VIEWS PARA ACOMPANHAR PERFORMANCE
-- ============================================================================

-- View: Conexões ativas por aplicação
CREATE OR REPLACE VIEW monitoring_active_connections AS
SELECT 
    application_name,
    COUNT(*) as connection_count,
    MAX(backend_start) as oldest_connection
FROM pg_stat_activity
WHERE state != 'idle'
GROUP BY application_name;

-- View: Cache hit ratio (>99% é bom)
CREATE OR REPLACE VIEW monitoring_cache_hit_ratio AS
SELECT
    sum(heap_blks_read) as heap_blks_read,
    sum(heap_blks_hit) as heap_blks_hit,
    sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
FROM pg_statio_user_tables;

-- View: Índices não utilizados
CREATE OR REPLACE VIEW monitoring_unused_indexes AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================================================
-- 7. AUTO-VACUUM TUNNING
-- ============================================================================

ALTER TABLE imobipro_messages SET (
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_analyze_scale_factor = 0.005
);

ALTER TABLE user_profiles SET (
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_analyze_scale_factor = 0.005
);

-- ============================================================================
-- 8. STATEMENT TIMEOUT PARA EVITAR QUERIES INFINITAS
-- ============================================================================

ALTER ROLE postgres SET statement_timeout = 30000;  -- 30 segundos
ALTER ROLE postgres SET idle_in_transaction_session_timeout = 60000;  -- 1 minuto idle

-- ============================================================================
-- 9. VERIFICAR E EXECUTAR
-- ============================================================================

-- Confirmar extensões instaladas
SELECT * FROM pg_extension;

-- Confirmar tamanho do pool após alterações
SHOW max_connections;
SHOW shared_buffers;

-- Verificar índices criados
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
