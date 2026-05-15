# 🏢 IMOBIPRO - Sistema de Gestão Imobiliária

Sistema completo de gestão imobiliária com dashboard interativo, controle de leads, propriedades, contratos e integração WhatsApp via endpoints externos.

## 📋 **Índice**

- [Sobre o Projeto](#sobre-o-projeto)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Arquitetura](#arquitetura)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Funcionalidades](#funcionalidades)
- [Deployment](#deployment)
- [Contribuição](#contribuição)

---

## 🎯 **Sobre o Projeto**

O **IMOBIPRO** é uma plataforma moderna para gestão de imobiliárias que oferece:

- 📊 **Dashboard analítico** com métricas em tempo real
- 🏠 **Gestão de propriedades** (integração VivaReal)
- 👥 **Controle de leads** com pipeline de vendas
- 📄 **Sistema de contratos** com templates personalizáveis
- 💬 **Integração WhatsApp** via endpoints externos (N8N)
- 👨‍💼 **Gestão de usuários** com roles hierárquicos
- 📅 **Sistema de plantão** para corretores
- 🔒 **Segurança RLS** com isolation por empresa

---

## 🛠️ **Tecnologias Utilizadas**

### **Frontend**
- ⚡ **Vite** - Build tool ultra-rápido
- ⚛️ **React 18** - Library de interface
- 🟦 **TypeScript** - Type safety
- 🎨 **Tailwind CSS** - Utility-first CSS
- 🧩 **shadcn/ui** - Componentes modernos
- 📊 **Chart.js / Recharts** - Gráficos interativos

### **Backend & Database**
- 🐘 **Supabase** - Backend-as-a-Service
- 🗄️ **PostgreSQL** - Banco de dados principal
- 🔐 **Row Level Security (RLS)** - Segurança por empresa
- ⚡ **Edge Functions** - Lógica server-side
- 📡 **Real-time subscriptions** - Updates ao vivo

### **Integrações Externas**
- 🤖 **N8N Webhooks** - Automação WhatsApp
- 🏠 **VivaReal API** - Sync de propriedades
- 📧 **Email Services** - Notificações
- 📅 **Calendar APIs** - Sistema de plantão

---

## 🏗️ **Arquitetura**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React SPA     │    │   Supabase      │    │   External APIs │
│                 │    │                 │    │                 │
│ • Dashboard     │◄──►│ • PostgreSQL    │◄──►│ • N8N WhatsApp  │
│ • Components    │    │ • Edge Functions│    │ • VivaReal      │
│ • Hooks         │    │ • Auth & RLS    │    │ • Email Service │
│ • Services      │    │ • Real-time     │    │ • Calendar      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Fluxo de Dados**
1. **Frontend** → Supabase Client → **Database**
2. **WhatsApp** → N8N Endpoints → **Frontend** (bypass Supabase)
3. **VivaReal** → Import Jobs → **Database**
4. **Users** → Auth → **RLS Policies** → **Data Isolation**

---

## 🚀 **Instalação e Configuração Completa**

### **📋 Pré-requisitos**
- 🖥️ **Cursor AI** ([baixar aqui](https://cursor.sh/))
- 🐙 **Conta GitHub** (gratuita)
- 🗄️ **Conta Supabase** (gratuita)
- 🌐 **Node.js 18+** ([instalar com nvm](https://github.com/nvm-sh/nvm))
- 📦 **npm ou pnpm**

---

## 🎯 **TUTORIAL PASSO A PASSO**

### **1️⃣ Configuração do GitHub e Clone**

#### **1.1 Criar/Configurar Conta GitHub**
1. Acesse [GitHub.com](https://github.com) e crie uma conta (se não tiver)
2. Faça fork deste repositório ou clone diretamente

#### **1.2 Clone no Cursor AI**
```bash
# Abra o Cursor AI e execute:
git clone https://github.com/SEU_USUARIO/dark-estate-dashboard.git
cd dark-estate-dashboard

# Instalar dependências
npm install
# ou
pnpm install
```

---

### **2️⃣ Configuração do Supabase**

#### **2.1 Criar Projeto Supabase**
1. Acesse [Supabase.com](https://supabase.com) e crie uma conta
2. Clique em **"New Project"**
3. Escolha organização e configure:
   - **Name:** `imobipro-dashboard`
   - **Database Password:** Anote a senha (será usada depois)
   - **Region:** Mais próxima do Brasil
4. Aguarde a criação do projeto (~2 minutos)

#### **2.2 Obter Credenciais**
No painel do Supabase, vá em **Settings > API** e copie:
- ✅ **Project URL** (`https://seu-projeto.supabase.co`)
- ✅ **Anon Public Key** (`eyJ...`)
- ✅ **Service Role Key** (`eyJ...`) ⚠️ **Manter secreto!**

#### **2.3 Aplicar Migration Completa**
```bash
# 1. Instalar Supabase CLI
npm install -g @supabase/cli

# 2. Login no Supabase
supabase login

# 3. Link ao projeto (use o Project Reference do dashboard)
supabase link --project-ref SUA_PROJECT_REF

# 4. Aplicar schema completo do banco
supabase db push

# 5. Aplicar dados de demonstração (opcional)
supabase db reset --with-seed
```

#### **2.4 Deploy das Edge Functions**
```bash
cd supabase/functions/

# Deploy de todas as functions
supabase functions deploy admin-create-user
supabase functions deploy admin-update-user
supabase functions deploy admin-delete-user

# Verificar se foram deployadas
supabase functions list
```

---

### **3️⃣ Configuração de MCPs (Smithery AI)**

#### **3.1 Instalar Supabase MCP via Smithery**
1. Acesse [Smithery.ai](https://smithery.ai/)
2. Procure por **"Supabase MCP"**
3. No Cursor AI, vá em **Settings > Extensions**
4. Adicione a configuração MCP:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["@smithery/supabase-mcp"],
      "env": {
        "SUPABASE_URL": "https://seu-projeto.supabase.co",
        "SUPABASE_ANON_KEY": "sua_anon_key",
        "SUPABASE_SERVICE_ROLE_KEY": "sua_service_role_key"
      }
    }
  }
}
```

#### **3.2 Ativar MCP no Cursor**
1. Reinicie o Cursor AI
2. Verifique se o MCP está funcionando:
   - Abra o chat do Cursor
   - Digite: `@supabase list tables`
   - Deve retornar as tabelas do projeto

---

### **4️⃣ Configuração de Variáveis de Ambiente**

#### **4.1 Criar arquivo .env.local**
```bash
# Copie o template e configure
cp .env.example .env.local
```

#### **4.2 Configurar .env.local**
```env
# Supabase (OBRIGATÓRIO)
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key_aqui
SUPABASE_ACCESS_TOKEN=sbp_...
```

---

### **5️⃣ Configuração dos Webhooks N8N**

#### **5.1 Endpoints WhatsApp (Externos)**
O sistema usa estes endpoints para WhatsApp:

```javascript
// Base URL configurada no .env
const WHATSAPP_API_BASE = "https://devlabz.n8nlabz.com.br/webhook"

// Endpoints disponíveis:
- GET /whatsapp-instances        → Listar instâncias
- POST /criar-instancia          → Criar instância  
- POST /puxar-qrcode            → Obter QR Code
- POST /deletar-instancia       → Deletar instância
- POST /conectar-instancia      → Conectar instância
- POST /desconectar-instancia   → Desconectar instância
- POST /config-instancia        → Configurar instância
- POST /edit-config-instancia   → Editar configuração
```

#### **5.2 Configurar N8N (se necessário)**
1. Se você tem acesso ao N8N, configure os workflows
2. Se não, use os endpoints públicos já configurados
3. Para produção, configure seus próprios endpoints

---

### **6️⃣ Configurações Finais do Supabase**

#### **6.1 Configurar RLS (Row Level Security)**
```sql
-- No SQL Editor do Supabase, execute:

-- Verificar se RLS está ativo em todas as tabelas
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;
```

#### **6.2 Criar Primeiro Usuário Admin**
```sql
-- No SQL Editor do Supabase:

-- 1. Criar usuário no auth (substitua o email)
INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, email_confirmed_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated', 'authenticated',
  'admin@seudominio.com',
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  NOW(), NOW(), NOW()
);

-- 2. Criar perfil admin
INSERT INTO public.user_profiles (
  id, email, full_name, role, company_id, is_active
) VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@seudominio.com'),
  'admin@seudominio.com',
  'Administrador do Sistema',
  'admin',
  NULL,
  true
);
```

#### **6.3 Configurar Secrets das Edge Functions**
No Supabase Dashboard > **Settings > Edge Functions**:

```bash
# Via CLI
supabase secrets set SUPABASE_URL=https://seu-projeto.supabase.co
supabase secrets set SUPABASE_ANON_KEY=sua_anon_key

# Via Dashboard
# Settings > Edge Functions > Environment Variables
```

---

### **7️⃣ Testar a Instalação**

#### **7.1 Executar o Projeto**
```bash
# Iniciar o desenvolvimento
npm run dev
# ou
pnpm dev

# Acessar: http://localhost:5173
```

#### **7.2 Validações**
1. ✅ **Login funciona** (use o admin criado)
2. ✅ **Dashboard carrega** sem erros
3. ✅ **Tabelas aparecem** (companies, leads, etc.)
4. ✅ **MCP Supabase** responde no Cursor
5. ✅ **WhatsApp endpoints** respondem (módulo CONEXÕES)

#### **7.3 Testes de Smoke**
```bash
# Testar build de produção
npm run build

# Verificar se não há erros TypeScript
npm run type-check

# Verificar linting
npm run lint
```

---

### **8️⃣ Próximos Passos**

#### **8.1 Configurações Opcionais**
- 📧 **Email Service** - Para notificações
- 🏠 **VivaReal API** - Para sync de propriedades  
- 📅 **Calendar APIs** - Para sistema de plantão
- 🔔 **Webhooks personalizados** - Para automações

#### **8.2 Produção**
- 🌍 **Deploy Frontend** - Netlify/Vercel
- 🗄️ **Upgrade Supabase** - Para projetos maiores
- 🔒 **Configurar domínio** - SSL customizado
- 📊 **Monitoring** - Logs e métricas

---

## 🆘 **Troubleshooting**

### **Problemas Comuns**

#### **❌ "Erro de conexão Supabase"**
```bash
# Verificar variáveis de ambiente
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY

# Testar conexão
curl https://seu-projeto.supabase.co/rest/v1/companies
```

#### **❌ "Migration failed"**
```bash
# Reset do banco (CUIDADO: remove dados)
supabase db reset

# Re-aplicar migrations
supabase db push
```

#### **❌ "MCP não funciona"**
1. Verificar configuração em Cursor > Settings
2. Reiniciar o Cursor AI
3. Testar: `@supabase --help`

#### **❌ "WhatsApp endpoints falhando"**
1. Verificar `VITE_WHATSAPP_API_BASE` no .env
2. Testar endpoint diretamente:
```bash
curl https://devlabz.n8nlabz.com.br/webhook/whatsapp-instances
```

### **📞 Suporte**
- 📖 **Documentação:** `docs/` folder
- 🐛 **Issues:** GitHub Issues
- 💬 **Discussões:** GitHub Discussions

---

## ✅ **Checklist de Instalação**

- [ ] Conta GitHub criada
- [ ] Projeto clonado no Cursor AI
- [ ] Conta Supabase criada
- [ ] Migration completa aplicada
- [ ] Edge Functions deployadas
- [ ] MCP Supabase configurado via Smithery.ai
- [ ] Arquivo .env.local configurado
- [ ] Endpoints N8N testados
- [ ] Usuário admin criado
- [ ] Projeto executa sem erros
- [ ] Dashboard carrega corretamente
- [ ] Testes de smoke passando

**🎉 Instalação completa quando todos os itens estiverem marcados!**

---

## ⚙️ **Configuração**

### **Variáveis de Ambiente**
```env
# Supabase
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key

# WhatsApp External API (N8N)
VITE_WHATSAPP_API_BASE=https://devlabz.n8nlabz.com.br/webhook

# VivaReal (opcional)
VITE_VIVAREAL_API_KEY=sua_api_key

# Email (opcional)
VITE_EMAIL_SERVICE_URL=https://seu-servico-email.com
```

### **Primeiro Usuário Admin**
```sql
-- Execute no SQL Editor do Supabase
INSERT INTO public.user_profiles (
  id, email, full_name, role, company_id, is_active
) VALUES (
  auth.uid(),
  'admin@seudominio.com',
  'Administrador Sistema',
  'admin',
  NULL,
  true
);
```

---

## ✨ **Funcionalidades**

### **📊 Dashboard & Analytics**
- Métricas de leads por período
- Gráficos de conversão de vendas
- Performance por corretor
- Relatórios de propriedades
- KPIs financeiros em tempo real

### **🏠 Gestão de Propriedades**
- Cadastro completo de imóveis
- Upload de imagens múltiplas
- Integração com VivaReal
- Filtros avançados de busca
- Status de disponibilidade

### **👥 Controle de Leads**
- Pipeline de vendas visual
- Atribuição automática para corretores
- Histórico de interações
- Integração WhatsApp
- Follow-up automatizado

### **📄 Sistema de Contratos**
- Templates personalizáveis
- Geração automática de PDFs
- Assinatura digital
- Controle de vencimentos
- Histórico de alterações

### **💬 WhatsApp (Endpoints Externos)**
- **100% via N8N webhooks** (sem dependência do Supabase)
- Criação de instâncias para usuários
- Controle de conexão QR Code
- Gestão de conversas
- Atribuição por gestor

### **👨‍💼 Gestão de Usuários**
- **Roles hierárquicos:**
  - 🔴 **Admin**: Acesso global
  - 🟡 **Gestor**: Controle da empresa
  - 🟢 **Corretor**: Acesso limitado
- Controle de permissões granular
- Multi-empresas com isolation

### **📅 Sistema de Plantão**
- Calendários personalizados
- Escala de corretores
- Disponibilidade por horário
- Integração com agenda

---

## 🌍 **Deployment**

### **Frontend (Netlify/Vercel)**
```bash
# Build de produção
npm run build

# Deploy direto
npm run deploy
```

### **Supabase (Production)**
```bash
# Deploy das functions
supabase functions deploy --project-ref PROD_REF

# Aplicar migrations
supabase db push --project-ref PROD_REF
```

### **Variáveis de Produção**
- Configure todas as `VITE_*` vars no seu provedor
- Configure secrets das Edge Functions no Supabase
- Configure domínio customizado (opcional)

---

## 📁 **Estrutura do Projeto**

```
dark-estate-dashboard/
├── src/
│   ├── components/          # Componentes React
│   │   ├── dashboard/       # Componentes do dashboard
│   │   ├── leads/          # Gestão de leads
│   │   ├── properties/     # Propriedades
│   │   ├── contracts/      # Contratos
│   │   └── ui/             # Componentes base (shadcn)
│   ├── hooks/              # Custom hooks
│   ├── services/           # APIs e integrações
│   ├── lib/                # Utilitários
│   ├── types/              # TypeScript definitions
│   └── pages/              # Páginas da aplicação
├── supabase/
│   ├── migrations/         # Database migrations
│   ├── functions/          # Edge Functions
│   └── seed.sql           # Dados de exemplo
├── docs/                   # Documentação
└── public/                 # Assets estáticos
```

---

## 🔐 **Segurança**

### **Row Level Security (RLS)**
- ✅ Isolation completo por empresa
- ✅ Roles granulares (admin/gestor/corretor)
- ✅ Policies automáticas em todas as tabelas
- ✅ Audit logs de operações críticas

### **Autenticação**
- 🔐 JWT tokens via Supabase Auth
- 🔐 Magic link e OAuth social
- 🔐 Session management automático
- 🔐 Password reset seguro

### **APIs Externas**
- 🛡️ Rate limiting nas integrações
- 🛡️ Webhook signatures validation
- 🛡️ Secrets management via environment

---

## 📈 **Performance**

### **Frontend**
- ⚡ Code splitting automático
- ⚡ Lazy loading de componentes
- ⚡ React Query para cache
- ⚡ Images optimization

### **Database**
- 🚀 Índices otimizados
- 🚀 Queries preparadas
- 🚀 Connection pooling
- 🚀 Real-time subscriptions eficientes

---

## 🤝 **Contribuição**

### **Development Setup**
```bash
# Rodar em modo desenvolvimento
npm run dev

# Linting e formatação
npm run lint
npm run format

# Testes (quando implementados)
npm run test
```

### **Commit Pattern**
```
feat: nova funcionalidade
fix: correção de bug
docs: alteração na documentação
style: formatação, missing semi colons, etc
refactor: refatoração de código
test: adição ou correção de testes
chore: manutenção
```

### **Pull Request Process**
1. Fork do projeto
2. Branch feature (`git checkout -b feature/nova-funcionalidade`)
3. Commit das mudanças (`git commit -m 'feat: adiciona nova funcionalidade'`)
4. Push para branch (`git push origin feature/nova-funcionalidade`)
5. Abrir Pull Request

---

## 📞 **Suporte**

### **Documentação**
- 📖 [Docs completa](./docs/)
- 🗄️ [Schema do banco](./docs/schema-db-imobipro.md)
- 👥 [Hierarquia de usuários](./docs/hierarquia-usuarios.md)
- 🔧 [Migrations](./supabase/README_MIGRATIONS.md)

### **Links Úteis**
- [Supabase Docs](https://supabase.com/docs)
- [React Docs](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com)

---

## 📄 **Licença**

Este projeto está licenciado sob a [MIT License](./LICENSE).

---

## 🚧 **Roadmap**

### **Q1 2025**
- [ ] Sistema de relatórios avançados
- [ ] Mobile app (React Native)
- [ ] Integração com CRM externo
- [ ] API pública para parceiros

### **Q2 2025**
- [ ] IA para qualificação de leads
- [ ] Chatbot WhatsApp automatizado
- [ ] Integração com marketplaces
- [ ] Sistema de comissões

---

**Versão:** 2.0.0  
**Última atualização:** Janeiro 2025  
**Mantenedores:** Equipe IMOBIPRO  

> 💡 **Nota**: Este sistema agora opera com **WhatsApp 100% via endpoints externos** (N8N), removendo todas as dependências da tabela `whatsapp_instances` do Supabase para maior flexibilidade e performance.# imobdashboard
