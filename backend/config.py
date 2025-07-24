"""
Configuration settings for the AI Book Generator.
"""

import os
from pathlib import Path

class Config:
    """Application configuration."""
    
    # Flask settings
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    
    # API settings
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
    
    # File settings
    UPLOAD_FOLDER = 'generated_books'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    
    # Book generation settings
    TARGET_CHAPTER_WORD_COUNT = 1400
    TOTAL_CHAPTERS = 15
    
    # PDF settings
    PDF_PAGE_WIDTH = 5  # inches
    PDF_PAGE_HEIGHT = 8  # inches
    PDF_MARGIN_INSIDE = 0.375  # inches
    PDF_MARGIN_OUTSIDE = 0.375  # inches
    PDF_MARGIN_TOP = 0.5  # inches
    PDF_MARGIN_BOTTOM = 0.5  # inches
    PDF_FONT = 'Times New Roman'
    
    # Retry settings
    MAX_API_RETRIES = 3
    RETRY_DELAY_BASE = 1  # seconds
    
    @staticmethod
    def init_app(app):
        """Initialize application with configuration."""
        # Create upload directory if it doesn't exist
        upload_path = Path(Config.UPLOAD_FOLDER)
        upload_path.mkdir(exist_ok=True)