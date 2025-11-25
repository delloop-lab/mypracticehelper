import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
    try {
        const { data, error } = await supabase
            .from('session_notes')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching session notes:', error);
            return NextResponse.json([]);
        }

        return NextResponse.json(data || []);
    } catch (error) {
        console.error('Error fetching session notes:', error);
        return NextResponse.json({ error: 'Failed to fetch session notes' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const notes = await request.json();

        // Sync logic: Get existing IDs, delete missing, upsert new
        const { data: existing } = await supabase.from('session_notes').select('id');
        const existingIds = existing?.map(n => n.id) || [];
        const newIds = notes.map((n: any) => n.id);

        const idsToDelete = existingIds.filter(id => !newIds.includes(id));

        if (idsToDelete.length > 0) {
            await supabase.from('session_notes').delete().in('id', idsToDelete);
        }

        // Map frontend fields to DB fields if necessary
        // Assuming frontend sends objects compatible with DB schema
        const records = notes.map((note: any) => ({
            id: note.id,
            client_id: note.clientId || note.client_id, // Handle both cases
            session_id: note.sessionId || note.session_id,
            content: note.content || note.notes, // 'content' in DB, might be 'notes' in app
            created_at: note.date || note.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        }));

        const { error } = await supabase
            .from('session_notes')
            .upsert(records);

        if (error) {
            console.error('Supabase error saving session notes:', error);
            throw error;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving session notes:', error);
        return NextResponse.json({ error: 'Failed to save session notes' }, { status: 500 });
    }
}

