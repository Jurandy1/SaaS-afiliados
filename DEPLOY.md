# Deploy (Vercel)

## Variáveis de ambiente (Settings → Environment Variables)

Obrigatórias no servidor (nunca no browser):

| Variável | Valor |
|----------|--------|
| `SUPABASE_URL` | `https://tirvmswpccejqasmauug.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role do projeto SaaS SHOPPE |
| `SUPABASE_ANON_KEY` | anon key (opcional no backend) |
| `PORT` | Vercel ignora; app usa a porta do host |

Shopee / Meta **não precisam** ficar no Vercel se já estiverem salvos no Supabase (`app_credentials` / `meta_credentials`) via tela Configurações. Opcional para seed no boot:

- `SHOPEE_APP_ID` / `SHOPEE_SECRET` — só se quiser fallback sem DB
- `META_ACCESS_TOKEN` / `META_AD_ACCOUNT_IDS` / `META_API_VERSION` — idem

## Runtime

Este app é Node HTTP (`server/index.js`). No Vercel use um entry serverless ou migre para um host Node (Railway/Render/Fly) — Vercel serverless puro exige adaptar o servidor. Alternativa simples: deploy Node em Railway/Render com as mesmas env vars.

## Multi-usuário (Shopee)

Hoje o SaaS é **single-tenant**: uma conta Shopee + um Meta no Supabase. Cada usuário **não** precisa digitar Meta de outra pessoa — o Meta da plataforma fica salvo uma vez. Para vários afiliados, cada um com a **própria** API Shopee isolada, falta auth + `user_id` nas credenciais (próxima fase).
