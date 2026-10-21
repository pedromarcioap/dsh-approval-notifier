# Gera docs/notification.png — uma ilustração da notificação do Windows,
# sem nenhuma captura de tela real. Rode de qualquer pasta:
#   pwsh -File tools/make-preview.ps1

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'docs'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$outFile = Join-Path $outDir 'notification.png'

$scale = 2                      # desenha em 2x para ficar nítido em telas HiDPI
$cardW = 380 * $scale
$cardH = 104 * $scale
$pad = 24 * $scale
$width = $cardW + $pad * 2
$height = $cardH + $pad * 2

$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$graphics.Clear([System.Drawing.Color]::Transparent)

function New-RoundedPath([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

# Sombra suave: três camadas com alfa crescente.
for ($i = 3; $i -ge 1; $i--) {
  $spread = $i * 2 * $scale
  $path = New-RoundedPath ($pad - $spread / 2) ($pad - $spread / 2 + 3 * $scale) ($cardW + $spread) ($cardH + $spread) (10 * $scale)
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(18, 0, 0, 0))
  $graphics.FillPath($brush, $path)
  $brush.Dispose(); $path.Dispose()
}

# Cartão no estilo do Windows 11 (tema escuro).
$cardPath = New-RoundedPath $pad $pad $cardW $cardH (10 * $scale)
$cardBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 43, 43, 43))
$graphics.FillPath($cardBrush, $cardPath)
$borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 60, 60, 60), (1 * $scale))
$graphics.DrawPath($borderPen, $cardPath)

# Ícone da extensão.
$iconPath = Join-Path $root 'icons\icon128.png'
$iconSize = 44 * $scale
$iconX = $pad + 16 * $scale
$iconY = $pad + 15 * $scale
$icon = [System.Drawing.Image]::FromFile($iconPath)
$graphics.DrawImage($icon, $iconX, $iconY, $iconSize, $iconSize)
$icon.Dispose()

# Textos.
$textX = $iconX + $iconSize + 14 * $scale
$titleFont = New-Object System.Drawing.Font('Segoe UI Semibold', (16 * $scale / 2), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$bodyFont = New-Object System.Drawing.Font('Segoe UI', (13 * $scale / 2), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$metaFont = New-Object System.Drawing.Font('Segoe UI', (10.5 * $scale / 2), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)

$titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 245, 245, 245))
$bodyBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 214, 214, 214))
$metaBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 150, 150, 150))

$graphics.DrawString('DSH aguardando sua aprovação', $titleFont, $titleBrush, [single]$textX, [single]($pad + 17 * $scale))
$graphics.DrawString('Permitir acesso a uma pasta fora do workspace?', $bodyFont, $bodyBrush, [single]$textX, [single]($pad + 43 * $scale))
$graphics.DrawString('DSH — Aviso de aprovação  ·  clique para abrir', $metaFont, $metaBrush, [single]$textX, [single]($pad + 68 * $scale))

$bitmap.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$bitmap.Dispose()
$titleFont.Dispose(); $bodyFont.Dispose(); $metaFont.Dispose()
$titleBrush.Dispose(); $bodyBrush.Dispose(); $metaBrush.Dispose()
$borderPen.Dispose(); $cardBrush.Dispose(); $cardPath.Dispose()

"gerado: $outFile ($width x $height)"
