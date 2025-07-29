"""
Billing service for handling Stripe billing events with proper database constraints.
"""

import logging
import uuid
from typing import Dict, Any, Optional
from lib.database_service import get_database_service, DatabaseError
from lib.user_profile_service import get_profile_service, ProfileError
from utils.datetime_utils import format_for_database


class BillingError(Exception):
    """Custom exception for billing operations."""
    pass


class BillingService:
    """Service for handling billing events and subscription management."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.db = get_database_service()
        self.profile_service = get_profile_service()
    
    def process_stripe_webhook(self, stripe_event_id: str, event_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process a Stripe webhook event.
        
        Args:
            stripe_event_id: Stripe event ID
            event_type: Type of Stripe event
            payload: Event payload from Stripe
            
        Returns:
            Dict: Created billing event record
            
        Raises:
            BillingError: If processing fails
        """
        try:
            # Extract customer ID from payload
            customer_id = self._extract_customer_id(payload)
            if not customer_id:
                raise BillingError(f"No customer ID found in event payload for event {stripe_event_id}")
            
            # Find user by Stripe customer ID
            user_id = self._find_user_by_customer_id(customer_id)
            if not user_id:
                raise BillingError(f"No user found for Stripe customer {customer_id}")
            
            # Ensure user profile exists (for foreign key constraint)
            try:
                self.profile_service.ensure_profile_exists(user_id)
            except ProfileError as e:
                raise BillingError(f"Could not ensure user profile exists: {str(e)}")
            
            # Create billing event record
            billing_event = self.create_billing_event(
                user_id=user_id,
                stripe_event_id=stripe_event_id,
                event_type=event_type,
                payload=payload
            )
            
            # Process the specific event type
            self._process_event_by_type(event_type, payload, user_id)
            
            # Mark event as processed
            self.mark_event_processed(billing_event['id'])
            
            self.logger.info(f"Successfully processed Stripe event {stripe_event_id} for user {user_id}")
            return billing_event
            
        except Exception as e:
            self.logger.error(f"Error processing Stripe webhook {stripe_event_id}: {str(e)}")
            raise BillingError(f"Failed to process webhook: {str(e)}")
    
    def create_billing_event(self, user_id: str, stripe_event_id: str, event_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a billing event record.
        
        Args:
            user_id: User ID (must exist in profiles table)
            stripe_event_id: Stripe event ID
            event_type: Type of event
            payload: Event payload
            
        Returns:
            Dict: Created billing event record
        """
        try:
            event_data = {
                'id': str(uuid.uuid4()),
                'user_id': user_id,
                'stripe_event_id': stripe_event_id,
                'event_type': event_type,
                'payload': payload,
                'processed_at': format_for_database(),
                'processing_status': 'pending'
            }
            
            return self.db.create_billing_event(event_data)
            
        except DatabaseError as e:
            self.logger.error(f"Error creating billing event: {str(e)}")
            raise BillingError(f"Failed to create billing event: {str(e)}")
    
    def mark_event_processed(self, event_id: str, error_message: Optional[str] = None) -> None:
        """
        Mark a billing event as processed or failed.
        
        Args:
            event_id: Billing event ID
            error_message: Error message if processing failed
        """
        try:
            status = 'failed' if error_message else 'completed'
            updates = {
                'processing_status': status,
                'processed_at': format_for_database()
            }
            
            if error_message:
                updates['error_message'] = error_message
            
            # Note: We would need to add an update method for billing events
            # For now, we'll use the service client directly
            self.db.service_client.table('billing_events').update(updates).eq('id', event_id).execute()
            
            self.logger.info(f"Marked billing event {event_id} as {status}")
            
        except Exception as e:
            self.logger.error(f"Error marking event {event_id} as processed: {str(e)}")
    
    def handle_subscription_created(self, user_id: str, subscription_data: Dict[str, Any]) -> None:
        """
        Handle subscription.created event.
        
        Args:
            user_id: User ID
            subscription_data: Subscription data from Stripe
        """
        try:
            # Extract subscription details
            subscription_status = subscription_data.get('status', 'active')
            price_id = subscription_data.get('items', {}).get('data', [{}])[0].get('price', {}).get('id')
            
            # Map price ID to subscription tier
            subscription_tier = self._map_price_to_tier(price_id)
            
            # Update user profile with subscription status
            self.profile_service.update_subscription_status(user_id, subscription_tier)
            
            self.logger.info(f"Updated subscription for user {user_id} to {subscription_tier}")
            
        except Exception as e:
            self.logger.error(f"Error handling subscription created for user {user_id}: {str(e)}")
            raise BillingError(f"Failed to handle subscription created: {str(e)}")
    
    def handle_subscription_updated(self, user_id: str, subscription_data: Dict[str, Any]) -> None:
        """
        Handle subscription.updated event.
        
        Args:
            user_id: User ID
            subscription_data: Subscription data from Stripe
        """
        try:
            subscription_status = subscription_data.get('status', 'active')
            
            # If subscription is cancelled or past due, downgrade to free
            if subscription_status in ['canceled', 'past_due', 'unpaid']:
                self.profile_service.update_subscription_status(user_id, 'free')
                self.logger.info(f"Downgraded user {user_id} to free due to status: {subscription_status}")
            else:
                # Handle active subscription updates
                price_id = subscription_data.get('items', {}).get('data', [{}])[0].get('price', {}).get('id')
                subscription_tier = self._map_price_to_tier(price_id)
                self.profile_service.update_subscription_status(user_id, subscription_tier)
                self.logger.info(f"Updated subscription for user {user_id} to {subscription_tier}")
            
        except Exception as e:
            self.logger.error(f"Error handling subscription updated for user {user_id}: {str(e)}")
            raise BillingError(f"Failed to handle subscription updated: {str(e)}")
    
    def handle_subscription_deleted(self, user_id: str, subscription_data: Dict[str, Any]) -> None:
        """
        Handle subscription.deleted event.
        
        Args:
            user_id: User ID
            subscription_data: Subscription data from Stripe
        """
        try:
            # Downgrade user to free tier
            self.profile_service.update_subscription_status(user_id, 'free')
            self.logger.info(f"Downgraded user {user_id} to free due to subscription deletion")
            
        except Exception as e:
            self.logger.error(f"Error handling subscription deleted for user {user_id}: {str(e)}")
            raise BillingError(f"Failed to handle subscription deleted: {str(e)}")
    
    def _extract_customer_id(self, payload: Dict[str, Any]) -> Optional[str]:
        """Extract Stripe customer ID from event payload."""
        # Different event types have customer ID in different locations
        data = payload.get('data', {}).get('object', {})
        
        # Direct customer field
        if 'customer' in data:
            return data['customer']
        
        # Invoice events
        if 'invoice' in payload.get('type', ''):
            return data.get('customer')
        
        # Subscription events
        if 'subscription' in payload.get('type', ''):
            return data.get('customer')
        
        return None
    
    def _find_user_by_customer_id(self, customer_id: str) -> Optional[str]:
        """
        Find user ID by Stripe customer ID.
        
        Args:
            customer_id: Stripe customer ID
            
        Returns:
            str or None: User ID if found
        """
        try:
            # Query profiles table for matching stripe_customer_id
            result = self.db.client.table('profiles').select('id').eq('stripe_customer_id', customer_id).execute()
            
            if result.data:
                return result.data[0]['id']
            return None
            
        except Exception as e:
            self.logger.error(f"Error finding user by customer ID {customer_id}: {str(e)}")
            return None
    
    def _map_price_to_tier(self, price_id: str) -> str:
        """
        Map Stripe price ID to subscription tier.
        
        Args:
            price_id: Stripe price ID
            
        Returns:
            str: Subscription tier ('free', 'premium', 'pro')
        """
        # This would typically be configured based on your Stripe price IDs
        price_mapping = {
            # Example price IDs - replace with your actual Stripe price IDs
            'price_premium_monthly': 'premium',
            'price_premium_yearly': 'premium',
            'price_pro_monthly': 'pro',
            'price_pro_yearly': 'pro'
        }
        
        return price_mapping.get(price_id, 'free')
    
    def _process_event_by_type(self, event_type: str, payload: Dict[str, Any], user_id: str) -> None:
        """
        Process event based on its type.
        
        Args:
            event_type: Stripe event type
            payload: Event payload
            user_id: User ID
        """
        data = payload.get('data', {}).get('object', {})
        
        handlers = {
            'customer.subscription.created': lambda: self.handle_subscription_created(user_id, data),
            'customer.subscription.updated': lambda: self.handle_subscription_updated(user_id, data),
            'customer.subscription.deleted': lambda: self.handle_subscription_deleted(user_id, data),
            'invoice.payment_succeeded': lambda: self._handle_payment_succeeded(user_id, data),
            'invoice.payment_failed': lambda: self._handle_payment_failed(user_id, data)
        }
        
        handler = handlers.get(event_type)
        if handler:
            handler()
        else:
            self.logger.info(f"No specific handler for event type: {event_type}")
    
    def _handle_payment_succeeded(self, user_id: str, invoice_data: Dict[str, Any]) -> None:
        """Handle successful payment."""
        self.logger.info(f"Payment succeeded for user {user_id}: {invoice_data.get('id')}")
        # Add any specific logic for successful payments
    
    def _handle_payment_failed(self, user_id: str, invoice_data: Dict[str, Any]) -> None:
        """Handle failed payment."""
        self.logger.warning(f"Payment failed for user {user_id}: {invoice_data.get('id')}")
        # Add any specific logic for failed payments (notifications, etc.)


# Global instance
_billing_service = None


def get_billing_service() -> BillingService:
    """Get global billing service instance."""
    global _billing_service
    if _billing_service is None:
        _billing_service = BillingService()
    return _billing_service 