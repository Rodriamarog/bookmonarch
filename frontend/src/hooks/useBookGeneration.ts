/**
 * React hook for book generation with progress tracking
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { bookGenerationService } from '../lib/api/book-generation';
import { BookStatusResponse, GenerateBookRequest } from '../lib/types/flask-api';
import { useErrorHandler } from '../lib/error-handling';

export interface UseBookGenerationState {
  isGenerating: boolean;
  progress: number;
  status: string;
  currentStep: string;
  error: string | null;
  bookId: string | null;
  startTime: Date | null;
  estimatedTimeRemaining: string | null;
  generatedBook: BookStatusResponse | null;
}

export interface UseBookGenerationActions {
  generateBook: (title: string, author: string) => Promise<void>;
  cancelGeneration: () => void;
  clearError: () => void;
  reset: () => void;
}

export interface UseBookGenerationReturn extends UseBookGenerationState, UseBookGenerationActions {}

const initialState: UseBookGenerationState = {
  isGenerating: false,
  progress: 0,
  status: 'idle',
  currentStep: '',
  error: null,
  bookId: null,
  startTime: null,
  estimatedTimeRemaining: null,
  generatedBook: null
};

export function useBookGeneration(): UseBookGenerationReturn {
  const [state, setState] = useState<UseBookGenerationState>(initialState);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeRemainingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize error handler for this hook
  const { handleError } = useErrorHandler({
    component: 'useBookGeneration'
  });

  // Update estimated time remaining
  useEffect(() => {
    if (state.isGenerating && state.startTime && state.progress > 0) {
      const updateTimeRemaining = () => {
        const timeRemaining = bookGenerationService.formatTimeRemaining(
          state.progress,
          state.startTime!
        );
        setState(prev => ({ ...prev, estimatedTimeRemaining: timeRemaining }));
      };

      // Update immediately
      updateTimeRemaining();

      // Update every 10 seconds
      timeRemainingIntervalRef.current = setInterval(updateTimeRemaining, 10000);

      return () => {
        if (timeRemainingIntervalRef.current) {
          clearInterval(timeRemainingIntervalRef.current);
        }
      };
    } else {
      if (timeRemainingIntervalRef.current) {
        clearInterval(timeRemainingIntervalRef.current);
        timeRemainingIntervalRef.current = null;
      }
    }
  }, [state.isGenerating, state.startTime, state.progress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (timeRemainingIntervalRef.current) {
        clearInterval(timeRemainingIntervalRef.current);
      }
    };
  }, []);

  const generateBook = useCallback(async (title: string, author: string) => {
    try {
      // Validate inputs
      const request = bookGenerationService.createRequest(title, author);

      // Reset state
      setState({
        ...initialState,
        isGenerating: true,
        status: 'starting',
        currentStep: 'Preparing to generate your book...',
        startTime: new Date()
      });

      // Create abort controller
      abortControllerRef.current = new AbortController();

      // Start generation with progress tracking
      const result = await bookGenerationService.generateBookWithProgress(request, {
        signal: abortControllerRef.current.signal,
        onProgress: (status: BookStatusResponse) => {
          setState(prev => ({
            ...prev,
            progress: bookGenerationService.getProgressPercentage(status.progress),
            status: status.status,
            currentStep: bookGenerationService.getStatusMessage(status.status, status.current_step),
            bookId: status.book_id,
            error: status.error || null
          }));
        }
      });

      // Generation completed successfully
      setState(prev => ({
        ...prev,
        isGenerating: false,
        progress: 100,
        status: 'completed',
        currentStep: 'Book generation completed successfully!',
        generatedBook: result,
        estimatedTimeRemaining: null
      }));

    } catch (error) {
      const errorResult = handleError(error);

      setState(prev => ({
        ...prev,
        isGenerating: false,
        error: errorResult.userMessage,
        status: 'failed',
        currentStep: 'Book generation failed',
        estimatedTimeRemaining: null
      }));
    } finally {
      abortControllerRef.current = null;
    }
  }, []);

  const cancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (state.bookId) {
      bookGenerationService.stopPolling(state.bookId);
    }

    setState(prev => ({
      ...prev,
      isGenerating: false,
      status: 'cancelled',
      currentStep: 'Book generation was cancelled',
      estimatedTimeRemaining: null
    }));
  }, [state.bookId]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (state.bookId) {
      bookGenerationService.stopPolling(state.bookId);
    }

    if (timeRemainingIntervalRef.current) {
      clearInterval(timeRemainingIntervalRef.current);
      timeRemainingIntervalRef.current = null;
    }

    setState(initialState);
  }, [state.bookId]);

  return {
    ...state,
    generateBook,
    cancelGeneration,
    clearError,
    reset
  };
}

export default useBookGeneration;