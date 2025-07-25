/**
 * Structured Prompts System
 * 
 * This module creates precise AI prompts that force structured JSON output
 * instead of markdown, ensuring reliable and consistent content generation.
 * 
 * Requirements addressed: 3.1, 3.2, 3.3, 3.4
 */

import { BookGenerationRequest } from './gemini'
import { StructuredBookContent, StructuredChapter } from './structuredContent'

// Enhanced book generation request with structured output flag
export interface StructuredBookGenerationRequest extends BookGenerationRequest {
  structuredOutput: true
  targetChapters?: number
  targetWordsPerChapter?: number
}

/**
 * Creates a structured prompt for generating complete book content in JSON format
 * This replaces the old outline + chapter generation approach with a single structured response
 */
export function createStructuredBookPrompt(request: StructuredBookGenerationRequest): string {
  const { title, author, bookType, writingStyle, targetChapters = 10, targetWordsPerChapter = 600 } = request
  
  return `Generate a complete ${bookType.toLowerCase()} book in JSON format.

BOOK DETAILS:
Title: "${title}"
Author: ${author}
Genre: ${bookType}
Style: ${writingStyle || 'Professional and engaging'}
Chapters: ${targetChapters}

IMPORTANT: Return ONLY valid JSON. No explanations, no markdown, no extra text.

JSON FORMAT:
{
  "title": "${title}",
  "author": "${author}",
  "genre": "${bookType}",
  "plotSummary": "Write a 2-3 sentence summary of the book's main plot and themes.",
  "chapters": [
    {
      "number": 1,
      "title": "Chapter Title Here",
      "paragraphs": [
        {
          "text": "Write engaging paragraph content here. Keep paragraphs 50-100 words each.",
          "formatting": []
        }
      ]
    }
  ]
}

REQUIREMENTS:
- Generate exactly ${targetChapters} chapters
- Each chapter needs 5-8 paragraphs
- Each paragraph should be 50-100 words
- Use simple formatting array (can be empty [])
- Ensure proper JSON syntax with no trailing commas
- Escape quotes in text content properly

Create the complete book now as valid JSON:`
}

/**
 * Creates a structured prompt for generating a single chapter in JSON format
 * Used for regenerating specific chapters or adding chapters to existing books
 */
export function createStructuredChapterPrompt(
  bookContext: Partial<StructuredBookContent>,
  chapterNumber: number,
  chapterTitle?: string,
  previousChapters?: StructuredChapter[]
): string {
  const contextInfo = bookContext.title ? `
BOOK CONTEXT:
- Title: ${bookContext.title}
- Author: ${bookContext.author}
- Genre: ${bookContext.genre}
- Plot Summary: ${bookContext.plotSummary}
` : ''

  const previousContext = previousChapters && previousChapters.length > 0 ? `
PREVIOUS CHAPTERS CONTEXT:
${previousChapters.map(ch => `Chapter ${ch.number}: ${ch.title}`).join('\n')}

Ensure this chapter builds naturally on the previous content and maintains narrative continuity.
` : ''

  return `You are a professional writer creating Chapter ${chapterNumber} of a book. You must generate structured content in JSON format for professional PDF generation.

${contextInfo}

CHAPTER REQUIREMENTS:
- Chapter Number: ${chapterNumber}
- Chapter Title: ${chapterTitle || `Generate an appropriate title for Chapter ${chapterNumber}`}
- Target Length: 800-1200 words
- Multiple paragraphs (8-12 paragraphs recommended)

${previousContext}

CRITICAL FORMATTING REQUIREMENTS:
You MUST return your response as a valid JSON object with the exact structure specified below. Do not include any text before or after the JSON object. Do not use markdown code blocks. Return only the raw JSON.

REQUIRED JSON STRUCTURE:
{
  "number": ${chapterNumber},
  "title": "${chapterTitle || 'Chapter Title Here'}",
  "paragraphs": [
    {
      "text": "First paragraph text content. This should be substantial and engaging, typically 60-120 words.",
      "formatting": [
        {
          "start": 0,
          "end": 5,
          "type": "bold",
          "text": "First"
        }
      ]
    },
    {
      "text": "Second paragraph text content with more detail and development.",
      "formatting": [
        {
          "start": 7,
          "end": 16,
          "type": "italic",
          "text": "paragraph"
        }
      ]
    }
  ]
}

CONTENT GUIDELINES:
1. Create engaging, well-developed content appropriate for the genre
2. Each paragraph should be 60-120 words for good readability
3. Use formatting sparingly: "bold" for emphasis, "italic" for thoughts/emphasis, "bold-italic" rarely
4. Ensure formatting positions are accurate within paragraph text
5. Maintain consistent tone and advance the narrative
6. Include vivid descriptions and compelling dialogue where appropriate

Generate Chapter ${chapterNumber} following these specifications. Return only the JSON object.`
}

/**
 * Creates a validation prompt to check if AI-generated content meets requirements
 * Used as a secondary validation step for content quality
 */
export function createContentValidationPrompt(content: string, requirements: string): string {
  return `You are a content quality validator. Analyze the following JSON content and verify it meets the specified requirements.

CONTENT TO VALIDATE:
${content}

REQUIREMENTS TO CHECK:
${requirements}

VALIDATION CRITERIA:
1. JSON structure is valid and complete
2. All required fields are present and non-empty
3. Formatting positions are accurate
4. Content quality meets professional standards
5. Word count targets are met
6. Narrative flow and consistency

Respond with a JSON object:
{
  "isValid": true/false,
  "errors": ["list of specific errors found"],
  "warnings": ["list of potential improvements"],
  "wordCount": number,
  "qualityScore": number (1-10)
}

Return only the validation JSON object.`
}

/**
 * Creates a regeneration prompt for fixing malformed AI responses
 * Used when initial content generation fails validation
 */
export function createRegenerationPrompt(
  originalPrompt: string,
  errors: string[],
  previousAttempt?: string
): string {
  const errorContext = errors.length > 0 ? `
ERRORS TO FIX FROM PREVIOUS ATTEMPT:
${errors.map((error, index) => `${index + 1}. ${error}`).join('\n')}
` : ''

  const attemptContext = previousAttempt ? `
PREVIOUS FAILED ATTEMPT (for reference only):
${previousAttempt.substring(0, 500)}...
` : ''

  return `${originalPrompt}

IMPORTANT: The previous attempt failed validation. Please fix the following issues:
${errorContext}

${attemptContext}

CRITICAL REMINDERS:
- Return ONLY valid JSON with no additional text
- Double-check all formatting position calculations
- Ensure all required fields are present and properly formatted
- Verify JSON syntax is correct (no trailing commas, proper escaping)
- Make sure content meets quality and length requirements

Generate the corrected content now:`
}

/**
 * Helper function to extract JSON from AI response that might contain extra text
 */
export function extractJSONFromResponse(response: string): string {
  console.log('Raw AI response length:', response.length)
  console.log('Raw AI response preview:', response.substring(0, 200))

  // Remove common markdown code block markers
  let cleaned = response
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()

  // Find JSON object boundaries - look for the outermost braces
  let startIndex = -1
  let endIndex = -1
  let braceCount = 0
  
  // Find the first opening brace
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '{') {
      if (startIndex === -1) {
        startIndex = i
      }
      braceCount++
    } else if (cleaned[i] === '}') {
      braceCount--
      if (braceCount === 0 && startIndex !== -1) {
        endIndex = i
        break
      }
    }
  }

  if (startIndex === -1 || endIndex === -1) {
    console.error('JSON extraction failed - no complete JSON object found')
    console.error('Start index:', startIndex, 'End index:', endIndex)
    console.error('Response preview:', cleaned.substring(0, 500))
    throw new Error('No complete JSON object found in response')
  }

  const jsonString = cleaned.substring(startIndex, endIndex + 1)
  console.log('Extracted JSON length:', jsonString.length)
  console.log('Extracted JSON preview:', jsonString.substring(0, 200))

  // Only remove control characters that would break JSON parsing
  // Don't over-escape - let the AI generate properly formatted JSON
  const cleanedJson = jsonString
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '') // Remove problematic control characters but keep \n, \r, \t

  console.log('Cleaned JSON preview:', cleanedJson.substring(0, 200))
  return cleanedJson
}

/**
 * Helper function to validate that a response contains valid JSON structure
 */
export function validateJSONStructure(jsonString: string): boolean {
  try {
    const parsed = JSON.parse(jsonString)
    return typeof parsed === 'object' && parsed !== null
  } catch {
    return false
  }
}