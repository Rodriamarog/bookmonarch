"""
Supabase Storage integration for file upload, download, and management.
"""

import os
import logging
from typing import Optional, Dict, Any
from pathlib import Path
from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions


class SupabaseStorageError(Exception):
    """Custom exception for Supabase Storage operations."""
    pass


class SupabaseStorageService:
    """Service for managing files in Supabase Storage."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # Initialize Supabase client with service role key for storage operations
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_service_key = os.getenv('SECRET_KEY')  # Use service role key for storage operations
        
        if not supabase_url or not supabase_service_key:
            raise ValueError("SUPABASE_URL and SECRET_KEY environment variables are required")
        
        try:
            self.client: Client = create_client(supabase_url, supabase_service_key)
            self.bucket_name = 'books'  # Supabase Storage bucket name
            self.logger.info("Supabase Storage client initialized successfully")
        except Exception as e:
            self.logger.error(f"Failed to initialize Supabase client: {str(e)}")
            raise SupabaseStorageError(f"Supabase initialization failed: {str(e)}")
    
    def upload_file(self, local_file_path: str, storage_path: str) -> str:
        """
        Upload a file to Supabase Storage.
        
        Args:
            local_file_path: Path to the local file to upload
            storage_path: Path in storage (e.g., 'books/user123/book456/book.pdf')
            
        Returns:
            str: Public URL of the uploaded file
            
        Raises:
            SupabaseStorageError: If upload fails
        """
        try:
            # Validate local file exists
            if not os.path.exists(local_file_path):
                raise SupabaseStorageError(f"Local file not found: {local_file_path}")
            
            # Get file size for logging
            file_size = os.path.getsize(local_file_path)
            self.logger.info(f"Uploading file: {local_file_path} ({file_size:,} bytes) to {storage_path}")
            
            # Read file content
            with open(local_file_path, 'rb') as file:
                file_content = file.read()
            
            # Upload to Supabase Storage
            response = self.client.storage.from_(self.bucket_name).upload(
                path=storage_path,
                file=file_content,
                file_options={
                    "content-type": self._get_content_type(local_file_path),
                    "upsert": "true"  # Overwrite if exists - must be string
                }
            )
            
            # Check for upload errors
            if hasattr(response, 'error') and response.error:
                raise SupabaseStorageError(f"Upload failed: {response.error}")
            
            # Get public URL
            public_url = self.get_public_url(storage_path)
            
            self.logger.info(f"Successfully uploaded file to: {public_url}")
            return public_url
            
        except Exception as e:
            self.logger.error(f"Failed to upload file {local_file_path}: {str(e)}")
            raise SupabaseStorageError(f"Upload failed: {str(e)}")
    
    def delete_file(self, storage_path: str) -> bool:
        """
        Delete a file from Supabase Storage.
        
        Args:
            storage_path: Path in storage to delete
            
        Returns:
            bool: True if deletion was successful
            
        Raises:
            SupabaseStorageError: If deletion fails
        """
        try:
            self.logger.info(f"Deleting file: {storage_path}")
            
            response = self.client.storage.from_(self.bucket_name).remove([storage_path])
            
            # Check for deletion errors
            if hasattr(response, 'error') and response.error:
                raise SupabaseStorageError(f"Deletion failed: {response.error}")
            
            self.logger.info(f"Successfully deleted file: {storage_path}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to delete file {storage_path}: {str(e)}")
            raise SupabaseStorageError(f"Deletion failed: {str(e)}")
    
    def get_signed_url(self, storage_path: str, expires_in: int = 3600) -> str:
        """
        Generate a signed URL for file download.
        
        Args:
            storage_path: Path in storage
            expires_in: URL expiration time in seconds (default: 1 hour)
            
        Returns:
            str: Signed URL for file download
            
        Raises:
            SupabaseStorageError: If URL generation fails
        """
        try:
            self.logger.info(f"Generating signed URL for: {storage_path}")
            
            response = self.client.storage.from_(self.bucket_name).create_signed_url(
                path=storage_path,
                expires_in=expires_in
            )
            
            # Check for errors
            if hasattr(response, 'error') and response.error:
                raise SupabaseStorageError(f"Signed URL generation failed: {response.error}")
            
            signed_url = response.get('signedURL')
            if not signed_url:
                raise SupabaseStorageError("No signed URL returned from Supabase")
            
            self.logger.info(f"Generated signed URL (expires in {expires_in}s)")
            return signed_url
            
        except Exception as e:
            self.logger.error(f"Failed to generate signed URL for {storage_path}: {str(e)}")
            raise SupabaseStorageError(f"Signed URL generation failed: {str(e)}")
    
    def get_public_url(self, storage_path: str) -> str:
        """
        Get public URL for a file (if bucket is public).
        
        Args:
            storage_path: Path in storage
            
        Returns:
            str: Public URL
        """
        try:
            response = self.client.storage.from_(self.bucket_name).get_public_url(storage_path)
            return response
        except Exception as e:
            self.logger.error(f"Failed to get public URL for {storage_path}: {str(e)}")
            raise SupabaseStorageError(f"Public URL generation failed: {str(e)}")
    
    def file_exists(self, storage_path: str) -> bool:
        """
        Check if a file exists in storage.
        
        Args:
            storage_path: Path in storage to check
            
        Returns:
            bool: True if file exists
        """
        try:
            response = self.client.storage.from_(self.bucket_name).list(
                path=os.path.dirname(storage_path)
            )
            
            if hasattr(response, 'error') and response.error:
                return False
            
            filename = os.path.basename(storage_path)
            return any(file.get('name') == filename for file in response)
            
        except Exception as e:
            self.logger.error(f"Error checking file existence {storage_path}: {str(e)}")
            return False
    
    def generate_storage_path(self, user_id: str, book_id: str, filename: str) -> str:
        """
        Generate a standardized storage path for book files.
        
        Args:
            user_id: User ID
            book_id: Book ID
            filename: File name (e.g., 'book.pdf', 'book.epub')
            
        Returns:
            str: Storage path (e.g., 'books/user123/book456/book.pdf')
        """
        return f"books/{user_id}/{book_id}/{filename}"
    
    def cleanup_temp_file(self, file_path: str) -> None:
        """
        Clean up temporary local file after upload.
        
        Args:
            file_path: Path to temporary file to delete
        """
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                self.logger.info(f"Cleaned up temporary file: {file_path}")
        except Exception as e:
            self.logger.warning(f"Failed to clean up temporary file {file_path}: {str(e)}")
    
    def cleanup_book_files(self, user_id: str, book_id: str) -> bool:
        """
        Clean up all files for a specific book.
        
        Args:
            user_id: User ID
            book_id: Book ID
            
        Returns:
            bool: True if cleanup was successful
        """
        try:
            self.logger.info(f"Cleaning up files for book {book_id} (user {user_id})")
            
            # List of standard book files
            file_names = ['book.pdf', 'book.epub', 'metadata.pdf']
            success_count = 0
            
            for filename in file_names:
                storage_path = self.generate_storage_path(user_id, book_id, filename)
                
                if self.file_exists(storage_path):
                    try:
                        self.delete_file(storage_path)
                        success_count += 1
                        self.logger.info(f"Deleted {filename} for book {book_id}")
                    except Exception as e:
                        self.logger.warning(f"Failed to delete {filename} for book {book_id}: {str(e)}")
                else:
                    self.logger.info(f"File {filename} does not exist for book {book_id}")
            
            self.logger.info(f"Cleaned up {success_count}/{len(file_names)} files for book {book_id}")
            return success_count > 0
            
        except Exception as e:
            self.logger.error(f"Failed to cleanup files for book {book_id}: {str(e)}")
            return False
    
    def validate_file_before_upload(self, file_path: str, max_size_mb: int = 50) -> bool:
        """
        Validate file before upload.
        
        Args:
            file_path: Path to file to validate
            max_size_mb: Maximum file size in MB
            
        Returns:
            bool: True if file is valid for upload
            
        Raises:
            SupabaseStorageError: If validation fails
        """
        try:
            # Check if file exists
            if not os.path.exists(file_path):
                raise SupabaseStorageError(f"File does not exist: {file_path}")
            
            # Check file size
            file_size = os.path.getsize(file_path)
            max_size_bytes = max_size_mb * 1024 * 1024
            
            if file_size > max_size_bytes:
                raise SupabaseStorageError(f"File too large: {file_size:,} bytes (max: {max_size_bytes:,} bytes)")
            
            if file_size == 0:
                raise SupabaseStorageError("File is empty")
            
            # Check file extension
            allowed_extensions = {'.pdf', '.epub', '.json', '.txt', '.md'}
            file_extension = Path(file_path).suffix.lower()
            
            if file_extension not in allowed_extensions:
                raise SupabaseStorageError(f"File type not allowed: {file_extension}")
            
            self.logger.info(f"File validation passed: {file_path} ({file_size:,} bytes)")
            return True
            
        except SupabaseStorageError:
            raise
        except Exception as e:
            raise SupabaseStorageError(f"File validation failed: {str(e)}")
    
    def get_book_file_urls(self, user_id: str, book_id: str, expires_in: int = 3600) -> Dict[str, Optional[str]]:
        """
        Get signed URLs for all book files.
        
        Args:
            user_id: User ID
            book_id: Book ID
            expires_in: URL expiration time in seconds
            
        Returns:
            Dict with file URLs (None if file doesn't exist)
        """
        file_urls = {}
        file_names = {
            'pdf': 'book.pdf',
            'epub': 'book.epub',
            'metadata': 'metadata.pdf'
        }
        
        for file_type, filename in file_names.items():
            storage_path = self.generate_storage_path(user_id, book_id, filename)
            
            try:
                if self.file_exists(storage_path):
                    file_urls[file_type] = self.get_signed_url(storage_path, expires_in)
                else:
                    file_urls[file_type] = None
            except Exception as e:
                self.logger.warning(f"Failed to get URL for {filename}: {str(e)}")
                file_urls[file_type] = None
        
        return file_urls
    
    def _get_content_type(self, file_path: str) -> str:
        """
        Determine content type based on file extension.
        
        Args:
            file_path: Path to file
            
        Returns:
            str: MIME content type
        """
        extension = Path(file_path).suffix.lower()
        
        content_types = {
            '.pdf': 'application/pdf',
            '.epub': 'application/epub+zip',
            '.json': 'application/json',
            '.txt': 'text/plain',
            '.md': 'text/markdown'
        }
        
        return content_types.get(extension, 'application/octet-stream')
    
    def get_file_info(self, storage_path: str) -> Optional[Dict[str, Any]]:
        """
        Get information about a file in storage.
        
        Args:
            storage_path: Path in storage
            
        Returns:
            Dict with file information or None if not found
        """
        try:
            directory = os.path.dirname(storage_path)
            filename = os.path.basename(storage_path)
            
            response = self.client.storage.from_(self.bucket_name).list(path=directory)
            
            if hasattr(response, 'error') and response.error:
                return None
            
            for file_info in response:
                if file_info.get('name') == filename:
                    return {
                        'name': file_info.get('name'),
                        'size': file_info.get('metadata', {}).get('size'),
                        'last_modified': file_info.get('updated_at'),
                        'content_type': file_info.get('metadata', {}).get('mimetype')
                    }
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error getting file info for {storage_path}: {str(e)}")
            return None


# Convenience function for easy import
def get_storage_service() -> SupabaseStorageService:
    """Get a configured Supabase Storage service instance."""
    return SupabaseStorageService()