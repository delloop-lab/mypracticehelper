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
        // Single-user app: Fetch all sessions
        // Note: For Google Calendar subscriptions, this endpoint needs to be accessible
        // Since it's single-user, we allow access without strict auth
        // (Google Calendar won't send cookies when fetching the feed)
        const { data: sessions, error: sessionsError } = await supabase
            .from('sessions')
            .select('*')
            .order('date', { ascending: true });

        if (sessionsError || !sessions) {
            console.error('[Calendar ICS] Error fetching sessions:', sessionsError);
            return new NextResponse('No sessions available', {
                status: 200,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });
        }

        const { data: clients } = await supabase
            .from('clients')
            .select('id, name');

        const clientMap = new Map((clients || []).map((c: any) => [c.id, c.name]));

        const now = new Date();
        const dtStamp = formatDateToICS(now);

        const events = sessions.map((session: any) => {
            const start = new Date(session.date);
            const durationMinutes = session.duration || 60;
            const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

            const dtStart = formatDateToICS(start);
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
            const eventLines: string[] = [
                'BEGIN:VEVENT',
                `UID:${uid}`,
                `DTSTAMP:${dtStamp}`,
                `DTSTART:${dtStart}`,
                `DTEND:${dtEnd}`,
                `SUMMARY:${escapeICS(summary)}`,
                `DESCRIPTION:${escapeICS(description)}`,
                'END:VEVENT',
            ];

            // Fold long lines and join with CRLF
            return eventLines.map(foldLine).join('\r\n');
        }).join('\r\n');

        const calendarLines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//My Practice Helper//Therapy Sessions//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:Therapy Sessions',
            'X-WR-TIMEZONE:UTC',
            events,
            'END:VCALENDAR',
        ];

        const ical = calendarLines.map(foldLine).join('\r\n') + '\r\n';

        return new NextResponse(ical, {
            status: 200,
            headers: {
                'Content-Type': 'text/calendar',
                'Content-Disposition': 'attachment; filename="sessions.ics"',
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


