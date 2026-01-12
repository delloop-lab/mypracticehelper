import { NextResponse } from 'next/server';
import { getCurrentUser, verifyPassword } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
    try {
        const user = await getCurrentUser(request);

        if (!user) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { newEmail, currentPassword } = body;

        // Validate input
        if (!newEmail || typeof newEmail !== 'string') {
            return NextResponse.json(
                { error: 'New email is required' },
                { status: 400 }
            );
        }

        if (!currentPassword || typeof currentPassword !== 'string') {
            return NextResponse.json(
                { error: 'Current password is required to change email' },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        const normalizedEmail = newEmail.toLowerCase().trim();

        // Check if new email is same as current
        if (normalizedEmail === user.email.toLowerCase()) {
            return NextResponse.json(
                { error: 'New email is the same as current email' },
                { status: 400 }
            );
        }

        // Check if new email is already in use by another user
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('id')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (checkError) {
            console.error('[Update Email] Error checking existing email:', checkError);
            return NextResponse.json(
                { error: 'Failed to verify email availability' },
                { status: 500 }
            );
        }

        if (existingUser) {
            return NextResponse.json(
                { error: 'This email is already in use by another account' },
                { status: 409 }
            );
        }

        // Get user's password hash to verify current password
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('password_hash')
            .eq('id', user.id)
            .single();

        if (userError || !userData?.password_hash) {
            console.error('[Update Email] Error fetching user password:', userError);
            return NextResponse.json(
                { error: 'Failed to verify password' },
                { status: 500 }
            );
        }

        // Verify current password
        const isValidPassword = await verifyPassword(currentPassword, userData.password_hash);
        if (!isValidPassword) {
            return NextResponse.json(
                { error: 'Current password is incorrect' },
                { status: 401 }
            );
        }

        // Update email in database
        const { data, error } = await supabase
            .from('users')
            .update({
                email: normalizedEmail,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id)
            .select('id, email, first_name, last_name')
            .single();

        if (error) {
            console.error('[Update Email] Database error:', error);
            return NextResponse.json(
                { error: 'Failed to update email' },
                { status: 500 }
            );
        }

        console.log('[Update Email] Email updated for user:', user.id, {
            old_email: user.email,
            new_email: data.email
        });

        return NextResponse.json({
            success: true,
            message: 'Email updated successfully. Please login with your new email address.',
            user: {
                id: data.id,
                email: data.email,
                first_name: data.first_name,
                last_name: data.last_name
            }
        });
    } catch (error) {
        console.error('[Update Email] Error:', error);
        return NextResponse.json(
            { error: 'An error occurred' },
            { status: 500 }
        );
    }
}
