import bcrypt from 'bcryptjs';
import { supabase } from './supabase';

/**
 * Hash a password using bcrypt
 * @param password Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
}

/**
 * Verify a password against a hash
 * @param password Plain text password
 * @param hash Hashed password from database
 * @returns true if password matches, false otherwise
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
}

/**
 * Generate a secure random session token
 * @returns Random session token string
 */
export function generateSessionToken(): string {
    // Generate a secure random token
    return crypto.randomUUID() + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2);
}

/**
 * Create a session for a user
 * @param userId User ID
 * @returns Session token
 */
export async function createSession(userId: string): Promise<string> {
    const sessionToken = generateSessionToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now (better for PWA)

    // Store session in database (we'll use a simple sessions table or store in users table)
    // For now, we'll store it in a cookie and verify against user_id
    // In a production app, you'd want a sessions table
    
    return sessionToken;
}

/**
 * Get current user ID from session cookie
 * @param request Next.js request object (required for server-side)
 * @returns User ID if authenticated, null otherwise
 */
export async function getCurrentUserId(request: Request): Promise<string | null> {
    try {
        // Get session token from cookie
        const cookieHeader = request.headers.get('cookie');
        if (!cookieHeader) {
            return null;
        }

        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            acc[key] = decodeURIComponent(value);
            return acc;
        }, {} as Record<string, string>);

        const sessionToken = cookies['sessionToken'] || null;
        
        // If we have a sessionToken, use it (new auth method)
        if (sessionToken) {
            // Parse session token to get user ID
            // New format: userId::timestamp::random (using :: as separator)
            // Old format: userId-timestamp-random (UUID has dashes, so this was buggy)
            let userId: string;
            
            if (sessionToken.includes('::')) {
                // New format with :: separator
                const parts = sessionToken.split('::');
                if (parts.length < 3) {
                    return null;
                }
                userId = parts[0];
            } else {
                // Old format - UUID is first 5 dash-separated parts
                // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 chars with dashes)
                const parts = sessionToken.split('-');
                if (parts.length < 7) {
                    // Not enough parts for UUID + timestamp + random
                    return null;
                }
                // Reconstruct UUID from first 5 parts
                userId = parts.slice(0, 5).join('-');
            }
            
            // Verify user exists in database
            const { data: user } = await supabase
                .from('users')
                .select('id')
                .eq('id', userId)
                .single();

            return user ? userId : null;
        }

        // Fallback: Check for old authentication method (backwards compatibility)
        // If isAuthenticated cookie exists, look up user by email
        const isAuthenticated = cookies['isAuthenticated'] === 'true';
        const userEmail = cookies['userEmail'];
        
        if (isAuthenticated && userEmail) {
            // Look up user by email
            const { data: user } = await supabase
                .from('users')
                .select('id')
                .eq('email', userEmail.toLowerCase().trim())
                .single();

            if (user) {
                console.log(`[Auth] Fallback auth: Found user ${user.id} for email ${userEmail}`);
                return user.id;
            } else {
                console.warn(`[Auth] Fallback auth: No user found for email ${userEmail}`);
                return null;
            }
        }

        return null;
    } catch (error) {
        console.error('Error getting current user ID:', error);
        return null;
    }
}

/**
 * Check if user is authenticated (either via sessionToken or fallback)
 * Returns userId if authenticated, null otherwise
 * Also returns a flag indicating if this is fallback auth (user might not exist in DB)
 */
export async function checkAuthentication(request: Request): Promise<{ userId: string | null; isFallback: boolean; userEmail?: string }> {
    const userId = await getCurrentUserId(request);
    if (userId) {
        return { userId, isFallback: false };
    }

    // Check for fallback authentication
    try {
        const cookieHeader = request.headers.get('cookie') || '';
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            acc[key] = decodeURIComponent(value);
            return acc;
        }, {} as Record<string, string>);

        const isAuthenticated = cookies['isAuthenticated'] === 'true';
        const userEmail = cookies['userEmail'];

        if (isAuthenticated && userEmail) {
            // Try to find user by email
            const { data: user } = await supabase
                .from('users')
                .select('id')
                .eq('email', userEmail.toLowerCase().trim())
                .single();

            if (user) {
                return { userId: user.id, isFallback: false, userEmail };
            } else {
                // Fallback auth but user doesn't exist in DB yet (migration period)
                return { userId: null, isFallback: true, userEmail };
            }
        }
    } catch (error) {
        console.error('Error checking fallback auth:', error);
    }

    return { userId: null, isFallback: false };
}

/**
 * Get current user info from session
 * @param request Next.js request object (required for server-side)
 * @returns User object if authenticated, null otherwise
 */
export async function getCurrentUser(request: Request): Promise<{ id: string; email: string; first_name: string | null; last_name: string | null } | null> {
    const userId = await getCurrentUserId(request);
    if (!userId) {
        return null;
    }

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, first_name, last_name')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return null;
        }

        return user;
    } catch (error) {
        console.error('Error getting current user:', error);
        return null;
    }
}

