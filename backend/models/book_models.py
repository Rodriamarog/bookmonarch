"""
Data models for the AI Book Generator.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import re
import json


@dataclass
class ChapterSummary:
    """Summary information for a book chapter."""
    number: int
    title: str
    summary: str
    
    def validate(self) -> List[str]:
        """Validate chapter summary data."""
        errors = []
        
        if not isinstance(self.number, int) or self.number < 1:
            errors.append("Chapter number must be a positive integer")
        
        if not self.title or not self.title.strip():
            errors.append("Chapter title cannot be empty")
        elif len(self.title.strip()) > 200:
            errors.append("Chapter title cannot exceed 200 characters")
        
        if not self.summary or not self.summary.strip():
            errors.append("Chapter summary cannot be empty")
        elif len(self.summary.strip()) > 1000:
            errors.append("Chapter summary cannot exceed 1000 characters")
        
        return errors
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ChapterSummary':
        """Create ChapterSummary from dictionary."""
        return cls(
            number=data.get('number', 0),
            title=data.get('title', ''),
            summary=data.get('summary', '')
        )


@dataclass
class BookOutline:
    """Complete book outline with chapter summaries."""
    title: str
    chapters: List[ChapterSummary] = field(default_factory=list)
    
    def validate(self) -> List[str]:
        """Validate book outline data."""
        errors = []
        
        if not self.title or not self.title.strip():
            errors.append("Book title cannot be empty")
        elif len(self.title.strip()) > 300:
            errors.append("Book title cannot exceed 300 characters")
        
        if not self.chapters:
            errors.append("Book outline must contain chapters")
        elif len(self.chapters) != 15:
            errors.append(f"Book outline must contain exactly 15 chapters, found {len(self.chapters)}")
        
        # Validate each chapter
        for i, chapter in enumerate(self.chapters):
            chapter_errors = chapter.validate()
            if chapter_errors:
                errors.extend([f"Chapter {i+1}: {error}" for error in chapter_errors])
            
            # Validate chapter numbering
            if chapter.number != i + 1:
                errors.append(f"Chapter {i+1} has incorrect number: {chapter.number}")
        
        return errors
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'BookOutline':
        """Create BookOutline from dictionary."""
        chapters_data = data.get('chapters', [])
        chapters = [ChapterSummary.from_dict(ch) for ch in chapters_data]
        
        return cls(
            title=data.get('title', ''),
            chapters=chapters
        )


@dataclass
class Chapter:
    """Full chapter with content."""
    number: int
    title: str
    content: str  # Markdown format
    word_count: int = 0
    
    def __post_init__(self):
        """Calculate word count after initialization."""
        if self.content and self.word_count == 0:
            self.word_count = self._calculate_word_count()
    
    def _calculate_word_count(self) -> int:
        """Calculate word count from content."""
        if not self.content:
            return 0
        
        # Remove markdown formatting for accurate word count
        text = re.sub(r'[#*_`\[\]()]', '', self.content)
        text = re.sub(r'\n+', ' ', text)
        words = text.split()
        return len([word for word in words if word.strip()])
    
    def validate(self) -> List[str]:
        """Validate chapter data."""
        errors = []
        
        if not isinstance(self.number, int) or self.number < 1:
            errors.append("Chapter number must be a positive integer")
        
        if not self.title or not self.title.strip():
            errors.append("Chapter title cannot be empty")
        elif len(self.title.strip()) > 200:
            errors.append("Chapter title cannot exceed 200 characters")
        
        if not self.content or not self.content.strip():
            errors.append("Chapter content cannot be empty")
        elif len(self.content.strip()) < 500:
            errors.append("Chapter content is too short (minimum 500 characters)")
        
        # Validate word count is reasonable (target is 1400 words)
        if self.word_count < 500:
            errors.append(f"Chapter word count too low: {self.word_count} (minimum 500)")
        elif self.word_count > 10000:
            errors.append(f"Chapter word count too high: {self.word_count} (maximum 10000)")
        
        # Check for meta commentary patterns
        meta_patterns = [
            r'\*\*Note:',
            r'\*\*Author\'s Note:',
            r'\[Author\'s commentary\]',
            r'\*\*Commentary:',
            r'As the author,',
            r'In this chapter, we will',
            r'This chapter will cover'
        ]
        
        for pattern in meta_patterns:
            if re.search(pattern, self.content, re.IGNORECASE):
                errors.append(f"Chapter contains meta commentary: {pattern}")
        
        return errors
    
    def clean_content(self) -> str:
        """Clean content by removing meta commentary."""
        content = self.content
        
        # Remove common meta commentary patterns
        meta_patterns = [
            r'\*\*Note:.*?\n',
            r'\*\*Author\'s Note:.*?\n',
            r'\[Author\'s commentary:.*?\]',
            r'\*\*Commentary:.*?\n'
        ]
        
        for pattern in meta_patterns:
            content = re.sub(pattern, '', content, flags=re.IGNORECASE | re.DOTALL)
        
        # Clean up extra whitespace
        content = re.sub(r'\n\s*\n\s*\n', '\n\n', content)
        content = content.strip()
        
        return content


@dataclass
class BookData:
    """Complete book data including outline and chapters."""
    title: str
    author: str
    book_type: str
    outline: Optional[BookOutline] = None
    chapters: List[Chapter] = field(default_factory=list)
    
    def validate(self) -> List[str]:
        """Validate complete book data."""
        errors = []
        
        if not self.title or not self.title.strip():
            errors.append("Book title cannot be empty")
        elif len(self.title.strip()) > 300:
            errors.append("Book title cannot exceed 300 characters")
        
        if not self.author or not self.author.strip():
            errors.append("Author name cannot be empty")
        elif len(self.author.strip()) > 200:
            errors.append("Author name cannot exceed 200 characters")
        
        if self.book_type != "non-fiction":
            errors.append("Only non-fiction books are supported")
        
        if self.outline:
            outline_errors = self.outline.validate()
            if outline_errors:
                errors.extend([f"Outline: {error}" for error in outline_errors])
        
        if self.chapters:
            if len(self.chapters) != 15:
                errors.append(f"Book must contain exactly 15 chapters, found {len(self.chapters)}")
            
            for i, chapter in enumerate(self.chapters):
                chapter_errors = chapter.validate()
                if chapter_errors:
                    errors.extend([f"Chapter {i+1}: {error}" for error in chapter_errors])
        
        return errors
    
    def get_total_word_count(self) -> int:
        """Get total word count for all chapters."""
        return sum(chapter.word_count for chapter in self.chapters)
    
    def is_complete(self) -> bool:
        """Check if book data is complete."""
        return (
            bool(self.title and self.author) and
            self.outline is not None and
            len(self.chapters) == 15 and
            all(chapter.content for chapter in self.chapters)
        )


@dataclass
class BookMetadata:
    """Marketing metadata for book publishing."""
    sales_description: str
    reading_age_range: str
    bisac_categories: List[str] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)
    back_cover_description: str = ""
    trim_size: str = "5x8in"
    bleed_settings: str = "No Bleed"
    
    def validate(self) -> List[str]:
        """Validate metadata."""
        errors = []
        
        if not self.sales_description or not self.sales_description.strip():
            errors.append("Sales description cannot be empty")
        elif len(self.sales_description) > 4000:
            errors.append("Sales description cannot exceed 4000 characters")
        
        if not self.reading_age_range or not self.reading_age_range.strip():
            errors.append("Reading age range cannot be empty")
        
        if not self.bisac_categories:
            errors.append("At least one BISAC category is required")
        elif len(self.bisac_categories) != 3:
            errors.append(f"Exactly 3 BISAC categories required, found {len(self.bisac_categories)}")
        
        if not self.keywords:
            errors.append("Keywords are required")
        elif len(self.keywords) != 7:
            errors.append(f"Exactly 7 keywords required, found {len(self.keywords)}")
        
        # Validate keyword length
        for keyword in self.keywords:
            if len(keyword) > 50:
                errors.append(f"Keyword too long: '{keyword}' (max 50 characters)")
        
        if not self.back_cover_description or not self.back_cover_description.strip():
            errors.append("Back cover description cannot be empty")
        elif len(self.back_cover_description) > 6000:
            errors.append("Back cover description cannot exceed 6000 characters")
        
        return errors
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'BookMetadata':
        """Create BookMetadata from dictionary."""
        return cls(
            sales_description=data.get('sales_description', ''),
            reading_age_range=data.get('reading_age_range', ''),
            bisac_categories=data.get('bisac_categories', []),
            keywords=data.get('keywords', []),
            back_cover_description=data.get('back_cover_description', ''),
            trim_size=data.get('trim_size', '5x8in'),
            bleed_settings=data.get('bleed_settings', 'No Bleed')
        )
    
    def to_kdp_format(self) -> Dict[str, Any]:
        """Format metadata for Amazon KDP."""
        return {
            'title': 'Book Metadata for Publishing',
            'sales_description': self.sales_description,
            'reading_age_range': self.reading_age_range,
            'bisac_categories': self.bisac_categories,
            'keywords': self.keywords,
            'back_cover_description': self.back_cover_description,
            'trim_size': self.trim_size,
            'bleed_settings': self.bleed_settings,
            'estimated_page_count': '~280 pages',
            'chapter_count': 15
        }