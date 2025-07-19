import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateDOCX, generatePDF, generateEPUB, extractBookData } from '@/lib/fileGeneration'

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
    const format = searchParams.get('format') // docx, pdf, epub
    const userId = searchParams.get('userId')

    if (!bookId || !format || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters: bookId, format, and userId' },
        { status: 400 }
      )
    }

    if (!['docx', 'pdf', 'epub'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Must be docx, pdf, or epub' },
        { status: 400 }
      )
    }

    // Fetch book data from database
    const { data: book, error } = await supabase
      .from('books')
      .select('id, title, author_name, content_url, status')
      .eq('id', bookId)
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('Book fetch error:', error)
      return NextResponse.json(
        { error: 'Book not found or access denied' },
        { status: 404 }
      )
    }

    if (book.status !== 'completed') {
      return NextResponse.json(
        { error: 'Book generation is not yet complete' },
        { status: 400 }
      )
    }

    if (!book.content_url) {
      return NextResponse.json(
        { error: 'Book content not available' },
        { status: 400 }
      )
    }

    // Extract book data
    const bookData = extractBookData(book.content_url)
    if (!bookData) {
      return NextResponse.json(
        { error: 'Invalid book content format' },
        { status: 400 }
      )
    }

    console.log(`Generating ${format.toUpperCase()} file for book ${bookId}`)

    let fileBuffer: Buffer
    let mimeType: string
    let fileExtension: string

    // Generate file based on format
    switch (format) {
      case 'docx':
        fileBuffer = await generateDOCX(bookData)
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        fileExtension = 'docx'
        break
      
      case 'pdf':
        fileBuffer = await generatePDF(bookData)
        mimeType = 'application/pdf'
        fileExtension = 'pdf'
        break
      
      case 'epub':
        fileBuffer = await generateEPUB(bookData)
        mimeType = 'application/epub+zip'
        fileExtension = 'epub'
        break
      
      default:
        return NextResponse.json(
          { error: 'Unsupported format' },
          { status: 400 }
        )
    }

    console.log(`Generated ${format.toUpperCase()} file: ${fileBuffer.length} bytes`)

    // Create filename
    const sanitizedTitle = book.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')
    const filename = `${sanitizedTitle}_by_${book.author_name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}.${fileExtension}`

    // Return file as download
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    })

  } catch (error) {
    console.error('File generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate file' },
      { status: 500 }
    )
  }
}