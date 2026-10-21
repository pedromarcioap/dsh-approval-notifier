# Empacota a extensão para distribuição: gera
# dist/dsh-approval-notifier-<versão>.zip com o manifest na raiz do ZIP.
#
#   pwsh -File tools/build-release.ps1 -Version 1.0.0

param(
  [string]$Version = '1.0.0'
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'
$staging = Join-Path $dist 'dsh-approval-notifier'

if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }
New-Item -ItemType Directory -Force -Path $staging | Out-Null

# Só o que a extensão precisa em tempo de execução.
$files = @(
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'popup.css',
  'popup.js',
  'README.md',
  'LICENSE'
)

foreach ($file in $files) {
  $source = Join-Path $root $file
  if (-not (Test-Path $source)) { throw "arquivo obrigatório ausente: $file" }
  Copy-Item $source $staging
}

Copy-Item (Join-Path $root 'icons') (Join-Path $staging 'icons') -Recurse

$manifest = Get-Content (Join-Path $staging 'manifest.json') -Raw | ConvertFrom-Json
if ($manifest.version -ne $Version) {
  throw "versão do manifest ($($manifest.version)) não bate com -Version $Version"
}

$zip = Join-Path $dist "dsh-approval-notifier-$Version.zip"
Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $zip -Force
Remove-Item $staging -Recurse -Force

$size = [math]::Round((Get-Item $zip).Length / 1KB, 1)
"gerado: $zip ($size KB)"
