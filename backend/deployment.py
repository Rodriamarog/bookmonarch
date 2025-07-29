"""
Deployment configuration and utilities for Flask Book Generator API.
"""

import os
import sys
import logging
from pathlib import Path
from typing import Dict, Any, Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from config import get_config, Config


class DeploymentManager:
    """Manages deployment configuration and validation."""
    
    def __init__(self):
        self.config = get_config()
        self.logger = logging.getLogger(__name__)
        self.environment = os.getenv('FLASK_ENV', 'development').lower()
    
    def validate_deployment_environment(self) -> Dict[str, Any]:
        """
        Validate deployment environment and return status.
        
        Returns:
            Dict with validation results
        """
        validation_results = {
            'environment': self.environment,
            'valid': True,
            'errors': [],
            'warnings': [],
            'config_status': {}
        }
        
        try:
            # Validate configuration
            self.config.validate_config()
            validation_results['config_status']['config_validation'] = 'passed'
        except Exception as e:
            validation_results['valid'] = False
            validation_results['errors'].append(f"Configuration validation failed: {str(e)}")
            validation_results['config_status']['config_validation'] = 'failed'
        
        # Check required environment variables
        required_vars = self._get_required_env_vars()
        missing_vars = []
        
        for var in required_vars:
            if not os.getenv(var):
                missing_vars.append(var)
        
        if missing_vars:
            validation_results['valid'] = False
            validation_results['errors'].append(f"Missing environment variables: {missing_vars}")
        
        validation_results['config_status']['environment_variables'] = 'passed' if not missing_vars else 'failed'
        
        # Check dependencies
        dependency_status = self._check_dependencies()
        validation_results['config_status'].update(dependency_status)
        
        if not all(status == 'passed' for status in dependency_status.values()):
            validation_results['warnings'].append("Some dependencies may not be available")
        
        # Environment-specific validations
        if self.environment == 'production':
            prod_warnings = self._validate_production_config()
            validation_results['warnings'].extend(prod_warnings)
        
        return validation_results
    
    def _get_required_env_vars(self) -> list:
        """Get list of required environment variables."""
        base_vars = [
            'SUPABASE_URL',
            'SECRET_KEY',
            'GEMINI_API_KEY'
        ]
        
        if self.environment == 'production':
            base_vars.extend([
                'FLASK_ENV',
                'CORS_ORIGINS'
            ])
        
        return base_vars
    
    def _check_dependencies(self) -> Dict[str, str]:
        """Check external dependencies."""
        status = {}
        
        # Check Supabase connection
        try:
            from lib.supabase_storage import SupabaseStorageService
            storage = SupabaseStorageService()
            status['supabase_storage'] = 'passed'
        except Exception as e:
            self.logger.warning(f"Supabase storage check failed: {e}")
            status['supabase_storage'] = 'failed'
        
        # Check Gemini API key format
        gemini_key = os.getenv('GEMINI_API_KEY')
        if gemini_key and len(gemini_key) > 10:
            status['gemini_api'] = 'passed'
        else:
            status['gemini_api'] = 'failed'
        
        return status
    
    def _validate_production_config(self) -> list:
        """Validate production-specific configuration."""
        warnings = []
        
        # Check SECRET_KEY strength
        secret_key = os.getenv('SECRET_KEY')
        if secret_key:
            if len(secret_key) < 32:
                warnings.append("SECRET_KEY should be at least 32 characters for production")
            if secret_key == 'dev-secret-key-change-in-production':
                warnings.append("SECRET_KEY is using default development value")
        
        # Check CORS origins
        cors_origins = os.getenv('CORS_ORIGINS', '')
        if 'localhost' in cors_origins or '127.0.0.1' in cors_origins:
            warnings.append("CORS_ORIGINS contains localhost - ensure this is intended for production")
        
        # Check debug mode
        if os.getenv('FLASK_DEBUG', '').lower() == 'true':
            warnings.append("FLASK_DEBUG is enabled - should be disabled in production")
        
        return warnings
    
    def get_deployment_info(self) -> Dict[str, Any]:
        """Get comprehensive deployment information."""
        return {
            'environment': self.environment,
            'app_version': os.getenv('APP_VERSION', 'unknown'),
            'python_version': sys.version,
            'flask_config': {
                'debug': self.config.DEBUG,
                'testing': self.config.TESTING,
                'cors_origins': self.config.CORS_ORIGINS,
                'log_level': self.config.LOG_LEVEL
            },
            'server_config': {
                'host': os.getenv('FLASK_HOST', '0.0.0.0'),
                'port': os.getenv('FLASK_PORT', '5000'),
                'workers': os.getenv('GUNICORN_WORKERS', 'auto'),
                'timeout': os.getenv('GUNICORN_TIMEOUT', '300')
            },
            'storage_config': {
                'supabase_url': self.config.SUPABASE_URL,
                'bucket_name': 'books'
            }
        }
    
    def create_deployment_script(self, target_env: str = 'production') -> str:
        """
        Create deployment script for target environment.
        
        Args:
            target_env: Target environment (development, production)
            
        Returns:
            Deployment script content
        """
        if target_env == 'production':
            return self._create_production_script()
        else:
            return self._create_development_script()
    
    def _create_production_script(self) -> str:
        """Create production deployment script."""
        return """#!/bin/bash
# Production deployment script for Flask Book Generator API

set -e  # Exit on any error

echo "🚀 Starting production deployment..."

# Check environment variables
echo "📋 Checking environment variables..."
required_vars=("SUPABASE_URL" "SECRET_KEY" "GEMINI_API_KEY" "CORS_ORIGINS")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: $var is not set"
        exit 1
    fi
done
echo "✅ Environment variables validated"

# Set production environment
export FLASK_ENV=production
export FLASK_DEBUG=false

# Install dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt

# Validate configuration
echo "🔧 Validating configuration..."
python -c "
from deployment import DeploymentManager
dm = DeploymentManager()
result = dm.validate_deployment_environment()
if not result['valid']:
    print('❌ Configuration validation failed:')
    for error in result['errors']:
        print(f'  - {error}')
    exit(1)
print('✅ Configuration validated')
"

# Run database migrations (if any)
echo "🗄️  Running database setup..."
python setup_storage_bucket.py

# Start the application with Gunicorn
echo "🌟 Starting Flask API with Gunicorn..."
exec gunicorn -c gunicorn.conf.py app:app
"""
    
    def _create_development_script(self) -> str:
        """Create development deployment script."""
        return """#!/bin/bash
# Development deployment script for Flask Book Generator API

set -e  # Exit on any error

echo "🛠️  Starting development deployment..."

# Set development environment
export FLASK_ENV=development
export FLASK_DEBUG=true
export CORS_ORIGINS=http://localhost:3000

# Install dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt

# Validate configuration
echo "🔧 Validating configuration..."
python -c "
from deployment import DeploymentManager
dm = DeploymentManager()
result = dm.validate_deployment_environment()
if result['warnings']:
    print('⚠️  Configuration warnings:')
    for warning in result['warnings']:
        print(f'  - {warning}')
if not result['valid']:
    print('❌ Configuration validation failed:')
    for error in result['errors']:
        print(f'  - {error}')
    exit(1)
print('✅ Configuration validated')
"

# Setup storage bucket
echo "🗄️  Setting up storage bucket..."
python setup_storage_bucket.py

# Start the application in development mode
echo "🌟 Starting Flask API in development mode..."
python app.py
"""


def create_deployment_files():
    """Create deployment files for different environments."""
    dm = DeploymentManager()
    
    # Create production deployment script
    prod_script = dm.create_deployment_script('production')
    with open('deploy_production.sh', 'w') as f:
        f.write(prod_script)
    os.chmod('deploy_production.sh', 0o755)
    
    # Create development deployment script
    dev_script = dm.create_deployment_script('development')
    with open('deploy_development.sh', 'w') as f:
        f.write(dev_script)
    os.chmod('deploy_development.sh', 0o755)
    
    # Create environment template
    env_template = """# Flask Book Generator API Environment Variables

# Environment Configuration
FLASK_ENV=production
FLASK_DEBUG=false
FLASK_HOST=0.0.0.0
FLASK_PORT=5000
APP_VERSION=1.0.0

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SECRET_KEY=your-service-role-key-here
SUPABASE_KEY=your-anon-key-here
SUPABASE_JWT_SECRET=your-jwt-secret-here

# Gemini API Configuration
GEMINI_API_KEY=your-gemini-api-key-here

# CORS Configuration (comma-separated)
CORS_ORIGINS=https://your-frontend-domain.com,https://www.your-frontend-domain.com

# Gunicorn Configuration
GUNICORN_WORKERS=4
GUNICORN_TIMEOUT=600
GUNICORN_LOG_LEVEL=info

# Optional: Redis for rate limiting
REDIS_URL=redis://localhost:6379/0

# Optional: Sentry for error monitoring
SENTRY_DSN=https://your-sentry-dsn-here

# Optional: Logging Configuration
LOG_LEVEL=INFO
JSON_LOGGING=false
CONTAINER_ENV=false
"""
    
    with open('.env.template', 'w') as f:
        f.write(env_template)
    
    print("✅ Deployment files created:")
    print("  - deploy_production.sh")
    print("  - deploy_development.sh")
    print("  - .env.template")


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'validate':
        # Validate current deployment
        dm = DeploymentManager()
        result = dm.validate_deployment_environment()
        
        print(f"Environment: {result['environment']}")
        print(f"Valid: {result['valid']}")
        
        if result['errors']:
            print("\nErrors:")
            for error in result['errors']:
                print(f"  ❌ {error}")
        
        if result['warnings']:
            print("\nWarnings:")
            for warning in result['warnings']:
                print(f"  ⚠️  {warning}")
        
        print("\nConfiguration Status:")
        for check, status in result['config_status'].items():
            emoji = "✅" if status == "passed" else "❌"
            print(f"  {emoji} {check}: {status}")
        
        sys.exit(0 if result['valid'] else 1)
    
    elif len(sys.argv) > 1 and sys.argv[1] == 'info':
        # Show deployment info
        dm = DeploymentManager()
        info = dm.get_deployment_info()
        
        print("Deployment Information:")
        print(f"  Environment: {info['environment']}")
        print(f"  App Version: {info['app_version']}")
        print(f"  Python Version: {info['python_version']}")
        print(f"  Debug Mode: {info['flask_config']['debug']}")
        print(f"  CORS Origins: {info['flask_config']['cors_origins']}")
        print(f"  Server Host: {info['server_config']['host']}")
        print(f"  Server Port: {info['server_config']['port']}")
    
    elif len(sys.argv) > 1 and sys.argv[1] == 'create-files':
        # Create deployment files
        create_deployment_files()
    
    else:
        print("Usage:")
        print("  python deployment.py validate    - Validate deployment configuration")
        print("  python deployment.py info        - Show deployment information")
        print("  python deployment.py create-files - Create deployment scripts and templates")