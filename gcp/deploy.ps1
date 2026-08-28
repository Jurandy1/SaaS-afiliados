param(
  [Parameter(Mandatory = $true)][string]$ProjectId,
  [string]$Region = "southamerica-east1",
  [string]$Service = "saas-afiliados-sync",
  [string]$EnvFile = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
if (-not $EnvFile) { $EnvFile = Join-Path $Root ".env" }

function Read-DotEnv([string]$path) {
  $map = @{}
  if (-not (Test-Path $path)) { throw "Arquivo .env nao encontrado: $path" }
  foreach ($line in Get-Content $path) {
    $t = $line.Trim()
    if (-not $t -or $t.StartsWith("#")) { continue }
    $i = $t.IndexOf("=")
    if ($i -lt 1) { continue }
    $k = $t.Substring(0, $i).Trim()
    $v = $t.Substring($i + 1).Trim()
    if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
      $v = $v.Substring(1, $v.Length - 2)
    }
    $map[$k] = $v
  }
  return $map
}

$envMap = Read-DotEnv $EnvFile
foreach ($need in @("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET")) {
  if (-not $envMap[$need]) { throw "Defina $need no .env antes do deploy GCP" }
}

Write-Host "Projeto: $ProjectId  regiao: $Region  servico: $Service"
gcloud config set project $ProjectId | Out-Null
gcloud services enable run.googleapis.com cloudscheduler.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project $ProjectId

$envList = @(
  "SUPABASE_URL=$($envMap.SUPABASE_URL)",
  "SUPABASE_SERVICE_ROLE_KEY=$($envMap.SUPABASE_SERVICE_ROLE_KEY)",
  "CRON_SECRET=$($envMap.CRON_SECRET)",
  "AUTO_SYNC_DISABLE=1"
)
if ($envMap.VAPID_PUBLIC_KEY) { $envList += "VAPID_PUBLIC_KEY=$($envMap.VAPID_PUBLIC_KEY)" }
if ($envMap.VAPID_PRIVATE_KEY) { $envList += "VAPID_PRIVATE_KEY=$($envMap.VAPID_PRIVATE_KEY)" }
if ($envMap.VAPID_MAILTO) { $envList += "VAPID_MAILTO=$($envMap.VAPID_MAILTO)" }
$publicBase = if ($envMap.PUBLIC_BASE_URL) { $envMap.PUBLIC_BASE_URL } else { "https://saa-s-afiliados.vercel.app" }
$envList += "PUBLIC_BASE_URL=$publicBase"
if (-not $envMap.VAPID_PUBLIC_KEY -or -not $envMap.VAPID_PRIVATE_KEY) {
  Write-Host "AVISO: VAPID_* ausente no .env - push de comissao NAO vai funcionar no Cloud Run" -ForegroundColor Yellow
}
$envVars = $envList -join ","

$Repo = "saas-afiliados"
$Image = "$Region-docker.pkg.dev/$ProjectId/$Repo/$Service"
$CloudBuild = Join-Path $PSScriptRoot "cloudbuild.yaml"

Write-Host "Artifact Registry ($Repo)..."
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
gcloud artifacts repositories describe $Repo --location $Region --project $ProjectId 2>$null | Out-Null
$repoExists = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = $prevEap
if (-not $repoExists) {
  gcloud artifacts repositories create $Repo `
    --repository-format=docker `
    --location $Region `
    --project $ProjectId | Out-Null
}

Write-Host "Build imagem: $Image"
Push-Location $Root
try {
  gcloud builds submit . `
    --project $ProjectId `
    --config $CloudBuild `
    --substitutions "_IMAGE=$Image"
  if ($LASTEXITCODE -ne 0) { throw "Cloud Build falhou" }
} finally {
  Pop-Location
}

Write-Host "Deploy Cloud Run..."
gcloud run deploy $Service `
  --project $ProjectId `
  --region $Region `
  --image $Image `
  --allow-unauthenticated `
  --timeout 900 `
  --memory 1Gi `
  --cpu 1 `
  --min-instances 0 `
  --max-instances 1 `
  --set-env-vars $envVars

$Url = gcloud run services describe $Service --project $ProjectId --region $Region --format="value(status.url)"
if (-not $Url) { throw "Nao foi possivel obter a URL do Cloud Run" }
Write-Host "Cloud Run: $Url"

$AuthHeader = "Authorization=Bearer $($envMap.CRON_SECRET)"

function Ensure-SchedulerJob([string]$name, [string]$schedule, [string]$mode) {
  $uri = "$Url/sync?mode=$mode"
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  gcloud scheduler jobs describe $name --location $Region --project $ProjectId 2>$null | Out-Null
  $exists = ($LASTEXITCODE -eq 0)
  $ErrorActionPreference = $prevEap
  if ($exists) {
    Write-Host "Atualizando job $name..."
    gcloud scheduler jobs update http $name `
      --project $ProjectId `
      --location $Region `
      --schedule $schedule `
      --time-zone "America/Sao_Paulo" `
      --uri $uri `
      --http-method GET `
      --update-headers $AuthHeader `
      --attempt-deadline 900s | Out-Null
  } else {
    Write-Host "Criando job $name..."
    gcloud scheduler jobs create http $name `
      --project $ProjectId `
      --location $Region `
      --schedule $schedule `
      --time-zone "America/Sao_Paulo" `
      --uri $uri `
      --http-method GET `
      --headers $AuthHeader `
      --attempt-deadline 900s | Out-Null
  }
}

Ensure-SchedulerJob "saas-afiliados-ontem" "*/10 5-9 * * *" "ontem"
Ensure-SchedulerJob "saas-afiliados-recent" "*/15 * * * *" "recent"
Ensure-SchedulerJob "saas-afiliados-daily" "0 4 * * *" "daily"
Ensure-SchedulerJob "saas-afiliados-morning" "0 5,6,7,8 * * *" "daily"

Write-Host ""
Write-Host "Pronto. Google Cloud Scheduler puxa sozinho."
Write-Host "  ontem:   a cada 10 min entre 05h-09h BRT (so ontem + push)"
Write-Host "  recent:  a cada 15 min (BRT)"
Write-Host "  daily:   04:00 BRT (7 dias + SubIDs)"
Write-Host "  morning: 05:00, 06:00, 07:00, 08:00 BRT"
Write-Host "Teste: gcloud scheduler jobs run saas-afiliados-ontem --location=$Region --project=$ProjectId"
