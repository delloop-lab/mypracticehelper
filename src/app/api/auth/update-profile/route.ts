import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
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
        const { firstName, lastName } = body;

        // Validate input
        if (typeof firstName !== 'string' || typeof lastName !== 'string') {
            return NextResponse.json(
                { error: 'First name and last name are required' },
                { status: 400 }
            );
        }

        // Update user in database
        const { data, error } = await supabase
            .from('users')
            .update({
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id)
            .select('id, email, first_name, last_name')
            .single();

        if (error) {
            console.error('[Update Profile] Database error:', error);
            return NextResponse.json(
                { error: 'Failed to update profile' },
                { status: 500 }
            );
        }

        console.log('[Update Profile] Profile updated for user:', user.id, {
            first_name: data.first_name,
            last_name: data.last_name
        });

        return NextResponse.json({
            success: true,
            user: {
                id: data.id,
                email: data.email,
                first_name: data.first_name,
                last_name: data.last_name
            }
        });
    } catch (error) {
        console.error('[Update Profile] Error:', error);
        return NextResponse.json(
            { error: 'An error occurred' },
            { status: 500 }
        );
    }
}
