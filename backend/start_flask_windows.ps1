# PowerShell script to start Flask on Windows

Write-Host "🚀 Starting Flask Book Generator API on Windows..." -ForegroundColor Green

# Set environment variables for development
$env:FLASK_ENV = "development"
$env:FLASK_DEBUG = "true"
$env:CORS_ORIGINS = "http://localhost:3000"

# Test environment first
Write-Host "🔧 Testing environment configuration..." -ForegroundColor Yellow
python test_environment.py

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Environment test failed. Please check your .env file." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Environment test passed!" -ForegroundColor Green

# Validate deployment configuration
Write-Host "🔧 Validating deployment configuration..." -ForegroundColor Yellow
python deployment.py validate

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Deployment validation failed, but continuing..." -ForegroundColor Yellow
}

# Setup storage bucket
Write-Host "🗄️  Setting up storage bucket..." -ForegroundColor Yellow
python setup_storage_bucket.py

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Storage bucket setup failed." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Storage bucket setup complete!" -ForegroundColor Green

# Start Flask application
Write-Host "🌟 Starting Flask application..." -ForegroundColor Green
Write-Host "📍 Flask API will be available at: http://localhost:5000" -ForegroundColor Cyan
Write-Host "📍 Health check: http://localhost:5000/api/health" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow

python app.py