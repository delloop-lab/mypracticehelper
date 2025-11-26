import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        console.log('[Appointments API] Starting fetch...');
        
        // First, check if sessions table exists and has data
        const { data: allSessions, error: allSessionsError } = await supabase
            .from('sessions')
            .select('*')
            .order('date', { ascending: false });

        if (allSessionsError) {
            console.error('[Appointments API] Error fetching all sessions:', allSessionsError);
            console.error('[Appointments API] Error details:', JSON.stringify(allSessionsError, null, 2));
            return NextResponse.json([]);
        }

        console.log(`[Appointments API] Total sessions in database: ${allSessions?.length || 0}`);
        if (allSessions && allSessions.length > 0) {
            console.log('[Appointments API] Sample sessions:', allSessions.slice(0, 3).map((s: any) => ({
                id: s.id,
                client_id: s.client_id,
                date: s.date,
                type: s.type
            })));
        }

        // If no sessions found, return empty array early
        if (!allSessions || allSessions.length === 0) {
            console.log('[Appointments API] No sessions found in database');
            return NextResponse.json([]);
        }

        // Get all clients first for manual mapping (more reliable than join)
        const { data: allClients } = await supabase.from('clients').select('id, name');
        const clientMap = new Map((allClients || []).map((c: any) => [c.id, c.name]));
        console.log(`[Appointments API] Loaded ${allClients?.length || 0} clients for mapping`);

        // Fetch all sessions (including those with null client_id)
        // Don't use join - manually map client names to avoid filtering out unassigned sessions
        const { data: sessionsWithClients, error: joinError } = await supabase
            .from('sessions')
            .select('*')
            .order('date', { ascending: false });

        if (joinError) {
            console.error('[Appointments API] Error fetching sessions:', joinError);
            console.error('[Appointments API] Error details:', JSON.stringify(joinError, null, 2));
            // Continue with manual mapping below
        }

        console.log(`[Appointments API] Fetched ${sessionsWithClients?.length || 0} sessions`);
        
        // Log sessions with missing client_id
        const unassignedSessions = sessionsWithClients?.filter((s: any) => !s.client_id) || [];
        if (unassignedSessions.length > 0) {
            console.warn(`[Appointments API] Found ${unassignedSessions.length} unassigned sessions (no client_id):`, 
                unassignedSessions.map((s: any) => ({ 
                    id: s.id, 
                    date: s.date,
                    type: s.type
                }))
            );
        }

        const appointments = sessionsWithClients?.map(session => {
            // Handle metadata - it might be null, undefined, or an object
            let metadata = {};
            try {
                if (session.metadata && typeof session.metadata === 'object') {
                    metadata = session.metadata;
                }
            } catch (e) {
                // If metadata is invalid, use empty object
                metadata = {};
            }
            
            // Map client_id to client name using our clientMap
            let clientName = 'Unassigned';
            if (session.client_id) {
                clientName = clientMap.get(session.client_id) || 'Unassigned';
                if (clientName === 'Unassigned') {
                    console.warn(`[Appointments API] Session ${session.id} has client_id ${session.client_id} but client not found in map`);
                }
            } else {
                console.warn(`[Appointments API] Session ${session.id} has no client_id - needs assignment`);
            }
            
            return {
                id: session.id,
                clientName: clientName,
                date: session.date, // ISO string
                time: new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                duration: session.duration,
                type: session.type,
                status: (metadata as any).status || 'confirmed',
                notes: session.notes,
                clinicalNotes: '', // Legacy field - session notes are now stored in session_notes table
                fee: (metadata as any).fee,
                currency: (metadata as any).currency,
                paymentStatus: (metadata as any).paymentStatus || 'unpaid',
                paymentMethod: (metadata as any).paymentMethod
            };
        }) || [];

        console.log(`[Appointments API] Fetched ${sessionsWithClients?.length || 0} sessions, mapped to ${appointments.length} appointments`);
        if (appointments.length > 0) {
            console.log('[Appointments API] Sample appointments:', appointments.slice(0, 3).map(a => ({ 
                id: a.id, 
                client: a.clientName, 
                date: a.date, 
                time: a.time 
            })));
        }

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
            
            // Store fee, currency, and paymentStatus in metadata JSONB
            const metadata: any = {};
            if (apt.fee !== undefined) metadata.fee = apt.fee;
            if (apt.currency) metadata.currency = apt.currency;
            if (apt.paymentStatus) metadata.paymentStatus = apt.paymentStatus;
            if (apt.status) metadata.status = apt.status;

            const record: any = {
                id: apt.id,
                client_id: client?.id || null, // If we can't find client, it might be orphaned
                date: dateValue, // Full ISO timestamp with time component
                duration: apt.duration,
                type: apt.type,
                notes: apt.notes,
                updated_at: new Date().toISOString()
            };

            // Only include metadata if we have something to store and the column exists
            if (Object.keys(metadata).length > 0) {
                record.metadata = metadata;
            }

            return record;
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

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, paymentStatus, fee, currency, paymentMethod } = body;

        if (!id) {
            return NextResponse.json({ error: 'Appointment ID is required' }, { status: 400 });
        }

        // Get existing session to preserve metadata
        const { data: existingSession, error: fetchError } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) {
            console.error('Error fetching session:', fetchError);
            return NextResponse.json({ error: `Appointment not found: ${fetchError.message}` }, { status: 404 });
        }

        if (!existingSession) {
            return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
        }

        // Update metadata - handle case where metadata column might not exist or is null
        let metadata: any = {};
        try {
            if (existingSession.metadata && typeof existingSession.metadata === 'object') {
                metadata = { ...existingSession.metadata };
            }
        } catch (e) {
            // If metadata is invalid, start with empty object
            metadata = {};
        }

        // Update fields - always save paymentStatus, fee, currency, and paymentMethod if provided
        if (paymentStatus !== undefined) metadata.paymentStatus = paymentStatus;
        // Only update fee if it's provided and > 0 (don't overwrite with 0)
        if (fee !== undefined && fee !== null && fee > 0) {
            metadata.fee = fee;
        }
        if (currency !== undefined && currency !== null) metadata.currency = currency;
        if (paymentMethod !== undefined && paymentMethod !== null) metadata.paymentMethod = paymentMethod;


        // Prepare update object
        const updateData: any = {
            updated_at: new Date().toISOString()
        };

        // Always include metadata if we have paymentStatus or other fields
        if (Object.keys(metadata).length > 0) {
            updateData.metadata = metadata;
        }

        const { data: updatedData, error: updateError } = await supabase
            .from('sessions')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('Supabase error updating appointment:', updateError);
            // Check if it's a column doesn't exist error
            const errorMsg = updateError.message || '';
            if (errorMsg.includes('metadata') && (errorMsg.includes('does not exist') || errorMsg.includes('schema cache'))) {
                return NextResponse.json({ 
                    error: 'METADATA_COLUMN_MISSING',
                    message: 'The metadata column does not exist in the sessions table. Please run this SQL in your Supabase SQL Editor:\n\nALTER TABLE sessions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT \'{}\'::jsonb;\nCREATE INDEX IF NOT EXISTS idx_sessions_metadata ON sessions USING gin (metadata);'
                }, { status: 500 });
            }
            return NextResponse.json({ error: `Failed to update: ${errorMsg}` }, { status: 500 });
        }


        return NextResponse.json({ success: true, data: updatedData });
    } catch (error: any) {
        console.error('Error updating appointment:', error);
        return NextResponse.json({ 
            error: `Failed to update appointment: ${error?.message || 'Unknown error'}` 
        }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Appointment ID is required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('sessions')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Supabase error deleting appointment:', error);
            return NextResponse.json({ error: `Failed to delete: ${error.message}` }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting appointment:', error);
        return NextResponse.json({ 
            error: `Failed to delete appointment: ${error?.message || 'Unknown error'}` 
        }, { status: 500 });
    }
}

