"""
Quick test script for testing specific components.
"""

from test_book_generation import BookGenerationTester
import sys

def quick_test():
    """Quick test with predefined book."""
    tester = BookGenerationTester()
    
    # Test book
    book_title = "Mastering Time Management"
    author = "Productivity Expert"
    
    print(f"🚀 Quick test: Generating '{book_title}' by {author}")
    print("This will use cached data if available, or generate new content.")
    
    try:
        pdf_path = tester.test_full_generation(book_title, author, use_cache=True)
        print(f"✅ Success! PDF generated: {pdf_path}")
        
        # Show PDF info
        pdf_info = tester.pdf_service.get_pdf_info(pdf_path)
        print(f"\nPDF Details:")
        print(f"  File size: {pdf_info.get('file_size_mb', 0)} MB")
        print(f"  Dimensions: {pdf_info.get('page_dimensions', 'Unknown')}")
        print(f"  Font: {pdf_info.get('font', 'Unknown')}")
        
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False
    
    return True

if __name__ == "__main__":
    success = quick_test()
    sys.exit(0 if success else 1)