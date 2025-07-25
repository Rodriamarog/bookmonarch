/**
 * LaTeX Content Processor
 * 
 * This module converts structured JSON content to LaTeX markup with proper formatting,
 * special character escaping, and chapter/section structure generation.
 * 
 * Requirements addressed: 6.1, 6.2, 6.3, 6.4
 */

import { StructuredBookContent, StructuredChapter, StructuredParagraph, TextFormatting } from './structuredContent'

// LaTeX processing configuration
export interface LaTeXProcessorConfig {
  escapeSpecialChars: boolean
  preserveWhitespace: boolean
  enableHyperlinks: boolean
  chapterNumbering: boolean
  paragraphIndentation: boolean
  customCommands: { [key: string]: string }
}

// Default LaTeX processor configuration
export const DEFAULT_LATEX_PROCESSOR_CONFIG: LaTeXProcessorConfig = {
  escapeSpecialChars: true,
  preserveWhitespace: false,
  enableHyperlinks: true,
  chapterNumbering: true,
  paragraphIndentation: true,
  customCommands: {}
}

// LaTeX processing error types
export class LaTeXProcessingError extends Error {
  constructor(message: string, public context?: string, public originalError?: Error) {
    super(message)
    this.name = 'LaTeXProcessingError'
  }
}

/**
 * LaTeX Content Processor class for converting structured JSON to LaTeX markup
 */
export class LaTeXProcessor {
  private config: LaTeXProcessorConfig

  constructor(config?: Partial<LaTeXProcessorConfig>) {
    this.config = { ...DEFAULT_LATEX_PROCESSOR_CONFIG, ...config }
  }

  /**
   * Convert structured book content to LaTeX markup
   */
  processBookContent(content: StructuredBookContent): string {
    try {
      const latexParts = [
        this.processBookMetadata(content),
        this.processChapters(content.chapters)
      ]

      return latexParts.filter(part => part.trim().length > 0).join('\n\n')
    } catch (error) {
      throw new LaTeXProcessingError(
        'Failed to process book content',
        'book-level',
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Process book metadata (title, author, etc.)
   */
  private processBookMetadata(content: StructuredBookContent): string {
    const metadata = [
      `% Book: ${this.escapeText(content.title)}`,
      `% Author: ${this.escapeText(content.author)}`,
      `% Genre: ${this.escapeText(content.genre)}`,
      `% Summary: ${this.escapeText(content.plotSummary)}`,
      ''
    ]

    return metadata.join('\n')
  }

  /**
   * Process all chapters
   */
  processChapters(chapters: StructuredChapter[]): string {
    try {
      const processedChapters = chapters.map((chapter, index) => {
        return this.processChapter(chapter, index === 0)
      })

      return processedChapters.join('\n\n')
    } catch (error) {
      throw new LaTeXProcessingError(
        'Failed to process chapters',
        'chapters',
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Process a single chapter
   */
  processChapter(chapter: StructuredChapter, isFirstChapter: boolean = false): string {
    try {
      const chapterParts = [
        `% Chapter ${chapter.number}: ${chapter.title}`,
        isFirstChapter ? '' : '\\cleardoublepage',
        this.generateChapterHeader(chapter),
        this.generateChapterLabel(chapter),
        '',
        this.processParagraphs(chapter.paragraphs)
      ]

      return chapterParts.filter(part => part !== '').join('\n')
    } catch (error) {
      throw new LaTeXProcessingError(
        `Failed to process chapter ${chapter.number}`,
        `chapter-${chapter.number}`,
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Generate chapter header with proper formatting
   */
  private generateChapterHeader(chapter: StructuredChapter): string {
    if (this.config.chapterNumbering) {
      return `\\chapter{${this.escapeText(chapter.title)}}`
    } else {
      return `\\chapter*{${this.escapeText(chapter.title)}}`
    }
  }

  /**
   * Generate chapter label for cross-referencing
   */
  private generateChapterLabel(chapter: StructuredChapter): string {
    const labelId = this.generateLabelId(chapter.title, chapter.number)
    return `\\label{chap:${labelId}}`
  }

  /**
   * Generate a safe label ID from chapter title and number
   */
  private generateLabelId(title: string, number: number): string {
    // Create a safe label ID by removing special characters and spaces
    const safeTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 20) // Limit length
      .replace(/-+$/, '') // Remove trailing dashes

    return safeTitle ? `${number}-${safeTitle}` : number.toString()
  }

  /**
   * Process all paragraphs in a chapter
   */
  processParagraphs(paragraphs: StructuredParagraph[]): string {
    try {
      const processedParagraphs = paragraphs.map((paragraph, index) => {
        return this.processParagraph(paragraph, index)
      })

      return processedParagraphs.join('\n\n')
    } catch (error) {
      throw new LaTeXProcessingError(
        'Failed to process paragraphs',
        'paragraphs',
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Process a single paragraph with formatting
   */
  processParagraph(paragraph: StructuredParagraph, index: number): string {
    try {
      let processedText = this.processTextFormatting(paragraph.text, paragraph.formatting)

      // Add paragraph indentation if enabled
      if (this.config.paragraphIndentation && index > 0) {
        processedText = `\\indent ${processedText}`
      }

      return processedText
    } catch (error) {
      throw new LaTeXProcessingError(
        `Failed to process paragraph ${index + 1}`,
        `paragraph-${index + 1}`,
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Process text formatting (bold, italic, bold-italic) for LaTeX
   */
  processTextFormatting(text: string, formatting: TextFormatting[]): string {
    if (!formatting || formatting.length === 0) {
      return this.escapeText(text)
    }

    try {
      // Validate formatting positions
      this.validateFormattingPositions(text, formatting)

      // Sort formatting by start position (descending) to apply from end to beginning
      const sortedFormatting = [...formatting].sort((a, b) => b.start - a.start)
      
      let result = text
      
      for (const format of sortedFormatting) {
        const before = result.substring(0, format.start)
        const middle = result.substring(format.start, format.end)
        const after = result.substring(format.end)
        
        const formattedMiddle = this.applyTextFormatting(middle, format.type)
        result = before + formattedMiddle + after
      }
      
      // Escape the entire result, but preserve LaTeX commands
      return this.escapeTextPreservingCommands(result)
    } catch (error) {
      throw new LaTeXProcessingError(
        'Failed to process text formatting',
        'text-formatting',
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Apply specific text formatting type
   */
  private applyTextFormatting(text: string, type: 'bold' | 'italic' | 'bold-italic'): string {
    switch (type) {
      case 'bold':
        return `\\textbf{${text}}`
      case 'italic':
        return `\\textit{${text}}`
      case 'bold-italic':
        return `\\textbf{\\textit{${text}}}`
      default:
        return text
    }
  }

  /**
   * Escape text while preserving LaTeX commands
   */
  private escapeTextPreservingCommands(text: string): string {
    if (!this.config.escapeSpecialChars) {
      return text
    }

    // Handle nested LaTeX commands like \textbf{\textit{content}}
    const processNestedCommands = (str: string): string => {
      // Match nested textbf/textit commands
      return str.replace(/\\textbf\{\\textit\{([^}]*)\}\}/g, (_match, content) => {
        return `\\textbf{\\textit{${this.escapeText(content)}}}`
      }).replace(/\\textit\{\\textbf\{([^}]*)\}\}/g, (_match, content) => {
        return `\\textit{\\textbf{${this.escapeText(content)}}}`
      }).replace(/\\text(bf|it)\{([^}]*)\}/g, (match, type, content) => {
        // Handle single commands
        if (!content.includes('\\text')) {
          return `\\text${type}{${this.escapeText(content)}}`
        }
        return match
      })
    }

    // First handle nested commands
    let result = processNestedCommands(text)
    
    // Then split by remaining LaTeX commands and escape non-command parts
    const parts = result.split(/(\\text[a-z]+\{(?:[^{}]|\\text[a-z]+\{[^}]*\})*\})/g)
    
    return parts.map((part, index) => {
      // Odd indices are LaTeX commands, preserve them
      if (index % 2 === 1 && part.startsWith('\\text')) {
        return part
      }
      // Even indices are regular text, escape them
      return this.escapeText(part)
    }).join('')
  }

  /**
   * Validate formatting positions against text length
   */
  private validateFormattingPositions(text: string, formatting: TextFormatting[]): void {
    for (const format of formatting) {
      if (format.start < 0 || format.start >= text.length) {
        throw new LaTeXProcessingError(
          `Invalid formatting start position ${format.start} for text of length ${text.length}`,
          'formatting-validation'
        )
      }
      
      if (format.end <= format.start || format.end > text.length) {
        throw new LaTeXProcessingError(
          `Invalid formatting end position ${format.end} for text of length ${text.length}`,
          'formatting-validation'
        )
      }

      // Validate that the formatting text matches the specified range
      const expectedText = text.substring(format.start, format.end)
      if (format.text !== expectedText) {
        throw new LaTeXProcessingError(
          `Formatting text '${format.text}' does not match text at positions ${format.start}-${format.end}: '${expectedText}'`,
          'formatting-validation'
        )
      }
    }
  }

  /**
   * Escape special LaTeX characters in text
   */
  escapeText(text: string): string {
    if (!this.config.escapeSpecialChars) {
      return text
    }

    return text
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/&/g, '\\&')
      .replace(/%/g, '\\%')
      .replace(/\$/g, '\\$')
      .replace(/#/g, '\\#')
      .replace(/_/g, '\\_')
      .replace(/\^/g, '\\textasciicircum{}')
      .replace(/~/g, '\\textasciitilde{}')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
  }

  /**
   * Process custom LaTeX commands
   */
  processCustomCommands(text: string): string {
    let result = text

    for (const [command, replacement] of Object.entries(this.config.customCommands)) {
      const regex = new RegExp(`\\\\${command}\\b`, 'g')
      result = result.replace(regex, replacement)
    }

    return result
  }

  /**
   * Generate LaTeX section structure
   */
  generateSectionStructure(level: number, title: string, numbered: boolean = true): string {
    const sectionCommands = [
      'chapter',
      'section', 
      'subsection',
      'subsubsection',
      'paragraph',
      'subparagraph'
    ]

    if (level < 0 || level >= sectionCommands.length) {
      throw new LaTeXProcessingError(
        `Invalid section level ${level}. Must be between 0 and ${sectionCommands.length - 1}`,
        'section-structure'
      )
    }

    const command = sectionCommands[level]
    const asterisk = numbered ? '' : '*'
    
    return `\\${command}${asterisk}{${this.escapeText(title)}}`
  }

  /**
   * Generate cross-references and hyperlinks
   */
  generateCrossReference(type: 'chapter' | 'section' | 'page', labelId: string, displayText?: string): string {
    if (!this.config.enableHyperlinks) {
      return displayText || labelId
    }

    switch (type) {
      case 'chapter':
        return `\\hyperref[chap:${labelId}]{${displayText || `Chapter \\ref{chap:${labelId}}`}}`
      case 'section':
        return `\\hyperref[sec:${labelId}]{${displayText || `Section \\ref{sec:${labelId}}`}}`
      case 'page':
        return `\\pageref{${labelId}}`
      default:
        return displayText || labelId
    }
  }

  /**
   * Process special content types (quotes, lists, etc.)
   */
  processSpecialContent(content: string, type: 'quote' | 'list' | 'code'): string {
    switch (type) {
      case 'quote':
        return `\\begin{quote}\n${this.escapeText(content)}\n\\end{quote}`
      case 'list':
        const items = content.split('\n').filter(item => item.trim())
        const listItems = items.map(item => `\\item ${this.escapeText(item.trim())}`).join('\n')
        return `\\begin{itemize}\n${listItems}\n\\end{itemize}`
      case 'code':
        return `\\begin{verbatim}\n${content}\n\\end{verbatim}`
      default:
        return this.escapeText(content)
    }
  }

  /**
   * Update processor configuration
   */
  updateConfig(newConfig: Partial<LaTeXProcessorConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Get current processor configuration
   */
  getConfig(): LaTeXProcessorConfig {
    return { ...this.config }
  }

  /**
   * Validate structured content before processing
   */
  validateContent(content: StructuredBookContent): void {
    if (!content.title || !content.author || !content.chapters) {
      throw new LaTeXProcessingError(
        'Invalid book content: missing required fields (title, author, chapters)',
        'content-validation'
      )
    }

    if (!Array.isArray(content.chapters) || content.chapters.length === 0) {
      throw new LaTeXProcessingError(
        'Invalid book content: chapters must be a non-empty array',
        'content-validation'
      )
    }

    // Validate each chapter
    content.chapters.forEach((chapter, index) => {
      if (!chapter.title || typeof chapter.number !== 'number') {
        throw new LaTeXProcessingError(
          `Invalid chapter ${index + 1}: missing title or number`,
          'content-validation'
        )
      }

      if (!Array.isArray(chapter.paragraphs)) {
        throw new LaTeXProcessingError(
          `Invalid chapter ${index + 1}: paragraphs must be an array`,
          'content-validation'
        )
      }
    })
  }

  /**
   * Generate complete LaTeX document structure
   */
  generateCompleteDocument(content: StructuredBookContent, includeMetadata: boolean = true): string {
    try {
      this.validateContent(content)

      const documentParts = []

      if (includeMetadata) {
        documentParts.push(this.processBookMetadata(content))
      }

      documentParts.push(this.processChapters(content.chapters))

      return documentParts.join('\n\n')
    } catch (error) {
      throw new LaTeXProcessingError(
        'Failed to generate complete LaTeX document',
        'document-generation',
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }
}

/**
 * Factory function to create LaTeX processor with default configuration
 */
export function createLatexProcessor(config?: Partial<LaTeXProcessorConfig>): LaTeXProcessor {
  return new LaTeXProcessor(config)
}

/**
 * Factory function to create LaTeX processor optimized for book processing
 */
export function createBookLatexProcessor(): LaTeXProcessor {
  return new LaTeXProcessor({
    chapterNumbering: true,
    paragraphIndentation: true,
    enableHyperlinks: true
  })
}

/**
 * Factory function to create LaTeX processor for article processing
 */
export function createArticleLatexProcessor(): LaTeXProcessor {
  return new LaTeXProcessor({
    chapterNumbering: false,
    paragraphIndentation: false,
    enableHyperlinks: true
  })
}