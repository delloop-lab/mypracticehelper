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

export async function GET() {
    try {
        // Fetch sessions and clients to build events
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

            return [
                'BEGIN:VEVENT',
                `UID:${uid}`,
                `DTSTAMP:${dtStamp}`,
                `DTSTART:${dtStart}`,
                `DTEND:${dtEnd}`,
                `SUMMARY:${summary}`,
                // In ICS, literal "\n" sequences represent line breaks inside DESCRIPTION
                `DESCRIPTION:${description.replace(/\r?\n/g, '\\n')}`,
                'END:VEVENT',
            ].join('\r\n');
        }).join('\r\n');

        const ical = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//My Practice Helper//Therapy Sessions//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            events,
            'END:VCALENDAR',
            '',
        ].join('\r\n');

        return new NextResponse(ical, {
            status: 200,
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Content-Disposition': 'attachment; filename=\"sessions.ics\"',
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


