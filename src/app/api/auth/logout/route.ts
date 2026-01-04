import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
    const response = NextResponse.json({ success: true });

    // Clear all auth cookies
    response.cookies.delete('sessionToken');
    response.cookies.delete('userEmail');
    response.cookies.delete('isAuthenticated');

    return response;
}





