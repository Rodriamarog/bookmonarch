/**
 * LaTeX Template Engine
 * 
 * This module creates professional book templates using LaTeX for publication-quality PDFs.
 * It replaces the unreliable jsPDF approach with proper typesetting.
 * 
 * Requirements addressed: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 5.1, 5.2, 5.3, 5.4
 */

import { StructuredBookContent } from './structuredContent'

// LaTeX template configuration
export interface LaTeXTemplateConfig {
  documentClass: string
  fontSize: string
  paperSize: string
  margins: {
    top: string
    bottom: string
    left: string
    right: string
  }
  fonts: {
    main: string
    chapter: string
    bodySize: string
    chapterSize: string
  }
  spacing: {
    lineSpacing: string
    paragraphSpacing: string
    chapterSpacing: string
  }
  toc: {
    enabled: boolean
    hyperlinks: boolean
    depth: number
  }
  headers: {
    enabled: boolean
    style: string
  }
  pageNumbers: {
    enabled: boolean
    style: string
    startPage: number
  }
}

// Default professional book template configuration
export const DEFAULT_BOOK_TEMPLATE: LaTeXTemplateConfig = {
  documentClass: 'book',
  fontSize: '12pt',
  paperSize: 'letterpaper',
  margins: {
    top: '1in',
    bottom: '1in',
    left: '1.25in',
    right: '1in'
  },
  fonts: {
    main: 'Times New Roman',
    chapter: 'Times New Roman',
    bodySize: '12pt',
    chapterSize: '16pt'
  },
  spacing: {
    lineSpacing: '1.2',
    paragraphSpacing: '0.5em',
    chapterSpacing: '2em'
  },
  toc: {
    enabled: true,
    hyperlinks: true,
    depth: 2
  },
  headers: {
    enabled: true,
    style: 'fancy'
  },
  pageNumbers: {
    enabled: true,
    style: 'arabic',
    startPage: 1
  }
}

// 5x8 inch book template configuration (for compact books)
export const COMPACT_BOOK_TEMPLATE: LaTeXTemplateConfig = {
  ...DEFAULT_BOOK_TEMPLATE,
  paperSize: '[5in,8in]',
  margins: {
    top: '0.75in',
    bottom: '0.75in',
    left: '0.75in',
    right: '0.5in'
  },
  fonts: {
    main: 'Times New Roman',
    chapter: 'Times New Roman',
    bodySize: '11pt',
    chapterSize: '14pt'
  }
}

/**
 * LaTeX Template Engine class for generating professional book templates
 */
export class LaTeXTemplateEngine {
  private config: LaTeXTemplateConfig

  constructor(config: LaTeXTemplateConfig = DEFAULT_BOOK_TEMPLATE) {
    this.config = config
  }

  /**
   * Generate complete LaTeX document from structured book content
   */
  generateDocument(bookContent: StructuredBookContent): string {
    const latex = [
      this.generatePreamble(),
      this.generateTitlePage(bookContent),
      this.generateTableOfContents(),
      this.generateChapters(bookContent),
      this.generateEndMatter(),
      '\\end{document}'
    ].join('\n\n')

    return latex
  }

  /**
   * Generate LaTeX preamble with all necessary packages and configurations
   */
  private generatePreamble(): string {
    const preamble = [
      `\\documentclass[${this.config.fontSize},${this.config.paperSize}]{${this.config.documentClass}}`,
      '',
      '% Essential packages for professional typography',
      '\\usepackage[utf8]{inputenc}',
      '\\usepackage[T1]{fontenc}',
      '\\usepackage{lmodern}',
      '\\usepackage{microtype}',
      '',
      '% Page layout and margins',
      '\\usepackage[',
      `  top=${this.config.margins.top},`,
      `  bottom=${this.config.margins.bottom},`,
      `  left=${this.config.margins.left},`,
      `  right=${this.config.margins.right}`,
      ']{geometry}',
      '',
      '% Font configuration - Times New Roman equivalent',
      '\\usepackage{mathptmx}',
      '\\usepackage[scaled=0.9]{helvet}',
      '\\usepackage{courier}',
      '',
      '% Line spacing and paragraph formatting',
      `\\usepackage[${this.config.spacing.lineSpacing}]{setspace}`,
      `\\setlength{\\parskip}{${this.config.spacing.paragraphSpacing}}`,
      '\\setlength{\\parindent}{1.5em}',
      '',
      '% Headers and footers',
      '\\usepackage{fancyhdr}',
      '\\pagestyle{fancy}',
      '\\fancyhf{}',
      '\\fancyhead[LE,RO]{\\thepage}',
      '\\fancyhead[LO]{\\nouppercase{\\rightmark}}',
      '\\fancyhead[RE]{\\nouppercase{\\leftmark}}',
      '\\renewcommand{\\headrulewidth}{0.4pt}',
      '',
      '% Table of contents with hyperlinks',
      '\\usepackage[',
      '  colorlinks=true,',
      '  linkcolor=black,',
      '  urlcolor=blue,',
      '  citecolor=black,',
      '  bookmarks=true,',
      '  bookmarksopen=true,',
      '  bookmarksnumbered=true,',
      '  pdfstartview=FitH',
      ']{hyperref}',
      '',
      '% Chapter formatting',
      '\\usepackage{titlesec}',
      '\\titleformat{\\chapter}[display]',
      `  {\\normalfont\\huge\\bfseries\\centering}`,
      '  {\\chaptertitlename\\ \\thechapter}',
      '  {20pt}',
      `  {\\Huge}`,
      `\\titlespacing*{\\chapter}{0pt}{${this.config.spacing.chapterSpacing}}{${this.config.spacing.chapterSpacing}}`,
      '',
      '% Prevent widows and orphans',
      '\\widowpenalty=10000',
      '\\clubpenalty=10000',
      '',
      '% Better handling of figures and tables',
      '\\usepackage{float}',
      '\\usepackage{graphicx}',
      '',
      '% Enhanced list formatting',
      '\\usepackage{enumitem}',
      '',
      '% Better quote environments',
      '\\usepackage{csquotes}',
      '',
      '% Document metadata',
      `\\hypersetup{`,
      `  pdftitle={BOOK_TITLE_PLACEHOLDER},`,
      `  pdfauthor={BOOK_AUTHOR_PLACEHOLDER},`,
      `  pdfsubject={BOOK_GENRE_PLACEHOLDER},`,
      `  pdfkeywords={book, literature, AI-generated}`,
      `}`,
      '',
      '\\begin{document}'
    ]

    return preamble.join('\n')
  }

  /**
   * Generate professional title page
   */
  private generateTitlePage(bookContent: StructuredBookContent): string {
    const titlePage = [
      '% Title page',
      '\\begin{titlepage}',
      '\\centering',
      '\\vspace*{2cm}',
      '',
      `{\\Huge\\bfseries ${this.escapeLatex(bookContent.title)}\\par}`,
      '\\vspace{1.5cm}',
      `{\\Large\\itshape by ${this.escapeLatex(bookContent.author)}\\par}`,
      '\\vspace{2cm}',
      '',
      `{\\large Genre: ${this.escapeLatex(bookContent.genre)}\\par}`,
      '\\vspace{1cm}',
      '',
      '\\begin{quote}',
      `\\itshape ${this.escapeLatex(bookContent.plotSummary)}`,
      '\\end{quote}',
      '',
      '\\vfill',
      '',
      `{\\small Generated by BookMonarch AI on \\today\\par}`,
      '',
      '\\end{titlepage}',
      '',
      '% Clear page and reset page numbering',
      '\\cleardoublepage',
      '\\pagenumbering{roman}',
      '\\setcounter{page}{1}'
    ]

    return titlePage.join('\n')
  }

  /**
   * Generate table of contents with hyperlinks
   */
  private generateTableOfContents(): string {
    if (!this.config.toc.enabled) {
      return ''
    }

    const toc = [
      '% Table of contents',
      '\\tableofcontents',
      '\\cleardoublepage',
      '',
      '% Start main content with arabic page numbers',
      '\\pagenumbering{arabic}',
      '\\setcounter{page}{1}'
    ]

    return toc.join('\n')
  }

  /**
   * Generate all chapters with proper formatting
   */
  private generateChapters(bookContent: StructuredBookContent): string {
    const chapters = bookContent.chapters.map((chapter, index) => {
      return this.generateChapter(chapter, index === 0)
    })

    return chapters.join('\n\n')
  }

  /**
   * Generate a single chapter with proper formatting
   */
  private generateChapter(chapter: any, isFirstChapter: boolean = false): string {
    const chapterContent = [
      `% Chapter ${chapter.number}: ${chapter.title}`,
      isFirstChapter ? '' : '\\cleardoublepage',
      `\\chapter{${this.escapeLatex(chapter.title)}}`,
      '\\label{chap:' + chapter.number + '}',
      ''
    ]

    // Process paragraphs with formatting
    chapter.paragraphs.forEach((paragraph: any) => {
      const formattedText = this.processTextFormatting(paragraph.text, paragraph.formatting)
      chapterContent.push(formattedText)
      chapterContent.push('')
    })

    return chapterContent.join('\n')
  }

  /**
   * Process text formatting (bold, italic, bold-italic) for LaTeX
   */
  private processTextFormatting(text: string, formatting: any[]): string {
    if (!formatting || formatting.length === 0) {
      return this.escapeLatex(text)
    }

    // Sort formatting by start position (descending) to apply from end to beginning
    const sortedFormatting = [...formatting].sort((a, b) => b.start - a.start)

    let result = text

    for (const format of sortedFormatting) {
      const before = result.substring(0, format.start)
      const middle = result.substring(format.start, format.end)
      const after = result.substring(format.end)

      let formattedMiddle: string
      switch (format.type) {
        case 'bold':
          formattedMiddle = `\\textbf{${this.escapeLatex(middle)}}`
          break
        case 'italic':
          formattedMiddle = `\\textit{${this.escapeLatex(middle)}}`
          break
        case 'bold-italic':
          formattedMiddle = `\\textbf{\\textit{${this.escapeLatex(middle)}}}`
          break
        default:
          formattedMiddle = this.escapeLatex(middle)
      }

      result = this.escapeLatex(before) + formattedMiddle + this.escapeLatex(after)
    }

    return result
  }

  /**
   * Generate end matter (if any)
   */
  private generateEndMatter(): string {
    return [
      '% End matter',
      '\\cleardoublepage',
      '\\appendix',
      '',
      '% Optional: Add bibliography, index, etc. here'
    ].join('\n')
  }

  /**
   * Escape special LaTeX characters
   */
  private escapeLatex(text: string): string {
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
   * Update template configuration
   */
  updateConfig(newConfig: Partial<LaTeXTemplateConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Get current template configuration
   */
  getConfig(): LaTeXTemplateConfig {
    return { ...this.config }
  }

  /**
   * Generate minimal LaTeX template for testing
   */
  generateMinimalTemplate(title: string, author: string, content: string): string {
    return [
      '\\documentclass[12pt,letterpaper]{article}',
      '\\usepackage[utf8]{inputenc}',
      '\\usepackage[T1]{fontenc}',
      '\\usepackage{mathptmx}',
      '\\usepackage[top=1in,bottom=1in,left=1.25in,right=1in]{geometry}',
      '\\usepackage{hyperref}',
      '',
      '\\title{' + this.escapeLatex(title) + '}',
      '\\author{' + this.escapeLatex(author) + '}',
      '\\date{\\today}',
      '',
      '\\begin{document}',
      '\\maketitle',
      '',
      this.escapeLatex(content),
      '',
      '\\end{document}'
    ].join('\n')
  }
}

/**
 * Factory function to create LaTeX template engine with default configuration
 */
export function createLatexTemplateEngine(config?: Partial<LaTeXTemplateConfig>): LaTeXTemplateEngine {
  const finalConfig = config ? { ...DEFAULT_BOOK_TEMPLATE, ...config } : DEFAULT_BOOK_TEMPLATE
  return new LaTeXTemplateEngine(finalConfig)
}

/**
 * Factory function to create compact book template engine
 */
export function createCompactBookTemplate(config?: Partial<LaTeXTemplateConfig>): LaTeXTemplateEngine {
  const finalConfig = config ? { ...COMPACT_BOOK_TEMPLATE, ...config } : COMPACT_BOOK_TEMPLATE
  return new LaTeXTemplateEngine(finalConfig)
}