/**
 * Tests for Structured Content Generation System
 * 
 * These tests verify the validation logic and error handling for structured content
 * Requirements tested: 3.1, 3.2, 3.3, 3.4
 */

import { describe, it, expect } from 'vitest'
import {
  StructuredBookContent,
  StructuredChapter,
  StructuredParagraph,
  TextFormatting,
  StructuredContentValidationError,
  validateStructuredBookContent,
  validateStructuredChapter,
  validateStructuredParagraph,
  validateTextFormatting,
  countWordsInStructuredContent,
  extractPlainText
} from '../structuredContent'

describe('Structured Content Validation', () => {
  // Valid test data
  const validTextFormatting: TextFormatting = {
    start: 0,
    end: 4,
    type: 'bold',
    text: 'Test'
  }

  const validParagraph: StructuredParagraph = {
    text: 'Test paragraph with some content.',
    formatting: [validTextFormatting]
  }

  const validChapter: StructuredChapter = {
    number: 1,
    title: 'Test Chapter',
    paragraphs: [validParagraph]
  }

  const validBookContent: StructuredBookContent = {
    title: 'Test Book',
    author: 'Test Author',
    genre: 'Fiction',
    plotSummary: 'A test book about testing.',
    chapters: [validChapter]
  }

  describe('validateTextFormatting', () => {
    it('should validate correct text formatting', () => {
      const paragraphText = 'Test paragraph content'
      const formatting = {
        start: 0,
        end: 4,
        type: 'bold' as const,
        text: 'Test'
      }

      const result = validateTextFormatting(formatting, paragraphText)
      expect(result).toEqual(formatting)
    })

    it('should throw error for invalid object', () => {
      expect(() => validateTextFormatting(null, 'text')).toThrow(StructuredContentValidationError)
      expect(() => validateTextFormatting('invalid', 'text')).toThrow(StructuredContentValidationError)
    })

    it('should throw error for invalid start position', () => {
      const formatting = { start: -1, end: 4, type: 'bold' as const, text: 'Test' }
      expect(() => validateTextFormatting(formatting, 'Test text')).toThrow(StructuredContentValidationError)
    })

    it('should throw error for invalid end position', () => {
      const formatting = { start: 5, end: 4, type: 'bold' as const, text: 'Test' }
      expect(() => validateTextFormatting(formatting, 'Test text')).toThrow(StructuredContentValidationError)
    })

    it('should throw error for positions exceeding text length', () => {
      const formatting = { start: 0, end: 20, type: 'bold' as const, text: 'Test' }
      expect(() => validateTextFormatting(formatting, 'Short')).toThrow(StructuredContentValidationError)
    })

    it('should throw error for invalid formatting type', () => {
      const formatting = { start: 0, end: 4, type: 'invalid' as any, text: 'Test' }
      expect(() => validateTextFormatting(formatting, 'Test text')).toThrow(StructuredContentValidationError)
    })

    it('should throw error for mismatched text', () => {
      const formatting = { start: 0, end: 4, type: 'bold' as const, text: 'Wrong' }
      expect(() => validateTextFormatting(formatting, 'Test text')).toThrow(StructuredContentValidationError)
    })

    it('should validate all formatting types', () => {
      const paragraphText = 'Test italic bold-italic content'
      
      const boldFormatting = { start: 0, end: 4, type: 'bold' as const, text: 'Test' }
      const italicFormatting = { start: 5, end: 11, type: 'italic' as const, text: 'italic' }
      const boldItalicFormatting = { start: 12, end: 23, type: 'bold-italic' as const, text: 'bold-italic' }

      expect(() => validateTextFormatting(boldFormatting, paragraphText)).not.toThrow()
      expect(() => validateTextFormatting(italicFormatting, paragraphText)).not.toThrow()
      expect(() => validateTextFormatting(boldItalicFormatting, paragraphText)).not.toThrow()
    })
  })

  describe('validateStructuredParagraph', () => {
    it('should validate correct paragraph', () => {
      const paragraph = {
        text: 'Test paragraph content',
        formatting: [{
          start: 0,
          end: 4,
          type: 'bold' as const,
          text: 'Test'
        }]
      }

      const result = validateStructuredParagraph(paragraph)
      expect(result.text).toBe('Test paragraph content')
      expect(result.formatting).toHaveLength(1)
    })

    it('should throw error for invalid object', () => {
      expect(() => validateStructuredParagraph(null)).toThrow(StructuredContentValidationError)
      expect(() => validateStructuredParagraph('invalid')).toThrow(StructuredContentValidationError)
    })

    it('should throw error for missing or invalid text', () => {
      expect(() => validateStructuredParagraph({ formatting: [] })).toThrow(StructuredContentValidationError)
      expect(() => validateStructuredParagraph({ text: null, formatting: [] })).toThrow(StructuredContentValidationError)
      expect(() => validateStructuredParagraph({ text: 123, formatting: [] })).toThrow(StructuredContentValidationError)
    })

    it('should throw error for invalid formatting array', () => {
      expect(() => validateStructuredParagraph({ text: 'Test', formatting: 'invalid' })).toThrow(StructuredContentValidationError)
    })

    it('should validate paragraph with empty formatting', () => {
      const paragraph = { text: 'Test paragraph', formatting: [] }
      const result = validateStructuredParagraph(paragraph)
      expect(result.formatting).toHaveLength(0)
    })

    it('should validate paragraph with multiple formatting entries', () => {
      const paragraph = {
        text: 'Test bold and italic text',
        formatting: [
          { start: 5, end: 9, type: 'bold' as const, text: 'bold' },
          { start: 14, end: 20, type: 'italic' as const, text: 'italic' }
        ]
      }

      const result = validateStructuredParagraph(paragraph)
      expect(result.formatting).toHaveLength(2)
    })
  })

  describe('validateStructuredChapter', () => {
    it('should validate correct chapter', () => {
      const chapter = {
        number: 1,
        title: 'Test Chapter',
        paragraphs: [{
          text: 'Test paragraph',
          formatting: []
        }]
      }

      const result = validateStructuredChapter(chapter)
      expect(result.number).toBe(1)
      expect(result.title).toBe('Test Chapter')
      expect(result.paragraphs).toHaveLength(1)
    })

    it('should throw error for invalid object', () => {
      expect(() => validateStructuredChapter(null)).toThrow(StructuredContentValidationError)
      expect(() => validateStructuredChapter('invalid')).toThrow(StructuredContentValidationError)
    })

    it('should throw error for invalid chapter number', () => {
      const chapter = { number: 'invalid', title: 'Test', paragraphs: [validParagraph] }
      expect(() => validateStructuredChapter(chapter)).toThrow(StructuredContentValidationError)
      
      const negativeChapter = { number: -1, title: 'Test', paragraphs: [validParagraph] }
      expect(() => validateStructuredChapter(negativeChapter)).toThrow(StructuredContentValidationError)
    })

    it('should throw error for chapter number mismatch', () => {
      const chapter = { number: 2, title: 'Test', paragraphs: [validParagraph] }
      expect(() => validateStructuredChapter(chapter, 1)).toThrow(StructuredContentValidationError)
    })

    it('should throw error for missing or invalid title', () => {
      expect(() => validateStructuredChapter({ number: 1, paragraphs: [validParagraph] })).toThrow(StructuredContentValidationError)
      expect(() => validateStructuredChapter({ number: 1, title: '', paragraphs: [validParagraph] })).toThrow(StructuredContentValidationError)
      expect(() => validateStructuredChapter({ number: 1, title: 123, paragraphs: [validParagraph] })).toThrow(StructuredContentValidationError)
    })

    it('should throw error for invalid paragraphs array', () => {
      expect(() => validateStructuredChapter({ number: 1, title: 'Test', paragraphs: 'invalid' })).toThrow(StructuredContentValidationError)
      expect(() => validateStructuredChapter({ number: 1, title: 'Test', paragraphs: [] })).toThrow(StructuredContentValidationError)
    })

    it('should trim whitespace from title', () => {
      const chapter = { number: 1, title: '  Test Chapter  ', paragraphs: [validParagraph] }
      const result = validateStructuredChapter(chapter)
      expect(result.title).toBe('Test Chapter')
    })
  })

  describe('validateStructuredBookContent', () => {
    it('should validate correct book content', () => {
      const result = validateStructuredBookContent(validBookContent)
      expect(result.title).toBe('Test Book')
      expect(result.author).toBe('Test Author')
      expect(result.genre).toBe('Fiction')
      expect(result.plotSummary).toBe('A test book about testing.')
      expect(result.chapters).toHaveLength(1)
    })

    it('should throw error for invalid object', () => {
      expect(() => validateStructuredBookContent(null)).toThrow(StructuredContentValidationError)
      expect(() => validateStructuredBookContent('invalid')).toThrow(StructuredContentValidationError)
    })

    it('should throw error for missing required string fields', () => {
      const requiredFields = ['title', 'author', 'genre', 'plotSummary']
      
      for (const field of requiredFields) {
        const invalidContent = { ...validBookContent }
        delete (invalidContent as any)[field]
        expect(() => validateStructuredBookContent(invalidContent)).toThrow(StructuredContentValidationError)
        
        const emptyContent = { ...validBookContent, [field]: '' }
        expect(() => validateStructuredBookContent(emptyContent)).toThrow(StructuredContentValidationError)
        
        const nullContent = { ...validBookContent, [field]: null }
        expect(() => validateStructuredBookContent(nullContent)).toThrow(StructuredContentValidationError)
      }
    })

    it('should throw error for invalid chapters array', () => {
      expect(() => validateStructuredBookContent({ ...validBookContent, chapters: 'invalid' })).toThrow(StructuredContentValidationError)
      expect(() => validateStructuredBookContent({ ...validBookContent, chapters: [] })).toThrow(StructuredContentValidationError)
    })

    it('should validate multiple chapters with correct numbering', () => {
      const multiChapterContent = {
        ...validBookContent,
        chapters: [
          { number: 1, title: 'Chapter 1', paragraphs: [validParagraph] },
          { number: 2, title: 'Chapter 2', paragraphs: [validParagraph] }
        ]
      }

      const result = validateStructuredBookContent(multiChapterContent)
      expect(result.chapters).toHaveLength(2)
      expect(result.chapters[0].number).toBe(1)
      expect(result.chapters[1].number).toBe(2)
    })

    it('should trim whitespace from string fields', () => {
      const contentWithWhitespace = {
        title: '  Test Book  ',
        author: '  Test Author  ',
        genre: '  Fiction  ',
        plotSummary: '  A test book about testing.  ',
        chapters: [validChapter]
      }

      const result = validateStructuredBookContent(contentWithWhitespace)
      expect(result.title).toBe('Test Book')
      expect(result.author).toBe('Test Author')
      expect(result.genre).toBe('Fiction')
      expect(result.plotSummary).toBe('A test book about testing.')
    })
  })

  describe('Helper Functions', () => {
    describe('countWordsInStructuredContent', () => {
      it('should count words correctly', () => {
        const content: StructuredBookContent = {
          title: 'Test Book',
          author: 'Test Author',
          genre: 'Fiction',
          plotSummary: 'A test book.',
          chapters: [
            {
              number: 1,
              title: 'Chapter 1',
              paragraphs: [
                { text: 'First paragraph with five words.', formatting: [] },
                { text: 'Second paragraph has four words.', formatting: [] }
              ]
            },
            {
              number: 2,
              title: 'Chapter 2',
              paragraphs: [
                { text: 'Third paragraph contains three words.', formatting: [] }
              ]
            }
          ]
        }

        const wordCount = countWordsInStructuredContent(content)
        // First paragraph: "First paragraph with five words." = 5 words
        // Second paragraph: "Second paragraph has four words." = 5 words (not 4)
        // Third paragraph: "Third paragraph contains three words." = 5 words (not 3)
        expect(wordCount).toBe(15) // 5 + 5 + 5 = 15 words total
      })

      it('should handle empty paragraphs', () => {
        const content: StructuredBookContent = {
          title: 'Test Book',
          author: 'Test Author',
          genre: 'Fiction',
          plotSummary: 'A test book.',
          chapters: [
            {
              number: 1,
              title: 'Chapter 1',
              paragraphs: [
                { text: '', formatting: [] },
                { text: '   ', formatting: [] },
                { text: 'Only paragraph with words.', formatting: [] }
              ]
            }
          ]
        }

        const wordCount = countWordsInStructuredContent(content)
        expect(wordCount).toBe(4) // Only "Only paragraph with words"
      })
    })

    describe('extractPlainText', () => {
      it('should extract plain text correctly', () => {
        const content: StructuredBookContent = {
          title: 'Test Book',
          author: 'Test Author',
          genre: 'Fiction',
          plotSummary: 'A test book about testing.',
          chapters: [
            {
              number: 1,
              title: 'First Chapter',
              paragraphs: [
                { text: 'First paragraph.', formatting: [] },
                { text: 'Second paragraph.', formatting: [] }
              ]
            },
            {
              number: 2,
              title: 'Second Chapter',
              paragraphs: [
                { text: 'Third paragraph.', formatting: [] }
              ]
            }
          ]
        }

        const plainText = extractPlainText(content)
        
        expect(plainText).toContain('Test Book')
        expect(plainText).toContain('By Test Author')
        expect(plainText).toContain('A test book about testing.')
        expect(plainText).toContain('Chapter 1: First Chapter')
        expect(plainText).toContain('Chapter 2: Second Chapter')
        expect(plainText).toContain('First paragraph.')
        expect(plainText).toContain('Second paragraph.')
        expect(plainText).toContain('Third paragraph.')
      })
    })
  })

  describe('Error Handling', () => {
    it('should provide detailed error messages with field information', () => {
      try {
        validateStructuredBookContent({ title: '', author: 'Test', genre: 'Fiction', plotSummary: 'Test', chapters: [] })
      } catch (error) {
        expect(error).toBeInstanceOf(StructuredContentValidationError)
        expect((error as StructuredContentValidationError).field).toBe('title')
      }
    })

    it('should provide nested error information for chapter validation', () => {
      const invalidContent = {
        title: 'Test',
        author: 'Test',
        genre: 'Fiction',
        plotSummary: 'Test',
        chapters: [
          { number: 1, title: '', paragraphs: [validParagraph] }
        ]
      }

      try {
        validateStructuredBookContent(invalidContent)
      } catch (error) {
        expect(error).toBeInstanceOf(StructuredContentValidationError)
        expect((error as StructuredContentValidationError).field).toBe('chapters[0]')
        expect((error as StructuredContentValidationError).message).toContain('Chapter 1 validation failed')
      }
    })

    it('should provide nested error information for paragraph validation', () => {
      const invalidContent = {
        title: 'Test',
        author: 'Test',
        genre: 'Fiction',
        plotSummary: 'Test',
        chapters: [
          {
            number: 1,
            title: 'Test Chapter',
            paragraphs: [
              { text: 'Test', formatting: [{ start: 0, end: 10, type: 'bold', text: 'Wrong' }] }
            ]
          }
        ]
      }

      try {
        validateStructuredBookContent(invalidContent)
      } catch (error) {
        expect(error).toBeInstanceOf(StructuredContentValidationError)
        expect((error as StructuredContentValidationError).message).toContain('Paragraph 1 validation failed')
      }
    })
  })
})