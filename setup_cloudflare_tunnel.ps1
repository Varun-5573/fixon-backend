# ══════════════════════════════════════════════════════════════
#  FixoN Option A — Cloudflare Tunnel Production Setup Script
# ══════════════════════════════════════════════════════════════

Write-Host "🚀 Setting up Cloudflare Tunnel for FixoN Laptop Production Backend..." -ForegroundColor Green

# 1. Disable Windows Sleep & Hibernate
Write-Host "⚡ Configuring Laptop Power Settings (24/7 Always ON)..." -ForegroundColor Yellow
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /change monitor-timeout-ac 15
Write-Host "✅ Laptop power set to ALWAYS ON!" -ForegroundColor Green

# 2. Check if cloudflared is installed
$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
    Write-Host "📥 Installing Cloudflare Tunnel CLI (cloudflared)..." -ForegroundColor Yellow
    winget install --id Cloudflare.cloudflared --exact --accept-package-agreements --accept-source-agreements
} else {
    Write-Host "✅ cloudflared is already installed!" -ForegroundColor Green
}

# 3. Start local server with PM2
Write-Host "🔄 Setting up PM2 Process Manager for server.js..." -ForegroundColor Yellow
try {
    npm install -g pm2
    pm2 start server.js --name "fixon-backend" --max-memory-restart 500M
    pm2 save
} catch {
    Write-Host "⚠️ PM2 step skipped or already running." -ForegroundColor Gray
}

Write-Host "`n🎉 Setup Complete!" -ForegroundColor Green
Write-Host "To start your permanent public HTTPS tunnel, run:" -ForegroundColor Cyan
Write-Host "   cloudflared tunnel --url http://localhost:5000" -ForegroundColor White
