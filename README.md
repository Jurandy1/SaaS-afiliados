# SaaS Afiliados (Metricly) — Shopee + Supabase

Painel SaaS de afiliados Shopee (sem Meta/Pinterest), com dados reais via Open API e persistência no Supabase.

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
   npm run seed
   npm start
   ```
4. Abra http://localhost:3790

## Comportamento da API Shopee

- Credenciais ficam no Supabase (`app_credentials`).
- Se o **APP_ID** mudar na tela Configuração, o sistema **reseta** métricas/sync e puxa do novo afiliado.
- Sync grava `daily_metrics`, `subid_metrics` e `sync_runs`.

## Segurança

- **Nunca** commite o `.env` (já está no `.gitignore`).
- Use `service_role` só no backend; no browser use no máximo a anon key se precisar.

## Repo

https://github.com/Jurandy1/SaaS-afiliados
