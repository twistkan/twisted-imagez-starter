param(
    [ValidateSet('Debug', 'Release')]
    [string]$Configuration = 'Release'
)

$ErrorActionPreference = 'Stop'
$desktopRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $desktopRoot
$publishRoot = Join-Path $desktopRoot 'publish'

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw 'The .NET SDK is required to build the desktop app. Install the .NET 8 SDK, then run this script again.'
}

dotnet publish (Join-Path $desktopRoot 'TwistedImagez.Desktop.csproj') `
    --configuration $Configuration `
    --runtime win-x64 `
    --self-contained true `
    --output $publishRoot `
    --property:PublishSingleFile=true `
    --property:IncludeNativeLibrariesForSelfExtract=true `
    --property:EnableCompressionInSingleFile=true

if ($LASTEXITCODE -ne 0) { throw 'Desktop publish failed.' }

New-Item -ItemType Directory -Path (Join-Path $publishRoot 'app') -Force | Out-Null
Copy-Item -Path (Join-Path $projectRoot 'app\*') -Destination (Join-Path $publishRoot 'app') -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'server.ps1') -Destination (Join-Path $publishRoot 'server.ps1') -Force

$publishedExe = Join-Path $publishRoot 'TwistedImagez.Desktop.exe'
Copy-Item -LiteralPath $publishedExe -Destination (Join-Path $desktopRoot 'TwistedImagez.Desktop.exe') -Force
Copy-Item -LiteralPath $publishedExe -Destination (Join-Path $desktopRoot 'TwistedImagez.OneClick.exe') -Force

$dataRoot = Join-Path $publishRoot 'data'
New-Item -ItemType Directory -Path $dataRoot -Force | Out-Null
$sourceData = Join-Path $projectRoot 'sample-data'
if (Test-Path -LiteralPath $sourceData) {
    if (-not (Test-Path -LiteralPath (Join-Path $dataRoot 'twisted-imagez-data.json'))) { Copy-Item -LiteralPath (Join-Path $sourceData 'twisted-imagez-data.json') -Destination $dataRoot }
}

Write-Host "Desktop app published to: $publishRoot"
Write-Host "Convenience executable copied to: $(Join-Path $desktopRoot 'TwistedImagez.Desktop.exe')"
Write-Host "Main one-click executable copied to: $(Join-Path $desktopRoot 'TwistedImagez.OneClick.exe')"
Write-Host 'Copy the complete publish folder to another Windows PC to carry the app and its data.'
