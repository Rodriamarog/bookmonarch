import { describe, it, expect, beforeEach } from 'vitest'
import { 
  BasicMarkdownProcessor, 
  createMarkdownProcessor, 
  parseMarkdownText,
  type FormattedTextSegment 
} from '../markdownProcessor'

describe('BasicMarkdownProcessor', () => {
  let processor: BasicMarkdownProcessor

  beforeEach(() => {
    processor = new BasicMarkdownProcessor()
  })

  describe('processInlineFormatting', () => {
    it('should handle plain text without formatting', () => {
      const result = processor.processInlineFormatting('This is plain text')
      
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        text: 'This is plain text',
        isBold: false,
        isItalic: false
      })
    })

    it('should handle single asterisk for italic formatting', () => {
      const result = processor.processInlineFormatting('This is *italic* text')
      
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({
        text: 'This is ',
        isBold: false,
        isItalic: false
      })
      expect(result[1]).toEqual({
        text: 'italic',
        isBold: false,
        isItalic: true
      })
      expect(result[2]).toEqual({
        text: ' text',
        isBold: false,
        isItalic: false
      })
    })

    it('should handle double asterisk for bold formatting', () => {
      const result = processor.processInlineFormatting('This is **bold** text')
      
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({
        text: 'This is ',
        isBold: false,
        isItalic: false
      })
      expect(result[1]).toEqual({
        text: 'bold',
        isBold: true,
        isItalic: false
      })
      expect(result[2]).toEqual({
        text: ' text',
        isBold: false,
        isItalic: false
      })
    })

    it('should handle triple asterisk for bold italic formatting', () => {
      const result = processor.processInlineFormatting('This is ***bold italic*** text')
      
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({
        text: 'This is ',
        isBold: false,
        isItalic: false
      })
      expect(result[1]).toEqual({
        text: 'bold italic',
        isBold: true,
        isItalic: true
      })
      expect(result[2]).toEqual({
        text: ' text',
        isBold: false,
        isItalic: false
      })
    })

    it('should handle multiple formatting in the same text', () => {
      const result = processor.processInlineFormatting('Text with *italic* and **bold** and ***bold italic***')
      
      expect(result).toHaveLength(6)
      expect(result[0]).toEqual({
        text: 'Text with ',
        isBold: false,
        isItalic: false
      })
      expect(result[1]).toEqual({
        text: 'italic',
        isBold: false,
        isItalic: true
      })
      expect(result[2]).toEqual({
        text: ' and ',
        isBold: false,
        isItalic: false
      })
      expect(result[3]).toEqual({
        text: 'bold',
        isBold: true,
        isItalic: false
      })
      expect(result[4]).toEqual({
        text: ' and ',
        isBold: false,
        isItalic: false
      })
      expect(result[5]).toEqual({
        text: 'bold italic',
        isBold: true,
        isItalic: true
      })
    })

    it('should handle consecutive formatting', () => {
      const result = processor.processInlineFormatting('**bold***italic*')
      
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        text: 'bold',
        isBold: true,
        isItalic: false
      })
      expect(result[1]).toEqual({
        text: 'italic',
        isBold: false,
        isItalic: true
      })
    })

    it('should handle formatting at the beginning of text', () => {
      const result = processor.processInlineFormatting('*italic* at start')
      
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        text: 'italic',
        isBold: false,
        isItalic: true
      })
      expect(result[1]).toEqual({
        text: ' at start',
        isBold: false,
        isItalic: false
      })
    })

    it('should handle formatting at the end of text', () => {
      const result = processor.processInlineFormatting('Text ends with **bold**')
      
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        text: 'Text ends with ',
        isBold: false,
        isItalic: false
      })
      expect(result[1]).toEqual({
        text: 'bold',
        isBold: true,
        isItalic: false
      })
    })

    it('should handle empty formatted text', () => {
      const result = processor.processInlineFormatting('Text with ** empty bold')
      
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        text: 'Text with ** empty bold',
        isBold: false,
        isItalic: false
      })
    })

    it('should handle unmatched asterisks', () => {
      const result = processor.processInlineFormatting('Text with *unmatched asterisk')
      
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        text: 'Text with *unmatched asterisk',
        isBold: false,
        isItalic: false
      })
    })

    it('should handle nested formatting correctly', () => {
      // This tests the regex behavior with overlapping patterns
      const result = processor.processInlineFormatting('Text with *italic **bold** italic*')
      
      // The regex should match the first complete pattern it finds
      expect(result.length).toBeGreaterThan(1)
      // At least one segment should be formatted
      expect(result.some(segment => segment.isBold || segment.isItalic)).toBe(true)
    })

    it('should handle special characters within formatted text', () => {
      const result = processor.processInlineFormatting('Text with **bold & special chars!** here')
      
      expect(result).toHaveLength(3)
      expect(result[1]).toEqual({
        text: 'bold & special chars!',
        isBold: true,
        isItalic: false
      })
    })

    it('should handle numbers and punctuation in formatted text', () => {
      const result = processor.processInlineFormatting('Chapter *1: The Beginning* continues')
      
      expect(result).toHaveLength(3)
      expect(result[1]).toEqual({
        text: '1: The Beginning',
        isBold: false,
        isItalic: true
      })
    })
  })

  describe('parseMarkdown', () => {
    it('should delegate to processInlineFormatting', () => {
      const testText = 'Test **bold** text'
      const result = processor.parseMarkdown(testText)
      const expected = processor.processInlineFormatting(testText)
      
      expect(result).toEqual(expected)
    })
  })
})

describe('Factory functions', () => {
  describe('createMarkdownProcessor', () => {
    it('should create a BasicMarkdownProcessor instance', () => {
      const processor = createMarkdownProcessor()
      expect(processor).toBeInstanceOf(BasicMarkdownProcessor)
    })

    it('should create a working processor', () => {
      const processor = createMarkdownProcessor()
      const result = processor.parseMarkdown('**bold** text')
      
      expect(result).toHaveLength(2)
      expect(result[0].isBold).toBe(true)
      expect(result[1].isBold).toBe(false)
    })
  })

  describe('parseMarkdownText', () => {
    it('should parse markdown text correctly', () => {
      const result = parseMarkdownText('This is *italic* and **bold**')
      
      expect(result).toHaveLength(4)
      expect(result[1].isItalic).toBe(true)
      expect(result[3].isBold).toBe(true)
    })

    it('should handle empty string', () => {
      const result = parseMarkdownText('')
      
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        text: '',
        isBold: false,
        isItalic: false
      })
    })
  })
})

describe('Edge cases and complex scenarios', () => {
  let processor: BasicMarkdownProcessor

  beforeEach(() => {
    processor = new BasicMarkdownProcessor()
  })

  it('should handle multiple paragraphs with formatting', () => {
    const text = 'First paragraph with **bold**.\n\nSecond paragraph with *italic*.'
    const result = processor.processInlineFormatting(text)
    
    expect(result.length).toBeGreaterThan(3)
    expect(result.some(segment => segment.isBold)).toBe(true)
    expect(result.some(segment => segment.isItalic)).toBe(true)
  })

  it('should handle very long formatted text', () => {
    const longText = 'a'.repeat(1000)
    const text = `**${longText}**`
    const result = processor.processInlineFormatting(text)
    
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe(longText)
    expect(result[0].isBold).toBe(true)
  })

  it('should handle mixed formatting patterns', () => {
    const text = '***Bold italic*** followed by **just bold** and *just italic*'
    const result = processor.processInlineFormatting(text)
    
    expect(result.length).toBeGreaterThanOrEqual(5)
    
    // Find the bold italic segment
    const boldItalicSegment = result.find(segment => segment.isBold && segment.isItalic)
    expect(boldItalicSegment).toBeDefined()
    expect(boldItalicSegment?.text).toBe('Bold italic')
    
    // Find the just bold segment
    const boldSegment = result.find(segment => segment.isBold && !segment.isItalic)
    expect(boldSegment).toBeDefined()
    expect(boldSegment?.text).toBe('just bold')
    
    // Find the just italic segment
    const italicSegment = result.find(segment => !segment.isBold && segment.isItalic)
    expect(italicSegment).toBeDefined()
    expect(italicSegment?.text).toBe('just italic')
  })
})