/**
 * Anonymous user management utilities
 */

const ANONYMOUS_USER_ID_KEY = 'bookmonarch_anonymous_user_id';

/**
 * Generate a new anonymous user ID
 */
export function generateAnonymousUserId(): string {
  return `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get or create an anonymous user ID (tab-specific to avoid conflicts)
 */
export function getAnonymousUserId(): string {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return generateAnonymousUserId();
  }

  try {
    // Use sessionStorage instead of localStorage for tab-specific IDs
    let anonymousId = sessionStorage.getItem(ANONYMOUS_USER_ID_KEY);
    
    if (!anonymousId) {
      // Generate new ID if none exists for this tab
      anonymousId = generateAnonymousUserId();
      sessionStorage.setItem(ANONYMOUS_USER_ID_KEY, anonymousId);
    }
    
    return anonymousId;
  } catch (error) {
    // Fallback if sessionStorage is not available
    console.warn('sessionStorage not available, using session-only anonymous ID');
    return generateAnonymousUserId();
  }
}

/**
 * Clear the anonymous user ID (called when user logs in)
 */
export function clearAnonymousUserId(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    sessionStorage.removeItem(ANONYMOUS_USER_ID_KEY);
  } catch (error) {
    console.warn('Failed to clear anonymous user ID from sessionStorage');
  }
}

/**
 * Check if user is anonymous (not authenticated)
 */
export function isAnonymousUser(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  try {
    return sessionStorage.getItem(ANONYMOUS_USER_ID_KEY) !== null;
  } catch (error) {
    return true;
  }
}

/**
 * Get anonymous user ID for API requests (returns null if user is authenticated)
 */
export function getAnonymousUserIdForAPI(isAuthenticated: boolean): string | null {
  if (isAuthenticated) {
    return null;
  }
  return getAnonymousUserId();
}