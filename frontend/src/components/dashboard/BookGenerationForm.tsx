/**
 * Book generation form component with progress tracking
 */

'use client';

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, BookOpen, Download, X, CheckCircle, AlertCircle, UserPlus } from 'lucide-react';
import useBookGeneration from '../../hooks/useBookGeneration';
import { flaskAPI } from '../../lib/api/flask-client';
import { useAuth } from '../../hooks/useAuth';

interface BookGenerationFormProps {
  onBookGenerated?: (bookId: string) => void;
  className?: string;
}

export function BookGenerationForm({ onBookGenerated, className }: BookGenerationFormProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const { user, signIn } = useAuth();

  const {
    isGenerating,
    progress,
    currentStep,
    error,
    bookId,
    estimatedTimeRemaining,
    generatedBook,
    generateBook,
    cancelGeneration,
    clearError,
    reset
  } = useBookGeneration();

  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (!title.trim()) {
      errors.push('Book title is required');
    } else if (title.length > 200) {
      errors.push('Book title cannot exceed 200 characters');
    }

    if (!author.trim()) {
      errors.push('Author name is required');
    } else if (author.length > 100) {
      errors.push('Author name cannot exceed 100 characters');
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await generateBook(title, author);
      if (onBookGenerated && bookId) {
        onBookGenerated(bookId);
      }
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  const handleDownloadFile = async (fileType: 'pdf' | 'epub' | 'metadata') => {
    if (!generatedBook?.book_id) return;

    // If user is not authenticated, show login prompt
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }

    try {
      const filesResponse = await flaskAPI.getBookFiles(generatedBook.book_id);
      const fileUrl = filesResponse.files[`${fileType}_url`];
      
      if (fileUrl) {
        // Create a temporary link to download the file
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = `${title}.${fileType === 'metadata' ? 'pdf' : fileType}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error(`Error downloading ${fileType}:`, error);
    }
  };

  const handleSignIn = async () => {
    try {
      await signIn();
      setShowLoginPrompt(false);
    } catch (error) {
      console.error('Sign in failed:', error);
    }
  };

  const handleReset = () => {
    reset();
    setTitle('');
    setAuthor('');
    setValidationErrors([]);
  };

  // Show completion state
  if (generatedBook) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Book Generated Successfully!
          </CardTitle>
          <CardDescription>
            Your book &quot;{generatedBook.title}&quot; by {generatedBook.author} is ready for download.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {generatedBook.files?.pdf_url && (
              <Button
                onClick={() => handleDownloadFile('pdf')}
                variant="default"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {user ? 'Download PDF' : 'Sign in to Download PDF'}
              </Button>
            )}
            {generatedBook.files?.epub_url && (
              <Button
                onClick={() => handleDownloadFile('epub')}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {user ? 'Download EPUB' : 'Sign in to Download EPUB'}
              </Button>
            )}
            {generatedBook.files?.metadata_url && (
              <Button
                onClick={() => handleDownloadFile('metadata')}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {user ? 'Download Metadata' : 'Sign in to Download Metadata'}
              </Button>
            )}
          </div>
          
          {/* Anonymous user info after generation */}
          {!user && (
            <Alert>
              <UserPlus className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">Your book is ready!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Sign in to download your files and keep your book saved to your account for future access.
                </p>
              </AlertDescription>
            </Alert>
          )}
          <Button onClick={handleReset} variant="ghost" className="w-full">
            Generate Another Book
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Generate New Book
        </CardTitle>
        <CardDescription>
          Create a comprehensive non-fiction book using AI. Enter your book details below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title Input */}
          <div className="space-y-2">
            <Label htmlFor="title">Book Title</Label>
            <Input
              id="title"
              type="text"
              placeholder="Enter your book title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isGenerating}
              maxLength={200}
              required
            />
            <div className="text-sm text-muted-foreground">
              {title.length}/200 characters
            </div>
          </div>

          {/* Author Input */}
          <div className="space-y-2">
            <Label htmlFor="author">Author Name</Label>
            <Input
              id="author"
              type="text"
              placeholder="Enter the author name..."
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              disabled={isGenerating}
              maxLength={100}
              required
            />
            <div className="text-sm text-muted-foreground">
              {author.length}/100 characters
            </div>
          </div>

          {/* Book Type (Fixed) */}
          <div className="space-y-2">
            <Label>Book Type</Label>
            <div className="p-2 bg-muted rounded-md text-sm">
              Non-fiction (Currently the only supported type)
            </div>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* API Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{error}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearError}
                >
                  <X className="h-4 w-4" />
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Login Prompt for Downloads */}
          {showLoginPrompt && (
            <Alert>
              <UserPlus className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Sign in to download your book</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create a free account to download your generated book and access it anytime.
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={handleSignIn}
                  >
                    Sign In
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowLoginPrompt(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Anonymous User Info */}
          {!user && !isGenerating && !generatedBook && (
            <Alert>
              <BookOpen className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">Anonymous Book Generation</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You can generate 1 book without signing up. To download files or generate more books, you&apos;ll need to create a free account.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Progress Section */}
          {isGenerating && (
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Generating your book...</span>
                <span className="text-sm text-muted-foreground">{progress}%</span>
              </div>
              
              <Progress value={progress} className="w-full" />
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{currentStep}</span>
              </div>
              
              {estimatedTimeRemaining && (
                <div className="text-sm text-muted-foreground">
                  Estimated time remaining: {estimatedTimeRemaining}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {!isGenerating ? (
              <Button type="submit" className="flex-1">
                <BookOpen className="h-4 w-4 mr-2" />
                Generate Book
              </Button>
            ) : (
              <Button
                type="button"
                variant="destructive"
                onClick={cancelGeneration}
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel Generation
              </Button>
            )}
          </div>

          {/* Generation Info */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Book generation typically takes 5-15 minutes</p>
            <p>• You can download PDF, EPUB, and metadata files when complete</p>
            <p>• Your book will be saved to your account for future access</p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default BookGenerationForm;