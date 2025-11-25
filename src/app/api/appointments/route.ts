import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { data, error } = await supabase
            .from('sessions')
            .select('*')
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching appointments:', error);
            return NextResponse.json([]);
        }

        // Map DB fields back to app fields if necessary
        // DB: id, client_id, date, duration, type, notes
        // App: id, clientName, date, time, duration, type, status, notes, clinicalNotes

        // We need to join with clients to get clientName
        const { data: sessionsWithClients, error: joinError } = await supabase
            .from('sessions')
            .select(`
                *,
                clients (name)
            `)
            .order('date', { ascending: false });

        if (joinError) {
            console.error('Error fetching sessions with clients:', joinError);
            return NextResponse.json([]);
        }

        const appointments = sessionsWithClients?.map(session => ({
            id: session.id,
            clientName: session.clients?.name || 'Unknown',
            date: session.date, // ISO string
            time: new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            duration: session.duration,
            type: session.type,
            status: 'confirmed', // Default status
            notes: session.notes,
            clinicalNotes: '' // We might store this in session_notes table, but for now empty
        })) || [];

        return NextResponse.json(appointments);
    } catch (error) {
        console.error('Error in GET appointments:', error);
        return NextResponse.json([]);
    }
}

export async function POST(request: Request) {
    try {
        const appointments = await request.json();

        // This is tricky because the app sends a list of "Appointment" objects which contain clientName but not clientId directly usually
        // But let's see if we can map it.
        // Actually, the app's "Appointment" interface has: id, clientName, date, time, duration...
        // It doesn't seem to have clientId. This is a flaw in the original local-only design (linking by name?).

        // To save to DB properly, we need client_id.
        // We might need to look up client_id by name, which is risky.
        // OR we just save what we can.

        // Ideally, we should update the frontend to include clientId in appointments.
        // For now, let's try to fetch all clients to map names to IDs.

        const { data: clients } = await supabase.from('clients').select('id, name');

        const records = appointments.map((apt: any) => {
            const client = clients?.find(c => c.name === apt.clientName);
            
            // Combine date and time into a full ISO timestamp
            // If date already includes time (has 'T'), use it as-is
            // Otherwise, combine date (YYYY-MM-DD) with time (HH:MM)
            let dateValue = apt.date;
            if (apt.time && !apt.date.includes('T')) {
                // Combine date and time: "2025-11-25" + "T" + "12:00:00"
                const timeStr = apt.time.length === 5 ? `${apt.time}:00` : apt.time; // Ensure HH:MM:SS format
                dateValue = `${apt.date}T${timeStr}`;
            }
            
            return {
                id: apt.id,
                client_id: client?.id || null, // If we can't find client, it might be orphaned
                date: dateValue, // Full ISO timestamp with time component
                duration: apt.duration,
                type: apt.type,
                notes: apt.notes,
                updated_at: new Date().toISOString()
            };
        });

        const { error } = await supabase
            .from('sessions')
            .upsert(records);

        if (error) {
            console.error('Supabase error saving appointments:', error);
            throw error;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving appointments:', error);
        return NextResponse.json({ error: 'Failed to save appointments' }, { status: 500 });
    }
}

