param([int]$Port = 18767, [switch]$NoBrowser)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dataDir = Join-Path $root 'data'
$dataFile = Join-Path $dataDir 'twisted-imagez-data.json'
$pidFile = Join-Path $root 'twisted-imagez-server.pid'
New-Item -ItemType Directory -Path $dataDir -Force | Out-Null

function Send-Bytes($context, [byte[]]$bytes, [string]$contentType, [int]$statusCode = 200) {
  $context.Response.StatusCode = $statusCode
  $context.Response.ContentType = $contentType
  $context.Response.ContentLength64 = $bytes.Length
  $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $context.Response.OutputStream.Close()
}
function Send-Json($context, $value, [int]$statusCode = 200) {
  $json = $value | ConvertTo-Json -Depth 20
  Send-Bytes $context ([Text.Encoding]::UTF8.GetBytes($json)) 'application/json; charset=utf-8' $statusCode
}
function Read-ProjectData {
  if (-not (Test-Path -LiteralPath $dataFile)) {
    return [ordered]@{ clients=@(); jobs=@(); quotations=@(); invoices=@(); settings=[ordered]@{ depositRate=50; validityDays=30; taxRate=0 } }
  }
  try { return Get-Content -Raw -LiteralPath $dataFile | ConvertFrom-Json }
  catch { return [ordered]@{ clients=@(); jobs=@(); quotations=@(); invoices=@(); settings=[ordered]@{ depositRate=50; validityDays=30; taxRate=0 } } }
}
function Get-ContentType($path) {
  switch ([IO.Path]::GetExtension($path).ToLowerInvariant()) {
    '.html' { 'text/html; charset=utf-8'; break }
    '.js' { 'application/javascript; charset=utf-8'; break }
    '.css' { 'text/css; charset=utf-8'; break }
    '.png' { 'image/png'; break }
    '.jpg' { 'image/jpeg'; break }
    '.jpeg' { 'image/jpeg'; break }
    '.json' { 'application/json; charset=utf-8'; break }
    default { 'application/octet-stream' }
  }
}

$listener = New-Object Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()
Set-Content -LiteralPath $pidFile -Value $PID -Encoding ascii
if (-not $NoBrowser) { Start-Process "http://127.0.0.1:$Port/app/" }

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $path = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath)

    if ($path -eq '/api/data' -and $context.Request.HttpMethod -eq 'GET') {
      Send-Json $context (Read-ProjectData)
      continue
    }

    if ($path -eq '/api/data' -and $context.Request.HttpMethod -eq 'POST') {
      $reader = New-Object IO.StreamReader($context.Request.InputStream, $context.Request.ContentEncoding)
      $body = $reader.ReadToEnd()
      $reader.Close()
      try {
        $body | ConvertFrom-Json | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath ($dataFile + '.tmp') -Encoding utf8
        Move-Item -LiteralPath ($dataFile + '.tmp') -Destination $dataFile -Force
        Send-Json $context @{ ok=$true }
      } catch {
        Send-Json $context @{ ok=$false; error='Could not save project data' } 500
      }
      continue
    }

    if ($context.Request.HttpMethod -ne 'GET') {
      Send-Bytes $context ([Text.Encoding]::UTF8.GetBytes('Method not allowed')) 'text/plain; charset=utf-8' 405
      continue
    }

    if ($path -eq '/') { $path = '/app/' }
    $staticFiles = @{
      '/app/' = 'app/index.html'
      '/app/index.html' = 'app/index.html'
      '/app/app.js' = 'app/app.js'
      '/app/styles.css' = 'app/styles.css'
    }
    if ($staticFiles.ContainsKey($path)) {
      $filePath = Join-Path $root $staticFiles[$path]
      Send-Bytes $context ([IO.File]::ReadAllBytes($filePath)) (Get-ContentType $filePath)
    } else {
      Send-Bytes $context ([Text.Encoding]::UTF8.GetBytes('Not found')) 'text/plain; charset=utf-8' 404
    }
  }
} finally {
  $listener.Stop()
  if (Test-Path -LiteralPath $pidFile) { Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue }
}

