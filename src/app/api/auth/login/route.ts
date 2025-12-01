import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyPassword, generateSessionToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json();

        // Validate input
        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required' },
                { status: 400 }
            );
        }

        // Look up user in database
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, email, password_hash, first_name, last_name')
            .eq('email', email.toLowerCase().trim())
            .single();

        if (userError || !user) {
            // Don't reveal if user exists or not (security best practice)
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            );
        }

        // Verify password
        const isValidPassword = await verifyPassword(password, user.password_hash);
        if (!isValidPassword) {
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            );
        }

        // Create session token
        // Format: userId-timestamp-random
        const sessionToken = `${user.id}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2)}`;
        
        // Set session cookie (7 days)
        const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
        const response = NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
            },
        });

        // Set secure cookie
        response.cookies.set('sessionToken', sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: maxAge,
            path: '/',
        });

        // Also set userEmail cookie for backwards compatibility (can remove later)
        response.cookies.set('userEmail', user.email, {
            httpOnly: false, // Needed for client-side access
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: maxAge,
            path: '/',
        });

        // Set isAuthenticated cookie for backwards compatibility with middleware
        response.cookies.set('isAuthenticated', 'true', {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: maxAge,
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'An error occurred during login' },
            { status: 500 }
        );
    }
}



