# Deploy

## Conta demonstração

Após `npm run seed:demo` (local) ou seed no ambiente:

- Email: `teste@gmail.com`
- Senha: `123456789`
- Admin: `/admin`

## Vercel (passo a passo)

1. Abra [vercel.com](https://vercel.com) e importe o repo **Jurandy1/SaaS-afiliados**.
2. Framework Preset: **Other**.
3. Em **Environment Variables**, configure:

```
SUPABASE_URL=https://tirvmswpccejqasmauug.supabase.co
SUPABASE_ANON_KEY=<anon jwt>
SUPABASE_SERVICE_ROLE_KEY=<service_role jwt>
ADMIN_EMAIL=teste@gmail.com
```

4. Deploy. A URL ficará tipo `https://saas-afiliados-xxx.vercel.app`.
5. No Supabase Auth → URL Configuration, adicione a URL do Vercel em Site URL / Redirect URLs se precisar.

### Observações Vercel

- App sobe como função serverless (`api/index.js` + `vercel.json`).
- Sync Shopee/Meta longo pode estourar timeout (Hobby ~10s / Pro até 60s neste projeto). Prefira sync por períodos curtos.
- **Não** coloque `SHOPEE_*` / `META_*` globais no Vercel — cada usuário cadastra as próprias APIs (ou use seed local só na conta demo).

## Local

```bash
npm start
```

http://localhost:3790

## Setup DB

```bash
npm run setup:db
npm run setup:profiles
npm run seed:demo
```
