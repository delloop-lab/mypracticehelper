import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkAuthentication } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // Check authentication (handles both new and fallback methods)
        const { userId, isFallback, userEmail } = await checkAuthentication(request);
        
        // If fallback auth, show legacy data (sessions without user_id)
        if (isFallback && userEmail === 'claire@claireschillaci.com') {
            console.log('[Appointments API] Fallback auth detected, showing legacy sessions (no user_id)');
            const { data: allSessions, error: allSessionsError } = await supabase
                .from('sessions')
                .select('*')
                .is('user_id', null)
                .order('date', { ascending: false });
            
            if (allSessionsError) {
                console.error('[Appointments API] Error fetching sessions:', allSessionsError);
                return NextResponse.json([]);
            }
            
            // Get all clients without user_id for mapping
            const { data: allClients } = await supabase
                .from('clients')
                .select('id, name')
                .is('user_id', null);
            const clientMap = new Map((allClients || []).map((c: any) => [c.id, c.name]));
            
            // Filter out cancelled sessions (double-check in case metadata filter didn't catch all)
            const validSessions = (allSessions || []).filter((session: any) => {
                let metadata = {};
                try {
                    if (session.metadata && typeof session.metadata === 'object') {
                        metadata = session.metadata;
                    }
                } catch (e) {
                    metadata = {};
                }
                const status = (metadata as any).status?.toLowerCase() || '';
                // Exclude cancelled sessions - ensures revenue calculations are accurate
                return status !== 'cancelled' && status !== 'canceled';
            });
            
            const appointments = validSessions.map((session: any) => {
                let metadata = {};
                try {
                    if (session.metadata && typeof session.metadata === 'object') {
                        metadata = session.metadata;
                    }
                } catch (e) {
                    metadata = {};
                }
                
                const clientName = session.client_id ? (clientMap.get(session.client_id) || 'Unassigned') : 'Unassigned';
                
                return {
                    id: session.id,
                    clientName: clientName,
                    date: session.date,
                    time: new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    duration: session.duration,
                    type: session.type,
                    venue: (metadata as any).venue || 'The Practice',
                    status: (metadata as any).status || 'confirmed',
                    notes: session.notes,
                    clinicalNotes: '',
                    fee: (metadata as any).fee,
                    currency: (metadata as any).currency,
                    paymentStatus: (metadata as any).paymentStatus || 'unpaid',
                    paymentMethod: (metadata as any).paymentMethod
                };
            });
            
            return NextResponse.json(appointments);
        }
        
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[Appointments API] Starting fetch for user:', userId);
        
        // Fetch sessions filtered by user_id
        // Note: We filter cancelled sessions in JavaScript after fetching
        // because Supabase JSONB filtering can be complex with null checks
        const { data: allSessions, error: allSessionsError } = await supabase
            .from('sessions')
            .select('*')
            .eq('user_id', userId)
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

        // Get all clients for this user for manual mapping
        const { data: allClients } = await supabase
            .from('clients')
            .select('id, name')
            .eq('user_id', userId);
        const clientMap = new Map((allClients || []).map((c: any) => [c.id, c.name]));
        console.log(`[Appointments API] Loaded ${allClients?.length || 0} clients for mapping`);

        // Sessions already filtered by user_id above, so use allSessions
        const sessionsWithClients = allSessions;
        const joinError = allSessionsError;

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

        // Filter out cancelled sessions (double-check in case metadata filter didn't catch all)
        const validSessions = (sessionsWithClients || []).filter((session: any) => {
            let metadata = {};
            try {
                if (session.metadata && typeof session.metadata === 'object') {
                    metadata = session.metadata;
                }
            } catch (e) {
                metadata = {};
            }
            const status = (metadata as any).status?.toLowerCase() || '';
            // Exclude cancelled sessions - ensures revenue calculations are accurate
            return status !== 'cancelled' && status !== 'canceled';
        });
        
        const appointments = validSessions.map(session => {
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
                venue: (metadata as any).venue || 'The Practice',
                status: (metadata as any).status || 'confirmed',
                notes: session.notes,
                clinicalNotes: '', // Legacy field - session notes are now stored in session_notes table
                fee: (metadata as any).fee,
                currency: (metadata as any).currency,
                paymentStatus: (metadata as any).paymentStatus || 'unpaid',
                paymentMethod: (metadata as any).paymentMethod
            };
        });

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
        console.log('[Appointments API POST] Starting POST request');
        
        // Check authentication (handles both new and fallback methods)
        const { userId, isFallback } = await checkAuthentication(request);
        console.log('[Appointments API POST] Authentication check - userId:', userId, 'isFallback:', isFallback);
        
        if (!userId) {
            console.error('[Appointments API POST] Unauthorized - no userId');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        // Reject write operations for fallback users (they need to run migration)
        if (isFallback) {
            console.error('[Appointments API POST] Rejected - fallback user needs migration');
            return NextResponse.json({ 
                error: 'Please run the migration script to assign your data to your user account before making changes.' 
            }, { status: 403 });
        }

        const appointments = await request.json();
        console.log('[Appointments API POST] Received appointments:', appointments.length);
        console.log('[Appointments API POST] First appointment sample:', appointments[0]);

        // Fetch clients for this user only to map names to IDs
        const { data: clients } = await supabase
            .from('clients')
            .select('id, name')
            .eq('user_id', userId);

        console.log('[Appointments API POST] Available clients:', clients?.length || 0);
        
        const records = appointments.map((apt: any, index: number) => {
            const client = clients?.find(c => c.name === apt.clientName);
            console.log(`[Appointments API POST] Processing appointment ${index + 1}/${appointments.length}:`, {
                id: apt.id,
                clientName: apt.clientName,
                clientFound: !!client,
                clientId: client?.id,
                date: apt.date,
                time: apt.time,
                type: apt.type
            });
            
            // Combine date and time into a full ISO timestamp
            // If date already includes time (has 'T'), use it as-is
            // Otherwise, combine date (YYYY-MM-DD) with time (HH:MM)
            let dateValue = apt.date;
            if (apt.time && !apt.date.includes('T')) {
                // Combine date and time: "2025-11-25" + "T" + "12:00:00"
                const timeStr = apt.time.length === 5 ? `${apt.time}:00` : apt.time; // Ensure HH:MM:SS format
                dateValue = `${apt.date}T${timeStr}`;
            }
            console.log(`[Appointments API POST] Appointment ${index + 1} - Final dateValue:`, dateValue);
            
            // Store fee, currency, paymentStatus, paymentMethod, and venue in metadata JSONB
            const metadata: any = {};
            if (apt.fee !== undefined) metadata.fee = apt.fee;
            if (apt.currency) metadata.currency = apt.currency;
            if (apt.paymentStatus) metadata.paymentStatus = apt.paymentStatus;
            if (apt.paymentMethod) {
                metadata.paymentMethod = apt.paymentMethod;
                console.log(`[Appointments API POST] Appointment ${index + 1} - Including paymentMethod:`, apt.paymentMethod);
            }
            if (apt.venue) metadata.venue = apt.venue;
            if (apt.status) metadata.status = apt.status;
            
            console.log(`[Appointments API POST] Appointment ${index + 1} - Final metadata:`, metadata);

            const record: any = {
                id: apt.id,
                client_id: client?.id || null, // If we can't find client, it might be orphaned
                user_id: userId, // Always include user_id
                date: dateValue, // Full ISO timestamp with time component
                duration: apt.duration || 60, // Default duration if not provided
                type: apt.type || 'Therapy Session', // Default type if not provided
                notes: apt.notes || '',
                updated_at: new Date().toISOString()
            };

            // Only include metadata if we have something to store and the column exists
            if (Object.keys(metadata).length > 0) {
                record.metadata = metadata;
            }

            console.log(`[Appointments API POST] Appointment ${index + 1} - Final record:`, record);
            return record;
        });

        console.log('[Appointments API POST] Total records to upsert:', records.length);
        console.log('[Appointments API POST] Sample record:', records[0]);
        
        const { data, error } = await supabase
            .from('sessions')
            .upsert(records)
            .select();

        if (error) {
            console.error('[Appointments API POST] Supabase error saving appointments:', error);
            console.error('[Appointments API POST] Error code:', error.code);
            console.error('[Appointments API POST] Error message:', error.message);
            console.error('[Appointments API POST] Error details:', error.details);
            console.error('[Appointments API POST] Error hint:', error.hint);
            throw error;
        }

        console.log('[Appointments API POST] Upsert successful. Records affected:', data?.length || 0);
        console.log('[Appointments API POST] Sample saved record:', data?.[0]);
        
        return NextResponse.json({ success: true, recordsAffected: data?.length || 0 });
    } catch (error) {
        console.error('Error saving appointments:', error);
        return NextResponse.json({ error: 'Failed to save appointments' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        // Check authentication (handles both new and fallback methods)
        const { userId, isFallback } = await checkAuthentication(request);
        
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        // Reject write operations for fallback users (they need to run migration)
        if (isFallback) {
            return NextResponse.json({ 
                error: 'Please run the migration script to assign your data to your user account before making changes.' 
            }, { status: 403 });
        }

        const body = await request.json();
        const { id, paymentStatus, fee, currency, paymentMethod, venue } = body;

        if (!id) {
            return NextResponse.json({ error: 'Appointment ID is required' }, { status: 400 });
        }

        // Get existing session to preserve metadata (and verify ownership)
        const { data: existingSession, error: fetchError } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId) // Ensure user owns this session
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

        // Update fields - always save paymentStatus, fee, currency, paymentMethod, and venue if provided
        if (paymentStatus !== undefined) metadata.paymentStatus = paymentStatus;
        // Only update fee if it's provided and > 0 (don't overwrite with 0)
        if (fee !== undefined && fee !== null && fee > 0) {
            metadata.fee = fee;
        }
        if (currency !== undefined && currency !== null) metadata.currency = currency;
        if (paymentMethod !== undefined && paymentMethod !== null) metadata.paymentMethod = paymentMethod;
        if (venue !== undefined && venue !== null) metadata.venue = venue;


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
        // Check authentication (handles both new and fallback methods)
        const { userId, isFallback } = await checkAuthentication(request);
        
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        // Reject write operations for fallback users (they need to run migration)
        if (isFallback) {
            return NextResponse.json({ 
                error: 'Please run the migration script to assign your data to your user account before making changes.' 
            }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Appointment ID is required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('sessions')
            .delete()
            .eq('id', id)
            .eq('user_id', userId); // Ensure user owns this session

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

