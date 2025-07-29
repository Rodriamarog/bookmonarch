/**
 * React hook for book management operations
 */

import { useState, useCallback } from 'react';
import { flaskAPI } from '../lib/api/flask-client';
import { BookFilesResponse, FileType } from '../lib/types/flask-api';
import { useErrorHandler } from '../lib/error-handling';

export interface BookFile {
  type: FileType;
  url: string;
  available: boolean;
}

export interface BookManagementState {
  isLoading: boolean;
  error: string | null;
  files: BookFile[];
  lastFetched: Date | null;
}

export interface UseBookManagementActions {
  getBookFiles: (bookId: string, expiresIn?: number) => Promise<BookFile[]>;
  downloadFile: (bookId: string, fileType: FileType, filename?: string) => Promise<void>;
  deleteBook: (bookId: string) => Promise<void>;
  clearError: () => void;
}

export interface UseBookManagementReturn extends BookManagementState, UseBookManagementActions {}

const initialState: BookManagementState = {
  isLoading: false,
  error: null,
  files: [],
  lastFetched: null
};

export function useBookManagement(): UseBookManagementReturn {
  const [state, setState] = useState<BookManagementState>(initialState);
  
  // Initialize error handler for this hook
  const { handleError } = useErrorHandler({
    component: 'useBookManagement'
  });

  const getBookFiles = useCallback(async (bookId: string, expiresIn: number = 3600): Promise<BookFile[]> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response: BookFilesResponse = await flaskAPI.getBookFiles(bookId, expiresIn);
      
      const files: BookFile[] = [
        {
          type: 'pdf',
          url: response.files.pdf_url || '',
          available: !!response.files.pdf_url
        },
        {
          type: 'epub',
          url: response.files.epub_url || '',
          available: !!response.files.epub_url
        },
        {
          type: 'metadata',
          url: response.files.metadata_url || '',
          available: !!response.files.metadata_url
        }
      ];

      setState(prev => ({
        ...prev,
        isLoading: false,
        files,
        lastFetched: new Date()
      }));

      return files;

    } catch (error) {
      const errorResult = handleError(error);

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorResult.userMessage
      }));

      throw error;
    }
  }, []);

  const downloadFile = useCallback(async (
    bookId: string, 
    fileType: FileType, 
    filename?: string
  ): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Get fresh file URLs
      const response = await flaskAPI.getBookFiles(bookId, 3600); // 1 hour expiry
      const fileUrl = response.files[`${fileType}_url`];

      if (!fileUrl) {
        throw new Error(`${fileType.toUpperCase()} file is not available for this book`);
      }

      // Create download link
      const link = document.createElement('a');
      link.href = fileUrl;
      
      // Set filename
      if (filename) {
        link.download = filename;
      } else {
        const extension = fileType === 'metadata' ? 'pdf' : fileType;
        link.download = `book.${extension}`;
      }
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setState(prev => ({ ...prev, isLoading: false }));

    } catch (error) {
      const errorResult = handleError(error);

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorResult.userMessage
      }));

      throw error;
    }
  }, []);

  const deleteBook = useCallback(async (bookId: string): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await flaskAPI.deleteBook(bookId);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        files: [], // Clear files after deletion
        lastFetched: null
      }));

    } catch (error) {
      const errorResult = handleError(error);

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorResult.userMessage
      }));

      throw error;
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    getBookFiles,
    downloadFile,
    deleteBook,
    clearError
  };
}

export default useBookManagement;