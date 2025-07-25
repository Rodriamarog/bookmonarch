"""
API package for Flask book generation service.
"""

from flask import Blueprint

# Create the main API blueprint
api_bp = Blueprint('api', __name__, url_prefix='/api')

# Import all API modules to register routes
from . import book_generation
from . import file_management
from . import health