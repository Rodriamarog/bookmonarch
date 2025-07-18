import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for our database
export interface Profile {
  id: string
  created_at: string
  updated_at: string | null
  full_name: string | null
  avatar_url: string | null
  subscription_status: string
  books_generated_today: number
  last_generation_date: string | null
  stripe_customer_id: string | null
}

export interface Book {
  id: string
  user_id: string
  created_at: string
  title: string
  author_name: string
  genre: string
  plot_summary: string | null
  writing_style: string | null
  chapter_titles: any | null
  total_chapters: number
  status: string
  progress: number | null
  content_url: string | null
  tokens_consumed: number | null
  error_message: string | null
}

export interface BillingEvent {
  id: string
  user_id: string | null
  stripe_event_id: string
  event_type: string
  payload: any
  processed_at: string
  processing_status: string
  error_message: string | null
}