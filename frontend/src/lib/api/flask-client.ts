/**
 * Flask API client for book generation service
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  GenerateBookRequest,
  GenerateBookResponse,
  BookStatusResponse,
  BookFilesResponse,
  DeleteBookResponse,
  FileInfoResponse,
  HealthCheckResponse,
  StorageStatusResponse,
  APIErrorResponse,
  FlaskAPIConfig,
  RequestOptions,
  FileType,
  API_ENDPOINTS
} from '../types/flask-api';

export class FlaskAPIError extends Error {
  public code: string;
  public field?: string;
  public statusCode: number;
  public retryAfter?: number;

  constructor(
    message: string,
    code: string = 'API_ERROR',
    statusCode: number = 500,
    field?: string,
    retryAfter?: number
  ) {
    super(message);
    this.name = 'FlaskAPIError';
    this.code = code;
    this.field = field;
    this.statusCode = statusCode;
    this.retryAfter = retryAfter;
  }
}

export class FlaskAPIClient {
  private baseURL: string;
  private timeout: number;
  private retries: number;
  private retryDelay: number;
  private supabase: SupabaseClient;

  constructor(config?: Partial<FlaskAPIConfig>) {
    this.baseURL = config?.baseURL || process.env.NEXT_PUBLIC_FLASK_API_URL || 'http://localhost:5000';
    this.timeout = config?.timeout || 30000; // 30 seconds
    this.retries = config?.retries || 3;
    this.retryDelay = config?.retryDelay || 1000; // 1 second

    // Initialize Supabase client for authentication
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Get authentication headers with JWT token
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await this.supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new FlaskAPIError('Authentication required', 'AUTH_REQUIRED', 401);
    }

    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Make HTTP request with retry logic
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit & RequestOptions = {}
  ): Promise<T> {
    const { retries = this.retries, timeout = this.timeout, signal, ...fetchOptions } = options;
    
    let lastError: Error;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        // Combine signals
        const combinedSignal = signal ? this.combineSignals([signal, controller.signal]) : controller.signal;

        const response = await fetch(`${this.baseURL}${endpoint}`, {
          ...fetchOptions,
          signal: combinedSignal
        });

        clearTimeout(timeoutId);

        // Handle different response types
        if (!response.ok) {
          const errorData = await this.parseErrorResponse(response);
          throw new FlaskAPIError(
            errorData.message || `HTTP ${response.status}`,
            errorData.code || 'HTTP_ERROR',
            response.status,
            errorData.field,
            errorData.retry_after
          );
        }

        const data = await response.json();
        
        // Check for API-level errors
        if (!data.success && data.error) {
          throw new FlaskAPIError(
            data.message || data.error,
            data.code || 'API_ERROR',
            response.status,
            data.field
          );
        }

        return data as T;

      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (error instanceof FlaskAPIError) {
          if (error.statusCode === 401 || error.statusCode === 403 || error.statusCode === 400) {
            throw error;
          }
          
          // Handle rate limiting
          if (error.statusCode === 429 && error.retryAfter) {
            if (attempt < retries) {
              await this.sleep(error.retryAfter * 1000);
              continue;
            }
          }
        }

        // Retry with exponential backoff
        if (attempt < retries) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          await this.sleep(delay);
          continue;
        }

        throw lastError;
      }
    }

    throw lastError!;
  }

  /**
   * Parse error response from API
   */
  private async parseErrorResponse(response: Response): Promise<APIErrorResponse> {
    try {
      return await response.json();
    } catch {
      return {
        success: false,
        error: `HTTP ${response.status}`,
        message: response.statusText || 'Unknown error'
      };
    }
  }

  /**
   * Combine multiple abort signals
   */
  private combineSignals(signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();
    
    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort();
        break;
      }
      signal.addEventListener('abort', () => controller.abort());
    }
    
    return controller.signal;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate a new book
   */
  async generateBook(request: GenerateBookRequest, options?: RequestOptions): Promise<GenerateBookResponse> {
    const headers = await this.getAuthHeaders();
    
    return this.makeRequest<GenerateBookResponse>(API_ENDPOINTS.GENERATE_BOOK, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      ...options
    });
  }

  /**
   * Get book generation status
   */
  async getBookStatus(bookId: string, options?: RequestOptions): Promise<BookStatusResponse> {
    const headers = await this.getAuthHeaders();
    
    return this.makeRequest<BookStatusResponse>(API_ENDPOINTS.BOOK_STATUS(bookId), {
      method: 'GET',
      headers,
      ...options
    });
  }

  /**
   * Get book file URLs
   */
  async getBookFiles(bookId: string, expiresIn: number = 3600, options?: RequestOptions): Promise<BookFilesResponse> {
    const headers = await this.getAuthHeaders();
    const params = new URLSearchParams({ expires_in: expiresIn.toString() });
    
    return this.makeRequest<BookFilesResponse>(`${API_ENDPOINTS.BOOK_FILES(bookId)}?${params}`, {
      method: 'GET',
      headers,
      ...options
    });
  }

  /**
   * Delete a book and its files
   */
  async deleteBook(bookId: string, options?: RequestOptions): Promise<DeleteBookResponse> {
    const headers = await this.getAuthHeaders();
    
    return this.makeRequest<DeleteBookResponse>(API_ENDPOINTS.DELETE_BOOK(bookId), {
      method: 'DELETE',
      headers,
      ...options
    });
  }

  /**
   * Get file information
   */
  async getFileInfo(bookId: string, fileType: FileType, options?: RequestOptions): Promise<FileInfoResponse> {
    const headers = await this.getAuthHeaders();
    
    return this.makeRequest<FileInfoResponse>(API_ENDPOINTS.FILE_INFO(bookId, fileType), {
      method: 'GET',
      headers,
      ...options
    });
  }

  /**
   * Check API health
   */
  async checkHealth(options?: RequestOptions): Promise<HealthCheckResponse> {
    return this.makeRequest<HealthCheckResponse>(API_ENDPOINTS.HEALTH, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
  }

  /**
   * Get storage status
   */
  async getStorageStatus(options?: RequestOptions): Promise<StorageStatusResponse> {
    const headers = await this.getAuthHeaders();
    
    return this.makeRequest<StorageStatusResponse>(API_ENDPOINTS.STORAGE_STATUS, {
      method: 'GET',
      headers,
      ...options
    });
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      return !!session?.access_token;
    } catch {
      return false;
    }
  }

  /**
   * Get current user information
   */
  async getCurrentUser() {
    const { data: { user } } = await this.supabase.auth.getUser();
    return user;
  }

  /**
   * Sign out user
   */
  async signOut() {
    await this.supabase.auth.signOut();
  }
}

// Export singleton instance
export const flaskAPI = new FlaskAPIClient();

// Export class for custom instances
export default FlaskAPIClient;