/**
 * Tests for Structured Prompts System
 * 
 * These tests verify the prompt generation and JSON extraction functionality
 * Requirements tested: 3.1, 3.2, 3.3, 3.4
 */

import { describe, it, expect } from 'vitest'
import {
  StructuredBookGenerationRequest,
  createStructuredBookPrompt,
  createStructuredChapterPrompt,
  createContentValidationPrompt,
  createRegenerationPrompt,
  extractJSONFromResponse,
  validateJSONStructure
} from '../structuredPrompts'
import { StructuredBookContent, StructuredChapter } from '../structuredContent'

describe('Structured Prompts System', () => {
  const mockRequest: StructuredBookGenerationRequest = {
    title: 'Test Book',
    author: 'Test Author',
    bookType: 'Fiction',
    writingStyle: 'Engaging and descriptive',
    structuredOutput: true,
    targetChapters: 15,
    targetWordsPerChapter: 800
  }

  const mockBookContext: Partial<StructuredBookContent> = {
    title: 'Test Book',
    author: 'Test Author',
    genre: 'Fiction',
    plotSummary: 'A compelling story about testing.'
  }

  const mockPreviousChapters: StructuredChapter[] = [
    {
      number: 1,
      title: 'The Beginning',
      paragraphs: [
        { text: 'First chapter content.', formatting: [] }
      ]
    },
    {
      number: 2,
      title: 'The Development',
      paragraphs: [
        { text: 'Second chapter content.', formatting: [] }
      ]
    }
  ]

  describe('createStructuredBookPrompt', () => {
    it('should create a complete book generation prompt', () => {
      const prompt = createStructuredBookPrompt(mockRequest)
      
      expect(prompt).toContain('Test Book')
      expect(prompt).toContain('Test Author')
      expect(prompt).toContain('Fiction')
      expect(prompt).toContain('Engaging and descriptive')
      expect(prompt).toContain('15')
      expect(prompt).toContain('800')
      expect(prompt).toContain('JSON')
      expect(prompt).toContain('chapters')
      expect(prompt).toContain('paragraphs')
      expect(prompt).toContain('formatting')
    })

    it('should include proper JSON structure example', () => {
      const prompt = createStructuredBookPrompt(mockRequest)
      
      expect(prompt).toContain('"title"')
      expect(prompt).toContain('"author"')
      expect(prompt).toContain('"genre"')
      expect(prompt).toContain('"plotSummary"')
      expect(prompt).toContain('"chapters"')
      expect(prompt).toContain('"number"')
      expect(prompt).toContain('"paragraphs"')
      expect(prompt).toContain('"text"')
      expect(prompt).toContain('"formatting"')
      expect(prompt).toContain('"start"')
      expect(prompt).toContain('"end"')
      expect(prompt).toContain('"type"')
    })

    it('should include formatting guidelines', () => {
      const prompt = createStructuredBookPrompt(mockRequest)
      
      expect(prompt).toContain('bold')
      expect(prompt).toContain('italic')
      expect(prompt).toContain('bold-italic')
      expect(prompt).toContain('start/end positions')
      expect(prompt).toContain('character positions')
    })

    it('should use default values when optional parameters are missing', () => {
      const minimalRequest: StructuredBookGenerationRequest = {
        title: 'Minimal Book',
        author: 'Minimal Author',
        bookType: 'Mystery',
        structuredOutput: true
      }
      
      const prompt = createStructuredBookPrompt(minimalRequest)
      
      expect(prompt).toContain('Minimal Book')
      expect(prompt).toContain('Minimal Author')
      expect(prompt).toContain('Mystery')
      expect(prompt).toContain('Professional and engaging') // default writing style
      expect(prompt).toContain('15') // default target chapters
      expect(prompt).toContain('800') // default words per chapter
    })

    it('should handle custom chapter and word targets', () => {
      const customRequest: StructuredBookGenerationRequest = {
        ...mockRequest,
        targetChapters: 10,
        targetWordsPerChapter: 1000
      }
      
      const prompt = createStructuredBookPrompt(customRequest)
      
      expect(prompt).toContain('10')
      expect(prompt).toContain('1000')
      expect(prompt).toContain('1400') // targetWordsPerChapter + 400
    })
  })

  describe('createStructuredChapterPrompt', () => {
    it('should create a chapter generation prompt with context', () => {
      const prompt = createStructuredChapterPrompt(mockBookContext, 3, 'Chapter Three', mockPreviousChapters)
      
      expect(prompt).toContain('Chapter 3')
      expect(prompt).toContain('Chapter Three')
      expect(prompt).toContain('Test Book')
      expect(prompt).toContain('Test Author')
      expect(prompt).toContain('Fiction')
      expect(prompt).toContain('A compelling story about testing.')
      expect(prompt).toContain('The Beginning')
      expect(prompt).toContain('The Development')
      expect(prompt).toContain('narrative continuity')
    })

    it('should work without previous chapters', () => {
      const prompt = createStructuredChapterPrompt(mockBookContext, 1, 'First Chapter')
      
      expect(prompt).toContain('Chapter 1')
      expect(prompt).toContain('First Chapter')
      expect(prompt).toContain('Test Book')
      expect(prompt).not.toContain('PREVIOUS CHAPTERS')
    })

    it('should work without book context', () => {
      const prompt = createStructuredChapterPrompt({}, 5)
      
      expect(prompt).toContain('Chapter 5')
      expect(prompt).toContain('Generate an appropriate title')
      expect(prompt).not.toContain('BOOK CONTEXT')
    })

    it('should include proper JSON structure for chapter', () => {
      const prompt = createStructuredChapterPrompt(mockBookContext, 2, 'Test Chapter')
      
      expect(prompt).toContain('"number": 2')
      expect(prompt).toContain('"title"')
      expect(prompt).toContain('"paragraphs"')
      expect(prompt).toContain('"text"')
      expect(prompt).toContain('"formatting"')
    })

    it('should include content guidelines', () => {
      const prompt = createStructuredChapterPrompt(mockBookContext, 1)
      
      expect(prompt).toContain('800-1200 words')
      expect(prompt).toContain('8-12 paragraphs')
      expect(prompt).toContain('60-120 words')
      expect(prompt).toContain('engaging')
      expect(prompt).toContain('narrative')
    })
  })

  describe('createContentValidationPrompt', () => {
    it('should create a validation prompt', () => {
      const content = '{"title": "Test", "author": "Author"}'
      const requirements = 'Must have title and author fields'
      
      const prompt = createContentValidationPrompt(content, requirements)
      
      expect(prompt).toContain(content)
      expect(prompt).toContain(requirements)
      expect(prompt).toContain('VALIDATION CRITERIA')
      expect(prompt).toContain('isValid')
      expect(prompt).toContain('errors')
      expect(prompt).toContain('warnings')
      expect(prompt).toContain('wordCount')
      expect(prompt).toContain('qualityScore')
    })

    it('should include all validation criteria', () => {
      const prompt = createContentValidationPrompt('{}', 'test requirements')
      
      expect(prompt).toContain('JSON structure is valid')
      expect(prompt).toContain('required fields are present')
      expect(prompt).toContain('Formatting positions are accurate')
      expect(prompt).toContain('Content quality meets professional standards')
      expect(prompt).toContain('Word count targets are met')
      expect(prompt).toContain('Narrative flow and consistency')
    })
  })

  describe('createRegenerationPrompt', () => {
    it('should create a regeneration prompt with errors', () => {
      const originalPrompt = 'Generate a book with proper JSON structure'
      const errors = ['Missing title field', 'Invalid formatting positions']
      const previousAttempt = '{"invalid": "json structure"}'
      
      const prompt = createRegenerationPrompt(originalPrompt, errors, previousAttempt)
      
      expect(prompt).toContain(originalPrompt)
      expect(prompt).toContain('ERRORS TO FIX')
      expect(prompt).toContain('Missing title field')
      expect(prompt).toContain('Invalid formatting positions')
      expect(prompt).toContain('PREVIOUS FAILED ATTEMPT')
      expect(prompt).toContain('{"invalid"')
    })

    it('should work without previous attempt', () => {
      const originalPrompt = 'Generate content'
      const errors = ['Error 1', 'Error 2']
      
      const prompt = createRegenerationPrompt(originalPrompt, errors)
      
      expect(prompt).toContain(originalPrompt)
      expect(prompt).toContain('Error 1')
      expect(prompt).toContain('Error 2')
      expect(prompt).not.toContain('PREVIOUS FAILED ATTEMPT')
    })

    it('should include critical reminders', () => {
      const prompt = createRegenerationPrompt('test', ['error'])
      
      expect(prompt).toContain('CRITICAL REMINDERS')
      expect(prompt).toContain('Return ONLY valid JSON')
      expect(prompt).toContain('Double-check all formatting position calculations')
      expect(prompt).toContain('required fields are present')
      expect(prompt).toContain('JSON syntax is correct')
      expect(prompt).toContain('quality and length requirements')
    })

    it('should handle empty errors array', () => {
      const prompt = createRegenerationPrompt('original prompt', [])
      
      expect(prompt).toContain('original prompt')
      expect(prompt).toContain('following issues')
      expect(prompt).not.toContain('1.')
    })
  })

  describe('extractJSONFromResponse', () => {
    it('should extract JSON from clean response', () => {
      const response = '{"title": "Test Book", "author": "Test Author"}'
      const result = extractJSONFromResponse(response)
      
      expect(result).toBe(response)
    })

    it('should extract JSON from response with markdown code blocks', () => {
      const json = '{"title": "Test Book", "author": "Test Author"}'
      const response = `Here is the JSON:\n\`\`\`json\n${json}\n\`\`\``
      const result = extractJSONFromResponse(response)
      
      expect(result).toBe(json)
    })

    it('should extract JSON from response with extra text', () => {
      const json = '{"title": "Test Book", "author": "Test Author"}'
      const response = `Some explanation text before.\n${json}\nSome text after.`
      const result = extractJSONFromResponse(response)
      
      expect(result).toBe(json)
    })

    it('should handle responses with multiple JSON-like structures', () => {
      const json = '{"title": "Test Book", "author": "Test Author"}'
      const response = `{"invalid": "first"} ${json} {"invalid": "last"}`
      const result = extractJSONFromResponse(response)
      
      expect(result).toBe(`{"invalid": "first"} ${json} {"invalid": "last"}`)
    })

    it('should clean control characters', () => {
      const response = '{"title": "Test\\nBook", "author": "Test\\tAuthor"}'
      const result = extractJSONFromResponse(response)
      
      expect(result).toContain('Test\\nBook')
      expect(result).toContain('Test\\tAuthor')
    })

    it('should throw error when no JSON found', () => {
      const response = 'No JSON here at all'
      
      expect(() => extractJSONFromResponse(response)).toThrow('No JSON object found in response')
    })

    it('should handle nested braces correctly', () => {
      const json = '{"nested": {"inner": "value"}, "array": [{"item": "test"}]}'
      const response = `Text before ${json} text after`
      const result = extractJSONFromResponse(response)
      
      expect(result).toBe(json)
    })
  })

  describe('validateJSONStructure', () => {
    it('should validate correct JSON', () => {
      const validJSON = '{"title": "Test", "number": 123, "array": [1, 2, 3]}'
      
      expect(validateJSONStructure(validJSON)).toBe(true)
    })

    it('should reject invalid JSON syntax', () => {
      const invalidJSON = '{"title": "Test", "number": 123,}' // trailing comma
      
      expect(validateJSONStructure(invalidJSON)).toBe(false)
    })

    it('should reject non-object JSON', () => {
      expect(validateJSONStructure('"just a string"')).toBe(false) // strings are not objects
      expect(validateJSONStructure('123')).toBe(false) // numbers are not objects
      expect(validateJSONStructure('null')).toBe(false) // null is not an object
    })

    it('should reject malformed JSON', () => {
      const malformedJSON = '{"title": "Test" "missing": "comma"}'
      
      expect(validateJSONStructure(malformedJSON)).toBe(false)
    })

    it('should handle empty object', () => {
      expect(validateJSONStructure('{}')).toBe(true)
    })

    it('should handle complex nested structures', () => {
      const complexJSON = JSON.stringify({
        title: 'Test',
        chapters: [
          {
            number: 1,
            paragraphs: [
              {
                text: 'Test',
                formatting: [
                  { start: 0, end: 4, type: 'bold', text: 'Test' }
                ]
              }
            ]
          }
        ]
      })
      
      expect(validateJSONStructure(complexJSON)).toBe(true)
    })
  })

  describe('Integration Tests', () => {
    it('should create prompts that include all necessary validation instructions', () => {
      const bookPrompt = createStructuredBookPrompt(mockRequest)
      const chapterPrompt = createStructuredChapterPrompt(mockBookContext, 1)
      
      // Both prompts should include JSON validation instructions
      expect(bookPrompt).toContain('valid JSON')
      expect(bookPrompt).toContain('No trailing commas')
      expect(bookPrompt).toContain('properly escaped')
      
      expect(chapterPrompt).toContain('valid JSON')
      expect(chapterPrompt).toContain('Return only the JSON object')
    })

    it('should create prompts with consistent formatting requirements', () => {
      const bookPrompt = createStructuredBookPrompt(mockRequest)
      const chapterPrompt = createStructuredChapterPrompt(mockBookContext, 1)
      
      // Both should mention the same formatting types
      expect(bookPrompt).toContain('bold')
      expect(bookPrompt).toContain('italic')
      expect(bookPrompt).toContain('bold-italic')
      
      expect(chapterPrompt).toContain('bold')
      expect(chapterPrompt).toContain('italic')
      expect(chapterPrompt).toContain('bold-italic')
    })

    it('should handle the complete prompt-to-validation workflow', () => {
      // Create a prompt
      const prompt = createStructuredBookPrompt(mockRequest)
      expect(prompt).toBeTruthy()
      
      // Simulate a response that needs JSON extraction
      const mockResponse = `Here's your book:\n\`\`\`json\n{"title": "Test"}\n\`\`\``
      const extractedJSON = extractJSONFromResponse(mockResponse)
      expect(extractedJSON).toBe('{"title": "Test"}')
      
      // Validate the JSON structure
      expect(validateJSONStructure(extractedJSON)).toBe(true)
      
      // Create a validation prompt
      const validationPrompt = createContentValidationPrompt(extractedJSON, 'Must have title')
      expect(validationPrompt).toContain('{"title": "Test"}')
      
      // Create a regeneration prompt if needed
      const errors = ['Missing author field']
      const regenPrompt = createRegenerationPrompt(prompt, errors, mockResponse)
      expect(regenPrompt).toContain('Missing author field')
    })
  })
})