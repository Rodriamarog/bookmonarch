/**
 * Book generation service with progress tracking
 */

import { flaskAPI, FlaskAPIError } from './flask-client';
import {
  GenerateBookRequest,
  BookStatusResponse,
  ProgressCallback,
  BookStatus,
  BOOK_GENERATION_STEPS
} from '../types/flask-api';

export interface BookGenerationOptions {
  pollInterval?: number; // Polling interval in milliseconds
  timeout?: number; // Total timeout in milliseconds
  onProgress?: ProgressCallback;
  signal?: AbortSignal;
}

export class BookGenerationService {
  private activePolls = new Map<string, { intervalId: NodeJS.Timeout; abortController: AbortController }>();

  /**
   * Generate a book with progress tracking
   */
  async generateBookWithProgress(
    request: GenerateBookRequest,
    options: BookGenerationOptions = {}
  ): Promise<BookStatusResponse> {
    const {
      pollInterval = 2000, // 2 seconds
      timeout = 30 * 60 * 1000, // 30 minutes
      onProgress,
      signal
    } = options;

    try {
      // Start book generation
      const generateResponse = await flaskAPI.generateBookWithAutoAuth(request, { signal });
      const bookId = generateResponse.book_id;

      // Create abort controller for polling
      const abortController = new AbortController();
      
      // Combine with external signal if provided
      if (signal) {
        signal.addEventListener('abort', () => abortController.abort());
      }

      // Set up timeout
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeout);

      try {
        // Start polling for progress
        const finalStatus = await this.pollBookStatus(
          bookId,
          pollInterval,
          onProgress,
          abortController.signal
        );

        clearTimeout(timeoutId);
        return finalStatus;

      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error instanceof Error && error.name === 'AbortError') {
          throw new FlaskAPIError('Book generation was cancelled', 'GENERATION_CANCELLED', 499);
        }
        
        throw error;
      }

    } catch (error) {
      if (error instanceof FlaskAPIError) {
        throw error;
      }
      
      throw new FlaskAPIError(
        `Book generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GENERATION_ERROR'
      );
    }
  }

  /**
   * Poll book status until completion
   */
  private async pollBookStatus(
    bookId: string,
    pollInterval: number,
    onProgress?: ProgressCallback,
    signal?: AbortSignal
  ): Promise<BookStatusResponse> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          if (signal?.aborted) {
            throw new Error('Aborted');
          }

          const status = await flaskAPI.getBookStatusWithAutoAuth(bookId, { signal });
          
          // Call progress callback
          if (onProgress) {
            onProgress(status);
          }

          // Check if generation is complete
          if (status.status === 'completed') {
            this.stopPolling(bookId);
            resolve(status);
            return;
          }

          // Check if generation failed
          if (status.status === 'failed') {
            this.stopPolling(bookId);
            reject(new FlaskAPIError(
              status.error || 'Book generation failed',
              'GENERATION_FAILED'
            ));
            return;
          }

          // Continue polling
          if (!signal?.aborted) {
            const intervalId = setTimeout(poll, pollInterval);
            this.activePolls.set(bookId, {
              intervalId,
              abortController: new AbortController()
            });
          }

        } catch (error) {
          this.stopPolling(bookId);
          
          if (signal?.aborted || (error instanceof Error && error.message === 'Aborted')) {
            reject(new Error('Aborted'));
          } else {
            reject(error);
          }
        }
      };

      // Start polling
      poll();
    });
  }

  /**
   * Stop polling for a specific book
   */
  stopPolling(bookId: string): void {
    const poll = this.activePolls.get(bookId);
    if (poll) {
      clearTimeout(poll.intervalId);
      poll.abortController.abort();
      this.activePolls.delete(bookId);
    }
  }

  /**
   * Stop all active polling
   */
  stopAllPolling(): void {
    for (const [bookId] of this.activePolls) {
      this.stopPolling(bookId);
    }
  }

  /**
   * Get human-readable status message
   */
  getStatusMessage(status: BookStatus, currentStep?: string): string {
    if (currentStep) {
      return currentStep;
    }
    
    return BOOK_GENERATION_STEPS[status] || 'Unknown status';
  }

  /**
   * Check if status indicates completion
   */
  isCompleted(status: BookStatus): boolean {
    return status === 'completed';
  }

  /**
   * Check if status indicates failure
   */
  isFailed(status: BookStatus): boolean {
    return status === 'failed';
  }

  /**
   * Check if status indicates in progress
   */
  isInProgress(status: BookStatus): boolean {
    return !this.isCompleted(status) && !this.isFailed(status);
  }

  /**
   * Get progress percentage for UI
   */
  getProgressPercentage(progress: number): number {
    return Math.max(0, Math.min(100, progress));
  }

  /**
   * Format time remaining estimate
   */
  formatTimeRemaining(progress: number, startTime: Date): string {
    if (progress <= 0) return 'Calculating...';
    
    const elapsed = Date.now() - startTime.getTime();
    const estimated = (elapsed / progress) * (100 - progress);
    
    const minutes = Math.ceil(estimated / (1000 * 60));
    
    if (minutes < 1) return 'Less than a minute';
    if (minutes === 1) return '1 minute';
    return `${minutes} minutes`;
  }

  /**
   * Validate book generation request
   */
  validateRequest(request: GenerateBookRequest): string[] {
    const errors: string[] = [];

    if (!request.title?.trim()) {
      errors.push('Book title is required');
    } else if (request.title.length > 200) {
      errors.push('Book title cannot exceed 200 characters');
    }

    if (!request.author?.trim()) {
      errors.push('Author name is required');
    } else if (request.author.length > 100) {
      errors.push('Author name cannot exceed 100 characters');
    }

    if (request.book_type !== 'non-fiction') {
      errors.push('Only non-fiction books are currently supported');
    }

    return errors;
  }

  /**
   * Create a book generation request with validation
   */
  createRequest(title: string, author: string): GenerateBookRequest {
    const request: GenerateBookRequest = {
      title: title.trim(),
      author: author.trim(),
      book_type: 'non-fiction'
    };

    const errors = this.validateRequest(request);
    if (errors.length > 0) {
      throw new FlaskAPIError(
        `Validation failed: ${errors.join(', ')}`,
        'VALIDATION_ERROR',
        400
      );
    }

    return request;
  }
}

// Export singleton instance
export const bookGenerationService = new BookGenerationService();

// Export class for custom instances
export default BookGenerationService;