'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { BookOpen, Download, Clock, CheckCircle, XCircle, Loader, Trash2, FileText, File } from 'lucide-react'
import useBookManagement from '@/hooks/useBookManagement'

interface Book {
  id: string
  title: string
  author_name: string
  genre: string
  status: string
  progress: number | null
  created_at: string
  content_url: string | null
  error_message: string | null
}

interface RecentBooksProps {
  userId: string
}

export function RecentBooks({ userId }: RecentBooksProps) {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingBooks, setDeletingBooks] = useState<Set<string>>(new Set())
  const { downloadFile, deleteBook, isLoading: bookManagementLoading, error: bookManagementError } = useBookManagement()

  useEffect(() => {
    fetchBooks()
  }, [userId])

  const fetchBooks = async () => {
    try {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setBooks(data || [])
    } catch (error) {
      console.error('Error fetching books:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />
      case 'pending':
      case 'outline_generated':
      case 'generating_content':
        return <Loader className="h-5 w-5 text-orange-600 animate-spin" />
      default:
        return <Clock className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusText = (status: string, progress: number | null) => {
    switch (status) {
      case 'completed':
        return 'Completed'
      case 'failed':
        return 'Failed'
      case 'pending':
        return 'Starting...'
      case 'outline_generated':
        return 'Creating chapters...'
      case 'generating_content':
        return `Generating... ${progress || 0}%`
      default:
        return 'Unknown'
    }
  }

  const handleDownload = async (bookId: string, title: string, fileType: 'pdf' | 'epub' | 'metadata') => {
    try {
      const extension = fileType === 'metadata' ? 'pdf' : fileType
      const filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.${extension}`
      await downloadFile(bookId, fileType, filename)
    } catch (error) {
      console.error('Download error:', error)
      alert(`Failed to download ${fileType.toUpperCase()} file. Please try again.`)
    }
  }

  const handleDelete = async (bookId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return
    }

    setDeletingBooks(prev => new Set(prev).add(bookId))

    try {
      // Delete using Flask API (which handles both database and storage cleanup)
      await deleteBook(bookId)

      // Also delete from Supabase database (for backward compatibility)
      const { error } = await supabase
        .from('books')
        .delete()
        .eq('id', bookId)

      if (error) {
        console.warn('Supabase deletion warning:', error)
        // Don't throw error as Flask API deletion is primary
      }

      // Remove the book from the local state
      setBooks(prevBooks => prevBooks.filter(book => book.id !== bookId))
      
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete book. Please try again.')
    } finally {
      setDeletingBooks(prev => {
        const newSet = new Set(prev)
        newSet.delete(bookId)
        return newSet
      })
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader className="h-6 w-6 animate-spin mr-2" />
          <span>Loading your books...</span>
        </CardContent>
      </Card>
    )
  }

  if (books.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 mb-2">No books generated yet</p>
          <p className="text-sm text-gray-500">
            Generate your first book using the form above!
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Your Books
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {books.map((book) => (
            <div
              key={book.id}
              className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  {getStatusIcon(book.status)}
                  <div>
                    <h3 className="font-bold text-gray-900">{book.title}</h3>
                    <p className="text-sm text-gray-600">by {book.author_name}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{getStatusText(book.status, book.progress)}</span>
                  <span>•</span>
                  <span>{new Date(book.created_at).toLocaleDateString()}</span>
                  {book.progress && book.progress > 0 && book.status !== 'completed' && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-orange-500 transition-all duration-300"
                            style={{ width: `${book.progress}%` }}
                          />
                        </div>
                        <span className="text-xs">{Math.round(book.progress || 0)}%</span>
                      </div>
                    </>
                  )}
                </div>

                {book.error_message && (
                  <p className="text-sm text-red-600 mt-1">
                    Error: {book.error_message}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {(book.status === 'outline_complete' || book.status === 'chapters_complete' || book.status === 'completed') && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(`/debug/book/${book.id}`, '_blank')}
                    className="flex items-center gap-2"
                  >
                    <BookOpen className="h-4 w-4" />
                    View Details
                  </Button>
                )}
                
                {/* Download buttons for completed books */}
                {book.status === 'completed' && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(book.id, book.title, 'pdf')}
                      disabled={bookManagementLoading}
                      className="flex items-center gap-1"
                      title="Download PDF"
                    >
                      <FileText className="h-3 w-3" />
                      PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(book.id, book.title, 'epub')}
                      disabled={bookManagementLoading}
                      className="flex items-center gap-1"
                      title="Download EPUB"
                    >
                      <File className="h-3 w-3" />
                      EPUB
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(book.id, book.title, 'metadata')}
                      disabled={bookManagementLoading}
                      className="flex items-center gap-1"
                      title="Download Metadata"
                    >
                      <Download className="h-3 w-3" />
                      Meta
                    </Button>
                  </div>
                )}
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(book.id, book.title)}
                  disabled={deletingBooks.has(book.id) || bookManagementLoading}
                  className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  {deletingBooks.has(book.id) ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}