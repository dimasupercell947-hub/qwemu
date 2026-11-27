param(
    [Parameter(Mandatory = $true)]
    [string]$Version,

    [Parameter(Mandatory = $true)]
    [string]$Tag,

    [Parameter(Mandatory = $true)]
    [string]$Repository
)

$ErrorActionPreference = "Stop"

$tagVersion = $Tag -replace "^[vV]", ""
if ($tagVersion -ne $Version) {
    throw "Updater manifest version mismatch: tag=$Tag, app=$Version."
}

$installerDirectory = Join-Path $PSScriptRoot "..\src-tauri\target\release\bundle\nsis"
$installer = Get-ChildItem -LiteralPath $installerDirectory -Filter "*.exe" -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $installer) {
    throw "The NSIS updater installer was not found in $installerDirectory."
}

$signaturePath = $installer.FullName + ".sig"
if (-not (Test-Path -LiteralPath $signaturePath -PathType Leaf)) {
    throw "The signed updater signature file is missing: $signaturePath."
}

$signature = (Get-Content -LiteralPath $signaturePath -Raw).Trim()
if ([string]::IsNullOrWhiteSpace($signature)) {
    throw "The generated updater signature is empty."
}

$assetName = [uri]::EscapeDataString($installer.Name)
$downloadUrl = "https://github.com/$Repository/releases/download/$Tag/$assetName"

$manifest = [ordered]@{
    version = $Version
    notes = "QWEMU MUSIC Desktop $Version"
    pub_date = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
    platforms = [ordered]@{
        "windows-x86_64" = [ordered]@{
            signature = $signature
            url = $downloadUrl
        }
    }
}

$json = $manifest | ConvertTo-Json -Depth 6
$outputPath = Join-Path (Get-Location) "latest.json"
[System.IO.File]::WriteAllText(
    $outputPath,
    $json + [Environment]::NewLine,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Created signed Windows update manifest: $outputPath"
Write-Host "Version: $Version"
Write-Host "Installer: $($installer.Name)"
