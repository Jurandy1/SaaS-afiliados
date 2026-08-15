# SaaS Afiliados — Shopee + Meta + Supabase

Painel de afiliados com dados reais (Open API Shopee, Meta Ads) e persistência no Supabase.

```
api/          entrada Vercel
gcp/          sync no Cloud Run
public/       frontend
scripts/      setup do banco e seed demo
server/       backend Node
sql/          schema.sql (único arquivo SQL)
styles/       fonte do Tailwind
```

## Setup rápido

1. Copie o ambiente:
   ```bash
   cp .env.example .env
   ```
2. Preencha no `.env`:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`
   - `SHOPEE_APP_ID`, `SHOPEE_SECRET` (Open API do afiliado)
3. Instale e prepare o banco:
   ```bash
   npm install
   npm run setup:db
   npm run seed:demo
   npm start
   ```
4. Abra http://localhost:3790

`setup:db` aplica só `sql/schema.sql` (idempotente — não apaga dados). `seed:demo` cria a conta `teste@gmail.com`.

## Segurança

- **Nunca** commite o `.env` (já está no `.gitignore`).
- Use `service_role` só no backend.

## Repo

https://github.com/Jurandy1/SaaS-afiliados
