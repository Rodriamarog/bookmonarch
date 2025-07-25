import { GoogleGenerativeAI } from '@google/generative-ai'

if (!process.env.GOOGLE_GEMINI_API_KEY) {
  throw new Error('GOOGLE_GEMINI_API_KEY is not configured')
}

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY)

// Get the Gemini 2.5 Flash model (we'll optimize rate limits with proper delays)
export const geminiModel = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash-lite-preview-06-17",
  generationConfig: {
    temperature: 0.7,
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 8192,
  },
})

// Types for book generation
export interface BookOutline {
  title: string
  author: string
  genre: string
  plotSummary: string
  writingStyleGuide: string
  chapterTitles: string[]
  chapterSummaries: string[]
  targetWordCount: number
}

export interface ChapterSection {
  type: 'opening' | 'body' | 'dialogue' | 'closing'
  content: string
}

export interface ChapterContent {
  chapterNumber: number
  title: string
  subtitle?: string
  sections: ChapterSection[]
  summary: string
  keyEvents: string[]
  wordCount: number
}

export interface BookGenerationRequest {
  title: string
  author: string
  bookType: string
  writingStyle?: string
  userId?: string
  isAnonymous?: boolean
}

export interface BookGenerationProgress {
  stage: string
  progress: number
  currentChapter?: number
  totalChapters: number
  estimatedTimeRemaining?: number
}

// Helper function to count words
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length
}

// Helper function to create structured prompts
export function createOutlinePrompt(request: BookGenerationRequest): string {
  const { title, author, bookType, writingStyle } = request
  
  return `You are a professional book outline creator. Create a comprehensive outline for a ${bookType.toLowerCase()} book.

BOOK DETAILS:
- Title: "${title}"
- Author: ${author}
- Type: ${bookType}
- Writing Style: ${writingStyle || 'Professional and engaging'}

REQUIREMENTS:
- Create exactly 15 chapters
- Each chapter should be 800-1200 words when written
- Provide a compelling plot summary (2-3 paragraphs)
- Create a writing style guide (1 paragraph)
- Generate 15 descriptive chapter titles that flow logically

RESPONSE FORMAT (JSON):
{
  "title": "${title}",
  "author": "${author}",
  "genre": "${bookType}",
  "plotSummary": "2-3 paragraph summary of the book's main themes and progression",
  "writingStyleGuide": "1 paragraph describing the tone, voice, and approach for this book",
  "chapterTitles": [
    "Chapter 1 title",
    "Chapter 2 title",
    ...15 titles total
  ],
  "chapterSummaries": [
    "Brief 2-3 sentence summary of what happens in Chapter 1",
    "Brief 2-3 sentence summary of what happens in Chapter 2",
    ...15 summaries total
  ],
  "targetWordCount": 15000
}

Ensure the outline is cohesive, engaging, and appropriate for the ${bookType.toLowerCase()} genre. The chapter titles should create a logical progression that readers will want to follow.`
}

export function createChapterPrompt(
  outline: BookOutline, 
  chapterNumber: number, 
  previousChaptersSummary: string = ""
): string {
  const chapterTitle = outline.chapterTitles[chapterNumber - 1]
  const chapterSummary = outline.chapterSummaries[chapterNumber - 1]
  
  return `You are a professional ${outline.genre.toLowerCase()} writer. Write Chapter ${chapterNumber} of the book "${outline.title}" by ${outline.author}.

BOOK CONTEXT:
- Title: ${outline.title}
- Author: ${outline.author}
- Genre: ${outline.genre}
- Plot Summary: ${outline.plotSummary}
- Writing Style Guide: ${outline.writingStyleGuide}

CHAPTER DETAILS:
- Chapter Number: ${chapterNumber} of 15
- Chapter Title: ${chapterTitle}
- Chapter Summary: ${chapterSummary}
- Target Word Count: 800-1200 words

${previousChaptersSummary ? `PREVIOUS CHAPTERS SUMMARY:
${previousChaptersSummary}

Ensure this chapter builds naturally on the previous content and maintains narrative continuity.` : ''}

CRITICAL FORMATTING REQUIREMENTS:
You MUST return your response as a valid JSON object with the exact structure specified below. Do not include any text before or after the JSON object. Do not use markdown code blocks. Return only the raw JSON.

REQUIRED JSON STRUCTURE:
{
  "chapterNumber": ${chapterNumber},
  "title": "${chapterTitle}",
  "subtitle": "Optional chapter subtitle if appropriate",
  "sections": [
    {
      "type": "opening",
      "content": "Opening paragraph with **bold text** and *italic text* as needed.\n\nUse standard markdown formatting for emphasis."
    },
    {
      "type": "body", 
      "content": "Main body content with multiple paragraphs.\n\n**Important points** can be bolded.\n\n*Thoughts or emphasis* can be italicized.\n\n> Quotes can use blockquote format\n\n- Use bullet points when listing items\n- Like this example\n\nThis should be the bulk of the chapter content."
    },
    {
      "type": "dialogue",
      "content": "\"Character dialogue should be in quotes,\" said the protagonist.\n\n*She thought to herself,* this is how we handle internal thoughts.\n\n\"More dialogue here,\" replied another character."
    },
    {
      "type": "closing",
      "content": "Closing paragraph that transitions to the next chapter.\n\n**Key revelation** or cliffhanger to maintain reader interest."
    }
  ],
  "summary": "Brief 2-3 sentence summary of what happens in this chapter",
  "keyEvents": ["Event 1", "Event 2", "Event 3"],
  "wordCount": 0
}

MARKDOWN FORMATTING GUIDELINES:
- Use **bold** for emphasis, important terms, or dramatic moments
- Use *italics* for thoughts, internal dialogue, or subtle emphasis  
- Use > for blockquotes or important statements
- Use - for bullet points when listing items
- Use standard paragraph breaks (double newline) between paragraphs
- Keep formatting purposeful and not excessive
- Ensure all markdown is properly formatted and will render correctly

CONTENT REQUIREMENTS:
- Write engaging, high-quality content appropriate for the ${outline.genre.toLowerCase()} genre
- Follow the established writing style and tone
- Ensure the chapter covers the content described in the chapter summary
- Each section should be substantial (200-400 words each)
- Create natural flow between sections
- End with a smooth transition that leads to the next chapter
- Include dialogue and character development where appropriate
- Maintain narrative continuity with previous chapters

Generate Chapter ${chapterNumber} following these specifications. Return only the JSON object.`
}

// Error handling for API calls
export class GeminiAPIError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message)
    this.name = 'GeminiAPIError'
  }
}

// Rate limiting helper
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}