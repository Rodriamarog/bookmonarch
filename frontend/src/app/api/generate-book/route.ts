import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { 
  geminiModel, 
  BookGenerationRequest, 
  BookOutline, 
  createOutlinePrompt,
  createChapterPrompt,
  delay,
  GeminiAPIError 
} from '@/lib/gemini'

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

// Async function to handle book generation
async function generateBookAsync(bookId: string, request: BookGenerationRequest) {
  try {
    // Update progress: Starting outline generation
    await updateBookProgress(bookId, 'Creating book outline...', 5)

    console.log(`Starting outline generation for book ${bookId}`)

    // Generate book outline
    const outlinePrompt = createOutlinePrompt(request)
    console.log('Sending outline prompt to Gemini API...')
    
    const outlineResult = await geminiModel.generateContent(outlinePrompt)
    const outlineText = outlineResult.response.text()
    
    console.log('Received outline response from Gemini API')

    // Parse outline JSON with improved error handling
    let outline: BookOutline
    try {
      // Clean the response to extract JSON
      let cleanedText = outlineText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim()
      
      // Find JSON object boundaries
      const startIndex = cleanedText.indexOf('{')
      const lastIndex = cleanedText.lastIndexOf('}')
      
      if (startIndex === -1 || lastIndex === -1) {
        console.error('No JSON boundaries found in response:', cleanedText.substring(0, 200) + '...')
        throw new Error('No JSON object found in outline response')
      }
      
      const jsonString = cleanedText.substring(startIndex, lastIndex + 1)
      
      // Clean up any control characters that might break JSON parsing
      const sanitizedJson = jsonString
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
        .replace(/(?<!\\)\\n/g, '\\n') // Escape unescaped newlines
        .replace(/(?<!\\)\\r/g, '\\r') // Escape unescaped carriage returns
        .replace(/(?<!\\)\\t/g, '\\t') // Escape unescaped tabs
      
      console.log('Attempting to parse JSON outline...')
      outline = JSON.parse(sanitizedJson)
      console.log('Successfully parsed outline JSON')
      
    } catch (parseError) {
      console.error('Outline parsing error:', parseError)
      console.error('Raw AI response (first 500 chars):', outlineText.substring(0, 500))
      
      // Try alternative parsing approach
      try {
        // Look for individual JSON fields if full parsing fails
        const titleMatch = outlineText.match(/"title":\s*"([^"]+)"/);
        const authorMatch = outlineText.match(/"author":\s*"([^"]+)"/);
        const genreMatch = outlineText.match(/"genre":\s*"([^"]+)"/);
        const plotMatch = outlineText.match(/"plotSummary":\s*"([^"]+)"/);
        const styleMatch = outlineText.match(/"writingStyleGuide":\s*"([^"]+)"/);
        const chaptersMatch = outlineText.match(/"chapterTitles":\s*\[(.*?)\]/s);
        const summariesMatch = outlineText.match(/"chapterSummaries":\s*\[(.*?)\]/s);
        
        if (titleMatch && authorMatch && genreMatch && plotMatch && styleMatch && chaptersMatch && summariesMatch) {
          const chapterTitles = chaptersMatch[1]
            .split(',')
            .map(title => title.trim().replace(/^"|"$/g, ''))
            .filter(title => title.length > 0);
          
          const chapterSummaries = summariesMatch[1]
            .split(',')
            .map(summary => summary.trim().replace(/^"|"$/g, ''))
            .filter(summary => summary.length > 0);
          
          outline = {
            title: titleMatch[1],
            author: authorMatch[1],
            genre: genreMatch[1],
            plotSummary: plotMatch[1],
            writingStyleGuide: styleMatch[1],
            chapterTitles: chapterTitles,
            chapterSummaries: chapterSummaries,
            targetWordCount: 15000
          };
          
          console.log('Successfully parsed outline using fallback method');
        } else {
          throw new GeminiAPIError('Failed to parse book outline from AI response using both methods')
        }
      } catch (fallbackError) {
        console.error('Fallback parsing also failed:', fallbackError)
        throw new GeminiAPIError('Failed to parse book outline from AI response')
      }
    }

    // Validate outline structure
    if (!outline.chapterTitles || outline.chapterTitles.length !== 15) {
      console.error('Invalid outline structure:', {
        hasChapterTitles: !!outline.chapterTitles,
        chapterCount: outline.chapterTitles?.length || 0,
        outline: outline
      })
      throw new GeminiAPIError(`Invalid outline: must contain exactly 15 chapter titles, got ${outline.chapterTitles?.length || 0}`)
    }

    if (!outline.chapterSummaries || outline.chapterSummaries.length !== 15) {
      console.error('Invalid outline structure:', {
        hasChapterSummaries: !!outline.chapterSummaries,
        summaryCount: outline.chapterSummaries?.length || 0,
        outline: outline
      })
      throw new GeminiAPIError(`Invalid outline: must contain exactly 15 chapter summaries, got ${outline.chapterSummaries?.length || 0}`)
    }

    // Additional validation
    if (!outline.plotSummary || !outline.writingStyleGuide) {
      throw new GeminiAPIError('Invalid outline: missing plot summary or writing style guide')
    }

    console.log('Outline validation successful, updating database...')

    // Update book with outline data
    const { error: updateError } = await supabase
      .from('books')
      .update({
        plot_summary: outline.plotSummary,
        chapter_titles: outline.chapterTitles,
        // Store chapter summaries in the writing_style field temporarily (we can add a proper field later)
        writing_style: JSON.stringify({
          style: outline.writingStyleGuide,
          chapterSummaries: outline.chapterSummaries
        }),
        progress: 10
      })
      .eq('id', bookId)

    if (updateError) {
      console.error('Database update error:', updateError)
      throw new Error('Failed to save outline to database')
    }

    await updateBookProgress(bookId, 'Outline complete. Starting chapter generation...', 10)
    console.log(`Outline generation completed successfully for book ${bookId}`)

    // TASK 7.2: Generate chapters iteratively
    console.log(`Starting chapter generation for book ${bookId}`)
    
    const chapterContents: { [key: number]: string } = {}
    const progressPerChapter = 70 / 15 // 70% of progress for 15 chapters (10% for outline, 20% for finalization)
    
    for (let chapterNumber = 1; chapterNumber <= 15; chapterNumber++) {
      try {
        console.log(`Generating chapter ${chapterNumber} of 15 for book ${bookId}`)
        
        // Update progress for current chapter
        const currentProgress = 10 + (chapterNumber - 1) * progressPerChapter
        await updateBookProgress(bookId, `Writing chapter ${chapterNumber} of 15...`, currentProgress)
        
        // Create context from previous chapters using outline summaries
        const previousChaptersSummary = chapterNumber > 1 
          ? `Previous chapters summary:\n${outline.chapterSummaries.slice(0, chapterNumber - 1).map((summary, index) => `Chapter ${index + 1}: ${summary}`).join('\n\n')}`
          : ''
        
        // Generate chapter content
        const chapterPrompt = createChapterPrompt(outline, chapterNumber, previousChaptersSummary)
        console.log(`Sending chapter ${chapterNumber} prompt to Gemini API...`)
        
        const chapterResult = await geminiModel.generateContent(chapterPrompt)
        const chapterContent = chapterResult.response.text().trim()
        
        console.log(`Received chapter ${chapterNumber} content (${chapterContent.length} characters)`)
        
        // Validate chapter content
        if (!chapterContent || chapterContent.length < 500) {
          throw new Error(`Chapter ${chapterNumber} content too short: ${chapterContent.length} characters`)
        }
        
        // Store chapter content
        chapterContents[chapterNumber] = chapterContent
        
        console.log(`Chapter ${chapterNumber} generated successfully (${chapterContent.length} chars)`)
        
        // Update database with current progress and chapter content
        await supabase
          .from('books')
          .update({
            progress: currentProgress,
            // Store chapters as JSON for now - in production, use Supabase Storage
            content_url: JSON.stringify(chapterContents)
          })
          .eq('id', bookId)
        
        // Add delay to respect 15 RPM rate limit (4 seconds between requests)
        await delay(4000)
        
      } catch (chapterError) {
        console.error(`Error generating chapter ${chapterNumber}:`, chapterError)
        
        // For now, we'll continue with other chapters rather than failing completely
        // In production, you might want to implement retry logic
        chapterContents[chapterNumber] = `[Chapter ${chapterNumber} generation failed: ${chapterError instanceof Error ? chapterError.message : 'Unknown error'}]`
      }
    }
    
    console.log(`Chapter generation completed for book ${bookId}`)
    
    // Update progress to indicate chapters are complete
    await updateBookProgress(bookId, 'All chapters generated. Finalizing book...', 80)
    
    // Update status to indicate chapters are complete
    await supabase
      .from('books')
      .update({
        status: 'chapters_complete',
        progress: 80
      })
      .eq('id', bookId)

    // TASK 7.3: Finalize and assemble the book
    console.log(`Starting book finalization for book ${bookId}`)
    
    try {
      await updateBookProgress(bookId, 'Compiling book content...', 85)
      
      // Compile all chapters into a complete book markdown
      const completeBook = await assembleCompleteBook(outline, chapterContents, bookId)
      
      await updateBookProgress(bookId, 'Storing final book file...', 90)
      
      // Store the complete book (for now, we'll store as JSON in content_url)
      // In production, this would be uploaded to Supabase Storage
      const finalBookData = {
        outline: outline,
        chapters: chapterContents,
        completeBook: completeBook,
        metadata: {
          totalWords: countTotalWords(chapterContents),
          totalChapters: Object.keys(chapterContents).length,
          generatedAt: new Date().toISOString()
        }
      }
      
      await updateBookProgress(bookId, 'Updating database...', 95)
      
      // Update database with completion status and final content
      await supabase
        .from('books')
        .update({
          status: 'completed',
          progress: 100,
          content_url: JSON.stringify(finalBookData)
        })
        .eq('id', bookId)
      
      await updateBookProgress(bookId, 'Book generation complete!', 100)
      console.log(`Book finalization completed successfully for book ${bookId}`)
      
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

// Helper function to assemble complete book from chapters
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

// Generate access token for anonymous books
function generateAccessToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}