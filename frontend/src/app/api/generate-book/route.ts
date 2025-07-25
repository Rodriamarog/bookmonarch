import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { 
  geminiModel, 
  BookGenerationRequest, 
  BookOutline, 
  ChapterContent,
  createOutlinePrompt,
  createChapterPrompt,
  countWords,
  delay,
  GeminiAPIError 
} from '@/lib/gemini'
import { 
  createStructuredBookPrompt,
  StructuredBookGenerationRequest,
  extractJSONFromResponse,
  validateJSONStructure,
  createRegenerationPrompt
} from '@/lib/structuredPrompts'
import { StructuredBookContent } from '@/lib/structuredContent'

// Initialize Supabase client with service role key for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, author, bookType, writingStyle, userId } = body as BookGenerationRequest

    // Validate required fields
    if (!title?.trim() || !author?.trim() || !bookType?.trim()) {
      return NextResponse.json(
        { error: 'Missing required fields: title, author, and bookType are required' },
        { status: 400 }
      )
    }

    // TEMPORARILY DISABLED: Check daily generation limits if user is authenticated
    // TODO: Re-enable this after testing
    /*
    if (userId) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('subscription_status, books_generated_today, last_generation_date')
        .eq('id', userId)
        .single()

      if (profileError) {
        console.error('Profile fetch error:', profileError)
        return NextResponse.json(
          { error: 'Failed to verify user profile' },
          { status: 500 }
        )
      }

      // Check if we need to reset daily counter
      const today = new Date().toISOString().split('T')[0]
      const lastGenDate = profile.last_generation_date

      let booksGeneratedToday = profile.books_generated_today || 0
      
      if (lastGenDate !== today) {
        // Reset counter for new day
        booksGeneratedToday = 0
        await supabase
          .from('profiles')
          .update({ 
            books_generated_today: 0, 
            last_generation_date: today 
          })
          .eq('id', userId)
      }

      // Check daily limits
      const dailyLimit = profile.subscription_status === 'pro' ? 10 : 1
      if (booksGeneratedToday >= dailyLimit) {
        return NextResponse.json(
          { 
            error: `Daily generation limit reached. ${profile.subscription_status === 'free' ? 'Upgrade to Pro for 10 books per day!' : 'Try again tomorrow!'}`,
            limitReached: true,
            dailyLimit,
            booksGeneratedToday
          },
          { status: 429 }
        )
      }
    }
    */

    // Create book record in database (using current schema)
    const bookData = {
      title: title.trim(),
      author_name: author.trim(),
      genre: bookType.trim(),
      writing_style: writingStyle?.trim() || null,
      user_id: userId, // Required for now until we update schema
      status: 'generating',
      progress: 0,
      total_chapters: 15
    }

    const { data: book, error: bookError } = await supabase
      .from('books')
      .insert(bookData)
      .select()
      .single()

    if (bookError) {
      console.error('Book creation error:', bookError)
      return NextResponse.json(
        { error: 'Failed to create book record' },
        { status: 500 }
      )
    }

    // Start asynchronous book generation
    generateBookAsync(book.id, {
      title: title.trim(),
      author: author.trim(),
      bookType: bookType.trim(),
      writingStyle: writingStyle?.trim(),
      userId,
      isAnonymous: !userId
    }).catch(error => {
      console.error('Async book generation error:', error)
      // Update book status to failed
      supabase
        .from('books')
        .update({ 
          status: 'failed', 
          error_message: error.message || 'Unknown error occurred',
          progress: 0
        })
        .eq('id', book.id)
        .then(() => console.log('Book status updated to failed'))
    })

    // Increment user's daily generation count if authenticated
    if (userId) {
      // First get current count, then increment
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('books_generated_today')
        .eq('id', userId)
        .single()
      
      const newCount = (currentProfile?.books_generated_today || 0) + 1
      
      await supabase
        .from('profiles')
        .update({ 
          books_generated_today: newCount,
          last_generation_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', userId)
    }

    return NextResponse.json({
      success: true,
      bookId: book.id,
      accessToken: book.access_token,
      message: 'Book generation started successfully'
    })

  } catch (error) {
    console.error('Generate book API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Async function to handle book generation using the two-phase approach (outline + structured chapters)
async function generateBookAsync(bookId: string, request: BookGenerationRequest) {
  try {
    // PHASE 1: Generate book outline
    await updateBookProgress(bookId, 'Generating book outline...', 10)
    console.log(`Starting outline generation for book ${bookId}`)

    const outline = await generateBookOutline(request)
    console.log(`Outline generated successfully for book ${bookId}`)

    // Update database with outline data
    const { error: outlineUpdateError } = await supabase
      .from('books')
      .update({
        plot_summary: outline.plotSummary,
        chapter_titles: outline.chapterTitles,
        writing_style: outline.writingStyleGuide,
        progress: 20
      })
      .eq('id', bookId)

    if (outlineUpdateError) {
      console.error('Database outline update error:', outlineUpdateError)
      throw new Error('Failed to save outline to database')
    }

    await updateBookProgress(bookId, 'Outline complete. Generating chapters...', 20)

    // PHASE 2: Generate structured chapters sequentially
    const structuredChapters: ChapterContent[] = []
    let previousChaptersSummary = ""

    for (let chapterNum = 1; chapterNum <= 15; chapterNum++) {
      const chapterProgress = 20 + (chapterNum / 15) * 60 // Progress from 20% to 80%
      await updateBookProgress(bookId, `Generating Chapter ${chapterNum} of 15...`, chapterProgress)
      
      console.log(`Generating structured Chapter ${chapterNum} for book ${bookId}`)
      
      try {
        const chapterContent = await generateStructuredChapterContent(outline, chapterNum, previousChaptersSummary)
        structuredChapters.push(chapterContent)
        
        // Update previous chapters summary for context
        if (previousChaptersSummary) {
          previousChaptersSummary += `\n\nChapter ${chapterNum}: ${chapterContent.summary}`
        } else {
          previousChaptersSummary = `Chapter ${chapterNum}: ${chapterContent.summary}`
        }
        
        console.log(`Chapter ${chapterNum} completed (${chapterContent.wordCount} words)`)
        
        // Add delay between chapters to respect rate limits
        if (chapterNum < 15) {
          await delay(1000) // 1 second delay between chapters
        }
        
      } catch (chapterError) {
        console.error(`Error generating Chapter ${chapterNum}:`, chapterError)
        
        // Try to recover with a simplified chapter
        try {
          console.log(`Attempting simplified generation for Chapter ${chapterNum}`)
          const fallbackContent = await generateFallbackStructuredChapter(outline, chapterNum)
          structuredChapters.push(fallbackContent)
          console.log(`Fallback Chapter ${chapterNum} generated successfully`)
        } catch (fallbackError) {
          console.error(`Fallback generation also failed for Chapter ${chapterNum}:`, fallbackError)
          throw new Error(`Failed to generate Chapter ${chapterNum}: ${chapterError instanceof Error ? chapterError.message : 'Unknown error'}`)
        }
      }
    }

    await updateBookProgress(bookId, 'All chapters generated. Finalizing book...', 80)

    // PHASE 3: Assemble complete book with structured chapters
    console.log(`Starting book assembly for book ${bookId}`)
    
    try {
      await updateBookProgress(bookId, 'Compiling book content...', 85)
      
      const completeBook = await assembleStructuredChaptersBook(outline, structuredChapters, bookId)
      
      await updateBookProgress(bookId, 'Storing final book file...', 90)
      
      // Store the complete book with structured chapters
      const finalBookData = {
        outline: outline,
        structuredChapters: structuredChapters,
        completeBook: completeBook,
        metadata: {
          totalWords: countStructuredChaptersWords(structuredChapters),
          totalChapters: 15,
          generatedAt: new Date().toISOString(),
          structuredChaptersFormat: true
        }
      }
      
      await updateBookProgress(bookId, 'Updating database...', 95)
      
      // Update database with completion status
      await supabase
        .from('books')
        .update({
          status: 'completed',
          progress: 100,
          content_url: JSON.stringify(finalBookData)
        })
        .eq('id', bookId)
      
      await updateBookProgress(bookId, 'Book generation complete!', 100)
      console.log(`Book generation completed successfully for book ${bookId}`)
      
    } catch (finalizationError) {
      console.error(`Error during book finalization for ${bookId}:`, finalizationError)
      
      // If finalization fails, still mark chapters as complete
      await supabase
        .from('books')
        .update({
          status: 'chapters_complete',
          progress: 80,
          error_message: `Finalization failed: ${finalizationError instanceof Error ? finalizationError.message : 'Unknown error'}`
        })
        .eq('id', bookId)
    }

  } catch (error) {
    console.error('Book generation error:', error)
    
    // Update book status to failed
    await supabase
      .from('books')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error occurred',
        progress: 0
      })
      .eq('id', bookId)

    throw error
  }
}

// Helper function to update book progress
async function updateBookProgress(bookId: string, stage: string, progress: number) {
  await supabase
    .from('books')
    .update({
      progress,
      // We'll store the current stage in a separate field when we add it to the schema
    })
    .eq('id', bookId)
}

// Helper function to assemble structured book content
async function assembleStructuredBook(
  bookContent: StructuredBookContent,
  bookId: string
): Promise<string> {
  console.log(`Assembling structured book for ${bookId}`)
  
  // Create the complete book with professional formatting
  let completeBook = ''
  
  // Title Page (centered)
  completeBook += `<div style="text-align: center; font-family: 'Garamond', serif; page-break-after: always; margin-top: 200px;">\n\n`
  completeBook += `# ${bookContent.title}\n\n`
  completeBook += `**${bookContent.author}**\n\n`
  completeBook += `</div>\n\n`
  completeBook += `<div style="page-break-after: always;"></div>\n\n`
  
  // Book Summary Page
  completeBook += `<div style="font-family: 'Garamond', serif; page-break-after: always;">\n\n`
  completeBook += `## About This Book\n\n`
  completeBook += `${bookContent.plotSummary}\n\n`
  completeBook += `</div>\n\n`
  completeBook += `<div style="page-break-after: always;"></div>\n\n`
  
  // Table of Contents
  completeBook += `<div style="font-family: 'Garamond', serif; page-break-after: always;">\n\n`
  completeBook += `## Table of Contents\n\n`
  for (let i = 0; i < bookContent.chapters.length; i++) {
    const chapter = bookContent.chapters[i]
    completeBook += `${chapter.number}. ${chapter.title} ........................... ${i + 4}\n\n`
  }
  completeBook += `</div>\n\n`
  completeBook += `<div style="page-break-after: always;"></div>\n\n`
  
  // Add all chapters with professional formatting
  for (const chapter of bookContent.chapters) {
    // Start new page for each chapter
    completeBook += `<div style="font-family: 'Garamond', serif; page-break-before: always; padding: 40px 0;">\n\n`
    
    // Chapter header
    completeBook += `<div style="text-align: center; margin-bottom: 40px;">\n\n`
    completeBook += `## ${chapter.title}\n\n`
    completeBook += `</div>\n\n`
    
    // Chapter content with proper paragraph spacing and formatting
    for (const paragraph of chapter.paragraphs) {
      let formattedText = paragraph.text
      
      // Apply formatting (bold, italic, bold-italic) in reverse order to maintain positions
      const sortedFormatting = [...paragraph.formatting].sort((a, b) => b.start - a.start)
      
      for (const format of sortedFormatting) {
        const before = formattedText.substring(0, format.start)
        const middle = formattedText.substring(format.start, format.end)
        const after = formattedText.substring(format.end)
        
        let formattedMiddle: string
        switch (format.type) {
          case 'bold':
            formattedMiddle = `**${middle}**`
            break
          case 'italic':
            formattedMiddle = `*${middle}*`
            break
          case 'bold-italic':
            formattedMiddle = `***${middle}***`
            break
          default:
            formattedMiddle = middle
        }
        
        formattedText = before + formattedMiddle + after
      }
      
      completeBook += `${formattedText}\n\n`
    }
    
    completeBook += `</div>\n\n`
    
    // Page number footer (will be handled by CSS)
    completeBook += `<div style="position: fixed; bottom: 20px; width: 100%; text-align: center; font-family: 'Garamond', serif; font-size: 12px; color: #666;">Page ${chapter.number + 3}</div>\n\n`
  }
  
  // Copyright Page (last page)
  completeBook += `<div style="page-break-before: always;"></div>\n\n`
  completeBook += `<div style="font-family: 'Garamond', serif; text-align: center; margin-top: 300px;">\n\n`
  completeBook += `---\n\n`
  completeBook += `Copyright © ${new Date().getFullYear()} ${bookContent.author}\n\n`
  completeBook += `All rights reserved.\n\n`
  completeBook += `No part of this publication may be reproduced, distributed, or transmitted in any form or by any means, including photocopying, recording, or other electronic or mechanical methods, without the prior written permission of the author, except in the case of brief quotations embodied in critical reviews and certain other noncommercial uses permitted by copyright law.\n\n`
  completeBook += `</div>\n\n`
  
  console.log(`Complete structured book assembled: ${completeBook.length} characters`)
  return completeBook
}

// Helper function to count words in structured content
function countStructuredWords(bookContent: StructuredBookContent): number {
  let totalWords = 0
  
  for (const chapter of bookContent.chapters) {
    for (const paragraph of chapter.paragraphs) {
      const words = paragraph.text.trim().split(/\s+/).filter(word => word.length > 0)
      totalWords += words.length
    }
  }
  
  console.log(`Total structured word count: ${totalWords} words`)
  return totalWords
}

// Helper function to assemble complete book from chapters (legacy function - kept for compatibility)
async function assembleCompleteBook(
  outline: BookOutline, 
  chapterContents: { [key: number]: string }, 
  bookId: string
): Promise<string> {
  console.log(`Assembling complete book for ${bookId}`)
  
  // Create the complete book with professional formatting
  let completeBook = ''
  
  // Title Page (centered)
  completeBook += `<div style="text-align: center; font-family: 'Garamond', serif; page-break-after: always; margin-top: 200px;">\n\n`
  completeBook += `# ${outline.title}\n\n`
  completeBook += `**${outline.author}**\n\n`
  completeBook += `</div>\n\n`
  completeBook += `<div style="page-break-after: always;"></div>\n\n`
  
  // Book Summary Page
  completeBook += `<div style="font-family: 'Garamond', serif; page-break-after: always;">\n\n`
  completeBook += `## About This Book\n\n`
  completeBook += `${outline.plotSummary}\n\n`
  completeBook += `</div>\n\n`
  completeBook += `<div style="page-break-after: always;"></div>\n\n`
  
  // Table of Contents
  completeBook += `<div style="font-family: 'Garamond', serif; page-break-after: always;">\n\n`
  completeBook += `## Table of Contents\n\n`
  for (let i = 1; i <= 15; i++) {
    if (outline.chapterTitles[i - 1]) {
      completeBook += `${i}. ${outline.chapterTitles[i - 1]} ........................... ${i + 3}\n\n`
    }
  }
  completeBook += `</div>\n\n`
  completeBook += `<div style="page-break-after: always;"></div>\n\n`
  
  // Add all chapters with professional formatting
  const chapterNumbers = Object.keys(chapterContents).map(Number).sort((a, b) => a - b)
  
  for (const chapterNum of chapterNumbers) {
    const chapterTitle = outline.chapterTitles[chapterNum - 1] || `Chapter ${chapterNum}`
    const chapterContent = chapterContents[chapterNum]
    
    // Start new page for each chapter
    completeBook += `<div style="font-family: 'Garamond', serif; page-break-before: always; padding: 40px 0;">\n\n`
    
    // Chapter header (remove hardcoded numbers, use AI-generated titles)
    completeBook += `<div style="text-align: center; margin-bottom: 40px;">\n\n`
    completeBook += `## ${chapterTitle}\n\n`
    completeBook += `</div>\n\n`
    
    // Chapter content with proper paragraph spacing
    const formattedContent = chapterContent
      .split('\n\n')
      .map(paragraph => paragraph.trim())
      .filter(paragraph => paragraph.length > 0)
      .join('\n\n')
    
    completeBook += `${formattedContent}\n\n`
    completeBook += `</div>\n\n`
    
    // Page number footer (will be handled by CSS)
    completeBook += `<div style="position: fixed; bottom: 20px; width: 100%; text-align: center; font-family: 'Garamond', serif; font-size: 12px; color: #666;">Page ${chapterNum + 3}</div>\n\n`
  }
  
  // Copyright Page (last page)
  completeBook += `<div style="page-break-before: always;"></div>\n\n`
  completeBook += `<div style="font-family: 'Garamond', serif; text-align: center; margin-top: 300px;">\n\n`
  completeBook += `---\n\n`
  completeBook += `Copyright © ${new Date().getFullYear()} ${outline.author}\n\n`
  completeBook += `All rights reserved.\n\n`
  completeBook += `No part of this publication may be reproduced, distributed, or transmitted in any form or by any means, including photocopying, recording, or other electronic or mechanical methods, without the prior written permission of the author, except in the case of brief quotations embodied in critical reviews and certain other noncommercial uses permitted by copyright law.\n\n`
  completeBook += `</div>\n\n`
  
  console.log(`Complete book assembled: ${completeBook.length} characters`)
  return completeBook
}

// Helper function to count total words across all chapters
function countTotalWords(chapterContents: { [key: number]: string }): number {
  let totalWords = 0
  
  for (const chapterContent of Object.values(chapterContents)) {
    if (typeof chapterContent === 'string' && !chapterContent.startsWith('[Chapter')) {
      // Count words (split by whitespace and filter empty strings)
      const words = chapterContent.trim().split(/\s+/).filter(word => word.length > 0)
      totalWords += words.length
    }
  }
  
  console.log(`Total word count: ${totalWords} words`)
  return totalWords
}

// Fallback function to generate simplified book structure when JSON parsing fails
async function generateSimplifiedBook(request: StructuredBookGenerationRequest): Promise<StructuredBookContent> {
  console.log('Attempting simplified book generation as fallback')
  
  // Create a simpler prompt that's more likely to succeed
  const simplePrompt = `Write a ${request.bookType.toLowerCase()} book titled "${request.title}" by ${request.author}.

Create exactly 10 chapters with the following structure for each chapter:
- Chapter number and title
- 5-8 paragraphs of content
- Each paragraph should be 50-100 words

Write in ${request.writingStyle || 'professional and engaging'} style.

Format your response as a simple text with clear chapter divisions using "CHAPTER X:" markers.`

  const result = await geminiModel.generateContent(simplePrompt)
  const text = result.response.text()
  
  // Parse the simple text response into structured format
  const chapters: any[] = []
  const chapterSections = text.split(/CHAPTER \d+:/i).filter(section => section.trim().length > 0)
  
  for (let i = 0; i < Math.min(chapterSections.length, 10); i++) {
    const section = chapterSections[i].trim()
    const lines = section.split('\n').filter(line => line.trim().length > 0)
    
    // First line is likely the chapter title
    const title = lines[0]?.trim() || `Chapter ${i + 1}`
    
    // Rest are paragraphs
    const paragraphs = lines.slice(1).map(line => ({
      text: line.trim(),
      formatting: []
    }))
    
    if (paragraphs.length > 0) {
      chapters.push({
        number: i + 1,
        title: title,
        paragraphs: paragraphs
      })
    }
  }
  
  // Ensure we have at least some chapters
  if (chapters.length === 0) {
    throw new Error('Failed to parse any chapters from simplified generation')
  }
  
  const simplifiedBook: StructuredBookContent = {
    title: request.title,
    author: request.author,
    genre: request.bookType,
    plotSummary: `A ${request.bookType.toLowerCase()} story about ${request.title.toLowerCase()}. This book explores themes and characters in an engaging narrative that will captivate readers from beginning to end.`,
    chapters: chapters
  }
  
  console.log(`Simplified book generated with ${chapters.length} chapters`)
  return simplifiedBook
}

// Helper function to generate book outline (Phase 1)
async function generateBookOutline(request: BookGenerationRequest): Promise<BookOutline> {
  const outlinePrompt = createOutlinePrompt(request)
  
  let attempts = 0
  const maxAttempts = 3
  
  while (attempts < maxAttempts) {
    try {
      attempts++
      console.log(`Outline generation attempt ${attempts} of ${maxAttempts}`)
      
      const result = await geminiModel.generateContent(outlinePrompt)
      const responseText = result.response.text()
      
      console.log('Outline response received, length:', responseText.length)
      console.log('Outline response preview:', responseText.substring(0, 300))
      
      // Extract JSON from response
      const cleanedJson = extractJSONFromResponse(responseText)
      
      if (!validateJSONStructure(cleanedJson)) {
        throw new Error('Invalid JSON structure in outline response')
      }
      
      const outline = JSON.parse(cleanedJson) as BookOutline
      
      // Validate outline structure
      if (!outline.title || !outline.chapterTitles || outline.chapterTitles.length !== 15) {
        throw new Error('Invalid outline structure: missing required fields or incorrect chapter count')
      }
      
      console.log('Outline generated successfully:', {
        title: outline.title,
        chapterCount: outline.chapterTitles.length,
        summaryCount: outline.chapterSummaries?.length || 0
      })
      
      return outline
      
    } catch (error) {
      console.error(`Outline generation attempt ${attempts} failed:`, error)
      
      if (attempts >= maxAttempts) {
        throw new GeminiAPIError(`Failed to generate outline after ${maxAttempts} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
      
      // Wait before retry
      await delay(2000)
    }
  }
  
  throw new GeminiAPIError('Failed to generate outline: maximum attempts exceeded')
}

// Helper function to generate individual structured chapter content (Phase 2)
async function generateStructuredChapterContent(
  outline: BookOutline, 
  chapterNumber: number, 
  previousChaptersSummary: string
): Promise<ChapterContent> {
  const chapterPrompt = createChapterPrompt(outline, chapterNumber, previousChaptersSummary)
  
  let attempts = 0
  const maxAttempts = 3
  
  while (attempts < maxAttempts) {
    try {
      attempts++
      console.log(`Chapter ${chapterNumber} generation attempt ${attempts} of ${maxAttempts}`)
      
      const result = await geminiModel.generateContent(chapterPrompt)
      const responseText = result.response.text()
      
      console.log(`Chapter ${chapterNumber} response received, length:`, responseText.length)
      
      // Extract JSON from response
      const cleanedJson = extractJSONFromResponse(responseText)
      
      if (!validateJSONStructure(cleanedJson)) {
        throw new Error('Invalid JSON structure in chapter response')
      }
      
      const chapterContent = JSON.parse(cleanedJson) as ChapterContent
      
      // Validate chapter structure
      if (!chapterContent.title || !chapterContent.sections || chapterContent.sections.length === 0) {
        throw new Error('Invalid chapter structure: missing required fields')
      }
      
      // Calculate word count from all sections
      let totalWords = 0
      for (const section of chapterContent.sections) {
        const words = countWords(section.content)
        totalWords += words
      }
      chapterContent.wordCount = totalWords
      
      if (totalWords < 400) {
        throw new Error(`Chapter word count too low: ${totalWords} words`)
      }
      
      console.log(`Chapter ${chapterNumber} generated successfully: ${totalWords} words, ${chapterContent.sections.length} sections`)
      
      return chapterContent
      
    } catch (error) {
      console.error(`Chapter ${chapterNumber} generation attempt ${attempts} failed:`, error)
      
      if (attempts >= maxAttempts) {
        throw new GeminiAPIError(`Failed to generate Chapter ${chapterNumber} after ${maxAttempts} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
      
      // Wait before retry
      await delay(1500)
    }
  }
  
  throw new GeminiAPIError(`Failed to generate Chapter ${chapterNumber}: maximum attempts exceeded`)
}

// Helper function to generate fallback structured chapter content
async function generateFallbackStructuredChapter(outline: BookOutline, chapterNumber: number): Promise<ChapterContent> {
  const simplifiedPrompt = `Write Chapter ${chapterNumber} titled "${outline.chapterTitles[chapterNumber - 1]}" for the book "${outline.title}".

Return as JSON with this structure:
{
  "chapterNumber": ${chapterNumber},
  "title": "${outline.chapterTitles[chapterNumber - 1]}",
  "sections": [
    {
      "type": "body",
      "content": "Write 600-800 words of engaging content appropriate for a ${outline.genre.toLowerCase()} book. Use **bold** and *italic* markdown formatting where appropriate."
    }
  ],
  "summary": "Brief summary of what happens in this chapter",
  "keyEvents": ["Key event 1", "Key event 2"],
  "wordCount": 0
}

Generate the chapter now as JSON:`

  const result = await geminiModel.generateContent(simplifiedPrompt)
  const responseText = result.response.text()
  
  const cleanedJson = extractJSONFromResponse(responseText)
  
  if (!validateJSONStructure(cleanedJson)) {
    throw new Error('Fallback chapter generation failed: invalid JSON')
  }
  
  const chapterContent = JSON.parse(cleanedJson) as ChapterContent
  
  // Calculate word count
  let totalWords = 0
  for (const section of chapterContent.sections) {
    totalWords += countWords(section.content)
  }
  chapterContent.wordCount = totalWords
  
  if (totalWords < 300) {
    throw new Error('Fallback chapter generation failed: content too short')
  }
  
  return chapterContent
}

// Helper function to assemble complete book from structured chapters
async function assembleStructuredChaptersBook(
  outline: BookOutline,
  structuredChapters: ChapterContent[],
  bookId: string
): Promise<string> {
  console.log(`Assembling structured chapters book for ${bookId}`)
  
  // Create the complete book with professional formatting
  let completeBook = ''
  
  // Title Page (centered)
  completeBook += `<div style="text-align: center; font-family: 'Garamond', serif; page-break-after: always; margin-top: 200px;">\n\n`
  completeBook += `# ${outline.title}\n\n`
  completeBook += `**${outline.author}**\n\n`
  completeBook += `</div>\n\n`
  completeBook += `<div style="page-break-after: always;"></div>\n\n`
  
  // Book Summary Page
  completeBook += `<div style="font-family: 'Garamond', serif; page-break-after: always;">\n\n`
  completeBook += `## About This Book\n\n`
  completeBook += `${outline.plotSummary}\n\n`
  completeBook += `</div>\n\n`
  completeBook += `<div style="page-break-after: always;"></div>\n\n`
  
  // Table of Contents
  completeBook += `<div style="font-family: 'Garamond', serif; page-break-after: always;">\n\n`
  completeBook += `## Table of Contents\n\n`
  for (let i = 0; i < structuredChapters.length; i++) {
    const chapter = structuredChapters[i]
    completeBook += `${chapter.chapterNumber}. ${chapter.title} ........................... ${i + 4}\n\n`
  }
  completeBook += `</div>\n\n`
  completeBook += `<div style="page-break-after: always;"></div>\n\n`
  
  // Add all chapters with professional formatting
  for (const chapter of structuredChapters) {
    // Start new page for each chapter
    completeBook += `<div style="font-family: 'Garamond', serif; page-break-before: always; padding: 40px 0;">\n\n`
    
    // Chapter header
    completeBook += `<div style="text-align: center; margin-bottom: 40px;">\n\n`
    completeBook += `## ${chapter.title}\n\n`
    if (chapter.subtitle) {
      completeBook += `### ${chapter.subtitle}\n\n`
    }
    completeBook += `</div>\n\n`
    
    // Chapter content from structured sections
    for (const section of chapter.sections) {
      // Convert markdown formatting to HTML/markdown for display
      const formattedContent = section.content
        .replace(/\*\*(.*?)\*\*/g, '**$1**') // Keep bold formatting
        .replace(/\*(.*?)\*/g, '*$1*') // Keep italic formatting
        .replace(/^> (.+)$/gm, '> $1') // Keep blockquotes
        .replace(/^- (.+)$/gm, '- $1') // Keep bullet points
      
      completeBook += `${formattedContent}\n\n`
    }
    
    completeBook += `</div>\n\n`
    
    // Page number footer (will be handled by CSS)
    completeBook += `<div style="position: fixed; bottom: 20px; width: 100%; text-align: center; font-family: 'Garamond', serif; font-size: 12px; color: #666;">Page ${chapter.chapterNumber + 3}</div>\n\n`
  }
  
  // Copyright Page (last page)
  completeBook += `<div style="page-break-before: always;"></div>\n\n`
  completeBook += `<div style="font-family: 'Garamond', serif; text-align: center; margin-top: 300px;">\n\n`
  completeBook += `---\n\n`
  completeBook += `Copyright © ${new Date().getFullYear()} ${outline.author}\n\n`
  completeBook += `All rights reserved.\n\n`
  completeBook += `No part of this publication may be reproduced, distributed, or transmitted in any form or by any means, including photocopying, recording, or other electronic or mechanical methods, without the prior written permission of the author, except in the case of brief quotations embodied in critical reviews and certain other noncommercial uses permitted by copyright law.\n\n`
  completeBook += `</div>\n\n`
  
  console.log(`Complete structured chapters book assembled: ${completeBook.length} characters`)
  return completeBook
}

// Helper function to count words in structured chapters
function countStructuredChaptersWords(structuredChapters: ChapterContent[]): number {
  let totalWords = 0
  
  for (const chapter of structuredChapters) {
    for (const section of chapter.sections) {
      totalWords += countWords(section.content)
    }
  }
  
  console.log(`Total structured chapters word count: ${totalWords} words`)
  return totalWords
}

// Generate access token for anonymous books
function generateAccessToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}