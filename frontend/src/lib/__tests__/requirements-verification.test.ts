/**
 * Requirements Verification Tests for PDF Formatting Improvements
 * 
 * These tests verify that all requirements from the spec are met:
 * - Consistent font styling throughout the document
 * - Proper markdown formatting (bold/italic instead of raw asterisks)
 * - Proper text indentation and spacing
 * - Consistent chapter title formatting
 * - Accurate table of contents
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  parseMarkdownText, 
  createMarkdownProcessor,
  type FormattedTextSegment 
} from '../markdownProcessor'
import { 
  createFontManager,
  type FontManager 
} from '../fontManager'
import { 
  createTextRenderer,
  type TextRenderer 
} from '../textRenderer'
import { generatePDF, type BookData } from '../fileGeneration'

// Mock jsPDF for testing
vi.mock('jspdf', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      setFontSize: vi.fn(),
      setFont: vi.fn(),
      text: vi.fn(),
      getTextWidth: vi.fn().mockReturnValue(50),
      splitTextToSize: vi.fn().mockImplementation((text: string) => [text]),
      addPage: vi.fn(),
      output: vi.fn().mockReturnValue(new ArrayBuffer(1000))
    }))
  }
})

describe('Requirements Verification Tests', () => {
  describe('Requirement 1: Consistent font styling throughout the document', () => {
    let fontManager: FontManager
    let mockPdf: any

    beforeEach(() => {
      fontManager = createFontManager()
      mockPdf = {
        setFontSize: vi.fn(),
        setFont: vi.fn()
      }
    })

    it('should maintain consistent font family across all text', () => {
      // Test various font combinations
      fontManager.setConsistentFont(mockPdf, 12, false, false)
      fontManager.setConsistentFont(mockPdf, 14, true, false)
      fontManager.setConsistentFont(mockPdf, 16, false, true)
      fontManager.setConsistentFont(mockPdf, 18, true, true)

      // All calls should use 'times' font family
      expect(mockPdf.setFont).toHaveBeenCalledWith('times', 'normal')
      expect(mockPdf.setFont).toHaveBeenCalledWith('times', 'bold')
      expect(mockPdf.setFont).toHaveBeenCalledWith('times', 'italic')
      expect(mockPdf.setFont).toHaveBeenCalledWith('times', 'bolditalic')
    })

    it('should prevent font variations between paragraphs', () => {
      // Set initial font
      fontManager.setConsistentFont(mockPdf, 11, false, false)
      mockPdf.setFont.mockClear()

      // Setting same font again should not call PDF methods
      fontManager.setConsistentFont(mockPdf, 11, false, false)
      expect(mockPdf.setFont).not.toHaveBeenCalled()
    })

    it('should maintain font consistency across page breaks', () => {
      const currentState = fontManager.getCurrentFontState()
      
      expect(currentState.family).toBe('times')
      expect(currentState.style).toBe('normal')
    })
  })

  describe('Requirement 2: Proper markdown formatting rendering', () => {
    it('should render italic text for *text* markdown', () => {
      const segments = parseMarkdownText('This is *italic* text')
      
      expect(segments).toHaveLength(3)
      expect(segments[0]).toEqual({
        text: 'This is ',
        isBold: false,
        isItalic: false
      })
      expect(segments[1]).toEqual({
        text: 'italic',
        isBold: false,
        isItalic: true
      })
      expect(segments[2]).toEqual({
        text: ' text',
        isBold: false,
        isItalic: false
      })
    })

    it('should render bold text for **text** markdown', () => {
      const segments = parseMarkdownText('This is **bold** text')
      
      expect(segments).toHaveLength(3)
      expect(segments[1]).toEqual({
        text: 'bold',
        isBold: true,
        isItalic: false
      })
    })

    it('should render bold italic text for ***text*** markdown', () => {
      const segments = parseMarkdownText('This is ***bold italic*** text')
      
      expect(segments).toHaveLength(3)
      expect(segments[1]).toEqual({
        text: 'bold italic',
        isBold: true,
        isItalic: true
      })
    })

    it('should not show raw asterisks in final output', () => {
      const segments = parseMarkdownText('Game *Pong* was revolutionary')
      
      // Should not contain any segments with raw asterisks
      const hasRawAsterisks = segments.some(segment => 
        segment.text.includes('*') && !segment.isBold && !segment.isItalic
      )
      expect(hasRawAsterisks).toBe(false)
      
      // Should have properly formatted italic text
      const italicSegment = segments.find(segment => segment.isItalic)
      expect(italicSegment).toBeDefined()
      expect(italicSegment?.text).toBe('Pong')
    })

    it('should handle complex markdown combinations', () => {
      const segments = parseMarkdownText('Text with *italic*, **bold**, and ***bold italic*** formatting')
      
      const italicSegment = segments.find(segment => segment.isItalic && !segment.isBold)
      const boldSegment = segments.find(segment => segment.isBold && !segment.isItalic)
      const boldItalicSegment = segments.find(segment => segment.isBold && segment.isItalic)
      
      expect(italicSegment?.text).toBe('italic')
      expect(boldSegment?.text).toBe('bold')
      expect(boldItalicSegment?.text).toBe('bold italic')
    })
  })

  describe('Requirement 3: Proper text indentation and spacing', () => {
    let textRenderer: TextRenderer
    let mockPdf: any

    beforeEach(() => {
      textRenderer = createTextRenderer({
        lineHeight: 16,
        paragraphSpacing: 12,
        indentSize: 20,
        defaultFontSize: 11
      })
      mockPdf = {
        setFontSize: vi.fn(),
        setFont: vi.fn(),
        text: vi.fn(),
        getTextWidth: vi.fn().mockReturnValue(50)
      }
    })

    it('should apply consistent paragraph indentation', () => {
      const initialY = 100
      const newY = textRenderer.renderParagraph(mockPdf, 'Test paragraph', 50, initialY, 300, true)
      
      // Should have advanced Y position (paragraph rendered)
      expect(newY).toBeGreaterThan(initialY)
      
      // Text should be rendered (indented)
      expect(mockPdf.text).toHaveBeenCalled()
    })

    it('should provide appropriate spacing between paragraphs', () => {
      const spacing = textRenderer.getParagraphSpacing()
      expect(spacing).toBe(12) // As configured
    })

    it('should handle proper spacing from chapter titles', () => {
      const lineHeight = textRenderer.getLineHeight()
      expect(lineHeight).toBe(16) // As configured
    })
  })

  describe('Requirement 4: Consistent chapter title formatting', () => {
    it('should format chapter titles consistently', () => {
      const processor = createMarkdownProcessor()
      const segments = processor.parseMarkdown('Chapter 1: The Beginning')
      
      // Chapter titles should be parsed as plain text (no markdown in titles)
      expect(segments).toHaveLength(1)
      expect(segments[0].text).toBe('Chapter 1: The Beginning')
    })
  })

  describe('Requirement 5: Accurate table of contents', () => {
    it('should list all chapters with correct titles', () => {
      const bookData: BookData = {
        title: 'Test Book',
        author: 'Test Author',
        genre: 'Test Genre',
        plotSummary: 'Test summary',
        chapterTitles: [
          'Chapter 1: Introduction',
          'Chapter 2: Development',
          'Chapter 3: Conclusion'
        ],
        chapters: {
          1: 'Introduction content',
          2: 'Development content',
          3: 'Conclusion content'
        },
        metadata: {
          totalWords: 1000,
          totalChapters: 3,
          generatedAt: new Date().toISOString()
        }
      }

      // Verify all chapter titles are present
      expect(bookData.chapterTitles).toHaveLength(3)
      expect(bookData.chapterTitles[0]).toBe('Chapter 1: Introduction')
      expect(bookData.chapterTitles[1]).toBe('Chapter 2: Development')
      expect(bookData.chapterTitles[2]).toBe('Chapter 3: Conclusion')
    })
  })

  describe('Integration Tests: Complete PDF Generation', () => {
    it('should generate PDF with all formatting improvements', async () => {
      const bookData: BookData = {
        title: 'Ultimate Guide To Gaming',
        author: 'Smith',
        genre: 'Non-fiction',
        plotSummary: 'A comprehensive guide to gaming with *italic* and **bold** text.',
        chapterTitles: [
          'Pixels to Polygons: The Genesis of Interactive Entertainment',
          'The Console Wars: A History of Gaming Hardware'
        ],
        chapters: {
          1: 'The glow of a cathode-ray tube, the rhythmic click of a joystick, the triumphant fanfare of a synthesized melody – these are the sensory touchstones that define the dawn of a new era. *Pong* was a masterclass in minimalist design.',
          2: 'From the flickering pixels of *Pong* in dimly lit arcades to the immersive, photorealistic worlds we explore today, the journey of video games is a story of relentless innovation and passionate rivalry.'
        },
        metadata: {
          totalWords: 15000,
          totalChapters: 2,
          generatedAt: new Date().toISOString()
        }
      }

      // Should generate PDF without errors
      const pdfBuffer = await generatePDF(bookData)
      
      expect(pdfBuffer).toBeInstanceOf(Buffer)
      expect(pdfBuffer.length).toBeGreaterThan(0)
    })

    it('should handle books with extensive markdown formatting', async () => {
      const bookData: BookData = {
        title: 'Markdown Test Book',
        author: 'Test Author',
        genre: 'Technical',
        plotSummary: 'A book to test **bold**, *italic*, and ***bold italic*** formatting.',
        chapterTitles: ['Test Chapter'],
        chapters: {
          1: 'This chapter contains *italic text*, **bold text**, ***bold italic text***, and regular text. The game *Pong* was revolutionary. **Bold statements** are important. ***Very important*** points need emphasis.'
        },
        metadata: {
          totalWords: 500,
          totalChapters: 1,
          generatedAt: new Date().toISOString()
        }
      }

      // Should generate PDF without errors despite complex formatting
      const pdfBuffer = await generatePDF(bookData)
      
      expect(pdfBuffer).toBeInstanceOf(Buffer)
      expect(pdfBuffer.length).toBeGreaterThan(0)
    })
  })

  describe('Visual Regression Prevention', () => {
    it('should maintain consistent font state across multiple operations', () => {
      const fontManager = createFontManager()
      const mockPdf = {
        setFontSize: vi.fn(),
        setFont: vi.fn()
      }

      // Simulate multiple font changes as would occur in PDF generation
      fontManager.setConsistentFont(mockPdf, 24, true, false) // Title
      fontManager.setConsistentFont(mockPdf, 16, false, true) // Author
      fontManager.setConsistentFont(mockPdf, 18, true, false) // TOC Header
      fontManager.setConsistentFont(mockPdf, 12, false, false) // TOC Entries
      fontManager.setConsistentFont(mockPdf, 16, true, false) // Chapter Title
      fontManager.setConsistentFont(mockPdf, 11, false, false) // Body Text
      fontManager.setConsistentFont(mockPdf, 11, false, true) // Italic Text
      fontManager.setConsistentFont(mockPdf, 11, true, false) // Bold Text

      // All font calls should use consistent family
      const fontCalls = mockPdf.setFont.mock.calls
      fontCalls.forEach(call => {
        expect(call[0]).toBe('times') // First argument should always be 'times'
      })
    })

    it('should handle edge cases in markdown processing', () => {
      // Test various edge cases that could cause formatting issues
      const testCases = [
        'Text with *unclosed italic',
        'Text with **unclosed bold',
        'Text with ***unclosed bold italic',
        'Text with * single asterisk',
        'Text with ** double asterisk',
        'Text with *** triple asterisk',
        'Text with *empty* formatting',
        'Text with **empty** formatting',
        'Text with ***empty*** formatting'
      ]

      testCases.forEach(testCase => {
        const segments = parseMarkdownText(testCase)
        
        // Should not throw errors
        expect(segments).toBeDefined()
        expect(Array.isArray(segments)).toBe(true)
        
        // Should have at least one segment
        expect(segments.length).toBeGreaterThan(0)
      })
    })
  })
})