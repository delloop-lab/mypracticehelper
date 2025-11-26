import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function formatDateToICS(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = date.getUTCFullYear();
    const month = pad(date.getUTCMonth() + 1);
    const day = pad(date.getUTCDate());
    const hours = pad(date.getUTCHours());
    const mins = pad(date.getUTCMinutes());
    const secs = pad(date.getUTCSeconds());
    return `${year}${month}${day}T${hours}${mins}${secs}Z`;
}

// Escape special characters in ICS text fields
function escapeICS(text: string): string {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '');
}

// Fold long lines according to RFC 5545 (max 75 chars per line)
function foldLine(line: string): string {
    if (line.length <= 75) {
        return line;
    }
    const parts: string[] = [];
    let remaining = line;
    while (remaining.length > 75) {
        parts.push(remaining.substring(0, 75));
        remaining = ' ' + remaining.substring(75); // Continuation lines start with space
    }
    if (remaining.length > 0) {
        parts.push(remaining);
    }
    return parts.join('\r\n');
}

export async function GET(request: Request) {
    try {
        // Fetch timezone setting
        let timezone = 'UTC';
        try {
            const { data: settingsData } = await supabase
                .from('settings')
                .select('config')
                .eq('id', 'default')
                .single();
            
            if (settingsData?.config?.timezone) {
                timezone = settingsData.config.timezone;
            }
        } catch (error) {
            console.warn('[Calendar ICS] Could not load timezone setting, using UTC:', error);
        }
        
        console.log('[Calendar ICS] Using timezone:', timezone);
        
        // Single-user app: Fetch all sessions
        // Note: For Google Calendar subscriptions, this endpoint needs to be accessible
        // Since it's single-user, we allow access without strict auth
        // (Google Calendar won't send cookies when fetching the feed)
        const { data: sessions, error: sessionsError } = await supabase
            .from('sessions')
            .select('*')
            .order('date', { ascending: true });

        console.log('[Calendar ICS] Fetched sessions:', sessions?.length || 0);
        
        if (sessionsError) {
            console.error('[Calendar ICS] Error fetching sessions:', sessionsError);
            return new NextResponse('Error fetching sessions', {
                status: 500,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });
        }

        if (!sessions || sessions.length === 0) {
            console.log('[Calendar ICS] No sessions found');
            // Return empty calendar instead of error
            const emptyCalendar = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//My Practice Helper//Therapy Sessions//EN',
                'CALSCALE:GREGORIAN',
                'METHOD:PUBLISH',
                'X-WR-CALNAME:Therapy Sessions',
                'X-WR-TIMEZONE:UTC',
                'END:VCALENDAR',
                '',
            ].join('\r\n');
            
            return new NextResponse(emptyCalendar, {
                status: 200,
                headers: {
                    'Content-Type': 'text/calendar',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                },
            });
        }

        const { data: clients } = await supabase
            .from('clients')
            .select('id, name');

        const clientMap = new Map((clients || []).map((c: any) => [c.id, c.name]));

        const now = new Date();
        const dtStamp = formatDateToICS(now);

        const events = sessions
            .filter((session: any) => {
                // Filter out sessions without valid dates
                if (!session.date) {
                    console.warn('[Calendar ICS] Session missing date:', session.id);
                    return false;
                }
                return true;
            })
            .map((session: any) => {
                try {
                    // Parse the date - Supabase returns ISO strings with timezone
                    let start: Date;
                    const dateStr = session.date;
                    
                    // If date doesn't have timezone info, assume it's already UTC (from Supabase)
                    // Supabase stores TIMESTAMP WITH TIME ZONE, so dates should have timezone
                    if (typeof dateStr === 'string' && !dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.includes('-', 10)) {
                        // Date format like "2025-01-15T14:00:00" - add Z to indicate UTC
                        start = new Date(dateStr + 'Z');
                    } else {
                        start = new Date(dateStr);
                    }
                    
                    // Validate date
                    if (isNaN(start.getTime())) {
                        console.warn('[Calendar ICS] Invalid date for session:', session.id, session.date);
                        return null;
                    }
                    
                    console.log(`[Calendar ICS] Session ${session.id}: ${session.date} -> ${start.toISOString()} (UTC)`);
                    
                    const durationMinutes = session.duration || 60;
                    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

                    // Convert date to user's timezone, then format as UTC for ICS
                    // This ensures the time displayed matches what the user expects
                    const dtStart = formatDateToICS(start); // Always use UTC format for ICS
                    const dtEnd = formatDateToICS(end);

                    const clientName = session.client_id
                        ? clientMap.get(session.client_id) || 'Client Session'
                        : 'Client Session';

                    const summary = `${clientName} – Therapy Session`;
                    const uid = `${session.id}@mypracticehelper`;

                    const descriptionLines: string[] = [];
                    descriptionLines.push(`Session type: ${session.type || 'Session'}`);
                    if (session.notes) {
                        descriptionLines.push('');
                        descriptionLines.push(session.notes);
                    }

                    const description = descriptionLines.join('\n');

                    // Build event lines with proper formatting
                    // Use UTC format (Z suffix) - Google Calendar will convert based on calendar timezone
                    // Include CREATED and LAST-MODIFIED for better Google Calendar compatibility
                    const created = session.created_at ? formatDateToICS(new Date(session.created_at)) : dtStamp;
                    const lastModified = session.updated_at ? formatDateToICS(new Date(session.updated_at)) : dtStamp;
                    
                    const eventLines: string[] = [
                        'BEGIN:VEVENT',
                        `UID:${uid}`,
                        `DTSTAMP:${dtStamp}`,
                        `CREATED:${created}`,
                        `LAST-MODIFIED:${lastModified}`,
                        `DTSTART:${dtStart}`,
                        `DTEND:${dtEnd}`,
                        `SUMMARY:${escapeICS(summary)}`,
                        `DESCRIPTION:${escapeICS(description)}`,
                        'STATUS:CONFIRMED',
                        'SEQUENCE:0',
                        'END:VEVENT',
                    ];

                    // Fold long lines and join with CRLF
                    return eventLines.map(foldLine).join('\r\n');
                } catch (error) {
                    console.error('[Calendar ICS] Error processing session:', session.id, error);
                    return null;
                }
            })
            .filter((event: string | null) => event !== null)
            .join('\r\n');
        
        const eventCount = events ? events.split('BEGIN:VEVENT').length - 1 : 0;
        console.log('[Calendar ICS] Generated events:', eventCount);

        if (!events || events.trim().length === 0) {
            console.log('[Calendar ICS] No valid events to include');
            // Return empty calendar
            const emptyCalendar = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//My Practice Helper//Therapy Sessions//EN',
                'CALSCALE:GREGORIAN',
                'METHOD:PUBLISH',
                'X-WR-CALNAME:Therapy Sessions',
                'X-WR-TIMEZONE:UTC',
                'END:VCALENDAR',
                '',
            ].join('\r\n');
            
            return new NextResponse(emptyCalendar, {
                status: 200,
                headers: {
                    'Content-Type': 'text/calendar; charset=utf-8',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                },
            });
        }

        const calendarLines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//My Practice Helper//Therapy Sessions//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:Therapy Sessions',
            `X-WR-TIMEZONE:${timezone}`, // Inform Google Calendar of the intended timezone
            'X-WR-CALDESC:Therapy session appointments',
            events,
            'END:VCALENDAR',
        ];

        const ical = calendarLines.map(foldLine).join('\r\n') + '\r\n';

        console.log('[Calendar ICS] Returning ICS file, length:', ical.length);
        
        return new NextResponse(ical, {
            status: 200,
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
        });
    } catch (error) {
        console.error('[Calendar ICS] Unexpected error:', error);
        return new NextResponse('Error generating calendar feed', {
            status: 500,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }
}


