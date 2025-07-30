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
    
    def ensure_profile_exists(self, user_id: str, user_email: str = None, user_metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Ensure user profile exists, create if it doesn't.
        
        This is the main method to call before any book operations to ensure
        the user has a profile record for foreign key constraints.
        
        Args:
            user_id: User ID from authentication
            user_email: User email (optional)
            user_metadata: Additional user metadata (optional)
            
        Returns:
            Dict: User profile record
            
        Raises:
            ProfileError: If profile operations fail
        """
        try:
            # First, try to get existing profile
            profile = self.get_profile(user_id)
            
            if profile:
                self.logger.debug(f"Profile exists for user: {user_id}")
                return profile
            
            # Profile doesn't exist, create it
            self.logger.info(f"Creating new profile for user: {user_id}")
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
    
    def check_generation_limit(self, user_id: str, daily_limit: int = 5) -> Dict[str, Any]:
        """
        Check if user has exceeded daily generation limit.
        
        Args:
            user_id: User ID
            daily_limit: Daily generation limit (default: 5)
            
        Returns:
            Dict: Contains 'allowed' boolean and 'remaining' count
        """
        try:
            profile = self.get_profile(user_id)
            if not profile:
                raise ProfileError("Profile not found")
            
            current_count = profile.get('books_generated_today', 0)
            subscription_status = profile.get('subscription_status', 'free')
            
            # Premium users might have higher limits
            if subscription_status == 'premium':
                daily_limit = 50  # Higher limit for premium users
            elif subscription_status == 'pro':
                daily_limit = 100  # Highest limit for pro users
            
            remaining = max(0, daily_limit - current_count)
            allowed = current_count < daily_limit
            
            return {
                'allowed': allowed,
                'remaining': remaining,
                'current_count': current_count,
                'daily_limit': daily_limit,
                'subscription_status': subscription_status
            }
            
        except Exception as e:
            self.logger.error(f"Error checking generation limit for {user_id}: {str(e)}")
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


# Global instance
_profile_service = None


def get_profile_service() -> UserProfileService:
    """Get global profile service instance."""
    global _profile_service
    if _profile_service is None:
        _profile_service = UserProfileService()
    return _profile_service 