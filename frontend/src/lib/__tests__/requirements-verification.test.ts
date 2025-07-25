/**
 * Requirements Verification Tests
 * 
 * These tests verify that the structured content generation system meets
 * all the requirements specified in the task.
 * 
 * Requirements tested: 3.1, 3.2, 3.3, 3.4
 */

import { describe, it, expect } from 'vitest'
import {
  StructuredBookContent,
  validateStructuredBookContent,
  StructuredContentValidationError,
  countWordsInStructuredContent
} from '../structuredContent'
import {
  createStructuredBookPrompt,
  createStructuredChapterPrompt,
  createRegenerationPrompt,
  extractJSONFromResponse,
  validateJSONStructure,
  StructuredBookGenerationRequest
} from '../structuredPrompts'
import { fail } from 'assert'

describe('Requirements Verification', () => {
  describe('Requirement 3.1: AI prompts force structured JSON output instead of markdown', () => {
    it('should create prompts that explicitly request JSON format', () => {
      const request: StructuredBookGenerationRequest = {
        title: 'Test Book',
        author: 'Test Author',
        bookType: 'Fiction',
        structuredOutput: true
      }

      const prompt = createStructuredBookPrompt(request)

      // Verify prompt explicitly requests JSON
      expect(prompt).toContain('JSON object')
      expect(prompt).toContain('Do not use markdown')
      expect(prompt).toContain('Return only the raw JSON')
      expect(prompt).toContain('Do not use markdown code blocks')
      expect(prompt).toContain('REQUIRED JSON STRUCTURE')
    })

    it('should create chapter prompts that request JSON format', () => {
      const prompt = createStructuredChapterPrompt({}, 1, 'Test Chapter')

      expect(prompt).toContain('JSON object')
      expect(prompt).toContain('Return only the JSON object')
      expect(prompt).toContain('REQUIRED JSON STRUCTURE')
    })

    it('should include specific instructions against markdown formatting', () => {
      const request: StructuredBookGenerationRequest = {
        title: 'Test Book',
        author: 'Test Author',
        bookType: 'Fiction',
        structuredOutput: true
      }

      const prompt = createStructuredBookPrompt(request)

      expect(prompt).toContain('Do not include any text before or after the JSON object')
      expect(prompt).toContain('Do not use markdown code blocks')
    })
  })

  describe('Requirement 3.2: Define structured interfaces for content', () => {
    it('should define StructuredBookContent interface with all required fields', () => {
      const validContent: StructuredBookContent = {
        title: 'Test Book',
        author: 'Test Author',
        genre: 'Fiction',
        plotSummary: 'A test story',
        chapters: [
          {
            number: 1,
            title: 'Chapter 1',
            paragraphs: [
              {
                text: 'Test paragraph',
                formatting: [
                  {
                    start: 0,
                    end: 4,
                    type: 'bold',
                    text: 'Test'
                  }
                ]
              }
            ]
          }
        ]
      }

      // Should validate without errors
      expect(() => validateStructuredBookContent(validContent)).not.toThrow()
    })

    it('should enforce structured chapter format', () => {
      const invalidContent = {
        title: 'Test Book',
        author: 'Test Author',
        genre: 'Fiction',
        plotSummary: 'A test story',
        chapters: [
          {
            // Missing required fields
            paragraphs: []
          }
        ]
      }

      expect(() => validateStructuredBookContent(invalidContent)).toThrow(StructuredContentValidationError)
    })

    it('should enforce structured paragraph format with precise formatting positions', () => {
      const invalidContent = {
        title: 'Test Book',
        author: 'Test Author',
        genre: 'Fiction',
        plotSummary: 'A test story',
        chapters: [
          {
            number: 1,
            title: 'Chapter 1',
            paragraphs: [
              {
                text: 'Test paragraph',
                formatting: [
                  {
                    start: 0,
                    end: 20, // Exceeds text length
                    type: 'bold',
                    text: 'Wrong text'
                  }
                ]
              }
            ]
          }
        ]
      }

      expect(() => validateStructuredBookContent(invalidContent)).toThrow(StructuredContentValidationError)
    })
  })

  describe('Requirement 3.3: Implement content validation for proper JSON structure', () => {
    it('should validate complete book content structure', () => {
      const validContent: StructuredBookContent = {
        title: 'Test Book',
        author: 'Test Author',
        genre: 'Fiction',
        plotSummary: 'A compelling story about testing.',
        chapters: [
          {
            number: 1,
            title: 'The Beginning',
            paragraphs: [
              {
                text: 'This is the first paragraph with some bold text.',
                formatting: [
                  {
                    start: 38,
                    end: 42,
                    type: 'bold',
                    text: 'bold'
                  }
                ]
              },
              {
                text: 'This is the second paragraph with italic text.',
                formatting: [
                  {
                    start: 34,
                    end: 40,
                    type: 'italic',
                    text: 'italic'
                  }
                ]
              }
            ]
          }
        ]
      }

      const result = validateStructuredBookContent(validContent)
      expect(result).toBeDefined()
      expect(result.title).toBe('Test Book')
      expect(result.chapters).toHaveLength(1)
      expect(result.chapters[0].paragraphs).toHaveLength(2)
    })

    it('should provide detailed validation errors with field information', () => {
      const invalidContent = {
        title: '', // Invalid: empty string
        author: 'Test Author',
        genre: 'Fiction',
        plotSummary: 'A test story',
        chapters: []
      }

      try {
        validateStructuredBookContent(invalidContent)
        fail('Should have thrown validation error')
      } catch (error) {
        expect(error).toBeInstanceOf(StructuredContentValidationError)
        const validationError = error as StructuredContentValidationError
        expect(validationError.field).toBe('title')
        expect(validationError.message).toContain('non-empty string')
      }
    })

    it('should validate formatting positions precisely', () => {
      const content = {
        title: 'Test Book',
        author: 'Test Author',
        genre: 'Fiction',
        plotSummary: 'A test story',
        chapters: [
          {
            number: 1,
            title: 'Chapter 1',
            paragraphs: [
              {
                text: 'Hello world',
                formatting: [
                  {
                    start: 0,
                    end: 5,
                    type: 'bold',
                    text: 'Hello' // Correct text
                  }
                ]
              }
            ]
          }
        ]
      }

      expect(() => validateStructuredBookContent(content)).not.toThrow()

      // Now test with incorrect text
      content.chapters[0].paragraphs[0].formatting[0].text = 'Wrong'
      expect(() => validateStructuredBookContent(content)).toThrow(StructuredContentValidationError)
    })

    it('should count words accurately in structured content', () => {
      const content: StructuredBookContent = {
        title: 'Test Book',
        author: 'Test Author',
        genre: 'Fiction',
        plotSummary: 'A test story',
        chapters: [
          {
            number: 1,
            title: 'Chapter 1',
            paragraphs: [
              {
                text: 'This paragraph has exactly five words.',
                formatting: []
              },
              {
                text: 'This second paragraph has six words total.',
                formatting: []
              }
            ]
          }
        ]
      }

      const wordCount = countWordsInStructuredContent(content)
      // "This paragraph has exactly five words." = 6 words (not 5)
      // "This second paragraph has six words total." = 7 words (not 6)
      expect(wordCount).toBe(13) // 6 + 7 = 13 words
    })
  })

  describe('Requirement 3.4: Add error handling for malformed AI responses with regeneration logic', () => {
    it('should extract JSON from responses with extra text', () => {
      const responseWithExtra = `
        Here is your book content:
        
        {"title": "Test Book", "author": "Test Author"}
        
        I hope this helps!
      `

      const extractedJSON = extractJSONFromResponse(responseWithExtra)
      expect(extractedJSON).toBe('{"title": "Test Book", "author": "Test Author"}')
      expect(validateJSONStructure(extractedJSON)).toBe(true)
    })

    it('should extract JSON from responses with markdown code blocks', () => {
      const responseWithMarkdown = `
        \`\`\`json
        {"title": "Test Book", "author": "Test Author"}
        \`\`\`
      `

      const extractedJSON = extractJSONFromResponse(responseWithMarkdown)
      expect(extractedJSON).toBe('{"title": "Test Book", "author": "Test Author"}')
      expect(validateJSONStructure(extractedJSON)).toBe(true)
    })

    it('should handle malformed responses gracefully', () => {
      const malformedResponse = 'This is not JSON at all'

      expect(() => extractJSONFromResponse(malformedResponse)).toThrow('No JSON object found in response')
    })

    it('should create regeneration prompts with specific error information', () => {
      const originalPrompt = 'Generate a book with proper JSON structure'
      const errors = [
        'Missing title field',
        'Invalid formatting positions in chapter 1',
        'Chapter numbers are not sequential'
      ]
      const previousAttempt = '{"invalid": "structure"}'

      const regenPrompt = createRegenerationPrompt(originalPrompt, errors, previousAttempt)

      expect(regenPrompt).toContain(originalPrompt)
      expect(regenPrompt).toContain('Missing title field')
      expect(regenPrompt).toContain('Invalid formatting positions in chapter 1')
      expect(regenPrompt).toContain('Chapter numbers are not sequential')
      expect(regenPrompt).toContain('PREVIOUS FAILED ATTEMPT')
      expect(regenPrompt).toContain('{"invalid"')
    })

    it('should provide specific instructions for fixing common issues', () => {
      const regenPrompt = createRegenerationPrompt('original', ['test error'])

      expect(regenPrompt).toContain('Return ONLY valid JSON')
      expect(regenPrompt).toContain('Double-check all formatting position calculations')
      expect(regenPrompt).toContain('Ensure all required fields are present')
      expect(regenPrompt).toContain('Verify JSON syntax is correct')
      expect(regenPrompt).toContain('no trailing commas')
      expect(regenPrompt).toContain('proper escaping')
    })

    it('should validate JSON structure correctly', () => {
      // Valid JSON objects
      expect(validateJSONStructure('{}')).toBe(true)
      expect(validateJSONStructure('{"title": "Test"}')).toBe(true)
      expect(validateJSONStructure('{"nested": {"key": "value"}}')).toBe(true)

      // Invalid JSON
      expect(validateJSONStructure('{"invalid": "json",}')).toBe(false) // trailing comma
      expect(validateJSONStructure('{"missing": "quote}')).toBe(false) // syntax error
      expect(validateJSONStructure('"just a string"')).toBe(false) // not an object
      expect(validateJSONStructure('123')).toBe(false) // not an object
      expect(validateJSONStructure('null')).toBe(false) // not an object
    })
  })

  describe('Integration: Complete Workflow', () => {
    it('should support the complete structured content generation workflow', () => {
      // 1. Create a structured prompt
      const request: StructuredBookGenerationRequest = {
        title: 'Integration Test Book',
        author: 'Test Author',
        bookType: 'Mystery',
        writingStyle: 'Suspenseful and engaging',
        structuredOutput: true,
        targetChapters: 2,
        targetWordsPerChapter: 100
      }

      const prompt = createStructuredBookPrompt(request)
      expect(prompt).toContain('Integration Test Book')
      expect(prompt).toContain('Mystery')
      expect(prompt).toContain('Suspenseful and engaging')

      // 2. Simulate AI response (with markdown that needs cleaning)
      const mockAIResponse = `
        Here's your book:
        \`\`\`json
        {
          "title": "Integration Test Book",
          "author": "Test Author",
          "genre": "Mystery",
          "plotSummary": "A thrilling mystery about testing software systems.",
          "chapters": [
            {
              "number": 1,
              "title": "The Bug Appears",
              "paragraphs": [
                {
                  "text": "The mysterious bug appeared suddenly in the code.",
                  "formatting": [
                    {
                      "start": 4,
                      "end": 14,
                      "type": "italic",
                      "text": "mysterious"
                    }
                  ]
                }
              ]
            }
          ]
        }
        \`\`\`
      `

      // 3. Extract and validate JSON
      const extractedJSON = extractJSONFromResponse(mockAIResponse)
      expect(validateJSONStructure(extractedJSON)).toBe(true)

      // 4. Parse and validate structured content
      const parsedContent = JSON.parse(extractedJSON)
      const validatedContent = validateStructuredBookContent(parsedContent)

      expect(validatedContent.title).toBe('Integration Test Book')
      expect(validatedContent.author).toBe('Test Author')
      expect(validatedContent.genre).toBe('Mystery')
      expect(validatedContent.chapters).toHaveLength(1)
      expect(validatedContent.chapters[0].title).toBe('The Bug Appears')
      expect(validatedContent.chapters[0].paragraphs[0].formatting).toHaveLength(1)
      expect(validatedContent.chapters[0].paragraphs[0].formatting[0].type).toBe('italic')

      // 5. Verify word count functionality
      const wordCount = countWordsInStructuredContent(validatedContent)
      expect(wordCount).toBeGreaterThan(0)
    })

    it('should handle error recovery workflow', () => {
      // 1. Simulate malformed AI response
      const malformedResponse = `
        {
          "title": "Test Book",
          "author": "Test Author",
          // Missing required fields and has comments (invalid JSON)
          "chapters": [
            {
              "number": 1,
              "paragraphs": [
                {
                  "text": "Test",
                  "formatting": [
                    {
                      "start": 0,
                      "end": 10, // Invalid: exceeds text length
                      "type": "bold",
                      "text": "Wrong text"
                    }
                  ]
                }
              ]
            }
          ]
        }
      `

      // 2. Attempt to extract JSON (will succeed but parsing will fail due to comments)
      const extractedJSON = extractJSONFromResponse(malformedResponse)
      expect(() => JSON.parse(extractedJSON)).toThrow() // Should fail due to comments in JSON

      // 3. Create regeneration prompt with specific errors
      const originalPrompt = 'Generate a structured book'
      const errors = [
        'Invalid JSON syntax (contains comments)',
        'Missing required genre field',
        'Missing required plotSummary field',
        'Chapter missing title field',
        'Formatting positions exceed text length'
      ]

      const regenPrompt = createRegenerationPrompt(originalPrompt, errors, malformedResponse)

      expect(regenPrompt).toContain('Invalid JSON syntax')
      expect(regenPrompt).toContain('Missing required genre field')
      expect(regenPrompt).toContain('Formatting positions exceed text length')
      expect(regenPrompt).toContain('CRITICAL REMINDERS')
    })
  })
})