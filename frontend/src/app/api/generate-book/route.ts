import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { 
  geminiModel, 
  BookGenerationRequest, 
  BookOutline, 
  createOutlinePrompt,
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
        
        if (titleMatch && authorMatch && genreMatch && plotMatch && styleMatch && chaptersMatch) {
          const chapterTitles = chaptersMatch[1]
            .split(',')
            .map(title => title.trim().replace(/^"|"$/g, ''))
            .filter(title => title.length > 0);
          
          outline = {
            title: titleMatch[1],
            author: authorMatch[1],
            genre: genreMatch[1],
            plotSummary: plotMatch[1],
            writingStyleGuide: styleMatch[1],
            chapterTitles: chapterTitles,
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
        progress: 10
      })
      .eq('id', bookId)

    if (updateError) {
      console.error('Database update error:', updateError)
      throw new Error('Failed to save outline to database')
    }

    await updateBookProgress(bookId, 'Outline complete. Starting chapter generation...', 10)
    console.log(`Outline generation completed successfully for book ${bookId}`)

    // This is where we'll implement chapter generation in subtasks 7.1, 7.2, 7.3
    // For now, we'll mark the outline generation as complete
    await updateBookProgress(bookId, 'Book outline generated successfully. Chapter generation will be implemented in the next phase.', 15)

    // Update status to indicate outline is complete but full generation is pending
    await supabase
      .from('books')
      .update({
        status: 'outline_complete',
        progress: 15
      })
      .eq('id', bookId)

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

// Generate access token for anonymous books
function generateAccessToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}