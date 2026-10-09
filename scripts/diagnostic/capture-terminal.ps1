param(
  [Parameter(Mandatory)][string]$Cwd,
  [string]$Cmd = "",
  [string]$CmdFile = "",
  [Parameter(Mandatory)][string]$Out,
  [string]$Title = "",
  [int]$Cols = 120,
  [int]$Rows = 40,
  [int]$TimeoutSec = 180
)
# Ouvre une vraie fenetre console (conhost), y lance la commande, attend la fin,
# puis capture la fenetre avec PrintWindow et l'enregistre en PNG.
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class W {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint f);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("kernel32.dll")] public static extern bool FreeConsole();
  [DllImport("kernel32.dll")] public static extern bool AttachConsole(uint pid);
  [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
}
"@
[W]::SetProcessDPIAware() | Out-Null
if ($CmdFile) { $Cmd = ([IO.File]::ReadAllText($CmdFile)).TrimEnd() }

$marker = Join-Path $env:TEMP ("shot_" + [guid]::NewGuid().ToString("N") + ".done")
$sh = Join-Path $env:TEMP ("shot_" + [guid]::NewGuid().ToString("N") + ".sh")
[IO.File]::WriteAllText($sh, "cd '" + $Cwd.Replace('\','/') + "' || exit 99`n" + $Cmd + "`n", (New-Object Text.UTF8Encoding($false)))
$display = $Cmd.Replace("'","''")
$inner = @"
`$host.UI.RawUI.WindowTitle = 'salles-api'
try { `$host.UI.RawUI.BufferSize = New-Object Management.Automation.Host.Size($Cols, 3000) } catch {}
try { `$host.UI.RawUI.WindowSize = New-Object Management.Automation.Host.Size($Cols, $Rows) } catch {}
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Set-Location -LiteralPath '$Cwd'
Clear-Host
Write-Host '# $($Title.Replace("'","''"))' -ForegroundColor Cyan
Write-Host ('# ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '   ' + (Split-Path -Leaf (Get-Location)) + '  ' + (git rev-parse --abbrev-ref HEAD) + ' @ ' + (git rev-parse --short HEAD)) -ForegroundColor DarkGray
& 'C:\Program Files\Git\bin\bash.exe' '$sh' 2>&1 | ForEach-Object { "`$_" } | Out-Host
Write-Host ('[code de sortie : ' + `$LASTEXITCODE + ']') -ForegroundColor Magenta
New-Item -ItemType File -Path '$marker' | Out-Null
Start-Sleep -Seconds 600
"@
$enc = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($inner))
$p = Start-Process -FilePath "conhost.exe" -ArgumentList "powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -EncodedCommand $enc" -PassThru

$deadline = (Get-Date).AddSeconds($TimeoutSec)
while (-not (Test-Path $marker) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 300 }
Start-Sleep -Milliseconds 800

# Retrouver la fenetre console de la powershell enfant
$child = Get-CimInstance Win32_Process -Filter "ParentProcessId=$($p.Id) AND Name='powershell.exe'" | Select-Object -First 1
[W]::FreeConsole() | Out-Null
[W]::AttachConsole([uint32]$child.ProcessId) | Out-Null
$h = [W]::GetConsoleWindow()
[W]::FreeConsole() | Out-Null

$r = New-Object W+RECT
[W]::GetWindowRect($h, [ref]$r) | Out-Null
$w = $r.R - $r.L; $hgt = $r.B - $r.T
$bmp = New-Object Drawing.Bitmap $w, $hgt
$g = [Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()
[W]::PrintWindow($h, $hdc, 2) | Out-Null
$g.ReleaseHdc($hdc); $g.Dispose()
$bmp.Save($Out, [Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()

Stop-Process -Id $child.ProcessId -Force -ErrorAction SilentlyContinue
Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
Remove-Item $marker, $sh -ErrorAction SilentlyContinue
Write-Output "OK $Out ($w x $hgt)"
