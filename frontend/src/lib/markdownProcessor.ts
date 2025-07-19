/**
 * Markdown Processing Utilities for PDF Generation
 * 
 * This module provides utilities to parse basic markdown formatting
 * and convert it to structured text segments for PDF rendering.
 */

export interface FormattedTextSegment {
  text: string
  isBold: boolean
  isItalic: boolean
  fontSize?: number
}

export interface MarkdownProcessor {
  parseMarkdown(content: string): FormattedTextSegment[]
  processInlineFormatting(text: string): FormattedTextSegment[]
}

/**
 * Implementation of markdown processor that handles basic formatting
 */
export class BasicMarkdownProcessor implements MarkdownProcessor {
  /**
   * Parse markdown content and return formatted text segments
   * @param content - Raw markdown content
   * @returns Array of formatted text segments
   */
  parseMarkdown(content: string): FormattedTextSegment[] {
    return this.processInlineFormatting(content)
  }

  /**
   * Process inline markdown formatting (bold, italic, bold-italic)
   * @param text - Text with markdown formatting
   * @returns Array of formatted text segments
   */
  processInlineFormatting(text: string): FormattedTextSegment[] {
    const segments: FormattedTextSegment[] = []
    let currentIndex = 0

    // Regular expression to match markdown formatting
    // Matches: ***text***, **text**, *text* (with non-empty content)
    const markdownRegex = /(\*{1,3})(.+?)\1/g
    let match: RegExpExecArray | null

    while ((match = markdownRegex.exec(text)) !== null) {
      const [fullMatch, asterisks, content] = match
      const matchStart = match.index
      const matchEnd = match.index + fullMatch.length

      // Add any plain text before this match
      if (matchStart > currentIndex) {
        const plainText = text.substring(currentIndex, matchStart)
        if (plainText) {
          segments.push({
            text: plainText,
            isBold: false,
            isItalic: false
          })
        }
      }

      // Determine formatting based on number of asterisks
      let isBold = false
      let isItalic = false

      if (asterisks.length === 1) {
        // *text* = italic
        isItalic = true
      } else if (asterisks.length === 2) {
        // **text** = bold
        isBold = true
      } else if (asterisks.length === 3) {
        // ***text*** = bold italic
        isBold = true
        isItalic = true
      }

      // Add the formatted segment
      segments.push({
        text: content,
        isBold,
        isItalic
      })

      currentIndex = matchEnd
    }

    // Add any remaining plain text
    if (currentIndex < text.length) {
      const remainingText = text.substring(currentIndex)
      if (remainingText) {
        segments.push({
          text: remainingText,
          isBold: false,
          isItalic: false
        })
      }
    }

    // If no markdown was found, return the entire text as a single segment
    if (segments.length === 0) {
      segments.push({
        text: text,
        isBold: false,
        isItalic: false
      })
    }

    return segments
  }
}

/**
 * Factory function to create a markdown processor instance
 */
export function createMarkdownProcessor(): MarkdownProcessor {
  return new BasicMarkdownProcessor()
}

/**
 * Utility function to quickly parse markdown text
 * @param text - Markdown text to parse
 * @returns Array of formatted text segments
 */
export function parseMarkdownText(text: string): FormattedTextSegment[] {
  const processor = createMarkdownProcessor()
  return processor.parseMarkdown(text)
}