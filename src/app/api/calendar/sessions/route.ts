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
        
        // Single-user app: Fetch all sessions (including past ones for Google Calendar)
        // Note: For Google Calendar subscriptions, this endpoint needs to be accessible
        // Since it's single-user, we allow access without strict auth
        // (Google Calendar won't send cookies when fetching the feed)
        // Fetch sessions from the past 30 days and future to ensure Google Calendar shows them
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();
        
        console.log('[Calendar ICS] Fetching sessions from:', thirtyDaysAgoISO);
        
        const { data: sessions, error: sessionsError } = await supabase
            .from('sessions')
            .select('*')
            .gte('date', thirtyDaysAgoISO) // Only get sessions from last 30 days onwards
            .order('date', { ascending: true });

        console.log('[Calendar ICS] Fetched sessions:', sessions?.length || 0);
        
        // Log Calendly sessions specifically to debug
        if (sessions && sessions.length > 0) {
            const calendlySessions = sessions.filter((s: any) => s.metadata?.source === 'calendly');
            console.log('[Calendar ICS] Calendly sessions in fetched data:', calendlySessions.length);
            calendlySessions.forEach((s: any) => {
                console.log('[Calendar ICS] Calendly session:', s.id, 'Date:', s.date, 'Type:', typeof s.date);
            });
        }
        
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
                    console.warn('[Calendar ICS] Session missing date:', session.id, 'Metadata:', session.metadata);
                    return false;
                }
                // Log Calendly sessions for debugging
                if (session.metadata?.source === 'calendly') {
                    console.log('[Calendar ICS] Including Calendly session:', session.id, 'Date:', session.date);
                }
                return true;
            })
            .map((session: any) => {
                try {
                    // Parse the date - Supabase returns ISO strings with timezone
                    let start: Date;
                    const dateStr = session.date;
                    let normalizedDate = dateStr; // For error logging
                    
                    // Handle different date formats from Supabase
                    // Supabase can return: "2025-11-28T11:30:00+00:00" or "2025-11-28 11:30:00+00" (space instead of T)
                    // Manual bookings might be: "2025-11-28T11:30:00" (no timezone)
                    if (typeof dateStr === 'string') {
                        // Replace space with T if it's in the format "2025-11-28 11:30:00+00"
                        // This handles Supabase's TIMESTAMP WITH TIME ZONE format
                        normalizedDate = dateStr;
                        if (dateStr.includes(' ') && !dateStr.includes('T')) {
                            // Format: "2025-11-28 11:30:00+00" -> "2025-11-28T11:30:00+00:00"
                            normalizedDate = dateStr.replace(' ', 'T');
                            // Ensure timezone format is correct (+00 -> +00:00)
                            if (normalizedDate.match(/[+-]\d{2}$/)) {
                                normalizedDate = normalizedDate + ':00';
                            }
                        } else if (dateStr.includes('T') && !dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.includes('-', 10)) {
                            // Format like "2025-11-28T11:30:00" (has T but no timezone) - assume UTC
                            normalizedDate = dateStr + 'Z';
                        } else if (!dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.includes('-', 10)) {
                            // Format like "2025-01-15T14:00:00" without timezone - assume UTC and add Z
                            normalizedDate = dateStr + 'Z';
                        }
                        start = new Date(normalizedDate);
                    } else {
                        start = new Date(dateStr);
                        normalizedDate = String(dateStr);
                    }
                    
                    // Validate date
                    if (isNaN(start.getTime())) {
                        console.warn('[Calendar ICS] Invalid date for session:', session.id, 'Raw date:', session.date, 'Normalized:', normalizedDate);
                        return null;
                    }
                    
                    // Log all sessions for debugging
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

                    // Truncate long values to prevent lines exceeding 998 chars (RFC 5545 limit)
                    // But don't fold - Google Calendar handles long lines better than folded ones
                    const maxSummaryLength = 200; // Safe limit for SUMMARY field
                    const maxDescriptionLength = 500; // Safe limit for DESCRIPTION field
                    
                    let summary = `${clientName} – Therapy Session`;
                    if (summary.length > maxSummaryLength) {
                        summary = summary.substring(0, maxSummaryLength - 3) + '...';
                    }
                    
                    const uid = `${session.id}@mypracticehelper`;

                    const descriptionLines: string[] = [];
                    descriptionLines.push(`Session type: ${session.type || 'Session'}`);
                    if (session.notes) {
                        descriptionLines.push('');
                        let notes = session.notes;
                        if (notes.length > maxDescriptionLength) {
                            notes = notes.substring(0, maxDescriptionLength - 3) + '...';
                        }
                        descriptionLines.push(notes);
                    }

                    let description = descriptionLines.join('\n');
                    if (description.length > maxDescriptionLength) {
                        description = description.substring(0, maxDescriptionLength - 3) + '...';
                    }

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
                        'TRANSP:OPAQUE', // Required for Google Calendar
                        'END:VEVENT',
                    ];

                    // Join with CRLF - don't fold lines as it can break Google Calendar parsing
                    // Google Calendar handles long lines better than folded lines
                    return eventLines.join('\r\n');
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

        // Don't fold lines - Google Calendar handles long lines better
        // RFC 5545 allows up to 998 characters per line, and Google Calendar is fine with that
        const ical = calendarLines.join('\r\n') + '\r\n';

        // Verify no lines are folded (check for continuation lines starting with space)
        const hasFoldedLines = ical.includes('\r\n ');
        if (hasFoldedLines) {
            console.error('[Calendar ICS] WARNING: Detected folded lines in output!');
        }
        
        // Log first few lines to verify format
        const firstLines = ical.split('\r\n').slice(0, 10);
        console.log('[Calendar ICS] First 10 lines:', firstLines);
        console.log('[Calendar ICS] Returning ICS file, length:', ical.length, 'hasFoldedLines:', hasFoldedLines);
        
        // Convert to Buffer to ensure raw bytes are sent without any processing
        const icalBuffer = Buffer.from(ical, 'utf-8');
        
        return new NextResponse(icalBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Content-Disposition': 'inline; filename="therapy-sessions.ics"',
                'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET',
                'Content-Length': icalBuffer.length.toString(),
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


