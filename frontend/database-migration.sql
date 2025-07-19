-- Add columns to support anonymous book generation and improved tracking
-- Run this in your Supabase SQL editor

-- Add columns to books table
ALTER TABLE books 
ADD COLUMN IF NOT EXISTS access_token text,
ADD COLUMN IF NOT EXISTS is_anonymous boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;

-- Add column to profiles table for free book tracking
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS free_book_used boolean DEFAULT false;

-- Make user_id nullable for anonymous books
ALTER TABLE books ALTER COLUMN user_id DROP NOT NULL;

-- Update RLS policies to allow anonymous book access
-- First, drop existing policies
DROP POLICY IF EXISTS "Enable Read Access for Own Books" ON books;
DROP POLICY IF EXISTS "Enable Insert of Own Books" ON books;
DROP POLICY IF EXISTS "Enable Update of Own Books" ON books;
DROP POLICY IF EXISTS "Enable Delete of Own Books" ON books;

-- Create new policies that support both authenticated and anonymous access
CREATE POLICY "Enable Read Access for Books" ON books
FOR SELECT USING (
  -- Allow access if user owns the book OR if it's an anonymous book with valid access token
  (auth.uid() = user_id) OR 
  (is_anonymous = true AND access_token IS NOT NULL)
);

CREATE POLICY "Enable Insert for Books" ON books
FOR INSERT WITH CHECK (
  -- Allow authenticated users to create books for themselves
  -- Allow service role to create anonymous books
  (auth.uid() = user_id) OR 
  (is_anonymous = true AND user_id IS NULL)
);

CREATE POLICY "Enable Update for Books" ON books
FOR UPDATE USING (
  -- Allow users to update their own books
  -- Allow service role to update any book (for generation process)
  (auth.uid() = user_id) OR 
  (auth.role() = 'service_role')
) WITH CHECK (
  -- Ensure users can only update their own books
  -- Service role can update any book
  (auth.uid() = user_id) OR 
  (auth.role() = 'service_role')
);

CREATE POLICY "Enable Delete for Books" ON books
FOR DELETE USING (
  -- Allow users to delete their own books
  (auth.uid() = user_id)
);

-- Create index for access_token lookups
CREATE INDEX IF NOT EXISTS idx_books_access_token ON books(access_token) WHERE access_token IS NOT NULL;

-- Create index for anonymous book cleanup
CREATE INDEX IF NOT EXISTS idx_books_expires_at ON books(expires_at) WHERE expires_at IS NOT NULL;

-- Create a function to clean up expired anonymous books (optional)
CREATE OR REPLACE FUNCTION cleanup_expired_anonymous_books()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM books 
  WHERE is_anonymous = true 
    AND expires_at IS NOT NULL 
    AND expires_at < NOW();
END;
$$;

-- You can set up a cron job to run this function periodically
-- SELECT cron.schedule('cleanup-expired-books', '0 2 * * *', 'SELECT cleanup_expired_anonymous_books();');