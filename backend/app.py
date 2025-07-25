"""
Main Flask application entry point for the AI Book Generator.
"""

from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
from config import Config
from utils.logging_config import setup_logging
from services.book_generation_controller import BookGenerationController

# Load environment variables
load_dotenv()

# Setup logging
logger = setup_logging()

# Create Flask app
app = Flask(__name__)
app.config.from_object(Config)

# Enable CORS for frontend requests
CORS(app, origins=["http://localhost:3000"])

# Initialize configuration
Config.init_app(app)

# Initialize the book generation controller
book_controller = BookGenerationController()

# Register routes
app.add_url_rule('/', 'index', book_controller.index, methods=['GET'])
app.add_url_rule('/generate', 'generate_book', book_controller.generate_book, methods=['POST'])
app.add_url_rule('/progress', 'progress', book_controller.progress, methods=['GET'])
app.add_url_rule('/results', 'results', book_controller.results, methods=['GET'])
app.add_url_rule('/download/<filename>', 'download_file', book_controller.download_file, methods=['GET'])
app.add_url_rule('/api/books/<book_id>', 'delete_book', book_controller.delete_book, methods=['DELETE'])

if __name__ == '__main__':
    logger.info("Starting AI Book Generator application")
    app.run(debug=True)