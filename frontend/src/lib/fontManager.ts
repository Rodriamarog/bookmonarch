/**
 * Font Management System for PDF Generation
 * 
 * This module provides centralized font management to ensure consistent
 * styling throughout PDF documents and prevent font bleeding between sections.
 */

import jsPDF from 'jspdf'

export interface FontState {
  family: string
  size: number
  style: 'normal' | 'bold' | 'italic' | 'bolditalic'
}

export interface FontManager {
  setConsistentFont(pdf: jsPDF, fontSize: number, isBold: boolean, isItalic: boolean): void
  resetToDefault(pdf: jsPDF): void
  getCurrentFontState(): FontState
}

/**
 * Implementation of font manager that maintains consistent font styling
 */
export class PDFFontManager implements FontManager {
  private currentState: FontState
  private readonly defaultFamily: string = 'times'
  private readonly defaultSize: number = 11

  constructor() {
    this.currentState = {
      family: this.defaultFamily,
      size: this.defaultSize,
      style: 'normal'
    }
  }

  /**
   * Set font with consistent family and proper style combination
   * @param pdf - jsPDF instance
   * @param fontSize - Font size in points
   * @param isBold - Whether text should be bold
   * @param isItalic - Whether text should be italic
   */
  setConsistentFont(pdf: jsPDF, fontSize: number, isBold: boolean, isItalic: boolean): void {
    // Determine the correct font style
    let fontStyle: 'normal' | 'bold' | 'italic' | 'bolditalic'
    
    if (isBold && isItalic) {
      fontStyle = 'bolditalic'
    } else if (isBold) {
      fontStyle = 'bold'
    } else if (isItalic) {
      fontStyle = 'italic'
    } else {
      fontStyle = 'normal'
    }

    // Only update if the state has changed to avoid unnecessary PDF operations
    if (this.currentState.family !== this.defaultFamily ||
        this.currentState.size !== fontSize ||
        this.currentState.style !== fontStyle) {
      
      // Set font size first
      pdf.setFontSize(fontSize)
      
      // Set font family and style
      pdf.setFont(this.defaultFamily, fontStyle)
      
      // Update current state
      this.currentState = {
        family: this.defaultFamily,
        size: fontSize,
        style: fontStyle
      }
    }
  }

  /**
   * Reset font to default settings
   * @param pdf - jsPDF instance
   */
  resetToDefault(pdf: jsPDF): void {
    this.setConsistentFont(pdf, this.defaultSize, false, false)
  }

  /**
   * Get current font state
   * @returns Current font state
   */
  getCurrentFontState(): FontState {
    return { ...this.currentState }
  }

  /**
   * Check if current font state matches the specified parameters
   * @param fontSize - Font size to check
   * @param isBold - Bold state to check
   * @param isItalic - Italic state to check
   * @returns True if current state matches parameters
   */
  isCurrentState(fontSize: number, isBold: boolean, isItalic: boolean): boolean {
    const expectedStyle = this.getStyleString(isBold, isItalic)
    return this.currentState.family === this.defaultFamily &&
           this.currentState.size === fontSize &&
           this.currentState.style === expectedStyle
  }

  /**
   * Get the font style string for given bold/italic flags
   * @param isBold - Whether text is bold
   * @param isItalic - Whether text is italic
   * @returns Font style string
   */
  private getStyleString(isBold: boolean, isItalic: boolean): 'normal' | 'bold' | 'italic' | 'bolditalic' {
    if (isBold && isItalic) {
      return 'bolditalic'
    } else if (isBold) {
      return 'bold'
    } else if (isItalic) {
      return 'italic'
    } else {
      return 'normal'
    }
  }

  /**
   * Force update the font state (useful for initialization or after external font changes)
   * @param pdf - jsPDF instance
   * @param fontSize - Font size
   * @param isBold - Bold state
   * @param isItalic - Italic state
   */
  forceUpdateFont(pdf: jsPDF, fontSize: number, isBold: boolean, isItalic: boolean): void {
    // Reset current state to force update
    this.currentState = {
      family: '',
      size: 0,
      style: 'normal'
    }
    
    // Apply the font settings
    this.setConsistentFont(pdf, fontSize, isBold, isItalic)
  }
}

/**
 * Factory function to create a font manager instance
 */
export function createFontManager(): FontManager {
  return new PDFFontManager()
}

/**
 * Utility function to apply consistent font styling to a PDF
 * @param pdf - jsPDF instance
 * @param fontSize - Font size in points
 * @param isBold - Whether text should be bold
 * @param isItalic - Whether text should be italic
 */
export function applyConsistentFont(
  pdf: jsPDF, 
  fontSize: number, 
  isBold: boolean = false, 
  isItalic: boolean = false
): void {
  const fontManager = createFontManager()
  fontManager.setConsistentFont(pdf, fontSize, isBold, isItalic)
}