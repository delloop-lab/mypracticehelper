import { NextResponse } from 'next/server';
import { checkAuthentication } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { userId, isFallback, userEmail } = await checkAuthentication(request);
        
        // Also check directly in database
        let dbUser = null;
        if (userEmail) {
            const { data } = await supabase
                .from('users')
                .select('id, email, first_name, last_name, created_at')
                .eq('email', userEmail.toLowerCase().trim())
                .maybeSingle();
            dbUser = data;
        }
        
        return NextResponse.json({
            authenticated: !!userId || isFallback,
            userId: userId || null,
            isFallback,
            userEmail: userEmail || null,
            userExistsInDatabase: !!dbUser,
            dbUser: dbUser || null,
            message: dbUser 
                ? `User found in database with ID: ${dbUser.id}`
                : isFallback 
                    ? `User authenticated via fallback (no user_id in database yet)`
                    : 'Not authenticated'
        });
    } catch (error: any) {
        console.error('Error checking user:', error);
        return NextResponse.json(
            { error: error.message || 'An error occurred' },
            { status: 500 }
        );
    }
}

