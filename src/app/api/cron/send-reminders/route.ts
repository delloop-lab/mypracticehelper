import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendReminderEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

// Check if reminder was already sent for this session
function hasReminderBeenSent(metadata: any): boolean {
    if (!metadata) return false;
    if (typeof metadata === 'string') {
        try {
            metadata = JSON.parse(metadata);
        } catch {
            return false;
        }
    }
    return metadata.reminderSent === true || metadata.reminderSent24h === true;
}

// Mark reminder as sent in session metadata
async function markReminderSent(sessionId: string, currentMetadata: any) {
    let metadata: any = {};
    
    if (currentMetadata) {
        if (typeof currentMetadata === 'string') {
            try {
                metadata = JSON.parse(currentMetadata);
            } catch {
                metadata = {};
            }
        } else {
            metadata = currentMetadata;
        }
    }

    metadata.reminderSent = true;
    metadata.reminderSent24h = true;
    metadata.reminderSentAt = new Date().toISOString();

    await supabase
        .from('sessions')
        .update({ metadata, updated_at: new Date().toISOString() })
        .eq('id', sessionId);
}

export async function GET(request: Request) {
    // Verify this is called by Vercel Cron (optional security check)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log('[Reminders Cron] Starting reminder check...');

        // Get settings (timezone, email template, company logo, and reminder hours)
        let timezone = 'UTC';
        let emailTemplate: any = undefined;
        let companyLogo: string | undefined = undefined;
        let reminderHoursBefore = 24; // Default to 24 hours
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
                if (settingsData.config.reminderEmailTemplate) {
                    emailTemplate = settingsData.config.reminderEmailTemplate;
                }
                if (settingsData.config.companyLogo) {
                    companyLogo = settingsData.config.companyLogo;
                }
                if (settingsData.config.reminderHoursBefore) {
                    reminderHoursBefore = settingsData.config.reminderHoursBefore;
                }
            }
        } catch (e) {
            console.warn('[Reminders Cron] Could not load settings, using defaults');
        }

        // Calculate time range: appointments X hours from now (±1 hour window)
        // Use reminderHoursBefore from settings (default: 24 hours)
        const now = new Date();
        const targetTime = new Date(now.getTime() + reminderHoursBefore * 60 * 60 * 1000); // X hours from now
        const windowStart = new Date(targetTime.getTime() - 60 * 60 * 1000); // 1 hour before
        const windowEnd = new Date(targetTime.getTime() + 60 * 60 * 1000); // 1 hour after

        console.log(`[Reminders Cron] Checking for appointments ${reminderHoursBefore} hours from now (between ${windowStart.toISOString()} and ${windowEnd.toISOString()})`);

        // Fetch sessions in the time window
        const { data: sessions, error: sessionsError } = await supabase
            .from('sessions')
            .select('id, client_id, date, duration, type, metadata')
            .gte('date', windowStart.toISOString())
            .lte('date', windowEnd.toISOString())
            .order('date', { ascending: true });

        if (sessionsError) {
            console.error('[Reminders Cron] Error fetching sessions:', sessionsError);
            return NextResponse.json(
                { error: 'Failed to fetch sessions', details: sessionsError },
                { status: 500 }
            );
        }

        if (!sessions || sessions.length === 0) {
            console.log('[Reminders Cron] No appointments found in the time window');
            return NextResponse.json({
                success: true,
                message: 'No appointments to remind',
                checked: 0,
                sent: 0,
            });
        }

        console.log(`[Reminders Cron] Found ${sessions.length} appointments to check`);

        // Get all client IDs
        const clientIds = [...new Set(sessions.map((s: any) => s.client_id).filter(Boolean))];
        
        // Fetch clients
        const { data: clients, error: clientsError } = await supabase
            .from('clients')
            .select('id, name, email')
            .in('id', clientIds);

        if (clientsError) {
            console.error('[Reminders Cron] Error fetching clients:', clientsError);
            return NextResponse.json(
                { error: 'Failed to fetch clients', details: clientsError },
                { status: 500 }
            );
        }

        const clientMap = new Map((clients || []).map((c: any) => [c.id, c]));

        // Process each session
        const results = {
            checked: 0,
            sent: 0,
            skipped: 0,
            errors: [] as string[],
        };

        for (const session of sessions) {
            results.checked++;

            // Check if reminder already sent
            if (hasReminderBeenSent(session.metadata)) {
                console.log(`[Reminders Cron] Reminder already sent for session ${session.id}`);
                results.skipped++;
                continue;
            }

            // Get client info
            const client = session.client_id ? clientMap.get(session.client_id) : null;
            
            if (!client) {
                console.warn(`[Reminders Cron] No client found for session ${session.id}`);
                results.skipped++;
                continue;
            }

            if (!client.email) {
                console.warn(`[Reminders Cron] No email for client ${client.name} (session ${session.id})`);
                results.skipped++;
                continue;
            }

            // Send reminder email
            try {
                const appointmentDate = new Date(session.date);
                const appointmentType = session.type || 'Therapy Session';
                const duration = session.duration || 60;

                console.log(`[Reminders Cron] Sending reminder to ${client.email} for appointment on ${appointmentDate.toISOString()}`);

                await sendReminderEmail(
                    client.email,
                    client.name,
                    appointmentDate,
                    appointmentType,
                    duration,
                    timezone,
                    emailTemplate,
                    companyLogo
                );

                // Mark reminder as sent
                await markReminderSent(session.id, session.metadata);

                results.sent++;
                console.log(`[Reminders Cron] ✅ Reminder sent to ${client.email}`);

            } catch (error: any) {
                const errorMsg = `Failed to send reminder for session ${session.id}: ${error.message}`;
                console.error(`[Reminders Cron] ❌ ${errorMsg}`, error);
                results.errors.push(errorMsg);
            }
        }

        console.log(`[Reminders Cron] Complete: ${results.sent} sent, ${results.skipped} skipped, ${results.errors.length} errors`);

        return NextResponse.json({
            success: true,
            message: `Processed ${results.checked} appointments`,
            ...results,
        });

    } catch (error: any) {
        console.error('[Reminders Cron] Unexpected error:', error);
        return NextResponse.json(
            {
                error: error.message || 'Internal server error',
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            },
            { status: 500 }
        );
    }
}

