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
 * Get or create an anonymous user ID
 */
export function getAnonymousUserId(): string {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return generateAnonymousUserId();
  }

  try {
    // Try to get existing ID from localStorage
    let anonymousId = localStorage.getItem(ANONYMOUS_USER_ID_KEY);
    
    if (!anonymousId) {
      // Generate new ID if none exists
      anonymousId = generateAnonymousUserId();
      localStorage.setItem(ANONYMOUS_USER_ID_KEY, anonymousId);
    }
    
    return anonymousId;
  } catch (error) {
    // Fallback if localStorage is not available
    console.warn('localStorage not available, using session-only anonymous ID');
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
    localStorage.removeItem(ANONYMOUS_USER_ID_KEY);
  } catch (error) {
    console.warn('Failed to clear anonymous user ID from localStorage');
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
    return localStorage.getItem(ANONYMOUS_USER_ID_KEY) !== null;
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