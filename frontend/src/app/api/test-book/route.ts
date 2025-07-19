import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET() {
  try {
    // Read the test book file
    const filePath = join(process.cwd(), 'test-book-sample.md')
    const content = await readFile(filePath, 'utf8')
    
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain',
      },
    })
  } catch (error) {
    console.error('Error reading test book:', error)
    return NextResponse.json(
      { error: 'Failed to load test book' },
      { status: 500 }
    )
  }
}