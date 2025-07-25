import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'
import jsPDF from 'jspdf'

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

// Generate DOCX file from book content
export async function generateDOCX(bookData: BookData): Promise<Buffer> {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Title page
        new Paragraph({
          children: [
            new TextRun({
              text: bookData.title,
              bold: true,
              size: 32,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `by ${bookData.author}`,
              size: 24,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 800 },
        }),
        
        // Genre and summary
        new Paragraph({
          children: [
            new TextRun({
              text: `Genre: ${bookData.genre}`,
              bold: true,
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: bookData.plotSummary,
            }),
          ],
          spacing: { after: 400 },
        }),
        
        // Page break before chapters
        new Paragraph({
          children: [new TextRun({ text: "", break: 1 })],
          pageBreakBefore: true,
        }),
        
        // Table of Contents
        new Paragraph({
          children: [
            new TextRun({
              text: "Table of Contents",
              bold: true,
              size: 24,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 400 },
        }),
        
        // Chapter list
        ...bookData.chapterTitles.map((title, index) => 
          new Paragraph({
            children: [
              new TextRun({
                text: `Chapter ${index + 1}: ${title}`,
              }),
            ],
            spacing: { after: 100 },
          })
        ),
        
        // Page break before content
        new Paragraph({
          children: [new TextRun({ text: "", break: 1 })],
          pageBreakBefore: true,
        }),
        
        // Chapters content
        ...Object.entries(bookData.chapters)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .flatMap(([chapterNum, content]) => [
            new Paragraph({
              children: [
                new TextRun({
                  text: `Chapter ${chapterNum}: ${bookData.chapterTitles[parseInt(chapterNum) - 1] || 'Untitled'}`,
                  bold: true,
                  size: 20,
                }),
              ],
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
              pageBreakBefore: parseInt(chapterNum) > 1,
            }),
            ...content.split('\n\n').map(paragraph => 
              new Paragraph({
                children: [
                  new TextRun({
                    text: paragraph.trim(),
                  }),
                ],
                spacing: { after: 200 },
              })
            ),
          ]),
        
        // Footer
        new Paragraph({
          children: [
            new TextRun({
              text: `Generated by BookMonarch AI on ${new Date(bookData.metadata.generatedAt).toLocaleDateString()}`,
              italics: true,
              size: 16,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 800 },
        }),
      ],
    }],
  })

  return await Packer.toBuffer(doc)
}

// Generate PDF file using LaTeX-based professional typesetting
export async function generatePDF(bookData: BookData): Promise<Buffer> {
  // Import the LaTeX-based PDF generation system
  const { createBookPDFCompiler } = await import('./pdfCompiler')
  const { convertBookDataToStructuredContent } = await import('./structuredContent')
  
  console.log('Converting BookData to StructuredBookContent for LaTeX processing...')
  
  // Convert the BookData format to StructuredBookContent
  const structuredContent = convertBookDataToStructuredContent(bookData)
  
  console.log('Creating LaTeX PDF compiler...')
  
  // Create a book-optimized PDF compiler
  const pdfCompiler = createBookPDFCompiler()
  
  console.log('Compiling structured content to PDF using LaTeX...')
  
  // Compile the structured content to PDF
  const compilationResult = await pdfCompiler.compileBookToPDF(structuredContent)
  
  if (!compilationResult.success || !compilationResult.pdfBuffer) {
    console.error('LaTeX PDF compilation failed:', compilationResult.errors)
    throw new Error(`PDF compilation failed: ${compilationResult.errors.map(e => e.message).join(', ')}`)
  }
  
  console.log(`LaTeX PDF generated successfully: ${compilationResult.outputSize} bytes in ${compilationResult.compilationTime}ms`)
  
  // Log any warnings
  if (compilationResult.warnings.length > 0) {
    console.warn('LaTeX compilation warnings:', compilationResult.warnings)
  }
  
  return compilationResult.pdfBuffer
}

// Fallback jsPDF implementation (kept for backward compatibility)
async function generatePDFWithJsPDF(bookData: BookData): Promise<Buffer> {
  // Import the legacy formatting utilities
  const { createFontManager } = await import('./fontManager')
  const { createTextRenderer } = await import('./textRenderer')
  
  // 5x8 inches in points (72 points per inch)
  const pageWidth = 5 * 72  // 360 points
  const pageHeight = 8 * 72 // 576 points
  
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: [pageWidth, pageHeight],
  })

  const margin = 36 // 0.5 inch margins
  const contentWidth = pageWidth - (margin * 2)
  const bottomMargin = 50 // Space for page numbers
  let yPosition = margin
  let pageNumber = 1

  // Initialize the formatting systems with 12pt body text
  const fontManager = createFontManager()
  const textRenderer = createTextRenderer({
    lineHeight: 18,
    paragraphSpacing: 12,
    indentSize: 20,
    defaultFontSize: 12
  })

  // Helper function to add page numbers (except on title page)
  const addPageNumber = () => {
    if (pageNumber > 1) {
      fontManager.setConsistentFont(pdf, 10, false, false)
      pdf.text(pageNumber.toString(), pageWidth / 2, pageHeight - 20, { align: 'center' })
    }
  }

  // Helper function to check for page breaks and add new page if needed
  const checkPageBreak = (additionalLines: number = 1) => {
    if (textRenderer.needsPageBreak(yPosition, pageHeight, bottomMargin, additionalLines)) {
      addPageNumber()
      pdf.addPage()
      pageNumber++
      yPosition = margin + 20
      return true
    }
    return false
  }

  // Helper function to add centered text with consistent formatting
  const addCenteredText = (text: string, fontSize: number, isBold: boolean = false, isItalic: boolean = false) => {
    fontManager.setConsistentFont(pdf, fontSize, isBold, isItalic)
    pdf.text(text, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += textRenderer.getLineHeight() + 5
  }

  // TITLE PAGE
  yPosition = pageHeight / 2 - 40 // Center vertically
  
  addCenteredText(bookData.title, 24, true)
  yPosition += 20
  addCenteredText(`by ${bookData.author}`, 16, false, true)
  
  // Don't add page number to title page
  pdf.addPage()
  pageNumber++
  yPosition = margin + 20

  // TABLE OF CONTENTS
  addCenteredText('Table of Contents', 18, true)
  yPosition += 20
  
  // Render TOC entries
  bookData.chapterTitles.forEach((title, index) => {
    checkPageBreak()
    
    const chapterNum = index + 1
    const tocEntry = `${chapterNum}. ${title}`
    
    fontManager.setConsistentFont(pdf, 12, false, false)
    const tocLines = pdf.splitTextToSize(tocEntry, contentWidth)
    
    for (const line of tocLines) {
      if (checkPageBreak()) {
        // Page break occurred, continue with new page
      }
      pdf.text(line, margin, yPosition)
      yPosition += textRenderer.getLineHeight()
    }
    
    yPosition += 3 // Small spacing between TOC entries
  })
  
  yPosition += 20
  
  // CHAPTERS
  Object.entries(bookData.chapters)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .forEach(([chapterNum, content]) => {
      // Start new page for each chapter
      addPageNumber()
      pdf.addPage()
      pageNumber++
      yPosition = margin + 20
      
      // Chapter title
      const chapterTitle = bookData.chapterTitles[parseInt(chapterNum) - 1] || `Chapter ${chapterNum}`
      
      fontManager.setConsistentFont(pdf, 16, true, false)
      const titleLines = pdf.splitTextToSize(chapterTitle, contentWidth)
      
      for (const line of titleLines) {
        if (checkPageBreak()) {
          // Page break occurred, continue with new page
        }
        pdf.text(line, margin, yPosition)
        yPosition += textRenderer.getLineHeight()
      }
      
      yPosition += 15 // Extra spacing after chapter title
      
      // Reset font to 12pt normal after chapter title
      fontManager.setConsistentFont(pdf, 12, false, false)
      
      // Chapter content
      const paragraphs = content.split('\n\n').filter(p => p.trim())
      
      paragraphs.forEach(paragraph => {
        const cleanParagraph = paragraph.trim()
        
        // Skip if paragraph starts with chapter number (avoid duplication)
        if (!cleanParagraph.toLowerCase().startsWith(`chapter ${chapterNum}`)) {
          // Check if we need a page break before rendering the paragraph
          const estimatedLines = Math.ceil(cleanParagraph.length / 80)
          if (checkPageBreak(estimatedLines + 1)) {
            // Page break occurred, continue with new page
          }
          
          // Use the text renderer for proper formatting
          yPosition = textRenderer.renderParagraph(
            pdf,
            cleanParagraph,
            margin,
            yPosition,
            contentWidth,
            true // indent paragraphs
          )
        }
      })
    })
  
  // Add final page number
  addPageNumber()
  
  return Buffer.from(pdf.output('arraybuffer'))
}

// Generate EPUB file
export async function generateEPUB(bookData: BookData): Promise<Buffer> {
  // For now, we'll create a simple HTML-based EPUB structure
  // In a full implementation, you'd use a proper EPUB library
  
  const epubContent = `
<!DOCTYPE html>
<html>
<head>
    <title>${bookData.title}</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: serif; line-height: 1.6; margin: 2em; }
        h1 { text-align: center; font-size: 2em; margin-bottom: 1em; }
        h2 { font-size: 1.5em; margin-top: 2em; margin-bottom: 1em; }
        .author { text-align: center; font-size: 1.2em; margin-bottom: 2em; }
        .genre { font-weight: bold; margin-bottom: 1em; }
        .summary { margin-bottom: 2em; font-style: italic; }
        .chapter { page-break-before: always; }
        .footer { text-align: center; font-size: 0.8em; margin-top: 3em; font-style: italic; }
    </style>
</head>
<body>
    <h1>${bookData.title}</h1>
    <div class="author">by ${bookData.author}</div>
    
    <div class="genre">Genre: ${bookData.genre}</div>
    <div class="summary">${bookData.plotSummary}</div>
    
    <h2>Table of Contents</h2>
    <ul>
        ${bookData.chapterTitles.map((title, index) => 
          `<li>Chapter ${index + 1}: ${title}</li>`
        ).join('')}
    </ul>
    
    ${Object.entries(bookData.chapters)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([chapterNum, content]) => `
        <div class="chapter">
            <h2>Chapter ${chapterNum}: ${bookData.chapterTitles[parseInt(chapterNum) - 1] || 'Untitled'}</h2>
            ${content.split('\n\n').map(paragraph => 
              `<p>${paragraph.trim().replace(/\n/g, '<br>')}</p>`
            ).join('')}
        </div>
      `).join('')}
    
    <div class="footer">
        Generated by BookMonarch AI on ${new Date(bookData.metadata.generatedAt).toLocaleDateString()}
    </div>
</body>
</html>
  `
  
  // For now, return HTML as buffer (in production, use proper EPUB generation)
  return Buffer.from(epubContent, 'utf-8')
}

// Helper function to extract book data from the stored format
export function extractBookData(contentUrl: string): BookData | null {
  try {
    const bookContent = JSON.parse(contentUrl)
    
    if (bookContent.completeBook && bookContent.metadata && bookContent.outline && bookContent.structuredChapters) {
      // Convert structuredChapters array to legacy BookData format
      const chapters: { [key: number]: string } = {}
      
      bookContent.structuredChapters.forEach((chapter: any) => {
        if (chapter.chapterNumber && chapter.sections) {
          // Combine all sections into a single chapter content string
          const chapterContent = chapter.sections
            .map((section: any) => section.content)
            .join('\n\n')
          chapters[chapter.chapterNumber] = chapterContent
        }
      })
      
      if (Object.keys(chapters).length === 0) {
        console.error('No valid chapters found in structuredChapters')
        return null
      }
      
      return {
        title: bookContent.outline.title,
        author: bookContent.outline.author,
        genre: bookContent.outline.genre,
        plotSummary: bookContent.outline.plotSummary,
        chapterTitles: bookContent.outline.chapterTitles,
        chapters: chapters,
        metadata: bookContent.metadata
      }
    }
    
    console.error('Missing required properties in book content:', {
      hasCompleteBook: !!bookContent.completeBook,
      hasMetadata: !!bookContent.metadata,
      hasOutline: !!bookContent.outline,
      hasStructuredChapters: !!bookContent.structuredChapters
    })
    return null
  } catch (error) {
    console.error('Error extracting book data:', error)
    return null
  }
}