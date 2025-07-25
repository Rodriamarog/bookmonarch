"""
Gunicorn configuration for Flask Book Generator API.
"""

import os
import multiprocessing

# Server socket
bind = f"0.0.0.0:{os.getenv('PORT', '5000')}"
backlog = 2048

# Worker processes
workers = int(os.getenv('GUNICORN_WORKERS', multiprocessing.cpu_count() * 2 + 1))
worker_class = "sync"
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 100

# Timeout settings (important for book generation)
timeout = int(os.getenv('GUNICORN_TIMEOUT', '300'))  # 5 minutes for book generation
keepalive = 2
graceful_timeout = 30

# Preload application for better performance
preload_app = True

# Logging
accesslog = "-"  # Log to stdout
errorlog = "-"   # Log to stderr
loglevel = os.getenv('GUNICORN_LOG_LEVEL', 'info')
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = 'flask-book-generator'

# Server mechanics
daemon = False
pidfile = None
user = None
group = None
tmp_upload_dir = None

# SSL (if needed)
keyfile = os.getenv('SSL_KEYFILE')
certfile = os.getenv('SSL_CERTFILE')

# Worker process lifecycle
def on_starting(server):
    """Called just before the master process is initialized."""
    server.log.info("Starting Flask Book Generator API server")

def on_reload(server):
    """Called to recycle workers during a reload via SIGHUP."""
    server.log.info("Reloading Flask Book Generator API server")

def when_ready(server):
    """Called just after the server is started."""
    server.log.info(f"Flask Book Generator API server is ready. Listening on {bind}")

def worker_int(worker):
    """Called just after a worker exited on SIGINT or SIGQUIT."""
    worker.log.info(f"Worker {worker.pid} received INT or QUIT signal")

def pre_fork(server, worker):
    """Called just before a worker is forked."""
    server.log.info(f"Worker {worker.pid} is being forked")

def post_fork(server, worker):
    """Called just after a worker has been forked."""
    server.log.info(f"Worker {worker.pid} has been forked")

def post_worker_init(worker):
    """Called just after a worker has initialized the application."""
    worker.log.info(f"Worker {worker.pid} initialized")

def worker_abort(worker):
    """Called when a worker received the SIGABRT signal."""
    worker.log.info(f"Worker {worker.pid} received SIGABRT signal")

def pre_exec(server):
    """Called just before a new master process is forked."""
    server.log.info("Forked child, re-executing")

def pre_request(worker, req):
    """Called just before a worker processes the request."""
    worker.log.debug(f"{req.method} {req.uri}")

def post_request(worker, req, environ, resp):
    """Called after a worker processes the request."""
    worker.log.debug(f"{req.method} {req.uri} - {resp.status}")

# Environment-specific configurations
if os.getenv('FLASK_ENV') == 'development':
    # Development settings
    reload = True
    reload_extra_files = ['app.py', 'config.py']
    workers = 1
    timeout = 0  # No timeout in development
    loglevel = 'debug'
elif os.getenv('FLASK_ENV') == 'production':
    # Production settings
    reload = False
    preload_app = True
    max_requests = 1000
    max_requests_jitter = 100
    
    # Use more workers in production
    workers = max(2, multiprocessing.cpu_count())
    
    # Longer timeout for book generation
    timeout = 600  # 10 minutes in production
    
    # Production logging
    loglevel = 'warning'
    
    # Enable stats if requested
    if os.getenv('GUNICORN_STATS', 'false').lower() == 'true':
        statsd_host = os.getenv('STATSD_HOST', 'localhost:8125')

# Memory and resource limits
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190

# Security
forwarded_allow_ips = os.getenv('FORWARDED_ALLOW_IPS', '127.0.0.1')
secure_headers = [
    ('X-Content-Type-Options', 'nosniff'),
    ('X-Frame-Options', 'DENY'),
    ('X-XSS-Protection', '1; mode=block'),
]

# Custom application factory (if needed)
def application(environ, start_response):
    """WSGI application factory."""
    from app import app
    return app(environ, start_response)

# Health check configuration
def health_check():
    """Simple health check for load balancers."""
    try:
        from app import app
        with app.test_client() as client:
            response = client.get('/api/health')
            return response.status_code == 200
    except Exception:
        return False

# Graceful shutdown handling
def on_exit(server):
    """Called just before exiting."""
    server.log.info("Flask Book Generator API server is shutting down")
    
    # Clean up resources
    try:
        # Close database connections, clean up temp files, etc.
        server.log.info("Cleanup completed")
    except Exception as e:
        server.log.error(f"Error during cleanup: {e}")

# Configuration validation
def validate_config():
    """Validate configuration before starting."""
    required_env_vars = [
        'SUPABASE_URL',
        'SECRET_KEY',
        'GEMINI_API_KEY'
    ]
    
    missing_vars = []
    for var in required_env_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        raise ValueError(f"Missing required environment variables: {missing_vars}")

# Run validation on import
try:
    validate_config()
except ValueError as e:
    print(f"Configuration error: {e}")
    exit(1)