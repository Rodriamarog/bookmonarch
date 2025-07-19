import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client with service role key for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await params
    const { searchParams } = new URL(request.url)
    const accessToken = searchParams.get('accessToken')
    const userId = searchParams.get('userId')

    if (!bookId) {
      return NextResponse.json(
        { error: 'Book ID is required' },
        { status: 400 }
      )
    }

    // Build query for current schema (authenticated users only for now)
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required: userId must be provided' },
        { status: 401 }
      )
    }

    let query = supabase
      .from('books')
      .select(`
        id,
        title,
        author_name,
        genre,
        writing_style,
        status,
        progress,
        total_chapters,
        created_at,
        error_message,
        plot_summary,
        chapter_titles,
        content_url
      `)
      .eq('id', bookId)
      .eq('user_id', userId)

    const { data: book, error } = await query.single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Book not found or access denied' },
          { status: 404 }
        )
      }
      console.error('Book status fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch book status' },
        { status: 500 }
      )
    }

    // Check if anonymous book has expired
    if (book.is_anonymous && book.expires_at) {
      const expirationDate = new Date(book.expires_at)
      if (expirationDate < new Date()) {
        return NextResponse.json(
          { error: 'Book access has expired' },
          { status: 410 }
        )
      }
    }

    // Calculate estimated time remaining based on progress and status
    let estimatedTimeRemaining: number | undefined
    if (book.status === 'generating' && book.progress < 100) {
      // Rough estimation: 15 chapters * 2 minutes per chapter = 30 minutes total
      const totalEstimatedMinutes = 30
      const remainingProgress = 100 - (book.progress || 0)
      estimatedTimeRemaining = Math.ceil((remainingProgress / 100) * totalEstimatedMinutes)
    }

    // Determine current stage based on progress and status
    let currentStage = 'Initializing...'
    if (book.status === 'failed') {
      currentStage = `Generation failed: ${book.error_message || 'Unknown error'}`
    } else if (book.status === 'completed') {
      currentStage = 'Book generation complete!'
    } else if (book.status === 'chapters_complete') {
      currentStage = 'All chapters generated! Finalizing book...'
    } else if (book.status === 'outline_complete') {
      currentStage = 'Book outline complete. Starting chapter generation...'
    } else if (book.progress <= 10) {
      currentStage = 'Generating book outline...'
    } else if (book.progress >= 80) {
      currentStage = 'Finalizing book content...'
    } else if (book.progress > 10) {
      const currentChapter = Math.floor(((book.progress - 10) / 70) * 15) + 1
      currentStage = `Writing chapter ${currentChapter} of 15...`
    }

    // Parse writing style to extract chapter summaries if available
    let writingStyle = book.writing_style
    let chapterSummaries: string[] | undefined
    
    try {
      if (book.writing_style && book.writing_style.startsWith('{')) {
        const parsedStyle = JSON.parse(book.writing_style)
        writingStyle = parsedStyle.style
        chapterSummaries = parsedStyle.chapterSummaries
      }
    } catch (e) {
      // If parsing fails, use the original writing_style as-is
      writingStyle = book.writing_style
    }

    const response = {
      id: book.id,
      title: book.title,
      author: book.author_name,
      genre: book.genre,
      writingStyle: writingStyle,
      status: book.status,
      progress: book.progress || 0,
      totalChapters: book.total_chapters || 15,
      currentStage,
      estimatedTimeRemaining,
      createdAt: book.created_at,
      plotSummary: book.plot_summary,
      chapterTitles: book.chapter_titles,
      chapterSummaries: chapterSummaries,
      contentUrl: book.content_url,
      isAnonymous: book.is_anonymous,
      expiresAt: book.expires_at,
      errorMessage: book.error_message
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Book status API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Optional: Add PUT method for updating book status (for admin use)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await params
    const body = await request.json()
    const { status, progress, stage, errorMessage } = body

    // This would typically require admin authentication
    // For now, we'll allow it for development purposes
    
    const updateData: any = {}
    if (status) updateData.status = status
    if (typeof progress === 'number') updateData.progress = progress
    if (errorMessage) updateData.error_message = errorMessage

    const { data, error } = await supabase
      .from('books')
      .update(updateData)
      .eq('id', bookId)
      .select()
      .single()

    if (error) {
      console.error('Book status update error:', error)
      return NextResponse.json(
        { error: 'Failed to update book status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      book: data
    })

  } catch (error) {
    console.error('Book status update API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}