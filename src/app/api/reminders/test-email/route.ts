import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendReminderEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const { email, template } = await request.json();

        if (!email) {
            return NextResponse.json(
                { error: 'Email address is required' },
                { status: 400 }
            );
        }

        // Get timezone and company logo from settings
        let timezone = 'UTC';
        let companyLogo: string | undefined = undefined;
        try {
            const { data: settingsData } = await supabase
                .from('settings')
                .select('config')
                .eq('id', 'default')
                .single();
            
            if (settingsData?.config) {
                if (settingsData.config.timezone) {
                    timezone = settingsData.config.timezone;
                }
                if (settingsData.config.companyLogo) {
                    companyLogo = settingsData.config.companyLogo;
                }
            }
        } catch (e) {
            console.warn('[Test Email] Could not load settings, using defaults');
        }

        // Create a test appointment date (24 hours from now)
        const testDate = new Date();
        testDate.setHours(testDate.getHours() + 24);

        // Send test email with the provided template
        await sendReminderEmail(
            email,
            'Test Client', // Test client name
            testDate,
            'Therapy Session', // Test appointment type
            60, // Test duration
            timezone,
            template, // Use the custom template from settings
            companyLogo // Use company logo from settings
        );

        return NextResponse.json({
            success: true,
            message: `Test email sent to ${email}`,
        });

    } catch (error: any) {
        console.error('[Test Email] Error:', error);
        return NextResponse.json(
            {
                error: error.message || 'Failed to send test email',
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            },
            { status: 500 }
        );
    }
}

