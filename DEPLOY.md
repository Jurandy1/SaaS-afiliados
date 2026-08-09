# Deploy

## Multi-usuário
Cada pessoa cria conta (email/senha), cola **a própria** Shopee e **o próprio** Meta. Dados isolados por `user_id`.

## Vercel — Environment Variables (só infraestrutura)

```
SUPABASE_URL=https://tirvmswpccejqasmauug.supabase.co
SUPABASE_ANON_KEY=<anon jwt>
SUPABASE_SERVICE_ROLE_KEY=<service_role jwt>
```

**Não** coloque `SHOPEE_*` nem `META_*` no Vercel como “padrão do sistema” — cada usuário configura na tela após login.

## Host
App Node (`server/index.js`). Prefira Railway/Render/Fly; Vercel serverless exige adaptar o entrypoint.

## Setup DB
```bash
npm run setup:db
```
Aplica migrate multi-user + schema (apaga tabelas single-tenant antigas).
