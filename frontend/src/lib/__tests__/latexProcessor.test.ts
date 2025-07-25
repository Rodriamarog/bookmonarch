/**
 * Tests for LaTeX Content Processor
 * 
 * These tests verify the LaTeX content processing functionality
 * Requirements tested: 6.1, 6.2, 6.3, 6.4
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  LaTeXProcessor,
  LaTeXProcessorConfig,
  LaTeXProcessingError,
  DEFAULT_LATEX_PROCESSOR_CONFIG,
  createLatexProcessor,
  createBookLatexProcessor,
  createArticleLatexProcessor
} from '../latexProcessor'
import { StructuredBookContent, StructuredChapter, StructuredParagraph } from '../structuredContent'

describe('LaTeX Content Processor', () => {
  const mockBookContent: StructuredBookContent = {
    title: 'Test Book Title',
    author: 'Test Author',
    genre: 'Fiction',
    plotSummary: 'A compelling story about testing LaTeX processing.',
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
      },
      {
        number: 2,
        title: 'The Development',
        paragraphs: [
          {
            text: 'Chapter two content with bold-italic formatting.',
            formatting: [
              {
                start: 25,
                end: 36,
                type: 'bold-italic',
                text: 'bold-italic'
              }
            ]
          }
        ]
      }
    ]
  }

  describe('LaTeXProcessor Class', () => {
    it('should initialize with default configuration', () => {
      const processor = new LaTeXProcessor()
      const config = processor.getConfig()
      
      expect(config.escapeSpecialChars).toBe(true)
      expect(config.enableHyperlinks).toBe(true)
      expect(config.chapterNumbering).toBe(true)
      expect(config.paragraphIndentation).toBe(true)
    })

    it('should initialize with custom configuration', () => {
      const customConfig = {
        escapeSpecialChars: false,
        chapterNumbering: false,
        customCommands: { 'mycommand': '\\textbf{Custom}' }
      }
      
      const processor = new LaTeXProcessor(customConfig)
      const config = processor.getConfig()
      
      expect(config.escapeSpecialChars).toBe(false)
      expect(config.chapterNumbering).toBe(false)
      expect(config.customCommands['mycommand']).toBe('\\textbf{Custom}')
    })

    it('should update configuration', () => {
      const processor = new LaTeXProcessor()
      
      processor.updateConfig({
        enableHyperlinks: false,
        paragraphIndentation: false
      })
      
      const config = processor.getConfig()
      expect(config.enableHyperlinks).toBe(false)
      expect(config.paragraphIndentation).toBe(false)
    })
  })

  describe('Content Processing', () => {
    let processor: LaTeXProcessor

    beforeEach(() => {
      processor = new LaTeXProcessor()
    })

    it('should process complete book content', () => {
      const latex = processor.processBookContent(mockBookContent)
      
      expect(latex).toContain('% Book: Test Book Title')
      expect(latex).toContain('% Author: Test Author')
      expect(latex).toContain('\\chapter{The Beginning}')
      expect(latex).toContain('\\chapter{The Development}')
      expect(latex).toContain('\\label{chap:1-the-beginning}')
      expect(latex).toContain('\\label{chap:2-the-development}')
    })

    it('should process book metadata', () => {
      const latex = processor.processBookContent(mockBookContent)
      
      expect(latex).toContain('% Book: Test Book Title')
      expect(latex).toContain('% Author: Test Author')
      expect(latex).toContain('% Genre: Fiction')
      expect(latex).toContain('% Summary: A compelling story about testing LaTeX processing.')
    })

    it('should process chapters with proper structure', () => {
      const latex = processor.processChapters(mockBookContent.chapters)
      
      expect(latex).toContain('% Chapter 1: The Beginning')
      expect(latex).toContain('\\chapter{The Beginning}')
      expect(latex).toContain('\\label{chap:1-the-beginning}')
      expect(latex).toContain('% Chapter 2: The Development')
      expect(latex).toContain('\\cleardoublepage')
      expect(latex).toContain('\\chapter{The Development}')
      expect(latex).toContain('\\label{chap:2-the-development}')
    })

    it('should handle first chapter without page break', () => {
      const firstChapter = mockBookContent.chapters[0]
      const latex = processor.processChapter(firstChapter, true)
      
      expect(latex).not.toContain('\\cleardoublepage')
      expect(latex).toContain('\\chapter{The Beginning}')
    })

    it('should handle subsequent chapters with page break', () => {
      const secondChapter = mockBookContent.chapters[1]
      const latex = processor.processChapter(secondChapter, false)
      
      expect(latex).toContain('\\cleardoublepage')
      expect(latex).toContain('\\chapter{The Development}')
    })
  })

  describe('Text Formatting', () => {
    let processor: LaTeXProcessor

    beforeEach(() => {
      processor = new LaTeXProcessor()
    })

    it('should process bold formatting', () => {
      const paragraph: StructuredParagraph = {
        text: 'This text has bold formatting.',
        formatting: [
          {
            start: 14,
            end: 18,
            type: 'bold',
            text: 'bold'
          }
        ]
      }
      
      const latex = processor.processParagraph(paragraph, 0)
      expect(latex).toContain('\\textbf{bold}')
    })

    it('should process italic formatting', () => {
      const paragraph: StructuredParagraph = {
        text: 'This text has italic formatting.',
        formatting: [
          {
            start: 14,
            end: 20,
            type: 'italic',
            text: 'italic'
          }
        ]
      }
      
      const latex = processor.processParagraph(paragraph, 0)
      expect(latex).toContain('\\textit{italic}')
    })

    it('should process bold-italic formatting', () => {
      const paragraph: StructuredParagraph = {
        text: 'This text has bold-italic formatting.',
        formatting: [
          {
            start: 14,
            end: 25,
            type: 'bold-italic',
            text: 'bold-italic'
          }
        ]
      }
      
      const latex = processor.processParagraph(paragraph, 0)
      expect(latex).toContain('\\textbf{\\textit{bold-italic}}')
    })

    it('should handle multiple formatting in same paragraph', () => {
      const paragraph: StructuredParagraph = {
        text: 'Text with bold and italic formatting.',
        formatting: [
          {
            start: 10,
            end: 14,
            type: 'bold',
            text: 'bold'
          },
          {
            start: 19,
            end: 25,
            type: 'italic',
            text: 'italic'
          }
        ]
      }
      
      const latex = processor.processParagraph(paragraph, 0)
      expect(latex).toContain('\\textbf{bold}')
      expect(latex).toContain('\\textit{italic}')
    })

    it('should process text without formatting', () => {
      const paragraph: StructuredParagraph = {
        text: 'Plain text without any formatting.',
        formatting: []
      }
      
      const latex = processor.processParagraph(paragraph, 0)
      expect(latex).toBe('Plain text without any formatting.')
      expect(latex).not.toContain('\\textbf')
      expect(latex).not.toContain('\\textit')
    })
  })

  describe('Special Character Escaping', () => {
    let processor: LaTeXProcessor

    beforeEach(() => {
      processor = new LaTeXProcessor()
    })

    it('should escape LaTeX special characters', () => {
      const text = 'Text with & % $ # _ ^ ~ { } characters'
      const escaped = processor.escapeText(text)
      
      expect(escaped).toContain('\\&')
      expect(escaped).toContain('\\%')
      expect(escaped).toContain('\\$')
      expect(escaped).toContain('\\#')
      expect(escaped).toContain('\\_')
      expect(escaped).toContain('\\textasciicircum\\{\\}')
      expect(escaped).toContain('\\textasciitilde\\{\\}')
      expect(escaped).toContain('\\{')
      expect(escaped).toContain('\\}')
    })

    it('should handle backslashes correctly', () => {
      const text = 'Text with \\ backslash'
      const escaped = processor.escapeText(text)
      
      expect(escaped).toContain('\\textbackslash\\{\\}')
    })

    it('should not escape when disabled', () => {
      const processor = new LaTeXProcessor({ 
        escapeSpecialChars: false 
      })
      
      const text = 'Text with & % $ characters'
      const escaped = processor.escapeText(text)
      
      expect(escaped).toBe(text)
    })
  })

  describe('Chapter and Section Structure', () => {
    let processor: LaTeXProcessor

    beforeEach(() => {
      processor = new LaTeXProcessor()
    })

    it('should generate numbered chapters by default', () => {
      const chapter: StructuredChapter = {
        number: 1,
        title: 'Test Chapter',
        paragraphs: []
      }
      
      const latex = processor.processChapter(chapter)
      expect(latex).toContain('\\chapter{Test Chapter}')
      expect(latex).not.toContain('\\chapter*{Test Chapter}')
    })

    it('should generate unnumbered chapters when disabled', () => {
      const processor = new LaTeXProcessor({
        chapterNumbering: false
      })
      
      const chapter: StructuredChapter = {
        number: 1,
        title: 'Test Chapter',
        paragraphs: []
      }
      
      const latex = processor.processChapter(chapter)
      expect(latex).toContain('\\chapter*{Test Chapter}')
    })

    it('should generate section structure at different levels', () => {
      expect(processor.generateSectionStructure(0, 'Chapter Title')).toBe('\\chapter{Chapter Title}')
      expect(processor.generateSectionStructure(1, 'Section Title')).toBe('\\section{Section Title}')
      expect(processor.generateSectionStructure(2, 'Subsection Title')).toBe('\\subsection{Subsection Title}')
    })

    it('should generate unnumbered sections when specified', () => {
      expect(processor.generateSectionStructure(1, 'Section Title', false)).toBe('\\section*{Section Title}')
    })

    it('should throw error for invalid section levels', () => {
      expect(() => processor.generateSectionStructure(-1, 'Invalid')).toThrow(LaTeXProcessingError)
      expect(() => processor.generateSectionStructure(10, 'Invalid')).toThrow(LaTeXProcessingError)
    })
  })

  describe('Error Handling', () => {
    let processor: LaTeXProcessor

    beforeEach(() => {
      processor = new LaTeXProcessor()
    })

    it('should throw error for invalid content', () => {
      const invalidContent = {
        title: '',
        author: 'Test',
        genre: 'Fiction',
        plotSummary: 'Test',
        chapters: []
      } as unknown as StructuredBookContent
      
      expect(() => processor.validateContent(invalidContent)).toThrow(LaTeXProcessingError)
    })

    it('should throw error for invalid formatting positions', () => {
      const paragraph: StructuredParagraph = {
        text: 'Short text',
        formatting: [
          {
            start: 0,
            end: 20, // Exceeds text length
            type: 'bold',
            text: 'Wrong'
          }
        ]
      }
      
      expect(() => processor.processParagraph(paragraph, 0)).toThrow(LaTeXProcessingError)
    })

    it('should throw error for mismatched formatting text', () => {
      const paragraph: StructuredParagraph = {
        text: 'Test text',
        formatting: [
          {
            start: 0,
            end: 4,
            type: 'bold',
            text: 'Wrong' // Should be 'Test'
          }
        ]
      }
      
      expect(() => processor.processParagraph(paragraph, 0)).toThrow(LaTeXProcessingError)
    })
  })

  describe('Factory Functions', () => {
    it('should create default LaTeX processor', () => {
      const processor = createLatexProcessor()
      const config = processor.getConfig()
      
      expect(config.escapeSpecialChars).toBe(true)
      expect(config.chapterNumbering).toBe(true)
    })

    it('should create LaTeX processor with custom config', () => {
      const processor = createLatexProcessor({
        escapeSpecialChars: false,
        enableHyperlinks: false
      })
      
      const config = processor.getConfig()
      expect(config.escapeSpecialChars).toBe(false)
      expect(config.enableHyperlinks).toBe(false)
    })

    it('should create book-optimized processor', () => {
      const processor = createBookLatexProcessor()
      const config = processor.getConfig()
      
      expect(config.chapterNumbering).toBe(true)
      expect(config.paragraphIndentation).toBe(true)
      expect(config.enableHyperlinks).toBe(true)
    })

    it('should create article-optimized processor', () => {
      const processor = createArticleLatexProcessor()
      const config = processor.getConfig()
      
      expect(config.chapterNumbering).toBe(false)
      expect(config.paragraphIndentation).toBe(false)
      expect(config.enableHyperlinks).toBe(true)
    })
  })

  describe('Complete Document Generation', () => {
    let processor: LaTeXProcessor

    beforeEach(() => {
      processor = new LaTeXProcessor()
    })

    it('should generate complete document with metadata', () => {
      const latex = processor.generateCompleteDocument(mockBookContent, true)
      
      expect(latex).toContain('% Book: Test Book Title')
      expect(latex).toContain('\\chapter{The Beginning}')
      expect(latex).toContain('\\chapter{The Development}')
    })

    it('should generate complete document without metadata', () => {
      const latex = processor.generateCompleteDocument(mockBookContent, false)
      
      expect(latex).not.toContain('% Book: Test Book Title')
      expect(latex).toContain('\\chapter{The Beginning}')
      expect(latex).toContain('\\chapter{The Development}')
    })

    it('should validate content before processing', () => {
      const invalidContent = {
        title: '',
        author: '',
        chapters: []
      } as unknown as StructuredBookContent
      
      expect(() => processor.generateCompleteDocument(invalidContent)).toThrow(LaTeXProcessingError)
    })
  })

  describe('Paragraph Indentation', () => {
    it('should add indentation to non-first paragraphs when enabled', () => {
      const processor = new LaTeXProcessor({
        paragraphIndentation: true
      })
      
      const paragraph: StructuredParagraph = {
        text: 'Second paragraph',
        formatting: []
      }
      
      const latex = processor.processParagraph(paragraph, 1) // index 1 = second paragraph
      expect(latex).toContain('\\indent Second paragraph')
    })

    it('should not add indentation to first paragraph', () => {
      const processor = new LaTeXProcessor({
        paragraphIndentation: true
      })
      
      const paragraph: StructuredParagraph = {
        text: 'First paragraph',
        formatting: []
      }
      
      const latex = processor.processParagraph(paragraph, 0) // index 0 = first paragraph
      expect(latex).not.toContain('\\indent')
      expect(latex).toBe('First paragraph')
    })

    it('should not add indentation when disabled', () => {
      const processor = new LaTeXProcessor({
        paragraphIndentation: false
      })
      
      const paragraph: StructuredParagraph = {
        text: 'Any paragraph',
        formatting: []
      }
      
      const latex = processor.processParagraph(paragraph, 5)
      expect(latex).not.toContain('\\indent')
      expect(latex).toBe('Any paragraph')
    })
  })
})