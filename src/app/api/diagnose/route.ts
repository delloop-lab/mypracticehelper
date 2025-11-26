import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Helper to check if env var is set (not empty, not placeholder)
function checkEnvVar(name: string, value: string | undefined): { status: 'SET' | 'NOT SET' | 'PLACEHOLDER'; value?: string } {
    if (!value || value.trim() === '') {
        return { status: 'NOT SET' };
    }
    if (value.includes('placeholder') || value === 'placeholder-key') {
        return { status: 'PLACEHOLDER' };
    }
    // Don't expose full values, just show first/last few chars for verification
    const masked = value.length > 20 
        ? `${value.substring(0, 10)}...${value.substring(value.length - 4)}`
        : '***';
    return { status: 'SET', value: masked };
}

export async function GET() {
    // Check all critical environment variables
    const envVars = {
        // CRITICAL - Required for app to work
        critical: {
            NEXT_PUBLIC_SUPABASE_URL: checkEnvVar('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
            NEXT_PUBLIC_SUPABASE_ANON_KEY: checkEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
            SMTP_USER: checkEnvVar('SMTP_USER', process.env.SMTP_USER),
            SMTP_PASS: checkEnvVar('SMTP_PASS', process.env.SMTP_PASS),
        },
        // IMPORTANT - Should be set (have defaults)
        important: {
            SMTP_HOST: checkEnvVar('SMTP_HOST', process.env.SMTP_HOST),
            SMTP_PORT: checkEnvVar('SMTP_PORT', process.env.SMTP_PORT),
            SMTP_FROM: checkEnvVar('SMTP_FROM', process.env.SMTP_FROM),
            SMTP_FROM_NAME: checkEnvVar('SMTP_FROM_NAME', process.env.SMTP_FROM_NAME),
        },
        // OPTIONAL - For additional features
        optional: {
            CRON_SECRET: checkEnvVar('CRON_SECRET', process.env.CRON_SECRET),
            OPENAI_API_KEY: checkEnvVar('OPENAI_API_KEY', process.env.OPENAI_API_KEY),
            CALENDLY_CLIENT_ID: checkEnvVar('CALENDLY_CLIENT_ID', process.env.CALENDLY_CLIENT_ID),
            CALENDLY_CLIENT_SECRET: checkEnvVar('CALENDLY_CLIENT_SECRET', process.env.CALENDLY_CLIENT_SECRET),
            CALENDLY_WEBHOOK_SIGNING_KEY: checkEnvVar('CALENDLY_WEBHOOK_SIGNING_KEY', process.env.CALENDLY_WEBHOOK_SIGNING_KEY),
        }
    };

    // Count missing critical vars
    const missingCritical = Object.values(envVars.critical).filter(v => v.status !== 'SET').length;
    const missingImportant = Object.values(envVars.important).filter(v => v.status !== 'SET').length;

    const diagnostics: any = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        vercelUrl: process.env.VERCEL_URL || 'NOT SET',
        environmentVariables: envVars,
        summary: {
            criticalMissing: missingCritical,
            importantMissing: missingImportant,
            status: missingCritical > 0 ? '❌ CRITICAL VARIABLES MISSING' : missingImportant > 0 ? '⚠️ SOME IMPORTANT VARIABLES MISSING' : '✅ ALL CRITICAL VARIABLES SET',
        },
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


