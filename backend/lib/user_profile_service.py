"""
User profile management service for automatic profile creation and management.
"""

import logging
from typing import Optional, Dict, Any
from lib.database_service import get_database_service, DatabaseError
from utils.datetime_utils import format_for_database


class ProfileError(Exception):
    """Custom exception for profile operations."""
    pass


class UserProfileService:
    """Service for managing user profiles."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.db = get_database_service()
    
    def ensure_profile_exists(self, user_id: str, user_email: str = None, user_metadata: Dict[str, Any] = None, jwt_token: str = None) -> Dict[str, Any]:
        """
        Ensure user profile exists, create if it doesn't.
        
        This is the main method to call before any book operations to ensure
        the user has a profile record for foreign key constraints.
        
        Args:
            user_id: User ID from authentication
            user_email: User email (optional)
            user_metadata: Additional user metadata (optional)
            jwt_token: JWT token for authenticated database operations (optional)
            
        Returns:
            Dict: User profile record
            
        Raises:
            ProfileError: If profile operations fail
        """
        try:
            # First, try to get existing profile
            if jwt_token:
                profile = self.get_profile_with_jwt(user_id, jwt_token)
            else:
                profile = self.get_profile(user_id)
            
            if profile:
                self.logger.debug(f"Profile exists for user: {user_id}")
                return profile
            
            # Profile doesn't exist, create it
            self.logger.info(f"Creating new profile for user: {user_id}")
            if jwt_token:
                return self.create_profile_with_jwt(user_id, user_email, user_metadata, jwt_token)
            else:
                return self.create_profile(user_id, user_email, user_metadata)
            
        except Exception as e:
            self.logger.error(f"Error ensuring profile exists for {user_id}: {str(e)}")
            raise ProfileError(f"Failed to ensure profile exists: {str(e)}")
    
    def create_profile(self, user_id: str, user_email: str = None, user_metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Create a new user profile.
        
        Args:
            user_id: User ID
            user_email: User email (optional)
            user_metadata: Additional metadata (optional)
            
        Returns:
            Dict: Created profile record
        """
        try:
            # Extract full name from metadata or email
            full_name = None
            if user_metadata:
                full_name = user_metadata.get('full_name') or user_metadata.get('name')
            
            if not full_name and user_email:
                # Extract name from email if no full name available
                full_name = user_email.split('@')[0].replace('.', ' ').replace('_', ' ').title()
            
            profile_data = {
                'id': user_id,
                'full_name': full_name,
                'subscription_status': 'free',
                'books_generated_today': 0,
                'created_at': format_for_database(),
                'updated_at': format_for_database()
            }
            
            # Add avatar URL if available in metadata
            if user_metadata and user_metadata.get('avatar_url'):
                profile_data['avatar_url'] = user_metadata['avatar_url']
            
            profile = self.db.create_profile(profile_data)
            self.logger.info(f"Successfully created profile for user: {user_id}")
            
            return profile
            
        except DatabaseError as e:
            # Check if it's a duplicate key error (user already exists)
            if 'duplicate key' in str(e).lower() or 'already exists' in str(e).lower():
                self.logger.info(f"Profile already exists for user: {user_id}, fetching existing")
                return self.get_profile(user_id)
            raise ProfileError(f"Failed to create profile: {str(e)}")
        except Exception as e:
            self.logger.error(f"Error creating profile for {user_id}: {str(e)}")
            raise ProfileError(f"Failed to create profile: {str(e)}")
    
    def get_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user profile by ID.
        
        Args:
            user_id: User ID
            
        Returns:
            Dict or None: Profile record if found
        """
        try:
            return self.db.get_profile(user_id)
        except Exception as e:
            self.logger.error(f"Error getting profile for {user_id}: {str(e)}")
            raise ProfileError(f"Failed to get profile: {str(e)}")
    
    def create_profile_with_jwt(self, user_id: str, user_email: str = None, user_metadata: Dict[str, Any] = None, jwt_token: str = None) -> Dict[str, Any]:
        """
        Create a new user profile using JWT authentication.
        
        Args:
            user_id: User ID
            user_email: User email (optional)
            user_metadata: Additional metadata (optional)
            jwt_token: JWT token for authentication (optional)
            
        Returns:
            Dict: Created profile record
        """
        try:
            # Extract full name from metadata or email
            full_name = None
            if user_metadata:
                full_name = user_metadata.get('full_name') or user_metadata.get('name')
            
            if not full_name and user_email:
                # Extract name from email if no full name available
                full_name = user_email.split('@')[0].replace('.', ' ').replace('_', ' ').title()
            
            profile_data = {
                'id': user_id,
                'full_name': full_name,
                'subscription_status': 'free',
                'books_generated_today': 0,
                'total_books_generated': 0
            }
            
            # Add avatar URL if available in metadata
            if user_metadata and user_metadata.get('avatar_url'):
                profile_data['avatar_url'] = user_metadata['avatar_url']
            
            if jwt_token:
                profile = self.db.create_profile_with_jwt_fallback(profile_data, jwt_token)
            else:
                profile = self.db.create_profile(profile_data)
                
            self.logger.info(f"Successfully created profile for user: {user_id}")
            return profile
            
        except Exception as e:
            self.logger.error(f"Error creating profile for {user_id}: {str(e)}")
            raise ProfileError(f"Failed to create profile: {str(e)}")
    
    def get_profile_with_jwt(self, user_id: str, jwt_token: str) -> Optional[Dict[str, Any]]:
        """
        Get user profile by ID using JWT authentication.
        
        Args:
            user_id: User ID
            jwt_token: JWT token for authentication
            
        Returns:
            Dict or None: Profile record if found
        """
        try:
            return self.db.get_profile_with_jwt_fallback(user_id, jwt_token)
        except Exception as e:
            self.logger.error(f"Error getting profile for {user_id} with JWT: {str(e)}")
            raise ProfileError(f"Failed to get profile: {str(e)}")
    
    def update_profile_with_jwt(self, user_id: str, updates: Dict[str, Any], jwt_token: str) -> Dict[str, Any]:
        """
        Update user profile using JWT authentication.
        
        Args:
            user_id: User ID
            updates: Fields to update
            jwt_token: JWT token for authentication
            
        Returns:
            Dict: Updated profile record
        """
        try:
            return self.db.update_profile_with_jwt_fallback(user_id, updates, jwt_token)
        except Exception as e:
            self.logger.error(f"Error updating profile for {user_id} with JWT: {str(e)}")
            raise ProfileError(f"Failed to update profile: {str(e)}")
    
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
            return self.db.update_profile(user_id, updates)
        except Exception as e:
            self.logger.error(f"Error updating profile for {user_id}: {str(e)}")
            raise ProfileError(f"Failed to update profile: {str(e)}")
    
    def increment_daily_book_count(self, user_id: str) -> Dict[str, Any]:
        """
        Increment the daily book generation count for a user.
        
        Args:
            user_id: User ID
            
        Returns:
            Dict: Updated profile record
        """
        try:
            profile = self.get_profile(user_id)
            if not profile:
                raise ProfileError("Profile not found")
            
            current_count = profile.get('books_generated_today', 0)
            
            updates = {
                'books_generated_today': current_count + 1,
                'last_generation_date': format_for_database()[:10]  # YYYY-MM-DD format
            }
            
            return self.update_profile(user_id, updates)
            
        except Exception as e:
            self.logger.error(f"Error incrementing book count for {user_id}: {str(e)}")
            raise ProfileError(f"Failed to increment book count: {str(e)}")
    
    def reset_daily_book_count(self, user_id: str) -> Dict[str, Any]:
        """
        Reset the daily book generation count (typically called daily).
        
        Args:
            user_id: User ID
            
        Returns:
            Dict: Updated profile record
        """
        try:
            updates = {
                'books_generated_today': 0,
                'last_generation_date': format_for_database()[:10]
            }
            
            return self.update_profile(user_id, updates)
            
        except Exception as e:
            self.logger.error(f"Error resetting book count for {user_id}: {str(e)}")
            raise ProfileError(f"Failed to reset book count: {str(e)}")
    
    def check_generation_limit(self, user_id: str = None, anonymous_user_id: str = None, jwt_token: str = None) -> Dict[str, Any]:
        """
        Check if user has exceeded generation limit (supports both authenticated and anonymous users).
        
        Args:
            user_id: User ID (for authenticated users)
            anonymous_user_id: Anonymous user ID (for anonymous users)
            jwt_token: JWT token for authentication (optional)
            
        Returns:
            Dict: Contains 'allowed' boolean, 'remaining' count, and limit info
        """
        try:
            if user_id:
                # Authenticated user - check profile-based limits
                if jwt_token:
                    profile = self.get_profile_with_jwt(user_id, jwt_token)
                else:
                    profile = self.get_profile(user_id)
                    
                if not profile:
                    raise ProfileError("Profile not found")
                
                subscription_status = profile.get('subscription_status', 'free')
                total_books = profile.get('total_books_generated', 0)
                daily_books = profile.get('books_generated_today', 0)
                
                if subscription_status == 'free':
                    # Free users: 1 book total lifetime
                    allowed = total_books < 1
                    remaining = max(0, 1 - total_books)
                    limit_type = 'lifetime'
                    limit_value = 1
                elif subscription_status == 'pro':
                    # Pro users: 10 books per day
                    allowed = daily_books < 10
                    remaining = max(0, 10 - daily_books)
                    limit_type = 'daily'
                    limit_value = 10
                else:
                    # Unknown subscription status
                    allowed = False
                    remaining = 0
                    limit_type = 'none'
                    limit_value = 0
                
                return {
                    'allowed': allowed,
                    'remaining': remaining,
                    'limit_type': limit_type,
                    'limit_value': limit_value,
                    'current_count': total_books if limit_type == 'lifetime' else daily_books,
                    'subscription_status': subscription_status,
                    'user_type': 'authenticated'
                }
                
            elif anonymous_user_id:
                # Anonymous user - check anonymous book count
                anonymous_book_count = self.db.count_anonymous_books(anonymous_user_id)
                allowed = anonymous_book_count < 1
                remaining = max(0, 1 - anonymous_book_count)
                
                return {
                    'allowed': allowed,
                    'remaining': remaining,
                    'limit_type': 'lifetime',
                    'limit_value': 1,
                    'current_count': anonymous_book_count,
                    'subscription_status': 'anonymous',
                    'user_type': 'anonymous'
                }
            
            else:
                raise ProfileError("Either user_id or anonymous_user_id must be provided")
            
        except Exception as e:
            self.logger.error(f"Error checking generation limit: {str(e)}")
            raise ProfileError(f"Failed to check generation limit: {str(e)}")
    
    def update_subscription_status(self, user_id: str, status: str, stripe_customer_id: str = None) -> Dict[str, Any]:
        """
        Update user subscription status.
        
        Args:
            user_id: User ID
            status: New subscription status ('free', 'premium', 'pro')
            stripe_customer_id: Stripe customer ID (optional)
            
        Returns:
            Dict: Updated profile record
        """
        try:
            updates = {
                'subscription_status': status
            }
            
            if stripe_customer_id:
                updates['stripe_customer_id'] = stripe_customer_id
            
            return self.update_profile(user_id, updates)
            
        except Exception as e:
            self.logger.error(f"Error updating subscription for {user_id}: {str(e)}")
            raise ProfileError(f"Failed to update subscription: {str(e)}")
    
    def handle_user_login(self, user_id: str, user_email: str = None, user_metadata: Dict[str, Any] = None, anonymous_user_id: str = None) -> Dict[str, Any]:
        """
        Handle user login/signup, including linking anonymous books if applicable.
        
        Args:
            user_id: User ID from authentication
            user_email: User email (optional)
            user_metadata: Additional user metadata (optional)
            anonymous_user_id: Anonymous user ID to link books from (optional)
            
        Returns:
            Dict: Contains profile info and linking results
        """
        try:
            # Ensure profile exists
            profile = self.ensure_profile_exists(user_id, user_email, user_metadata)
            
            linked_books = 0
            
            # Link anonymous books if anonymous_user_id provided
            if anonymous_user_id:
                try:
                    linked_books = self.db.link_anonymous_books_to_user(anonymous_user_id, user_id)
                    
                    if linked_books > 0:
                        # Update profile with new total book count
                        current_total = profile.get('total_books_generated', 0)
                        updated_profile = self.update_profile(user_id, {
                            'total_books_generated': current_total + linked_books
                        })
                        profile = updated_profile
                        
                        self.logger.info(f"Linked {linked_books} anonymous books to user {user_id}")
                    
                except Exception as link_error:
                    self.logger.warning(f"Failed to link anonymous books for user {user_id}: {str(link_error)}")
            
            return {
                'profile': profile,
                'linked_books': linked_books,
                'success': True
            }
            
        except Exception as e:
            self.logger.error(f"Error handling user login for {user_id}: {str(e)}")
            raise ProfileError(f"Failed to handle user login: {str(e)}")
    
    def increment_total_book_count(self, user_id: str, jwt_token: str = None) -> Dict[str, Any]:
        """
        Increment the total lifetime book count for a user.
        
        Args:
            user_id: User ID
            jwt_token: JWT token for authentication (optional)
            
        Returns:
            Dict: Updated profile record
        """
        try:
            if jwt_token:
                profile = self.get_profile_with_jwt(user_id, jwt_token)
            else:
                profile = self.get_profile(user_id)
                
            if not profile:
                raise ProfileError("Profile not found")
            
            current_total = profile.get('total_books_generated', 0)
            current_daily = profile.get('books_generated_today', 0)
            
            updates = {
                'total_books_generated': current_total + 1,
                'books_generated_today': current_daily + 1,
                'last_generation_date': format_for_database()[:10]  # YYYY-MM-DD format
            }
            
            if jwt_token:
                return self.update_profile_with_jwt(user_id, updates, jwt_token)
            else:
                return self.update_profile(user_id, updates)
            
        except Exception as e:
            self.logger.error(f"Error incrementing total book count for {user_id}: {str(e)}")
            raise ProfileError(f"Failed to increment total book count: {str(e)}")


# Global instance
_profile_service = None


def get_profile_service() -> UserProfileService:
    """Get global profile service instance."""
    global _profile_service
    if _profile_service is None:
        _profile_service = UserProfileService()
    return _profile_service 