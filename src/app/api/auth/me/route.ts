import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const user = await getCurrentUser(request);

        if (!user) {
            console.log('[Auth/Me] No authenticated user found');
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        console.log('[Auth/Me] User found:', {
            id: user.id,
            email: user.email,
            first_name: user.first_name || '(empty)',
            last_name: user.last_name || '(empty)'
        });

        // If first_name and last_name are empty, log a warning with SQL to fix
        if (!user.first_name && !user.last_name) {
            console.warn(`[Auth/Me] ⚠️ User ${user.email} is missing first_name and last_name!`);
            console.warn(`[Auth/Me] Run this SQL: UPDATE users SET first_name = 'Claire', last_name = 'Schillaci' WHERE email = '${user.email}';`);
        }

        return NextResponse.json({
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
        });
    } catch (error) {
        console.error('Error getting current user:', error);
        return NextResponse.json(
            { error: 'An error occurred' },
            { status: 500 }
        );
    }
}





