# Minimal static file server for local development (no Node / Python needed).
# Usage: powershell -ExecutionPolicy Bypass -File serve.ps1 [-Port 8000] [-Open]
#   -Open  also opens the page in the default browser once the server is listening
param([int]$Port = 8000, [switch]$Open)

$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8'; '.wasm' = 'application/wasm'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'
  '.task' = 'application/octet-stream'; '.tflite' = 'application/octet-stream'; '.binarypb' = 'application/octet-stream'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root at http://localhost:$Port/  (Ctrl+C to stop)"
if ($Open) { Start-Process "http://localhost:$Port/" }

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $res = $ctx.Response
    try {
      $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
      if ($rel -eq '' -or $rel.EndsWith('/')) { $rel += 'index.html' }
      $path = [System.IO.Path]::GetFullPath((Join-Path $root $rel))
      # stay inside the served folder
      if (-not $path.StartsWith($root + [System.IO.Path]::DirectorySeparatorChar)) { $res.StatusCode = 403 }
      elseif (-not [System.IO.File]::Exists($path)) { $res.StatusCode = 404 }
      else {
        $ext = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
        $type = $mime[$ext]; if (-not $type) { $type = 'application/octet-stream' }
        $bytes = [System.IO.File]::ReadAllBytes($path)
        $res.ContentType = $type
        $res.Headers.Add('Cache-Control', 'no-cache')
        $res.ContentLength64 = $bytes.Length
        if ($ctx.Request.HttpMethod -ne 'HEAD') { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
      }
      Write-Host "$($res.StatusCode) $($ctx.Request.HttpMethod) /$rel"
    } catch {
      Write-Host "ERR $($_.Exception.Message)"
      try { $res.StatusCode = 500 } catch {}
    } finally {
      try { $res.Close() } catch {}
    }
  }
} finally {
  $listener.Stop()
}
