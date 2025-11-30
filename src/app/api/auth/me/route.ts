import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const user = await getCurrentUser(request);

        if (!user) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
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


