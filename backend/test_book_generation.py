"""
Test script for the AI Book Generator with caching capabilities.
"""

import os
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional

from dotenv import load_dotenv
from models.book_models import BookData, BookOutline, Chapter, ChapterSummary
from services.outline_generator_service import OutlineGeneratorService
from services.chapter_generator_service import ChapterGeneratorService
from services.pdf_generator_service import PDFGeneratorService
from utils.logging_config import setup_logging
from config import Config

# Load environment variables
load_dotenv()

# Setup logging
logger = setup_logging()


class BookGenerationTester:
    """Test class for book generation with caching capabilities."""
    
    def __init__(self):
        self.cache_dir = Path("test_cache")
        self.cache_dir.mkdir(exist_ok=True)
        
        self.outline_service = OutlineGeneratorService()
        self.chapter_service = ChapterGeneratorService()
        self.pdf_service = PDFGeneratorService()
        
        logger.info("BookGenerationTester initialized")
    
    def test_full_generation(self, book_title: str, author: str, use_cache: bool = True) -> str:
        """
        Test the full book generation process with caching.
        
        Args:
            book_title: Title of the book to generate
            author: Author name
            use_cache: Whether to use cached data if available
            
        Returns:
            str: Path to generated PDF
        """
        logger.info(f"Starting full book generation test for '{book_title}' by {author}")
        
        # Create cache key
        cache_key = self._create_cache_key(book_title, author)
        
        # Step 1: Generate or load outline
        outline = self._get_or_generate_outline(book_title, cache_key, use_cache)
        
        # Step 2: Generate or load chapters
        chapters = self._get_or_generate_chapters(outline, cache_key, use_cache)
        
        # Step 3: Create book data
        book_data = BookData(
            title=book_title,
            author=author,
            book_type="non-fiction",
            outline=outline,
            chapters=chapters
        )
        
        # Step 4: Generate PDF
        pdf_path = self._generate_pdf(book_data, cache_key)
        
        logger.info(f"Full book generation test completed. PDF: {pdf_path}")
        return pdf_path
    
    def test_outline_only(self, book_title: str, use_cache: bool = True) -> BookOutline:
        """Test outline generation only."""
        logger.info(f"Testing outline generation for '{book_title}'")
        
        cache_key = self._create_cache_key(book_title, "test_author")
        return self._get_or_generate_outline(book_title, cache_key, use_cache)
    
    def test_chapters_only(self, book_title: str, use_cache: bool = True) -> list:
        """Test chapter generation only (requires cached outline)."""
        logger.info(f"Testing chapter generation for '{book_title}'")
        
        cache_key = self._create_cache_key(book_title, "test_author")
        
        # Load outline from cache
        outline = self._load_outline_from_cache(cache_key)
        if not outline:
            logger.error("No cached outline found. Run outline generation first.")
            return []
        
        return self._get_or_generate_chapters(outline, cache_key, use_cache)
    
    def test_pdf_only(self, book_title: str, author: str) -> str:
        """Test PDF generation only (requires cached outline and chapters)."""
        logger.info(f"Testing PDF generation for '{book_title}'")
        
        cache_key = self._create_cache_key(book_title, author)
        
        # Load from cache
        outline = self._load_outline_from_cache(cache_key)
        chapters = self._load_chapters_from_cache(cache_key)
        
        if not outline or not chapters:
            logger.error("No cached data found. Run full generation first.")
            return ""
        
        book_data = BookData(
            title=book_title,
            author=author,
            book_type="non-fiction",
            outline=outline,
            chapters=chapters
        )
        
        return self._generate_pdf(book_data, cache_key)
    
    def _get_or_generate_outline(self, book_title: str, cache_key: str, use_cache: bool) -> BookOutline:
        """Get outline from cache or generate new one."""
        if use_cache:
            cached_outline = self._load_outline_from_cache(cache_key)
            if cached_outline:
                logger.info("Using cached outline")
                return cached_outline
        
        logger.info("Generating new outline...")
        outline = self.outline_service.generate_book_outline(book_title)
        
        # Cache the outline
        self._save_outline_to_cache(outline, cache_key)
        
        return outline
    
    def _get_or_generate_chapters(self, outline: BookOutline, cache_key: str, use_cache: bool) -> list:
        """Get chapters from cache or generate new ones."""
        if use_cache:
            cached_chapters = self._load_chapters_from_cache(cache_key)
            if cached_chapters:
                logger.info("Using cached chapters")
                return cached_chapters
        
        logger.info("Generating new chapters...")
        chapters = self.chapter_service.generate_all_chapters(outline)
        
        # Cache the chapters
        self._save_chapters_to_cache(chapters, cache_key)
        
        return chapters
    
    def _generate_pdf(self, book_data: BookData, cache_key: str) -> str:
        """Generate PDF from book data."""
        logger.info("Generating PDF...")
        
        # Create output filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        pdf_filename = f"{cache_key}_{timestamp}.pdf"
        pdf_path = self.cache_dir / "pdfs" / pdf_filename
        
        # Ensure PDF directory exists
        pdf_path.parent.mkdir(exist_ok=True)
        
        # Generate PDF
        return self.pdf_service.create_book_pdf(book_data, str(pdf_path))
    
    def _create_cache_key(self, book_title: str, author: str) -> str:
        """Create a cache key from book title and author."""
        # Clean title and author for filename
        clean_title = "".join(c for c in book_title if c.isalnum() or c in (' ', '-', '_')).strip()
        clean_author = "".join(c for c in author if c.isalnum() or c in (' ', '-', '_')).strip()
        
        # Replace spaces with underscores and limit length
        cache_key = f"{clean_title}_{clean_author}".replace(' ', '_').lower()[:50]
        return cache_key
    
    def _save_outline_to_cache(self, outline: BookOutline, cache_key: str):
        """Save outline to cache."""
        cache_file = self.cache_dir / f"{cache_key}_outline.json"
        
        outline_data = {
            'title': outline.title,
            'chapters': [
                {
                    'number': ch.number,
                    'title': ch.title,
                    'summary': ch.summary
                }
                for ch in outline.chapters
            ],
            'cached_at': datetime.now().isoformat()
        }
        
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(outline_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Outline cached to {cache_file}")
    
    def _load_outline_from_cache(self, cache_key: str) -> Optional[BookOutline]:
        """Load outline from cache."""
        cache_file = self.cache_dir / f"{cache_key}_outline.json"
        
        if not cache_file.exists():
            return None
        
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            chapters = [
                ChapterSummary(
                    number=ch['number'],
                    title=ch['title'],
                    summary=ch['summary']
                )
                for ch in data['chapters']
            ]
            
            outline = BookOutline(
                title=data['title'],
                chapters=chapters
            )
            
            logger.info(f"Outline loaded from cache: {cache_file}")
            return outline
            
        except Exception as e:
            logger.error(f"Failed to load outline from cache: {e}")
            return None
    
    def _save_chapters_to_cache(self, chapters: list, cache_key: str):
        """Save chapters to cache."""
        cache_file = self.cache_dir / f"{cache_key}_chapters.json"
        
        chapters_data = {
            'chapters': [
                {
                    'number': ch.number,
                    'title': ch.title,
                    'content': ch.content,
                    'word_count': ch.word_count
                }
                for ch in chapters
            ],
            'total_chapters': len(chapters),
            'total_words': sum(ch.word_count for ch in chapters),
            'cached_at': datetime.now().isoformat()
        }
        
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(chapters_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Chapters cached to {cache_file} ({len(chapters)} chapters, {chapters_data['total_words']:,} words)")
    
    def _load_chapters_from_cache(self, cache_key: str) -> Optional[list]:
        """Load chapters from cache."""
        cache_file = self.cache_dir / f"{cache_key}_chapters.json"
        
        if not cache_file.exists():
            return None
        
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            chapters = [
                Chapter(
                    number=ch['number'],
                    title=ch['title'],
                    content=ch['content'],
                    word_count=ch['word_count']
                )
                for ch in data['chapters']
            ]
            
            logger.info(f"Chapters loaded from cache: {cache_file} ({len(chapters)} chapters)")
            return chapters
            
        except Exception as e:
            logger.error(f"Failed to load chapters from cache: {e}")
            return None
    
    def list_cached_books(self):
        """List all cached books."""
        logger.info("Cached books:")
        
        outline_files = list(self.cache_dir.glob("*_outline.json"))
        
        for outline_file in outline_files:
            cache_key = outline_file.stem.replace('_outline', '')
            
            # Check if chapters exist
            chapter_file = self.cache_dir / f"{cache_key}_chapters.json"
            has_chapters = chapter_file.exists()
            
            # Load outline info
            try:
                with open(outline_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                title = data.get('title', 'Unknown')
                cached_at = data.get('cached_at', 'Unknown')
                
                status = "Complete" if has_chapters else "Outline only"
                logger.info(f"  {cache_key}: '{title}' - {status} (cached: {cached_at})")
                
            except Exception as e:
                logger.error(f"  {cache_key}: Error reading cache - {e}")
    
    def clear_cache(self, cache_key: Optional[str] = None):
        """Clear cache files."""
        if cache_key:
            # Clear specific book
            outline_file = self.cache_dir / f"{cache_key}_outline.json"
            chapter_file = self.cache_dir / f"{cache_key}_chapters.json"
            
            for file in [outline_file, chapter_file]:
                if file.exists():
                    file.unlink()
                    logger.info(f"Deleted {file}")
        else:
            # Clear all cache
            for file in self.cache_dir.glob("*.json"):
                file.unlink()
                logger.info(f"Deleted {file}")


def main():
    """Main test function."""
    tester = BookGenerationTester()
    
    # Test book details
    book_title = "The Complete Guide to Python Programming"
    author = "AI Assistant"
    
    print("\n" + "="*60)
    print("AI BOOK GENERATOR - TEST SUITE")
    print("="*60)
    
    print("\nAvailable test options:")
    print("1. Full generation (outline + chapters + PDF)")
    print("2. Outline only")
    print("3. Chapters only (requires cached outline)")
    print("4. PDF only (requires cached outline + chapters)")
    print("5. List cached books")
    print("6. Clear cache")
    
    choice = input("\nEnter your choice (1-6): ").strip()
    
    try:
        if choice == "1":
            print(f"\nTesting full generation for '{book_title}'...")
            pdf_path = tester.test_full_generation(book_title, author, use_cache=True)
            print(f"✅ PDF generated successfully: {pdf_path}")
            
        elif choice == "2":
            print(f"\nTesting outline generation for '{book_title}'...")
            outline = tester.test_outline_only(book_title, use_cache=True)
            print(f"✅ Outline generated successfully: {len(outline.chapters)} chapters")
            print("\nOutline summary:")
            print(tester.outline_service.get_outline_summary(outline))
            
        elif choice == "3":
            print(f"\nTesting chapter generation for '{book_title}'...")
            chapters = tester.test_chapters_only(book_title, use_cache=True)
            if chapters:
                total_words = sum(ch.word_count for ch in chapters)
                print(f"✅ Chapters generated successfully: {len(chapters)} chapters, {total_words:,} words")
                print("\nChapter summary:")
                print(tester.chapter_service.get_generation_summary(chapters))
            
        elif choice == "4":
            print(f"\nTesting PDF generation for '{book_title}'...")
            pdf_path = tester.test_pdf_only(book_title, author)
            if pdf_path:
                print(f"✅ PDF generated successfully: {pdf_path}")
                pdf_info = tester.pdf_service.get_pdf_info(pdf_path)
                print(f"PDF info: {pdf_info}")
            
        elif choice == "5":
            tester.list_cached_books()
            
        elif choice == "6":
            cache_key = input("Enter cache key to clear (or press Enter for all): ").strip()
            if not cache_key:
                cache_key = None
            tester.clear_cache(cache_key)
            print("✅ Cache cleared")
            
        else:
            print("Invalid choice")
    
    except Exception as e:
        logger.error(f"Test failed: {str(e)}")
        print(f"❌ Test failed: {str(e)}")


if __name__ == "__main__":
    main()