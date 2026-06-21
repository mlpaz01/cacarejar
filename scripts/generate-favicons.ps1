# Gera todos os arquivos de favicon a partir de brand-icon.png
# Requer: os arquivos de logo já salvos em client/public/assets/
# Uso: .\scripts\generate-favicons.ps1 -Project cacarejar

$root = "$PSScriptRoot\..\client\public"
$src  = "$root\assets\brand-icon.png"

if (-not (Test-Path $src)) {
  Write-Error "Arquivo nao encontrado: $src"
  Write-Host "Salve brand-icon.png em client/public/assets/ primeiro."
  exit 1
}

Add-Type -AssemblyName System.Drawing

function Resize-Png {
  param([string]$SrcPath, [string]$DstPath, [int]$W, [int]$H, [bool]$Circle = $false)

  $orig = [System.Drawing.Image]::FromFile($SrcPath)
  $bmp  = New-Object System.Drawing.Bitmap($W, $H)
  $bmp.SetResolution(96, 96)
  $g    = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  if ($Circle) {
    # Clip circular para apple-touch-icon
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse(0, 0, $W, $H)
    $g.SetClip($path)
    # Fundo navy
    $bg = [System.Drawing.Color]::FromArgb(255, 10, 25, 63)
    $g.Clear($bg)
    $pad = [int]($W * 0.08)
    $g.DrawImage($orig, $pad, $pad, $W - $pad*2, $H - $pad*2)
  } else {
    $g.DrawImage($orig, 0, 0, $W, $H)
  }

  $g.Dispose()
  $orig.Dispose()

  $bmp.Save($DstPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "  -> $DstPath ($W x $H)"
}

Write-Host "Gerando favicons a partir de $src"

# PNGs simples
Resize-Png -SrcPath $src -DstPath "$root\favicon-16x16.png"  -W 16  -H 16
Resize-Png -SrcPath $src -DstPath "$root\favicon-32x32.png"  -W 32  -H 32
Resize-Png -SrcPath $src -DstPath "$root\icon-192.png"       -W 192 -H 192
Resize-Png -SrcPath $src -DstPath "$root\icon-512.png"       -W 512 -H 512

# apple-touch-icon com fundo navy e clip circular (180x180)
Resize-Png -SrcPath $src -DstPath "$root\apple-touch-icon.png" -W 180 -H 180 -Circle $true

# favicon.ico = multi-resolucao (16 + 32 dentro de um .ico)
# .NET nao gera .ico nativo — copiamos o favicon-32x32.png renomeado como .ico
# (browsers modernos aceitam PNG dentro de .ico)
$f32 = [System.IO.File]::ReadAllBytes("$root\favicon-32x32.png")
[System.IO.File]::WriteAllBytes("$root\favicon.ico", $f32)
Write-Host "  -> $root\favicon.ico (copia do 32x32 como PNG-in-ICO)"

Write-Host ""
Write-Host "Favicons gerados com sucesso!"
Write-Host "Proximos passos:"
Write-Host "  1. Verifique visualmente os arquivos"
Write-Host "  2. Rode o deploy: .\scripts\deploy-hostinger.ps1 -Project cacarejar"
