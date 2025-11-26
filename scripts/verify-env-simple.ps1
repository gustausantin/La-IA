# Script simple para verificar configuracion de variables de entorno
# Uso: .\scripts\verify-env-simple.ps1

Write-Host "[INFO] Verificando configuracion de variables de entorno..." -ForegroundColor Cyan
Write-Host ""

$envFile = ".env"
$hasErrors = $false

# Verificar si existe el archivo .env
if (!(Test-Path $envFile)) {
    Write-Host "[ERROR] No se encontro el archivo .env" -ForegroundColor Red
    Write-Host ""
    Write-Host "[INFO] Creando archivo .env de ejemplo..." -ForegroundColor Yellow
    
    $envTemplate = @"
# Supabase Configuration (Frontend - Accesible en navegador)
VITE_SUPABASE_URL=https://zrcsujgurtglyqoqiynr.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY_AQUI

# Supabase Configuration (Backend - Solo en servidor Node.js)
SUPABASE_URL=https://zrcsujgurtglyqoqiynr.supabase.co
SUPABASE_ANON_KEY=TU_ANON_KEY_AQUI
SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY_AQUI

# SMTP Configuration (Opcional - Para envio de emails)
SMTP_USER=noreply@la-ia.site
SMTP_PASSWORD=TU_SMTP_PASSWORD_AQUI
"@
    
    $envTemplate | Out-File -FilePath $envFile -Encoding UTF8
    Write-Host "[OK] Archivo .env creado" -ForegroundColor Green
    Write-Host ""
    Write-Host "[WARNING] IMPORTANTE: Edita el archivo .env y reemplaza los valores de ejemplo" -ForegroundColor Yellow
    Write-Host ""
    $hasErrors = $true
} else {
    Write-Host "[OK] Archivo .env encontrado" -ForegroundColor Green
    Write-Host ""
}

# Cargar variables del archivo .env
$envVars = @{}
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and !$line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            $key = $parts[0].Trim()
            $value = $parts[1].Trim()
            $envVars[$key] = $value
        }
    }
}

# Variables requeridas para el frontend (navegador)
$requiredFrontend = @(
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY"
)

# Variables requeridas para el backend (servidor Node.js)
$requiredBackend = @(
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY"
)

Write-Host "Variables Frontend (para navegador):" -ForegroundColor Magenta
Write-Host "-------------------------------------" -ForegroundColor Gray
foreach ($var in $requiredFrontend) {
    if ($envVars.ContainsKey($var) -and $envVars[$var] -ne "" -and !($envVars[$var] -like "*AQUI*")) {
        Write-Host "  [OK] $var : Configurada" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] $var : FALTA o es placeholder" -ForegroundColor Red
        $hasErrors = $true
    }
}

Write-Host ""
Write-Host "Variables Backend (para servidor Node.js):" -ForegroundColor Magenta
Write-Host "-------------------------------------------" -ForegroundColor Gray
foreach ($var in $requiredBackend) {
    if ($envVars.ContainsKey($var) -and $envVars[$var] -ne "" -and !($envVars[$var] -like "*AQUI*")) {
        Write-Host "  [OK] $var : Configurada" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] $var : FALTA o es placeholder" -ForegroundColor Red
        $hasErrors = $true
    }
}

Write-Host ""
Write-Host "Variables Opcionales (SMTP):" -ForegroundColor Magenta
Write-Host "----------------------------" -ForegroundColor Gray
$optionalVars = @("SMTP_USER", "SMTP_PASSWORD")
foreach ($var in $optionalVars) {
    if ($envVars.ContainsKey($var) -and $envVars[$var] -ne "" -and !($envVars[$var] -like "*AQUI*")) {
        Write-Host "  [OK] $var : Configurada" -ForegroundColor Green
    } else {
        Write-Host "  [WARNING] $var : No configurada (opcional)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Gray

if ($hasErrors) {
    Write-Host ""
    Write-Host "HAY ERRORES EN LA CONFIGURACION" -ForegroundColor Red
    Write-Host ""
    Write-Host "Pasos para solucionar:" -ForegroundColor Yellow
    Write-Host "  1. Ve a https://supabase.com/dashboard/project/zrcsujgurtglyqoqiynr/settings/api"
    Write-Host "  2. Copia la 'URL' del proyecto"
    Write-Host "  3. Copia la clave 'anon public' (para VITE_SUPABASE_ANON_KEY)"
    Write-Host "  4. Copia la clave 'service_role' (para SUPABASE_SERVICE_ROLE_KEY)"
    Write-Host "  5. Edita el archivo .env y pega los valores"
    Write-Host "  6. Reinicia el servidor: npm run dev"
    Write-Host ""
    exit 1
} else {
    Write-Host ""
    Write-Host "CONFIGURACION CORRECTA - Todo listo!" -ForegroundColor Green
    Write-Host ""
    exit 0
}





