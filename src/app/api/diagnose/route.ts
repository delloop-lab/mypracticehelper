import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    const diagnostics: any = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        supabaseConfigured: isSupabaseConfigured(),
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 
            (process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder') ? 'PLACEHOLDER (NOT SET)' : 'SET') : 
            'NOT SET',
        supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 
            (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('placeholder') ? 'PLACEHOLDER (NOT SET)' : 'SET') : 
            'NOT SET',
    };

    // Try to connect to Supabase
    if (isSupabaseConfigured()) {
        try {
            const { data: clients, error: clientsError } = await supabase
                .from('clients')
                .select('id, name')
                .limit(1);
            
            diagnostics.databaseConnection = clientsError ? 'FAILED' : 'SUCCESS';
            diagnostics.databaseError = clientsError ? clientsError.message : null;
            diagnostics.clientsCount = clients ? clients.length : 0;
            
            // Try to get sessions count
            const { data: sessions, error: sessionsError } = await supabase
                .from('sessions')
                .select('id')
                .limit(1);
            
            diagnostics.sessionsAccessible = sessionsError ? 'FAILED' : 'SUCCESS';
            diagnostics.sessionsError = sessionsError ? sessionsError.message : null;
        } catch (error: any) {
            diagnostics.databaseConnection = 'ERROR';
            diagnostics.databaseError = error.message;
        }
    } else {
        diagnostics.databaseConnection = 'NOT CONFIGURED';
        diagnostics.message = 'Supabase environment variables are not set. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to Vercel environment variables.';
    }

    return NextResponse.json(diagnostics, {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
        },
    });
}

