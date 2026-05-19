# IMOBDASHBOARD

Frontend imobiliario em `Vite + React + TypeScript`, publicado em container `Nginx` e integrado com `Supabase` self-hosted e `Evolution API`.

## Stack validada

- Frontend: Docker + Nginx
- Backend/Auth/DB: Supabase self-hosted
- Integracao WhatsApp: Evolution API
- Proxy publico: Cloudflare Tunnel
- Proxy interno opcional: Traefik

## Dominios usados neste deploy

- Frontend: `https://imobdashboard.26121997.xyz`
- Supabase isolado do projeto: `https://supabase-imobdashboard.26121997.xyz`
- Evolution API: `https://evolution.26121997.xyz`

## Estrutura

- `Dockerfile`
- `docker-compose.yml`
- `nginx.conf`
- `supabase/migrations`
- `scripts/add_admin_user.sql`

## Variaveis do frontend

Crie um `.env` local na raiz do projeto com:

```env
VITE_SUPABASE_URL=https://supabase-imobdashboard.seudominio.com
VITE_SUPABASE_ANON_KEY=COLE_A_ANON_KEY_DO_SUPABASE_NOVO
VITE_EVOLUTION_API_URL=https://evolution.seudominio.com
VITE_EVOLUTION_API_KEY=COLE_A_API_KEY_DA_EVOLUTION
VITE_DEFAULT_NEW_USER_PASSWORD=Imobi@1234
VITE_ENABLE_ANON_LOGIN=false
VITE_FEATURE_RT_DEBUG_LEADS=false
VITE_FEATURE_RT_TRANSFER_FIX=false
```

Observacao:

- `VITE_*` entra no build do Vite. Qualquer mudanca exige rebuild da imagem.

## Subindo o frontend na VPS

Pré-requisitos:

- Docker e Docker Compose
- rede Docker `proxy` se for usar Traefik
- `.env` preenchido na raiz do projeto

Comandos:

```bash
docker network create proxy || true
docker compose up -d --build
```

O compose publica o frontend localmente em `http://localhost:8095`.

## Cloudflare Tunnel

No hostname publico do frontend, a origem validada foi:

```text
http://localhost:8095
```

No Supabase isolado, a origem validada foi:

```text
http://localhost:8005
```

Importante:

- Evite subdominio multinivel se a conta Cloudflare nao cobrir certificado para isso.
- `supabase.imobdashboard.26121997.xyz` falhou com erro de SSL.
- O hostname que funcionou para este projeto foi `supabase-imobdashboard.26121997.xyz`.

## Supabase isolado do projeto

Este projeto nao deve compartilhar o mesmo schema `public` com outros sistemas.

No deploy validado, foi criada uma stack separada em algo como:

```text
/opt/supabase-imobdashboard
```

A stack nova precisa ter:

- banco limpo
- volume proprio
- `SUPABASE_PUBLIC_URL` proprio
- `API_EXTERNAL_URL` proprio
- `SITE_URL` apontando para o frontend

## Aplicando as migrations

Depois de subir a stack nova do Supabase e confirmar que o `public` esta vazio:

```bash
docker exec -i supabase-dashboard-db-1 psql -U postgres -d postgres < /opt/imobdashboard/supabase/migrations/20250825193901_complete_remote_schema.sql
docker exec -i supabase-dashboard-db-1 psql -U postgres -d postgres < /opt/imobdashboard/supabase/migrations/20250826050000_fix_user_profiles_structure.sql
```

Validacao recomendada:

```bash
docker exec -it supabase-dashboard-db-1 psql -U postgres -d postgres -c "\dt public.*"
docker exec -it supabase-dashboard-db-1 psql -U postgres -d postgres -c "
select ordinal_position, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'user_profiles'
order by ordinal_position;
"
```

`user_profiles` precisa sair com `id uuid`, `email`, `full_name`, `role`, `company_id` e demais colunas esperadas.

## Criando o admin inicial

Depois de aplicar as migrations no Supabase novo:

1. Crie o usuario no Auth via endpoint admin do Supabase.
2. Insira ou atualize o perfil em `public.user_profiles` com role `admin`.

Login usado no deploy validado:

- Email: `seuemail@gmail.com`
- Senha: `Imobi@1234`

Troque essa senha depois do primeiro acesso.

## Troubleshooting

### Tela branca com `supabaseUrl is required`

Causa:

- frontend buildado sem `VITE_SUPABASE_URL`

Correcao:

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

### `502 Bad Gateway` no frontend

Causa comum:

- container do frontend nao subiu

Validacao:

```bash
docker compose ps
curl -I http://localhost:8095
```

### Migration falhando com tabelas antigas

Causa comum:

- a nova stack do Supabase foi criada copiando o diretorio `volumes/db/data` da instancia antiga

Correcao:

- parar a stack nova
- limpar apenas `volumes/db/data` da stack nova
- subir novamente
- reaplicar as migrations

## Observacoes

- O arquivo `.env` nao deve ser versionado.
- O arquivo `.mcp.json` nao deve ir para o GitHub.
- Se usar Traefik, ajuste os labels para o seu ambiente real. Neste projeto o caminho mais simples foi Cloudflare Tunnel direto no `localhost`.
