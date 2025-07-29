/**
 * TypeScript types for Flask Book Generator API
 */

// Base API response structure
export interface BaseAPIResponse {
  success: boolean;
  error?: string;
  code?: string;
  message?: string;
}

// Book generation request
export interface GenerateBookRequest {
  title: string;
  author: string;
  book_type: 'non-fiction';
}

// Book generation response
export interface GenerateBookResponse extends BaseAPIResponse {
  book_id: string;
  status: 'pending';
}

// Book status types
export type BookStatus = 'pending' | 'outline_generated' | 'generating_content' | 'completed' | 'failed';

// Book status response
export interface BookStatusResponse extends BaseAPIResponse {
  book_id: string;
  status: BookStatus;
  progress: number;
  current_step: string;
  title: string;
  author: string;
  created_at: string;
  error?: string;
  files?: {
    pdf_url?: string;
    epub_url?: string;
    metadata_url?: string;
  };
}

// Book files response
export interface BookFilesResponse extends BaseAPIResponse {
  book_id: string;
  expires_in: number;
  files: {
    pdf_url?: string;
    epub_url?: string;
    metadata_url?: string;
  };
}

// File info response
export interface FileInfoResponse extends BaseAPIResponse {
  book_id: string;
  file_type: 'pdf' | 'epub' | 'metadata';
  file_info: {
    name: string;
    size: number;
    last_modified: string;
    content_type: string;
  };
}

// Delete book response
export interface DeleteBookResponse extends BaseAPIResponse {
  book_id: string;
  message: string;
  details?: {
    database_deleted: boolean;
    files_deleted: boolean;
  };
}

// Health check response
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'error';
  timestamp: string;
  version: string;
  service: string;
  dependencies: {
    supabase: boolean;
    gemini_api: boolean;
    storage: boolean;
  };
}

// Error response structure
export interface APIErrorResponse extends BaseAPIResponse {
  success: false;
  field?: string;
  details?: string[];
  retry_after?: number;
}

// Rate limit info
export interface RateLimitInfo {
  limits: {
    book_generation: string;
    file_access: string;
    general_api: string;
  };
  user_id: string;
}

// Storage status response
export interface StorageStatusResponse extends BaseAPIResponse {
  storage_service: string;
  bucket_name: string;
  service_status: string;
}

// Progress tracking callback type
export type ProgressCallback = (status: BookStatusResponse) => void;

// API client configuration
export interface FlaskAPIConfig {
  baseURL: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

// Request options
export interface RequestOptions {
  timeout?: number;
  retries?: number;
  signal?: AbortSignal;
}

// Book generation progress states
export const BOOK_GENERATION_STEPS = {
  pending: 'Starting book generation...',
  outline_generated: 'Outline generated, creating chapters...',
  generating_content: 'Generating book content...',
  completed: 'Book generation completed!',
  failed: 'Book generation failed'
} as const;

// File types
export const FILE_TYPES = {
  PDF: 'pdf',
  EPUB: 'epub',
  METADATA: 'metadata'
} as const;

export type FileType = typeof FILE_TYPES[keyof typeof FILE_TYPES];

// API endpoint function types
type EndpointFunction1 = (param1: string) => string;
type EndpointFunction2 = (param1: string, param2: string) => string;
type StaticEndpoint = string;

// API endpoint interface for type safety
interface APIEndpoints {
  GENERATE_BOOK: StaticEndpoint;
  BOOK_STATUS: EndpointFunction1;
  BOOK_FILES: EndpointFunction1;
  DELETE_BOOK: EndpointFunction1;
  FILE_INFO: EndpointFunction2;
  HEALTH: StaticEndpoint;
  STORAGE_STATUS: StaticEndpoint;
}

// API endpoints - Functions for parameterized routes, strings for static routes
export const API_ENDPOINTS: APIEndpoints = {
  GENERATE_BOOK: '/api/generate-book',
  BOOK_STATUS: (bookId: string) => `/api/book-status/${bookId}`,
  BOOK_FILES: (bookId: string) => `/api/book-files/${bookId}`,
  DELETE_BOOK: (bookId: string) => `/api/book-delete/${bookId}`,
  FILE_INFO: (bookId: string, fileType: string) => `/api/file-info/${bookId}/${fileType}`,
  HEALTH: '/api/health',
  STORAGE_STATUS: '/api/storage-status'
};