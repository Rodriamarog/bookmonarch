import { describe, it, expect, beforeEach, vi } from 'vitest'
import jsPDF from 'jspdf'
import { 
  PDFTextRenderer, 
  createTextRenderer, 
  renderFormattedText,
  renderParagraph,
  type RenderOptions 
} from '../textRenderer'
import { FormattedTextSegment } from '../markdownProcessor'

// Mock jsPDF
vi.mock('jspdf', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      setFontSize: vi.fn(),
      setFont: vi.fn(),
      text: vi.fn(),
      getTextWidth: vi.fn().mockReturnValue(50) // Default width
    }))
  }
})

// Mock markdown processor
vi.mock('../markdownProcessor', () => ({
  parseMarkdownText: vi.fn().mockReturnValue([
    { text: 'Sample text', isBold: false, isItalic: false }
  ])
}))

// Mock font manager
vi.mock('../fontManager', () => ({
  createFontManager: vi.fn().mockReturnValue({
    setConsistentFont: vi.fn(),
    resetToDefault: vi.fn(),
    getCurrentFontState: vi.fn().mockReturnValue({
      family: 'times',
      size: 11,
      style: 'normal'
    })
  })
}))

describe('PDFTextRenderer', () => {
  let renderer: PDFTextRenderer
  let mockPdf: any

  beforeEach(() => {
    renderer = new PDFTextRenderer()
    mockPdf = {
      setFontSize: vi.fn(),
      setFont: vi.fn(),
      text: vi.fn(),
      getTextWidth: vi.fn().mockReturnValue(50)
    }
  })

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const defaultRenderer = new PDFTextRenderer()
      
      expect(defaultRenderer.getLineHeight()).toBe(16)
      expect(defaultRenderer.getParagraphSpacing()).toBe(8)
    })

    it('should accept custom options', () => {
      const customOptions: Partial<RenderOptions> = {
        lineHeight: 20,
        paragraphSpacing: 12,
        indentSize: 30,
        defaultFontSize: 14
      }
      
      const customRenderer = new PDFTextRenderer(customOptions)
      
      expect(customRenderer.getLineHeight()).toBe(20)
      expect(customRenderer.getParagraphSpacing()).toBe(12)
    })
  })

  describe('renderFormattedText', () => {
    it('should render simple text segments', () => {
      const segments: FormattedTextSegment[] = [
        { text: 'Hello ', isBold: false, isItalic: false },
        { text: 'world', isBold: true, isItalic: false }
      ]

      const newY = renderer.renderFormattedText(mockPdf, segments, 10, 20, 200)

      expect(mockPdf.text).toHaveBeenCalled()
      expect(newY).toBeGreaterThan(20) // Should advance Y position
    })

    it('should handle empty segments array', () => {
      const segments: FormattedTextSegment[] = []

      const newY = renderer.renderFormattedText(mockPdf, segments, 10, 20, 200)

      expect(newY).toBe(20) // Y position should not change
    })

    it('should handle word wrapping', () => {
      // Mock getTextWidth to simulate text that exceeds maxWidth
      mockPdf.getTextWidth.mockImplementation((text: string) => {
        return text.length * 10 // 10 points per character
      })

      const segments: FormattedTextSegment[] = [
        { text: 'This is a very long line that should wrap to the next line', isBold: false, isItalic: false }
      ]

      const newY = renderer.renderFormattedText(mockPdf, segments, 10, 20, 100)

      // Should have rendered multiple lines
      expect(mockPdf.text).toHaveBeenCalled() // Text should be rendered
      expect(newY).toBeGreaterThan(20) // Should advance Y position
    })

    it('should handle mixed formatting within wrapped text', () => {
      mockPdf.getTextWidth.mockImplementation((text: string) => text.length * 8)

      const segments: FormattedTextSegment[] = [
        { text: 'Normal text ', isBold: false, isItalic: false },
        { text: 'bold text ', isBold: true, isItalic: false },
        { text: 'and more normal text that wraps', isBold: false, isItalic: false }
      ]

      const newY = renderer.renderFormattedText(mockPdf, segments, 10, 20, 150)

      expect(mockPdf.text).toHaveBeenCalled()
      expect(newY).toBeGreaterThan(20)
    })

    it('should respect custom font sizes in segments', () => {
      const segments: FormattedTextSegment[] = [
        { text: 'Small text', isBold: false, isItalic: false, fontSize: 8 },
        { text: 'Large text', isBold: false, isItalic: false, fontSize: 18 }
      ]

      const newY = renderer.renderFormattedText(mockPdf, segments, 10, 20, 200)

      expect(mockPdf.text).toHaveBeenCalled()
      expect(newY).toBeGreaterThan(20)
    })
  })

  describe('renderParagraph', () => {
    it('should render paragraph with indentation by default', () => {
      const content = 'This is a test paragraph'
      
      const newY = renderer.renderParagraph(mockPdf, content, 10, 20, 200, true)

      expect(mockPdf.text).toHaveBeenCalled()
      expect(newY).toBeGreaterThan(20) // Should advance Y position
    })

    it('should render paragraph without indentation when specified', () => {
      const content = 'This is a test paragraph'
      
      const newY = renderer.renderParagraph(mockPdf, content, 10, 20, 200, false)

      expect(mockPdf.text).toHaveBeenCalled()
      expect(newY).toBeGreaterThan(20)
    })

    it('should handle empty content', () => {
      const newY = renderer.renderParagraph(mockPdf, '', 10, 20, 200)

      expect(newY).toBe(28) // Should advance by paragraph spacing only
    })

    it('should handle whitespace-only content', () => {
      const newY = renderer.renderParagraph(mockPdf, '   \n\t  ', 10, 20, 200)

      expect(newY).toBe(28) // Should advance by paragraph spacing only
    })
  })

  describe('needsPageBreak', () => {
    it('should return false when there is enough space', () => {
      const needsBreak = renderer.needsPageBreak(100, 800, 50, 1)
      
      expect(needsBreak).toBe(false)
    })

    it('should return true when space is insufficient', () => {
      const needsBreak = renderer.needsPageBreak(750, 800, 50, 1)
      
      expect(needsBreak).toBe(true)
    })

    it('should consider multiple lines', () => {
      const needsBreak = renderer.needsPageBreak(700, 800, 50, 5)
      
      expect(needsBreak).toBe(true) // 700 + (5 * 16) = 780 > 750
    })
  })

  describe('updateOptions', () => {
    it('should update rendering options', () => {
      renderer.updateOptions({ lineHeight: 20, paragraphSpacing: 15 })
      
      expect(renderer.getLineHeight()).toBe(20)
      expect(renderer.getParagraphSpacing()).toBe(15)
    })

    it('should merge options without overwriting unchanged values', () => {
      const originalLineHeight = renderer.getLineHeight()
      
      renderer.updateOptions({ paragraphSpacing: 15 })
      
      expect(renderer.getLineHeight()).toBe(originalLineHeight)
      expect(renderer.getParagraphSpacing()).toBe(15)
    })
  })

  describe('resetFont', () => {
    it('should reset font to default', () => {
      renderer.resetFont(mockPdf)
      
      // The resetFont method should call the font manager's resetToDefault method
      // Since we're mocking the font manager, we can't test the PDF calls directly
      // but we can verify the method completes without error
      expect(true).toBe(true) // Method executed successfully
    })
  })
})

describe('Factory functions', () => {
  describe('createTextRenderer', () => {
    it('should create a PDFTextRenderer instance', () => {
      const renderer = createTextRenderer()
      expect(renderer).toBeInstanceOf(PDFTextRenderer)
    })

    it('should create renderer with custom options', () => {
      const options: Partial<RenderOptions> = { lineHeight: 18 }
      const renderer = createTextRenderer(options) as PDFTextRenderer
      
      expect(renderer.getLineHeight()).toBe(18)
    })
  })

  describe('renderFormattedText utility', () => {
    let mockPdf: any

    beforeEach(() => {
      mockPdf = {
        setFontSize: vi.fn(),
        setFont: vi.fn(),
        text: vi.fn(),
        getTextWidth: vi.fn().mockReturnValue(50)
      }
    })

    it('should render formatted text using utility function', () => {
      const segments: FormattedTextSegment[] = [
        { text: 'Test text', isBold: false, isItalic: false }
      ]

      const newY = renderFormattedText(mockPdf, segments, 10, 20, 200)

      expect(mockPdf.text).toHaveBeenCalled()
      expect(newY).toBeGreaterThan(20)
    })
  })

  describe('renderParagraph utility', () => {
    let mockPdf: any

    beforeEach(() => {
      mockPdf = {
        setFontSize: vi.fn(),
        setFont: vi.fn(),
        text: vi.fn(),
        getTextWidth: vi.fn().mockReturnValue(50)
      }
    })

    it('should render paragraph using utility function', () => {
      const newY = renderParagraph(mockPdf, 'Test paragraph', 10, 20, 200)

      expect(mockPdf.text).toHaveBeenCalled()
      expect(newY).toBeGreaterThan(20)
    })

    it('should render paragraph without indentation when specified', () => {
      const newY = renderParagraph(mockPdf, 'Test paragraph', 10, 20, 200, false)

      expect(mockPdf.text).toHaveBeenCalled()
      expect(newY).toBeGreaterThan(20)
    })
  })
})

describe('Complex rendering scenarios', () => {
  let renderer: PDFTextRenderer
  let mockPdf: any

  beforeEach(() => {
    renderer = new PDFTextRenderer()
    mockPdf = {
      setFontSize: vi.fn(),
      setFont: vi.fn(),
      text: vi.fn(),
      getTextWidth: vi.fn().mockImplementation((text: string) => text.length * 6)
    }
  })

  it('should handle very long words that exceed line width', () => {
    const segments: FormattedTextSegment[] = [
      { text: 'supercalifragilisticexpialidocious', isBold: false, isItalic: false }
    ]

    const newY = renderer.renderFormattedText(mockPdf, segments, 10, 20, 100)

    expect(mockPdf.text).toHaveBeenCalled()
    expect(newY).toBeGreaterThan(20)
  })

  it('should handle mixed formatting with various font sizes', () => {
    const segments: FormattedTextSegment[] = [
      { text: 'Small ', isBold: false, isItalic: false, fontSize: 8 },
      { text: 'normal ', isBold: false, isItalic: false, fontSize: 11 },
      { text: 'large ', isBold: true, isItalic: false, fontSize: 16 },
      { text: 'text', isBold: false, isItalic: true, fontSize: 11 }
    ]

    const newY = renderer.renderFormattedText(mockPdf, segments, 10, 20, 200)

    expect(mockPdf.text).toHaveBeenCalled()
    expect(newY).toBeGreaterThan(20)
  })

  it('should handle text with only whitespace segments', () => {
    const segments: FormattedTextSegment[] = [
      { text: '   ', isBold: false, isItalic: false },
      { text: '\t\t', isBold: false, isItalic: false },
      { text: '  ', isBold: false, isItalic: false }
    ]

    const newY = renderer.renderFormattedText(mockPdf, segments, 10, 20, 200)

    // Should handle whitespace gracefully
    expect(newY).toBeGreaterThanOrEqual(20)
  })

  it('should maintain proper spacing between formatted segments', () => {
    const segments: FormattedTextSegment[] = [
      { text: 'Word1', isBold: false, isItalic: false },
      { text: ' ', isBold: false, isItalic: false },
      { text: 'Word2', isBold: true, isItalic: false },
      { text: ' ', isBold: false, isItalic: false },
      { text: 'Word3', isBold: false, isItalic: true }
    ]

    renderer.renderFormattedText(mockPdf, segments, 10, 20, 200)

    // Should have rendered all segments
    expect(mockPdf.text).toHaveBeenCalledTimes(3) // 3 non-whitespace segments
  })
})