# Flask Book Generator API - Deployment Guide

This guide covers deployment options for the Flask Book Generator API in different environments.

## Table of Contents

1. [Environment Configuration](#environment-configuration)
2. [Development Deployment](#development-deployment)
3. [Production Deployment](#production-deployment)
4. [Docker Deployment](#docker-deployment)
5. [Cloud Deployment](#cloud-deployment)
6. [Monitoring and Maintenance](#monitoring-and-maintenance)

## Environment Configuration

### Required Environment Variables

```bash
# Core Configuration
FLASK_ENV=production                    # Environment (development/production)
FLASK_DEBUG=false                      # Debug mode (false for production)
FLASK_HOST=0.0.0.0                     # Host to bind to
FLASK_PORT=5000                        # Port to bind to
APP_VERSION=1.0.0                      # Application version

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SECRET_KEY=your-service-role-key-here   # Service role key (admin access)
SUPABASE_KEY=your-anon-key-here        # Anonymous key (client access)
SUPABASE_JWT_SECRET=your-jwt-secret    # JWT secret for token validation

# Gemini API Configuration
GEMINI_API_KEY=your-gemini-api-key-here

# CORS Configuration
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Gunicorn Configuration
GUNICORN_WORKERS=4                     # Number of worker processes
GUNICORN_TIMEOUT=600                   # Request timeout (10 minutes)
GUNICORN_LOG_LEVEL=info               # Log level

# Optional Configuration
REDIS_URL=redis://localhost:6379/0     # Redis for rate limiting
SENTRY_DSN=https://your-sentry-dsn     # Error monitoring
LOG_LEVEL=INFO                         # Application log level
JSON_LOGGING=false                     # JSON structured logging
```

### Configuration Validation

Before deployment, validate your configuration:

```bash
python deployment.py validate
```

## Development Deployment

### Quick Start

1. **Clone and setup:**
   ```bash
   git clone <repository>
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Configure environment:**
   ```bash
   cp .env.template .env
   # Edit .env with your configuration
   ```

3. **Setup storage:**
   ```bash
   python setup_storage_bucket.py
   ```

4. **Run development server:**
   ```bash
   python deployment.py create-files
   ./deploy_development.sh
   ```

### Manual Development Setup

```bash
export FLASK_ENV=development
export FLASK_DEBUG=true
export CORS_ORIGINS=http://localhost:3000
python app.py
```

## Production Deployment

### Option 1: Direct Deployment

1. **Prepare environment:**
   ```bash
   # Create production environment file
   cp .env.template .env.production
   # Edit .env.production with production values
   source .env.production
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Validate configuration:**
   ```bash
   python deployment.py validate
   ```

4. **Setup storage:**
   ```bash
   python setup_storage_bucket.py
   ```

5. **Deploy with Gunicorn:**
   ```bash
   ./deploy_production.sh
   ```

### Option 2: Systemd Service

Create a systemd service file:

```bash
sudo nano /etc/systemd/system/flask-book-generator.service
```

```ini
[Unit]
Description=Flask Book Generator API
After=network.target

[Service]
Type=exec
User=www-data
Group=www-data
WorkingDirectory=/path/to/your/app
Environment=PATH=/path/to/your/venv/bin
EnvironmentFile=/path/to/your/.env
ExecStart=/path/to/your/venv/bin/gunicorn -c gunicorn.conf.py app:app
ExecReload=/bin/kill -s HUP $MAINPID
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable flask-book-generator
sudo systemctl start flask-book-generator
sudo systemctl status flask-book-generator
```

## Docker Deployment

### Development with Docker

```bash
# Build and run development container
docker-compose up --build

# Or run specific services
docker-compose up flask-api redis
```

### Production with Docker

1. **Create production environment:**
   ```bash
   cp .env.template .env
   # Edit .env with production values
   ```

2. **Build and deploy:**
   ```bash
   docker-compose -f docker-compose.yml up -d --build
   ```

3. **With Nginx reverse proxy:**
   ```bash
   docker-compose --profile nginx up -d
   ```

### Docker Commands

```bash
# View logs
docker-compose logs -f flask-api

# Scale workers
docker-compose up -d --scale flask-api=3

# Health check
docker-compose exec flask-api curl http://localhost:5000/api/health

# Shell access
docker-compose exec flask-api /bin/bash
```

## Cloud Deployment

### AWS ECS/Fargate

1. **Build and push image:**
   ```bash
   docker build -t flask-book-generator .
   docker tag flask-book-generator:latest your-ecr-repo:latest
   docker push your-ecr-repo:latest
   ```

2. **Create ECS task definition:**
   ```json
   {
     "family": "flask-book-generator",
     "networkMode": "awsvpc",
     "requiresCompatibilities": ["FARGATE"],
     "cpu": "1024",
     "memory": "2048",
     "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
     "containerDefinitions": [
       {
         "name": "flask-api",
         "image": "your-ecr-repo:latest",
         "portMappings": [
           {
             "containerPort": 5000,
             "protocol": "tcp"
           }
         ],
         "environment": [
           {"name": "FLASK_ENV", "value": "production"},
           {"name": "SUPABASE_URL", "value": "your-supabase-url"}
         ],
         "secrets": [
           {"name": "SECRET_KEY", "valueFrom": "arn:aws:secretsmanager:region:account:secret:name"},
           {"name": "GEMINI_API_KEY", "valueFrom": "arn:aws:secretsmanager:region:account:secret:name"}
         ],
         "logConfiguration": {
           "logDriver": "awslogs",
           "options": {
             "awslogs-group": "/ecs/flask-book-generator",
             "awslogs-region": "us-east-1",
             "awslogs-stream-prefix": "ecs"
           }
         },
         "healthCheck": {
           "command": ["CMD-SHELL", "curl -f http://localhost:5000/api/health || exit 1"],
           "interval": 30,
           "timeout": 5,
           "retries": 3
         }
       }
     ]
   }
   ```

### Google Cloud Run

```bash
# Build and deploy
gcloud builds submit --tag gcr.io/PROJECT-ID/flask-book-generator
gcloud run deploy --image gcr.io/PROJECT-ID/flask-book-generator --platform managed
```

### Heroku

```bash
# Create Heroku app
heroku create your-app-name

# Set environment variables
heroku config:set FLASK_ENV=production
heroku config:set SUPABASE_URL=your-supabase-url
heroku config:set SECRET_KEY=your-secret-key
heroku config:set GEMINI_API_KEY=your-gemini-key

# Deploy
git push heroku main
```

## Monitoring and Maintenance

### Health Checks

The API provides several health check endpoints:

- `GET /api/health` - Comprehensive health check
- `GET /api/health/ready` - Readiness probe
- `GET /api/health/live` - Liveness probe

### Logging

Logs are written to:
- Console (stdout/stderr)
- Files (if not in container): `logs/flask_book_generator.log`
- Structured JSON (if `JSON_LOGGING=true`)

### Monitoring Setup

1. **Application Performance Monitoring:**
   ```bash
   # Install Sentry SDK (already in requirements.txt)
   export SENTRY_DSN=your-sentry-dsn
   ```

2. **Infrastructure Monitoring:**
   - Use Prometheus + Grafana for metrics
   - Monitor health check endpoints
   - Set up alerts for error rates and response times

3. **Log Aggregation:**
   - Use ELK stack or similar for log analysis
   - Enable JSON logging for better parsing

### Maintenance Tasks

1. **Regular Updates:**
   ```bash
   # Update dependencies
   pip install -r requirements.txt --upgrade
   
   # Restart service
   sudo systemctl restart flask-book-generator
   ```

2. **Database Maintenance:**
   ```bash
   # Clean up old generation status (if using in-memory storage)
   # This is handled automatically by the cleanup function
   ```

3. **Storage Cleanup:**
   ```bash
   # Monitor Supabase storage usage
   # Implement cleanup policies as needed
   ```

### Troubleshooting

1. **Check service status:**
   ```bash
   sudo systemctl status flask-book-generator
   ```

2. **View logs:**
   ```bash
   sudo journalctl -u flask-book-generator -f
   ```

3. **Test API endpoints:**
   ```bash
   curl http://localhost:5000/api/health
   ```

4. **Validate configuration:**
   ```bash
   python deployment.py validate
   ```

5. **Common issues:**
   - **CORS errors**: Check `CORS_ORIGINS` configuration
   - **Authentication failures**: Verify Supabase JWT secret
   - **Rate limiting**: Check Redis connection if using external Redis
   - **File upload failures**: Verify Supabase storage configuration

## Security Considerations

1. **Environment Variables:**
   - Never commit `.env` files to version control
   - Use secrets management in production
   - Rotate keys regularly

2. **Network Security:**
   - Use HTTPS in production
   - Configure proper CORS origins
   - Implement rate limiting

3. **Container Security:**
   - Run containers as non-root user
   - Use minimal base images
   - Regularly update dependencies

4. **Monitoring:**
   - Monitor for unusual API usage patterns
   - Set up alerts for error rates
   - Log security-relevant events

## Performance Optimization

1. **Gunicorn Configuration:**
   - Adjust worker count based on CPU cores
   - Use appropriate worker class
   - Configure timeouts for long-running requests

2. **Caching:**
   - Use Redis for rate limiting and caching
   - Implement response caching where appropriate

3. **Database:**
   - Monitor Supabase performance
   - Optimize queries if needed

4. **Storage:**
   - Monitor Supabase storage usage
   - Implement file cleanup policies