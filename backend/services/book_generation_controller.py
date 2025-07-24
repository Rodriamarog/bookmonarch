"""
Main controller for orchestrating the book generation process.
"""

from flask import render_template, request, redirect, url_for, send_file
import os

class BookGenerationController:
    """Controller that handles web requests and orchestrates book generation."""
    
    def __init__(self):
        self.generated_files = {}
    
    def index(self):
        """Display the main form for book generation."""
        return render_template('index.html')
    
    def generate_book(self):
        """Handle book generation request."""
        # Get form data
        title = request.form.get('title', '').strip()
        author = request.form.get('author', '').strip()
        book_type = request.form.get('book_type', '').strip()
        
        # Validate input
        errors = {}
        if not title:
            errors['title'] = 'Book title is required'
        if not author:
            errors['author'] = 'Author name is required'
        if not book_type or book_type != 'non-fiction':
            errors['book_type'] = 'Only non-fiction books are supported'
        
        if errors:
            return render_template('index.html', errors=errors)
        
        # TODO: Implement actual book generation pipeline
        # For now, just show progress page
        return render_template('progress.html', status="Starting book generation...")
    
    def download_file(self, filename):
        """Handle file download requests."""
        # TODO: Implement file serving
        pass