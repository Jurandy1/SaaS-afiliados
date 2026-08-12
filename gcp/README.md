# Google Cloud — sync automático do SaaS Afiliados

O **Google Cloud puxa** Shopee + Meta (não a Vercel).

Agenda (fuso `America/Sao_Paulo`, igual Afiliadoteste):

| Job | Horário | O que puxa |
|-----|---------|------------|
| `saas-afiliados-recent` | a cada 2h (`15 */2 * * *`) | últimos 3 dias |
| `saas-afiliados-daily` | 04:00 | últimos 7 dias (reconcile) |

## Pré-requisito

1. [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (`gcloud`)
2. Um projeto GCP (pode ser o mesmo do Firebase do Afiliadoteste **ou outro** — o código do Afiliadoteste não é alterado)
3. APIs: Cloud Run, Cloud Scheduler, Artifact Registry, Cloud Build

```powershell
gcloud auth login
gcloud config set project SEU_PROJECT_ID
gcloud services enable run.googleapis.com cloudscheduler.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
```

## Deploy

Na pasta do SaaS:

```powershell
.\gcp\deploy.ps1 -ProjectId SEU_PROJECT_ID
```

O script:
- sobe o worker em Cloud Run (`southamerica-east1`)
- cria os 2 jobs do Cloud Scheduler
- lê `SUPABASE_*` e `CRON_SECRET` do `.env` local (não grava secret no Git)

Timeout do Cloud Run: **15 min** (Shopee com várias contas).

## Teste manual

```powershell
gcloud scheduler jobs run saas-afiliados-recent --location=southamerica-east1
```
