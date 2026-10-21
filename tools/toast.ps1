# Toast nativo do Windows, sem Chrome.
#
# Uso:
#   pwsh -File toast.ps1 -Title "DSH" -Message "Aguardando sua aprovação"
#
# Serve para (a) validar que o Windows está deixando notificações passarem e
# (b) avisar manualmente quando não quiser depender da extensão do Chrome.

param(
  [string]$Title = 'DSH aguardando sua aprovação',
  [string]$Message = 'Uma operação está esperando sua decisão na conversa.',
  [int]$Seconds = 8
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$notify = New-Object System.Windows.Forms.NotifyIcon
try {
  $notify.Icon = [System.Drawing.SystemIcons]::Information
  $notify.Visible = $true
  $notify.BalloonTipTitle = $Title
  $notify.BalloonTipText = $Message
  $notify.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
  $notify.ShowBalloonTip($Seconds * 1000)
  Start-Sleep -Seconds $Seconds
} finally {
  $notify.Visible = $false
  $notify.Dispose()
}
