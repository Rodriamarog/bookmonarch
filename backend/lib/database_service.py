"""
Centralized database service for consistent Supabase operations.
"""

import os
import logging
from typing import Optional, Dict, Any, List
from supabase import create_client, Client
from utils.datetime_utils import format_for_database


class DatabaseError(Exception):
    """Custom exception for database operations."""
    pass


class DatabaseService:
    """Service for centralized database operations."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # Get database credentials from environment
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_KEY')
        self.supabase_service_key = os.getenv('SECRET_KEY')  # Service role key
        
        if not self.supabase_url:
            raise ValueError("SUPABASE_URL environment variable is required")
        
        if not self.supabase_key:
            raise ValueError("SUPABASE_KEY environment variable is required")
        
        # Create client instances
        self._client = None
        self._service_client = None
        
        self.logger.info("Database service initialized")
    
    @property
    def client(self) -> Client:
        """Get regular Supabase client (anon key)."""
        if self._client is None:
            self._client = create_client(self.supabase_url, self.supabase_key)
        return self._client
    
    @property
    def service_client(self) -> Client:
        """Get service role Supabase client (for admin operations)."""
        if self._service_client is None:
            if not self.supabase_service_key:
                raise ValueError("SECRET_KEY (service role key) environment variable is required for admin operations")
            self._service_client = create_client(self.supabase_url, self.supabase_service_key)
        return self._service_client
    
    def get_authenticated_client(self, jwt_token: str) -> Client:
        """
        Get client with user authentication.
        
        Args:
            jwt_token: User's JWT token
            
        Returns:
            Client: Authenticated Supabase client
        """
        client = create_client(self.supabase_url, self.supabase_key)
        # Set the session with JWT token
        client.auth.set_session(jwt_token, jwt_token)
        return client
    
    # Books table operations
    def create_book(self, book_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new book record.
        
        Args:
            book_data: Book data dictionary
            
        Returns:
            Dict: Created book record
            
        Raises:
            DatabaseError: If creation fails
        """
        try:
            # Ensure created_at is properly formatted
            if 'created_at' not in book_data:
                book_data['created_at'] = format_for_database()
            
            # Use service_client to bypass RLS policies for book creation
            # This allows both authenticated and anonymous book creation
            result = self.service_client.table('books').insert(book_data).execute()
            
            if not result.data:
                raise DatabaseError("Failed to create book record")
            
            self.logger.info(f"Created book record: {book_data.get('id')}")
            return result.data[0]
            
        except Exception as e:
            self.logger.error(f"Error creating book: {str(e)}")
            raise DatabaseError(f"Failed to create book: {str(e)}")
    
    def get_book(self, book_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get book record by ID and user ID.
        
        Args:
            book_id: Book ID
            user_id: User ID
            
        Returns:
            Dict or None: Book record if found
        """
        try:
            result = self.client.table('books').select('*').eq('id', book_id).eq('user_id', user_id).execute()
            
            if result.data:
                return result.data[0]
            return None
            
        except Exception as e:
            self.logger.error(f"Error getting book {book_id}: {str(e)}")
            raise DatabaseError(f"Failed to get book: {str(e)}")
    
    def update_book(self, book_id: str, user_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update book record.
        
        Args:
            book_id: Book ID
            user_id: User ID
            updates: Fields to update
            
        Returns:
            Dict: Updated book record
        """
        try:
            result = self.client.table('books').update(updates).eq('id', book_id).eq('user_id', user_id).execute()
            
            if not result.data:
                raise DatabaseError("Book not found or access denied")
            
            self.logger.info(f"Updated book {book_id}")
            return result.data[0]
            
        except Exception as e:
            self.logger.error(f"Error updating book {book_id}: {str(e)}")
            raise DatabaseError(f"Failed to update book: {str(e)}")
    
    def update_book_file_urls(self, book_id: str, user_id: str, pdf_url: str = None, epub_url: str = None, metadata_url: str = None) -> Dict[str, Any]:
        """
        Update book file URLs (convenience method).
        
        Args:
            book_id: Book ID
            user_id: User ID
            pdf_url: PDF file URL
            epub_url: EPUB file URL
            metadata_url: Metadata file URL
            
        Returns:
            Dict: Updated book record
        """
        try:
            updates = {}
            
            if pdf_url is not None:
                updates['content_url'] = pdf_url
            if epub_url is not None:
                updates['epub_url'] = epub_url
            if metadata_url is not None:
                updates['metadata_url'] = metadata_url
            
            if not updates:
                raise DatabaseError("No file URLs provided to update")
            
            return self.update_book(book_id, user_id, updates)
            
        except Exception as e:
            self.logger.error(f"Error updating file URLs for book {book_id}: {str(e)}")
            raise DatabaseError(f"Failed to update file URLs: {str(e)}")
    
    def delete_book(self, book_id: str, user_id: str) -> bool:
        """
        Delete book record.
        
        Args:
            book_id: Book ID
            user_id: User ID
            
        Returns:
            bool: True if deleted successfully
        """
        try:
            result = self.client.table('books').delete().eq('id', book_id).eq('user_id', user_id).execute()
            
            if not result.data:
                raise DatabaseError("Book not found or access denied")
            
            self.logger.info(f"Deleted book {book_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error deleting book {book_id}: {str(e)}")
            raise DatabaseError(f"Failed to delete book: {str(e)}")
    
    def get_user_books(self, user_id: str, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get all books for a user.
        
        Args:
            user_id: User ID
            limit: Optional limit on results
            
        Returns:
            List: List of book records
        """
        try:
            query = self.client.table('books').select('*').eq('user_id', user_id).order('created_at', desc=True)
            
            if limit:
                query = query.limit(limit)
            
            result = query.execute()
            return result.data or []
            
        except Exception as e:
            self.logger.error(f"Error getting user books for {user_id}: {str(e)}")
            raise DatabaseError(f"Failed to get user books: {str(e)}")
    
    def get_anonymous_books(self, anonymous_user_id: str, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get all books for an anonymous user.
        
        Args:
            anonymous_user_id: Anonymous user ID
            limit: Optional limit on results
            
        Returns:
            List: List of book records
        """
        try:
            query = self.service_client.table('books').select('*').eq('anonymous_user_id', anonymous_user_id).is_('user_id', 'null').order('created_at', desc=True)
            
            if limit:
                query = query.limit(limit)
            
            result = query.execute()
            return result.data or []
            
        except Exception as e:
            self.logger.error(f"Error getting anonymous books for {anonymous_user_id}: {str(e)}")
            raise DatabaseError(f"Failed to get anonymous books: {str(e)}")
    
    def get_book_by_id_and_owner(self, book_id: str, user_id: str = None, anonymous_user_id: str = None) -> Optional[Dict[str, Any]]:
        """
        Get book record by ID and owner (either authenticated user or anonymous user).
        
        Args:
            book_id: Book ID
            user_id: User ID (for authenticated users)
            anonymous_user_id: Anonymous user ID (for anonymous users)
            
        Returns:
            Dict or None: Book record if found and owned by the user
        """
        try:
            if user_id:
                # Get authenticated user's book
                result = self.client.table('books').select('*').eq('id', book_id).eq('user_id', user_id).execute()
            elif anonymous_user_id:
                # Get anonymous user's book
                result = self.service_client.table('books').select('*').eq('id', book_id).eq('anonymous_user_id', anonymous_user_id).is_('user_id', 'null').execute()
            else:
                raise DatabaseError("Either user_id or anonymous_user_id must be provided")
            
            if result.data:
                return result.data[0]
            return None
            
        except Exception as e:
            self.logger.error(f"Error getting book {book_id}: {str(e)}")
            raise DatabaseError(f"Failed to get book: {str(e)}")
    
    def link_anonymous_books_to_user(self, anonymous_user_id: str, user_id: str) -> int:
        """
        Link anonymous books to a user account when they sign up/login.
        
        Args:
            anonymous_user_id: Anonymous user ID
            user_id: Authenticated user ID
            
        Returns:
            int: Number of books linked
        """
        try:
            # Update anonymous books to be owned by the authenticated user
            result = self.service_client.table('books').update({
                'user_id': user_id,
                'anonymous_user_id': None
            }).eq('anonymous_user_id', anonymous_user_id).is_('user_id', 'null').execute()
            
            linked_count = len(result.data) if result.data else 0
            
            if linked_count > 0:
                self.logger.info(f"Linked {linked_count} anonymous books to user {user_id}")
                
                # Update user's total book count
                try:
                    profile = self.get_profile(user_id)
                    if profile:
                        current_total = profile.get('total_books_generated', 0)
                        self.update_profile(user_id, {
                            'total_books_generated': current_total + linked_count
                        })
                except Exception as profile_error:
                    self.logger.warning(f"Failed to update book count for user {user_id}: {str(profile_error)}")
            
            return linked_count
            
        except Exception as e:
            self.logger.error(f"Error linking anonymous books for {anonymous_user_id} to user {user_id}: {str(e)}")
            raise DatabaseError(f"Failed to link anonymous books: {str(e)}")
    
    def count_anonymous_books(self, anonymous_user_id: str) -> int:
        """
        Count books generated by an anonymous user.
        
        Args:
            anonymous_user_id: Anonymous user ID
            
        Returns:
            int: Number of books generated
        """
        try:
            result = self.service_client.table('books').select('id', count='exact').eq('anonymous_user_id', anonymous_user_id).is_('user_id', 'null').execute()
            return result.count if hasattr(result, 'count') else 0
            
        except Exception as e:
            self.logger.error(f"Error counting anonymous books for {anonymous_user_id}: {str(e)}")
            raise DatabaseError(f"Failed to count anonymous books: {str(e)}")
    
    # Profile table operations
    def create_profile(self, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a user profile.
        
        Args:
            profile_data: Profile data dictionary
            
        Returns:
            Dict: Created profile record
        """
        try:
            # Ensure created_at is properly formatted
            if 'created_at' not in profile_data:
                profile_data['created_at'] = format_for_database()
            
            # Set default values
            profile_data.setdefault('subscription_status', 'free')
            profile_data.setdefault('books_generated_today', 0)
            
            result = self.service_client.table('profiles').insert(profile_data).execute()
            
            if not result.data:
                raise DatabaseError("Failed to create profile")
            
            self.logger.info(f"Created profile for user: {profile_data.get('id')}")
            return result.data[0]
            
        except Exception as e:
            self.logger.error(f"Error creating profile: {str(e)}")
            raise DatabaseError(f"Failed to create profile: {str(e)}")
    
    def get_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user profile by ID.
        
        Args:
            user_id: User ID
            
        Returns:
            Dict or None: Profile record if found
        """
        try:
            result = self.client.table('profiles').select('*').eq('id', user_id).execute()
            
            if result.data:
                return result.data[0]
            return None
            
        except Exception as e:
            self.logger.error(f"Error getting profile for {user_id}: {str(e)}")
            raise DatabaseError(f"Failed to get profile: {str(e)}")
    
    def update_profile(self, user_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update user profile.
        
        Args:
            user_id: User ID
            updates: Fields to update
            
        Returns:
            Dict: Updated profile record
        """
        try:
            # Add updated_at timestamp
            updates['updated_at'] = format_for_database()
            
            result = self.service_client.table('profiles').update(updates).eq('id', user_id).execute()
            
            if not result.data:
                raise DatabaseError("Profile not found")
            
            self.logger.info(f"Updated profile for user: {user_id}")
            return result.data[0]
            
        except Exception as e:
            self.logger.error(f"Error updating profile for {user_id}: {str(e)}")
            raise DatabaseError(f"Failed to update profile: {str(e)}")
    
    # Billing events operations
    def create_billing_event(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a billing event record.
        
        Args:
            event_data: Billing event data
            
        Returns:
            Dict: Created billing event record
        """
        try:
            # Ensure processed_at is properly formatted
            if 'processed_at' not in event_data:
                event_data['processed_at'] = format_for_database()
            
            # Set default processing status
            event_data.setdefault('processing_status', 'pending')
            
            result = self.service_client.table('billing_events').insert(event_data).execute()
            
            if not result.data:
                raise DatabaseError("Failed to create billing event")
            
            self.logger.info(f"Created billing event: {event_data.get('stripe_event_id')}")
            return result.data[0]
            
        except Exception as e:
            self.logger.error(f"Error creating billing event: {str(e)}")
            raise DatabaseError(f"Failed to create billing event: {str(e)}")
    
    # Health check
    def health_check(self) -> Dict[str, Any]:
        """
        Perform database health check.
        
        Returns:
            Dict: Health check results
        """
        try:
            # Simple query to test database connection
            result = self.client.table('profiles').select('id').limit(1).execute()
            
            return {
                'status': 'healthy',
                'database': 'connected',
                'tables_accessible': True
            }
            
        except Exception as e:
            self.logger.error(f"Database health check failed: {str(e)}")
            return {
                'status': 'unhealthy',
                'database': 'disconnected',
                'error': str(e)
            }


# Global instance
_db_service = None


def get_database_service() -> DatabaseService:
    """Get global database service instance."""
    global _db_service
    if _db_service is None:
        _db_service = DatabaseService()
    return _db_service 