/**
 * Enhanced Text Rendering System for PDF Generation
 * 
 * This module provides advanced text rendering capabilities that handle
 * formatted text segments, proper word wrapping, and consistent spacing.
 */

import jsPDF from 'jspdf'
import { FormattedTextSegment, parseMarkdownText } from './markdownProcessor'
import { FontManager, createFontManager } from './fontManager'

export interface TextRenderer {
  renderFormattedText(
    pdf: jsPDF, 
    segments: FormattedTextSegment[], 
    x: number, 
    y: number, 
    maxWidth: number
  ): number // returns new Y position
  
  renderParagraph(
    pdf: jsPDF,
    content: string,
    x: number,
    y: number,
    maxWidth: number,
    indent: boolean
  ): number
}

export interface RenderOptions {
  lineHeight: number
  paragraphSpacing: number
  indentSize: number
  defaultFontSize: number
}

/**
 * Implementation of enhanced text renderer
 */
export class PDFTextRenderer implements TextRenderer {
  private fontManager: FontManager
  private options: RenderOptions

  constructor(options?: Partial<RenderOptions>) {
    this.fontManager = createFontManager()
    this.options = {
      lineHeight: 16,
      paragraphSpacing: 8,
      indentSize: 20,
      defaultFontSize: 11,
      ...options
    }
  }

  /**
   * Render formatted text segments with proper styling and word wrapping
   * @param pdf - jsPDF instance
   * @param segments - Array of formatted text segments
   * @param x - Starting X position
   * @param y - Starting Y position
   * @param maxWidth - Maximum width for text wrapping
   * @returns New Y position after rendering
   */
  renderFormattedText(
    pdf: jsPDF, 
    segments: FormattedTextSegment[], 
    x: number, 
    y: number, 
    maxWidth: number
  ): number {
    let currentX = x
    let currentY = y
    let currentLine = ''
    let currentLineSegments: Array<{ text: string; isBold: boolean; isItalic: boolean; fontSize: number }> = []

    for (const segment of segments) {
      const fontSize = segment.fontSize || this.options.defaultFontSize
      
      // Set font to measure text width
      this.fontManager.setConsistentFont(pdf, fontSize, segment.isBold, segment.isItalic)
      
      // Split segment text into words
      const words = segment.text.split(/(\s+)/)
      
      for (const word of words) {
        if (!word) continue
        
        // Test if adding this word would exceed the line width
        const testLine = currentLine + word
        const testWidth = this.getTextWidth(pdf, testLine, currentLineSegments, { text: word, isBold: segment.isBold, isItalic: segment.isItalic, fontSize })
        
        if (testWidth > maxWidth && currentLine.trim()) {
          // Render current line and start new line
          currentY = this.renderLine(pdf, currentLineSegments, x, currentY)
          currentLine = word
          currentLineSegments = [{ text: word, isBold: segment.isBold, isItalic: segment.isItalic, fontSize }]
        } else {
          // Add word to current line
          currentLine += word
          if (currentLineSegments.length === 0 || 
              currentLineSegments[currentLineSegments.length - 1].isBold !== segment.isBold ||
              currentLineSegments[currentLineSegments.length - 1].isItalic !== segment.isItalic ||
              currentLineSegments[currentLineSegments.length - 1].fontSize !== fontSize) {
            currentLineSegments.push({ text: word, isBold: segment.isBold, isItalic: segment.isItalic, fontSize })
          } else {
            // Extend the last segment
            currentLineSegments[currentLineSegments.length - 1].text += word
          }
        }
      }
    }

    // Render any remaining line
    if (currentLine.trim()) {
      currentY = this.renderLine(pdf, currentLineSegments, x, currentY)
    }

    return currentY
  }

  /**
   * Render a paragraph with consistent formatting and spacing
   * @param pdf - jsPDF instance
   * @param content - Paragraph content (may contain markdown)
   * @param x - Starting X position
   * @param y - Starting Y position
   * @param maxWidth - Maximum width for text wrapping
   * @param indent - Whether to indent the paragraph
   * @returns New Y position after rendering
   */
  renderParagraph(
    pdf: jsPDF,
    content: string,
    x: number,
    y: number,
    maxWidth: number,
    indent: boolean = true
  ): number {
    if (!content.trim()) {
      return y + this.options.paragraphSpacing
    }

    const segments = parseMarkdownText(content)

    const startX = indent ? x + this.options.indentSize : x
    const availableWidth = indent ? maxWidth - this.options.indentSize : maxWidth

    const newY = this.renderFormattedText(pdf, segments, startX, y, availableWidth)
    
    // Add paragraph spacing
    return newY + this.options.paragraphSpacing
  }

  /**
   * Render a single line of formatted text segments
   * @param pdf - jsPDF instance
   * @param segments - Line segments with formatting
   * @param x - Starting X position
   * @param y - Y position for the line
   * @returns New Y position after rendering the line
   */
  private renderLine(
    pdf: jsPDF,
    segments: Array<{ text: string; isBold: boolean; isItalic: boolean; fontSize: number }>,
    x: number,
    y: number
  ): number {
    let currentX = x

    for (const segment of segments) {
      if (!segment.text.trim()) {
        // Handle whitespace
        this.fontManager.setConsistentFont(pdf, segment.fontSize, false, false)
        const spaceWidth = pdf.getTextWidth(segment.text)
        currentX += spaceWidth
        continue
      }

      // Set font for this segment
      this.fontManager.setConsistentFont(pdf, segment.fontSize, segment.isBold, segment.isItalic)
      
      // Render the text
      pdf.text(segment.text, currentX, y)
      
      // Move X position for next segment
      currentX += pdf.getTextWidth(segment.text)
    }

    return y + this.options.lineHeight
  }

  /**
   * Calculate the width of text with mixed formatting
   * @param pdf - jsPDF instance
   * @param fullText - Complete text line
   * @param existingSegments - Already processed segments
   * @param newSegment - New segment to add
   * @returns Total width of the text
   */
  private getTextWidth(
    pdf: jsPDF,
    fullText: string,
    existingSegments: Array<{ text: string; isBold: boolean; isItalic: boolean; fontSize: number }>,
    newSegment: { text: string; isBold: boolean; isItalic: boolean; fontSize: number }
  ): number {
    let totalWidth = 0

    // Calculate width of existing segments
    for (const segment of existingSegments) {
      this.fontManager.setConsistentFont(pdf, segment.fontSize, segment.isBold, segment.isItalic)
      totalWidth += pdf.getTextWidth(segment.text)
    }

    // Calculate width of new segment
    this.fontManager.setConsistentFont(pdf, newSegment.fontSize, newSegment.isBold, newSegment.isItalic)
    totalWidth += pdf.getTextWidth(newSegment.text)

    return totalWidth
  }

  /**
   * Check if adding text would cause a page break
   * @param currentY - Current Y position
   * @param pageHeight - Page height
   * @param bottomMargin - Bottom margin
   * @param additionalLines - Number of additional lines to check
   * @returns True if page break is needed
   */
  needsPageBreak(currentY: number, pageHeight: number, bottomMargin: number, additionalLines: number = 1): boolean {
    const requiredSpace = additionalLines * this.options.lineHeight
    return currentY + requiredSpace > pageHeight - bottomMargin
  }

  /**
   * Get the current line height setting
   * @returns Line height in points
   */
  getLineHeight(): number {
    return this.options.lineHeight
  }

  /**
   * Get the current paragraph spacing setting
   * @returns Paragraph spacing in points
   */
  getParagraphSpacing(): number {
    return this.options.paragraphSpacing
  }

  /**
   * Update rendering options
   * @param newOptions - New options to merge
   */
  updateOptions(newOptions: Partial<RenderOptions>): void {
    this.options = { ...this.options, ...newOptions }
  }

  /**
   * Reset font manager to default state
   * @param pdf - jsPDF instance
   */
  resetFont(pdf: jsPDF): void {
    this.fontManager.resetToDefault(pdf)
  }
}

/**
 * Factory function to create a text renderer instance
 */
export function createTextRenderer(options?: Partial<RenderOptions>): TextRenderer {
  return new PDFTextRenderer(options)
}

/**
 * Utility function to render formatted text quickly
 * @param pdf - jsPDF instance
 * @param segments - Formatted text segments
 * @param x - X position
 * @param y - Y position
 * @param maxWidth - Maximum width
 * @returns New Y position
 */
export function renderFormattedText(
  pdf: jsPDF,
  segments: FormattedTextSegment[],
  x: number,
  y: number,
  maxWidth: number
): number {
  const renderer = createTextRenderer()
  return renderer.renderFormattedText(pdf, segments, x, y, maxWidth)
}

/**
 * Utility function to render a paragraph quickly
 * @param pdf - jsPDF instance
 * @param content - Paragraph content
 * @param x - X position
 * @param y - Y position
 * @param maxWidth - Maximum width
 * @param indent - Whether to indent
 * @returns New Y position
 */
export function renderParagraph(
  pdf: jsPDF,
  content: string,
  x: number,
  y: number,
  maxWidth: number,
  indent: boolean = true
): number {
  const renderer = createTextRenderer()
  return renderer.renderParagraph(pdf, content, x, y, maxWidth, indent)
}