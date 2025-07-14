import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY || 'placeholder-key'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  console.log('[OAuth Callback] Received request:', { code, next, url: request.url })

  if (code) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('[OAuth Callback] exchangeCodeForSession error:', error)
    } else {
      console.log('[OAuth Callback] exchangeCodeForSession success')
    }
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    } else {
      // Pass the error message as a query parameter
      const errorMsg = encodeURIComponent(error.message || 'Unknown error')
      return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${errorMsg}`)
    }
  }

  console.error('[OAuth Callback] No code provided in callback URL')
  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error?error=No+code+provided`)
} 