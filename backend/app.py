"""
Main Flask API application entry point for the AI Book Generator.
"""

import os
import logging
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables FIRST
load_dotenv()

from config import Config, get_config
from utils.logging_config import setup_logging
from api import api_bp
from lib.rate_limiter import create_limiter, apply_rate_limits

# Setup logging
logger = setup_logging()

# Get configuration based on environment
ConfigClass = get_config()

# Create Flask app
app = Flask(__name__)
app.config.from_object(ConfigClass)

# Enable CORS for frontend requests with comprehensive configuration
CORS(app, 
     origins=ConfigClass.CORS_ORIGINS,
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type', 'Authorization', 'X-Requested-With'],
     expose_headers=['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
     supports_credentials=True,
     max_age=86400  # 24 hours preflight cache
)

# Initialize configuration
ConfigClass.init_app(app)

# Initialize rate limiting
limiter = create_limiter(app)

# Register API blueprint
app.register_blueprint(api_bp)

# Apply rate limits to endpoints
apply_rate_limits(limiter)

# Root endpoint - redirect to API documentation or health check
@app.route('/', methods=['GET'])
def root():
    """Root endpoint providing API information."""
    return jsonify({
        'service': 'Flask Book Generator API',
        'version': os.getenv('APP_VERSION', '1.0.0'),
        'status': 'operational',
        'endpoints': {
            'health': '/api/health',
            'generate_book': '/api/generate-book',
            'book_status': '/api/book-status/<book_id>',
            'book_files': '/api/book-files/<book_id>',
            'delete_book': '/api/book-delete/<book_id>'
        },
        'documentation': 'See API endpoints above for available operations'
    }), 200

# Global error handlers
@app.errorhandler(400)
def bad_request(error):
    """Handle 400 Bad Request errors."""
    return jsonify({
        'success': False,
        'error': 'Bad Request',
        'code': 'BAD_REQUEST',
        'message': str(error.description) if hasattr(error, 'description') else 'Invalid request'
    }), 400

@app.errorhandler(401)
def unauthorized(error):
    """Handle 401 Unauthorized errors."""
    return jsonify({
        'success': False,
        'error': 'Unauthorized',
        'code': 'UNAUTHORIZED',
        'message': 'Authentication required or invalid credentials'
    }), 401

@app.errorhandler(403)
def forbidden(error):
    """Handle 403 Forbidden errors."""
    return jsonify({
        'success': False,
        'error': 'Forbidden',
        'code': 'FORBIDDEN',
        'message': 'Access denied'
    }), 403

@app.errorhandler(404)
def not_found(error):
    """Handle 404 Not Found errors."""
    return jsonify({
        'success': False,
        'error': 'Not Found',
        'code': 'NOT_FOUND',
        'message': 'The requested resource was not found'
    }), 404

@app.errorhandler(405)
def method_not_allowed(error):
    """Handle 405 Method Not Allowed errors."""
    return jsonify({
        'success': False,
        'error': 'Method Not Allowed',
        'code': 'METHOD_NOT_ALLOWED',
        'message': 'The requested method is not allowed for this endpoint'
    }), 405

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 Internal Server Error."""
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({
        'success': False,
        'error': 'Internal Server Error',
        'code': 'INTERNAL_ERROR',
        'message': 'An unexpected error occurred'
    }), 500

# Request logging middleware
@app.before_request
def log_request_info():
    """Log incoming requests for debugging."""
    from flask import request
    if app.config.get('DEBUG'):
        logger.debug(f"Request: {request.method} {request.url}")

@app.after_request
def log_response_info(response):
    """Log response information."""
    if app.config.get('DEBUG'):
        logger.debug(f"Response: {response.status_code}")
    return response

if __name__ == '__main__':
    logger.info("Starting Flask Book Generator API service")
    
    # Get configuration from environment
    host = os.getenv('FLASK_HOST', '0.0.0.0')
    port = int(os.getenv('FLASK_PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    
    if debug:
        logger.warning("Running in DEBUG mode - not suitable for production")
    
    app.run(host=host, port=port, debug=debug)