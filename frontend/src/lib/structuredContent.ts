/**
 * Structured Content Generation System
 * 
 * This module defines the structured content interfaces and validation logic
 * for generating publication-quality books with precise formatting control.
 * 
 * Requirements addressed: 3.1, 3.2, 3.3, 3.4
 */

// Core structured content interfaces
export interface StructuredBookContent {
  title: string
  author: string
  genre: string
  plotSummary: string
  chapters: StructuredChapter[]
}

export interface StructuredChapter {
  number: number
  title: string
  paragraphs: StructuredParagraph[]
}

export interface StructuredParagraph {
  text: string
  formatting: TextFormatting[]
}

export interface TextFormatting {
  start: number
  end: number
  type: 'bold' | 'italic' | 'bold-italic'
  text: string
}

// Validation error types
export class StructuredContentValidationError extends Error {
  constructor(message: string, public field?: string, public details?: any) {
    super(message)
    this.name = 'StructuredContentValidationError'
  }
}

// Content validation functions
export function validateStructuredBookContent(content: any): StructuredBookContent {
  if (!content || typeof content !== 'object') {
    throw new StructuredContentValidationError('Content must be a valid object')
  }

  // Validate required string fields
  const requiredStringFields = ['title', 'author', 'genre', 'plotSummary']
  for (const field of requiredStringFields) {
    if (!content[field] || typeof content[field] !== 'string' || content[field].trim().length === 0) {
      throw new StructuredContentValidationError(
        `Field '${field}' is required and must be a non-empty string`,
        field
      )
    }
  }

  // Validate chapters array
  if (!Array.isArray(content.chapters)) {
    throw new StructuredContentValidationError('Chapters must be an array', 'chapters')
  }

  if (content.chapters.length === 0) {
    throw new StructuredContentValidationError('At least one chapter is required', 'chapters')
  }

  // Validate each chapter
  const validatedChapters = content.chapters.map((chapter: any, index: number) => {
    try {
      return validateStructuredChapter(chapter, index + 1)
    } catch (error) {
      throw new StructuredContentValidationError(
        `Chapter ${index + 1} validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        `chapters[${index}]`,
        error
      )
    }
  })

  return {
    title: content.title.trim(),
    author: content.author.trim(),
    genre: content.genre.trim(),
    plotSummary: content.plotSummary.trim(),
    chapters: validatedChapters
  }
}

export function validateStructuredChapter(chapter: any, expectedNumber?: number): StructuredChapter {
  if (!chapter || typeof chapter !== 'object') {
    throw new StructuredContentValidationError('Chapter must be a valid object')
  }

  // Validate chapter number
  if (typeof chapter.number !== 'number' || chapter.number < 1) {
    throw new StructuredContentValidationError('Chapter number must be a positive integer', 'number')
  }

  if (expectedNumber && chapter.number !== expectedNumber) {
    throw new StructuredContentValidationError(
      `Chapter number mismatch: expected ${expectedNumber}, got ${chapter.number}`,
      'number'
    )
  }

  // Validate chapter title
  if (!chapter.title || typeof chapter.title !== 'string' || chapter.title.trim().length === 0) {
    throw new StructuredContentValidationError('Chapter title is required and must be a non-empty string', 'title')
  }

  // Validate paragraphs array
  if (!Array.isArray(chapter.paragraphs)) {
    throw new StructuredContentValidationError('Chapter paragraphs must be an array', 'paragraphs')
  }

  if (chapter.paragraphs.length === 0) {
    throw new StructuredContentValidationError('Chapter must contain at least one paragraph', 'paragraphs')
  }

  // Validate each paragraph
  const validatedParagraphs = chapter.paragraphs.map((paragraph: any, index: number) => {
    try {
      return validateStructuredParagraph(paragraph)
    } catch (error) {
      throw new StructuredContentValidationError(
        `Paragraph ${index + 1} validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        `paragraphs[${index}]`,
        error
      )
    }
  })

  return {
    number: chapter.number,
    title: chapter.title.trim(),
    paragraphs: validatedParagraphs
  }
}

export function validateStructuredParagraph(paragraph: any): StructuredParagraph {
  if (!paragraph || typeof paragraph !== 'object') {
    throw new StructuredContentValidationError('Paragraph must be a valid object')
  }

  // Validate paragraph text
  if (!paragraph.text || typeof paragraph.text !== 'string') {
    throw new StructuredContentValidationError('Paragraph text is required and must be a string', 'text')
  }

  // Validate formatting array
  if (!Array.isArray(paragraph.formatting)) {
    throw new StructuredContentValidationError('Paragraph formatting must be an array', 'formatting')
  }

  // Validate each formatting entry
  const validatedFormatting = paragraph.formatting.map((format: any, index: number) => {
    try {
      return validateTextFormatting(format, paragraph.text)
    } catch (error) {
      throw new StructuredContentValidationError(
        `Formatting ${index + 1} validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        `formatting[${index}]`,
        error
      )
    }
  })

  return {
    text: paragraph.text,
    formatting: validatedFormatting
  }
}

export function validateTextFormatting(formatting: any, paragraphText: string): TextFormatting {
  if (!formatting || typeof formatting !== 'object') {
    throw new StructuredContentValidationError('Text formatting must be a valid object')
  }

  // Validate start position
  if (typeof formatting.start !== 'number' || formatting.start < 0) {
    throw new StructuredContentValidationError('Formatting start position must be a non-negative number', 'start')
  }

  // Validate end position
  if (typeof formatting.end !== 'number' || formatting.end < formatting.start) {
    throw new StructuredContentValidationError('Formatting end position must be a number greater than start position', 'end')
  }

  // Validate positions are within paragraph bounds
  if (formatting.start >= paragraphText.length || formatting.end > paragraphText.length) {
    throw new StructuredContentValidationError(
      `Formatting positions (${formatting.start}-${formatting.end}) exceed paragraph length (${paragraphText.length})`,
      'start/end'
    )
  }

  // Validate formatting type
  const validTypes = ['bold', 'italic', 'bold-italic']
  if (!validTypes.includes(formatting.type)) {
    throw new StructuredContentValidationError(
      `Invalid formatting type '${formatting.type}'. Must be one of: ${validTypes.join(', ')}`,
      'type'
    )
  }

  // Validate formatted text matches the specified range
  const expectedText = paragraphText.substring(formatting.start, formatting.end)
  if (formatting.text !== expectedText) {
    throw new StructuredContentValidationError(
      `Formatting text '${formatting.text}' does not match paragraph text at positions ${formatting.start}-${formatting.end}: '${expectedText}'`,
      'text'
    )
  }

  return {
    start: formatting.start,
    end: formatting.end,
    type: formatting.type,
    text: formatting.text
  }
}

// Helper function to count words in structured content
export function countWordsInStructuredContent(content: StructuredBookContent): number {
  let totalWords = 0
  
  for (const chapter of content.chapters) {
    for (const paragraph of chapter.paragraphs) {
      const words = paragraph.text.trim().split(/\s+/).filter(word => word.length > 0)
      totalWords += words.length
    }
  }
  
  return totalWords
}

// Helper function to extract plain text from structured content
export function extractPlainText(content: StructuredBookContent): string {
  let plainText = `${content.title}\n\nBy ${content.author}\n\n${content.plotSummary}\n\n`
  
  for (const chapter of content.chapters) {
    plainText += `Chapter ${chapter.number}: ${chapter.title}\n\n`
    
    for (const paragraph of chapter.paragraphs) {
      plainText += `${paragraph.text}\n\n`
    }
  }
  
  return plainText
}

// Legacy BookData interface (for backward compatibility)
export interface BookData {
  title: string
  author: string
  genre: string
  plotSummary: string
  chapterTitles: string[]
  chapters: { [key: number]: string }
  metadata: {
    totalWords: number
    totalChapters: number
    generatedAt: string
  }
}

/**
 * Convert legacy BookData format to StructuredBookContent format
 * This enables LaTeX-based PDF generation for existing book data
 */
export function convertBookDataToStructuredContent(bookData: BookData): StructuredBookContent {
  try {
    // Convert chapters from legacy format to structured format
    const structuredChapters: StructuredChapter[] = []
    
    // Process each chapter
    Object.entries(bookData.chapters)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([chapterNumStr, content]) => {
        const chapterNumber = parseInt(chapterNumStr)
        const chapterTitle = bookData.chapterTitles[chapterNumber - 1] || `Chapter ${chapterNumber}`
        
        // Split content into paragraphs
        const paragraphs = content
          .split('\n\n')
          .map(p => p.trim())
          .filter(p => p.length > 0)
          .map(paragraphText => {
            // Create structured paragraph with basic formatting detection
            const { cleanText, formatting } = detectBasicFormatting(paragraphText)
            
            return {
              text: cleanText,
              formatting: formatting
            }
          })
        
        // Only add chapters that have content
        if (paragraphs.length > 0) {
          structuredChapters.push({
            number: chapterNumber,
            title: chapterTitle,
            paragraphs: paragraphs
          })
        }
      })
    
    // Create structured book content
    const structuredContent: StructuredBookContent = {
      title: bookData.title,
      author: bookData.author,
      genre: bookData.genre,
      plotSummary: bookData.plotSummary,
      chapters: structuredChapters
    }
    
    // Validate the converted content
    return validateStructuredBookContent(structuredContent)
    
  } catch (error) {
    throw new StructuredContentValidationError(
      `Failed to convert BookData to StructuredBookContent: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'conversion',
      error
    )
  }
}

/**
 * Detect and convert markdown formatting to structured formatting
 * Single-pass approach to avoid position conflicts
 */
function detectBasicFormatting(text: string): { cleanText: string; formatting: TextFormatting[] } {
  const formatting: TextFormatting[] = []
  const allMatches: Array<{
    start: number
    end: number
    content: string
    type: 'bold-italic' | 'bold' | 'italic'
    markupLength: number
  }> = []
  
  // Find all markdown patterns in the original text
  const patterns = [
    { regex: /\*\*\*(.*?)\*\*\*/g, type: 'bold-italic' as const, markupLength: 6 },
    { regex: /\*\*(.*?)\*\*/g, type: 'bold' as const, markupLength: 4 },
    { regex: /\*(.*?)\*/g, type: 'italic' as const, markupLength: 2 }
  ]
  
  // Collect all matches from all patterns
  for (const pattern of patterns) {
    let match
    pattern.regex.lastIndex = 0
    while ((match = pattern.regex.exec(text)) !== null) {
      // Skip if this content is already covered by a longer pattern
      const isOverlapped = allMatches.some(existing => 
        match.index >= existing.start && match.index < existing.end
      )
      
      if (!isOverlapped && match[1].trim().length > 0) {
        allMatches.push({
          start: match.index,
          end: match.index + match[0].length,
          content: match[1],
          type: pattern.type,
          markupLength: pattern.markupLength
        })
      }
    }
  }
  
  // Sort matches by start position
  allMatches.sort((a, b) => a.start - b.start)
  
  // Build clean text and formatting in a single pass
  let cleanText = ''
  let cleanPosition = 0
  let originalPosition = 0
  
  for (const match of allMatches) {
    // Add text before this match
    cleanText += text.substring(originalPosition, match.start)
    cleanPosition += match.start - originalPosition
    
    // Add the formatted content (without markdown syntax)
    const formattingStart = cleanPosition
    const formattingEnd = cleanPosition + match.content.length
    
    formatting.push({
      start: formattingStart,
      end: formattingEnd,
      type: match.type,
      text: match.content
    })
    
    cleanText += match.content
    cleanPosition += match.content.length
    originalPosition = match.end
  }
  
  // Add remaining text after last match
  cleanText += text.substring(originalPosition)
  
  return { cleanText, formatting }
}