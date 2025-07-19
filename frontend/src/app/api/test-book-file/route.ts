import { NextRequest, NextResponse } from 'next/server'
import { generateDOCX, generatePDF, generateEPUB, BookData } from '@/lib/fileGeneration'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') // docx, pdf, epub

    if (!format) {
      return NextResponse.json(
        { error: 'Missing required parameter: format' },
        { status: 400 }
      )
    }

    if (!['docx', 'pdf', 'epub'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Must be docx, pdf, or epub' },
        { status: 400 }
      )
    }

    // For now, let's use hardcoded test data to isolate the issue
    const bookData: BookData = {
      title: "Ultimate Guide To Gaming",
      author: "Smith",
      genre: "Non-fiction",
      plotSummary: "As the guide progresses, it moves into the practical aspects of gaming, offering insights into building and optimizing gaming setups, understanding game design principles, and exploring the psychology behind player engagement.",
      chapterTitles: [
        "Pixels to Polygons: The Genesis of Interactive Entertainment",
        "The Console Wars: A History of Gaming Hardware",
        "Arcades to Online Arenas: The Evolution of Play",
        "Decoding the Genres: A Taxonomy of Gaming Experiences",
        "The Art and Science of Game Design: Crafting Virtual Worlds",
        "Building Your Battle Station: Hardware Essentials for Every Gamer",
        "Mastering the Controls: Input Devices and Ergonomics",
        "The Digital Frontier: Navigating Online Gaming and Connectivity",
        "The Psychology of Play: Why We Game and What Keeps Us Hooked",
        "Beyond the Screen: The Social Fabric of Gaming Communities",
        "The Rise of Esports: From Hobby to Global Spectacle",
        "Gaming's Cultural Footprint: Influence on Media and Society",
        "The Future of Play: Emerging Technologies and Trends",
        "Responsible Gaming: Finding Balance in a Digital World",
        "Your Gaming Journey: Becoming a Discerning Player"
      ],
      chapters: {
        1: "The glow of a cathode-ray tube, the rhythmic click of a joystick, the triumphant fanfare of a synthesized melody – these are the sensory touchstones that define the dawn of a new era. We stand at the precipice of a digital revolution, a world where imagination takes tangible form, and where our interactions with machines transcend mere utility to become engaging, often exhilarating, experiences. This is the world of gaming, and its journey from humble, academic experiments to a global cultural phenomenon is a story as captivating as any epic quest.",
        2: "From the flickering pixels of Pong in dimly lit arcades to the immersive, photorealistic worlds we explore today, the journey of video games is a story of relentless innovation and passionate rivalry. Chapter 1 laid the groundwork, tracing the nascent steps of this burgeoning medium, from its academic origins to the coin-operated triumphs that first captured the public imagination.",
        3: "The glow of cathode ray tubes, the cacophony of synthesized bleeps and bloops, the shared thrill of a high score etched onto a leaderboard – these are the sensory hallmarks of a bygone era, yet one that laid the very foundation for the digital playgrounds we inhabit today.",
        4: "Having journeyed through the nascent stages of video games, the console wars, and the dawn of online connectivity, we now arrive at a crucial juncture: understanding the vast and varied landscape of interactive entertainment itself.",
        5: "From the flickering pixels of Pong to the sprawling, photorealistic landscapes of modern epics, video games have always been more than just entertainment; they are meticulously crafted experiences."
      },
      metadata: {
        totalWords: 15000,
        totalChapters: 15,
        generatedAt: new Date().toISOString()
      }
    }
    console.log('Parsed book data:', {
      title: bookData.title,
      author: bookData.author,
      chapterCount: Object.keys(bookData.chapters).length,
      chapterTitlesCount: bookData.chapterTitles.length
    })

    console.log(`Generating ${format.toUpperCase()} file for test book`)

    // For debugging, let's first test if the route works at all
    if (format === 'test') {
      return NextResponse.json({
        success: true,
        message: 'API route is working',
        bookData: {
          title: bookData.title,
          author: bookData.author,
          chapterCount: Object.keys(bookData.chapters).length
        }
      })
    }

    let fileBuffer: Buffer
    let mimeType: string
    let fileExtension: string

    // Generate file based on format
    try {
      switch (format) {
        case 'docx':
          console.log('Generating DOCX...')
          fileBuffer = await generateDOCX(bookData)
          mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          fileExtension = 'docx'
          break
        
        case 'pdf':
          console.log('Generating PDF...')
          fileBuffer = await generatePDF(bookData)
          mimeType = 'application/pdf'
          fileExtension = 'pdf'
          break
        
        case 'epub':
          console.log('Generating EPUB...')
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
    } catch (generationError) {
      console.error(`Error generating ${format.toUpperCase()}:`, generationError)
      return NextResponse.json(
        { error: `Failed to generate ${format.toUpperCase()}: ${generationError instanceof Error ? generationError.message : 'Unknown error'}` },
        { status: 500 }
      )
    }

    console.log(`Generated ${format.toUpperCase()} file: ${fileBuffer.length} bytes`)

    // Create filename
    const filename = `Ultimate_Guide_To_Gaming_by_Smith.${fileExtension}`

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
    console.error('Test book file generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate file' },
      { status: 500 }
    )
  }
}

