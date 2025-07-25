/**
 * Tests for LaTeX Template Engine
 * 
 * These tests verify the LaTeX template generation functionality
 * Requirements tested: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 5.1, 5.2, 5.3, 5.4
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  LaTeXTemplateEngine,
  LaTeXTemplateConfig,
  DEFAULT_BOOK_TEMPLATE,
  COMPACT_BOOK_TEMPLATE,
  createLatexTemplateEngine,
  createCompactBookTemplate
} from '../latexTemplateEngine'
import { StructuredBookContent } from '../structuredContent'

describe('LaTeX Template Engine', () => {
  const mockBookContent: StructuredBookContent = {
    title: 'Test Book Title',
    author: 'Test Author',
    genre: 'Fiction',
    plotSummary: 'A compelling story about testing LaTeX generation.',
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

  describe('LaTeXTemplateEngine Class', () => {
    it('should initialize with default configuration', () => {
      const engine = new LaTeXTemplateEngine()
      const config = engine.getConfig()
      
      expect(config.documentClass).toBe('book')
      expect(config.fontSize).toBe('12pt')
      expect(config.fonts.bodySize).toBe('12pt')
      expect(config.fonts.chapterSize).toBe('16pt')
      expect(config.fonts.main).toBe('Times New Roman')
    })

    it('should initialize with custom configuration', () => {
      const customConfig: Partial<LaTeXTemplateConfig> = {
        fontSize: '11pt',
        fonts: {
          main: 'Arial',
          chapter: 'Arial',
          bodySize: '11pt',
          chapterSize: '14pt'
        }
      }
      
      const engine = new LaTeXTemplateEngine({ ...DEFAULT_BOOK_TEMPLATE, ...customConfig })
      const config = engine.getConfig()
      
      expect(config.fontSize).toBe('11pt')
      expect(config.fonts.main).toBe('Arial')
      expect(config.fonts.bodySize).toBe('11pt')
      expect(config.fonts.chapterSize).toBe('14pt')
    })

    it('should update configuration', () => {
      const engine = new LaTeXTemplateEngine()
      
      engine.updateConfig({
        fontSize: '14pt',
        margins: {
          top: '1.5in',
          bottom: '1.5in',
          left: '1.5in',
          right: '1.5in'
        }
      })
      
      const config = engine.getConfig()
      expect(config.fontSize).toBe('14pt')
      expect(config.margins.top).toBe('1.5in')
    })
  })

  describe('LaTeX Generation', () => {
    let engine: LaTeXTemplateEngine

    beforeEach(() => {
      engine = new LaTeXTemplateEngine()
    })

    it('should generate complete LaTeX document', () => {
      const latex = engine.generateDocument(mockBookContent)
      
      expect(latex).toContain('\\documentclass[12pt,letterpaper]{book}')
      expect(latex).toContain('\\begin{document}')
      expect(latex).toContain('\\end{document}')
      expect(latex).toContain('Test Book Title')
      expect(latex).toContain('Test Author')
      expect(latex).toContain('The Beginning')
      expect(latex).toContain('The Development')
    })

    it('should include essential LaTeX packages', () => {
      const latex = engine.generateDocument(mockBookContent)
      
      expect(latex).toContain('\\usepackage[utf8]{inputenc}')
      expect(latex).toContain('\\usepackage[T1]{fontenc}')
      expect(latex).toContain('\\usepackage{mathptmx}') // Times New Roman
      expect(latex).toContain(']{geometry}') // geometry package with parameters
      expect(latex).toContain(']{hyperref}')
      expect(latex).toContain('\\usepackage{fancyhdr}')
      expect(latex).toContain('\\usepackage{titlesec}')
    })

    it('should configure proper margins', () => {
      const latex = engine.generateDocument(mockBookContent)
      
      expect(latex).toContain('top=1in')
      expect(latex).toContain('bottom=1in')
      expect(latex).toContain('left=1.25in')
      expect(latex).toContain('right=1in')
    })

    it('should configure Times New Roman font (12pt body, 16pt chapters)', () => {
      const latex = engine.generateDocument(mockBookContent)
      
      expect(latex).toContain('\\documentclass[12pt,letterpaper]{book}')
      expect(latex).toContain('\\usepackage{mathptmx}') // Times New Roman equivalent
    })

    it('should include table of contents with hyperlinks', () => {
      const latex = engine.generateDocument(mockBookContent)
      
      expect(latex).toContain('\\tableofcontents')
      expect(latex).toContain('colorlinks=true')
      expect(latex).toContain('bookmarks=true')
    })

    it('should include professional title page', () => {
      const latex = engine.generateDocument(mockBookContent)
      
      expect(latex).toContain('\\begin{titlepage}')
      expect(latex).toContain('\\end{titlepage}')
      expect(latex).toContain('Test Book Title')
      expect(latex).toContain('by Test Author')
      expect(latex).toContain('Genre: Fiction')
      expect(latex).toContain('A compelling story about testing LaTeX generation.')
    })

    it('should include page numbering and headers', () => {
      const latex = engine.generateDocument(mockBookContent)
      
      expect(latex).toContain('\\pagestyle{fancy}')
      expect(latex).toContain('\\fancyhead[LE,RO]{\\thepage}')
      expect(latex).toContain('\\pagenumbering{roman}')
      expect(latex).toContain('\\pagenumbering{arabic}')
    })

    it('should format chapters properly', () => {
      const latex = engine.generateDocument(mockBookContent)
      
      expect(latex).toContain('\\chapter{The Beginning}')
      expect(latex).toContain('\\chapter{The Development}')
      expect(latex).toContain('\\label{chap:1}')
      expect(latex).toContain('\\label{chap:2}')
    })
  })

  describe('Text Formatting', () => {
    let engine: LaTeXTemplateEngine

    beforeEach(() => {
      engine = new LaTeXTemplateEngine()
    })

    it('should handle bold formatting', () => {
      const latex = engine.generateDocument(mockBookContent)
      
      expect(latex).toContain('\\textbf{bold}')
    })

    it('should handle italic formatting', () => {
      const latex = engine.generateDocument(mockBookContent)
      
      expect(latex).toContain('\\textit{italic}')
    })

    it('should handle bold-italic formatting', () => {
      const latex = engine.generateDocument(mockBookContent)
      
      expect(latex).toContain('\\textbf{\\textit{bold-italic}}')
    })

    it('should escape special LaTeX characters', () => {
      const testContent: StructuredBookContent = {
        title: 'Test & Special Characters',
        author: 'Author with $ symbols',
        genre: 'Fiction',
        plotSummary: 'A story with % and # symbols.',
        chapters: [
          {
            number: 1,
            title: 'Chapter with _ and ^ symbols',
            paragraphs: [
              {
                text: 'Text with special characters: & % $ # _ ^ ~ { }',
                formatting: []
              }
            ]
          }
        ]
      }
      
      const latex = engine.generateDocument(testContent)
      
      expect(latex).toContain('Test \\& Special Characters')
      expect(latex).toContain('Author with \\$ symbols')
      expect(latex).toContain('A story with \\% and \\# symbols.')
      expect(latex).toContain('Chapter with \\_ and \\textasciicircum\\{\\} symbols')
      expect(latex).toContain('\\& \\% \\$ \\# \\_ \\textasciicircum\\{\\} \\textasciitilde\\{\\} \\{ \\}')
    })
  })

  describe('Template Configurations', () => {
    it('should use default book template configuration', () => {
      expect(DEFAULT_BOOK_TEMPLATE.documentClass).toBe('book')
      expect(DEFAULT_BOOK_TEMPLATE.fontSize).toBe('12pt')
      expect(DEFAULT_BOOK_TEMPLATE.paperSize).toBe('letterpaper')
      expect(DEFAULT_BOOK_TEMPLATE.fonts.bodySize).toBe('12pt')
      expect(DEFAULT_BOOK_TEMPLATE.fonts.chapterSize).toBe('16pt')
      expect(DEFAULT_BOOK_TEMPLATE.margins.left).toBe('1.25in')
      expect(DEFAULT_BOOK_TEMPLATE.toc.enabled).toBe(true)
      expect(DEFAULT_BOOK_TEMPLATE.toc.hyperlinks).toBe(true)
    })

    it('should use compact book template configuration', () => {
      expect(COMPACT_BOOK_TEMPLATE.paperSize).toBe('[5in,8in]')
      expect(COMPACT_BOOK_TEMPLATE.fonts.bodySize).toBe('11pt')
      expect(COMPACT_BOOK_TEMPLATE.fonts.chapterSize).toBe('14pt')
      expect(COMPACT_BOOK_TEMPLATE.margins.top).toBe('0.75in')
      expect(COMPACT_BOOK_TEMPLATE.margins.left).toBe('0.75in')
    })

    it('should generate compact book template', () => {
      const engine = createCompactBookTemplate()
      const latex = engine.generateDocument(mockBookContent)
      
      expect(latex).toContain('[5in,8in]')
      expect(latex).toContain('top=0.75in')
      expect(latex).toContain('left=0.75in')
    })
  })

  describe('Factory Functions', () => {
    it('should create default LaTeX template engine', () => {
      const engine = createLatexTemplateEngine()
      const config = engine.getConfig()
      
      expect(config.documentClass).toBe('book')
      expect(config.fontSize).toBe('12pt')
    })

    it('should create LaTeX template engine with custom config', () => {
      const customConfig = {
        fontSize: '14pt',
        margins: { top: '2in', bottom: '2in', left: '2in', right: '2in' }
      }
      
      const engine = createLatexTemplateEngine(customConfig)
      const config = engine.getConfig()
      
      expect(config.fontSize).toBe('14pt')
      expect(config.margins.top).toBe('2in')
    })

    it('should create compact book template engine', () => {
      const engine = createCompactBookTemplate()
      const config = engine.getConfig()
      
      expect(config.paperSize).toBe('[5in,8in]')
      expect(config.fonts.bodySize).toBe('11pt')
    })
  })

  describe('Minimal Template Generation', () => {
    it('should generate minimal LaTeX template for testing', () => {
      const engine = new LaTeXTemplateEngine()
      const latex = engine.generateMinimalTemplate(
        'Test Title',
        'Test Author',
        'Test content with special characters: & % $'
      )
      
      expect(latex).toContain('\\documentclass[12pt,letterpaper]{article}')
      expect(latex).toContain('\\title{Test Title}')
      expect(latex).toContain('\\author{Test Author}')
      expect(latex).toContain('Test content with special characters: \\& \\% \\$')
      expect(latex).toContain('\\begin{document}')
      expect(latex).toContain('\\maketitle')
      expect(latex).toContain('\\end{document}')
    })
  })

  describe('Professional Typography Features', () => {
    let engine: LaTeXTemplateEngine

    beforeEach(() => {
      engine = new LaTeXTemplateEngine()
    })

    it('should include microtype for better typography', () => {
      const latex = engine.generateDocument(mockBookContent)
      
      expect(latex).toContain('\\usepackage{microtype}')
    })

    it('should prevent widows and orphans', () => {
      const latex = engine.generateDocument(mockBookContent)
      
      expect(latex).toContain('\\widowpenalty=10000')
      expect(latex).toContain('\\clubpenalty=10000')
    })

    it('should include proper line spacing configuration', () => {
      const latex = engine.generateDocument(mockBookContent)
      
      expect(latex).toContain('\\usepackage[1.2]{setspace}')
      expect(latex).toContain('\\setlength{\\parskip}{0.5em}')
      expect(latex).toContain('\\setlength{\\parindent}{1.5em}')
    })

    it('should include chapter formatting with proper spacing', () => {
      const latex = engine.generateDocument(mockBookContent)
      
      expect(latex).toContain('\\usepackage{titlesec}')
      expect(latex).toContain('\\titleformat{\\chapter}[display]')
      expect(latex).toContain('\\titlespacing*{\\chapter}')
    })

    it('should include PDF metadata', () => {
      const latex = engine.generateDocument(mockBookContent)
      
      expect(latex).toContain('\\hypersetup{')
      expect(latex).toContain('pdftitle={BOOK_TITLE_PLACEHOLDER}')
      expect(latex).toContain('pdfauthor={BOOK_AUTHOR_PLACEHOLDER}')
      expect(latex).toContain('pdfsubject={BOOK_GENRE_PLACEHOLDER}')
    })
  })

  describe('Error Handling', () => {
    it('should handle empty chapters gracefully', () => {
      const emptyContent: StructuredBookContent = {
        title: 'Empty Book',
        author: 'Test Author',
        genre: 'Fiction',
        plotSummary: 'A book with no content.',
        chapters: []
      }
      
      const engine = new LaTeXTemplateEngine()
      const latex = engine.generateDocument(emptyContent)
      
      expect(latex).toContain('\\begin{document}')
      expect(latex).toContain('\\end{document}')
      expect(latex).toContain('Empty Book')
    })

    it('should handle chapters with no paragraphs', () => {
      const contentWithEmptyChapter: StructuredBookContent = {
        title: 'Test Book',
        author: 'Test Author',
        genre: 'Fiction',
        plotSummary: 'Test summary.',
        chapters: [
          {
            number: 1,
            title: 'Empty Chapter',
            paragraphs: []
          }
        ]
      }
      
      const engine = new LaTeXTemplateEngine()
      const latex = engine.generateDocument(contentWithEmptyChapter)
      
      expect(latex).toContain('\\chapter{Empty Chapter}')
      expect(latex).toContain('\\label{chap:1}')
    })

    it('should handle paragraphs with no formatting', () => {
      const contentWithPlainText: StructuredBookContent = {
        title: 'Plain Text Book',
        author: 'Test Author',
        genre: 'Fiction',
        plotSummary: 'A book with plain text.',
        chapters: [
          {
            number: 1,
            title: 'Plain Chapter',
            paragraphs: [
              {
                text: 'This is plain text with no formatting.',
                formatting: []
              }
            ]
          }
        ]
      }
      
      const engine = new LaTeXTemplateEngine()
      const latex = engine.generateDocument(contentWithPlainText)
      
      expect(latex).toContain('This is plain text with no formatting.')
      expect(latex).not.toContain('\\textbf')
      expect(latex).not.toContain('\\textit')
    })
  })
})