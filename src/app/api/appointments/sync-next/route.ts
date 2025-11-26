import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const { clientId, nextAppointment: providedNextAppointment } = await request.json();
        
        if (!clientId) {
            return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
        }
        
        // Get client with metadata
        const { data: client, error: clientError } = await supabase
            .from('clients')
            .select('id, name, metadata')
            .eq('id', clientId)
            .single();
        
        if (clientError || !client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }
        
        // Parse metadata first (needed for sessionFee/currency even if nextAppointment is provided)
        let metadata: any = {};
        try {
            metadata = typeof client.metadata === 'string' ? JSON.parse(client.metadata) : client.metadata || {};
        } catch {
            console.warn('[Sync Next] Could not parse metadata, using empty object');
            metadata = {};
        }
        
        // Use provided nextAppointment if available (from formData), otherwise read from database
        let nextAppointment = providedNextAppointment || metadata.nextAppointment;
        
        if (!nextAppointment) {
            return NextResponse.json({ message: 'No nextAppointment set for this client', created: false });
        }
        
        // Parse the nextAppointment date
        // Handle different date formats: "2025-11-27T11:00" or "2025-11-27T11:00:00" or full ISO
        let appointmentDate: Date;
        try {
            // If the date is missing seconds/timezone, add them
            let normalizedDate = nextAppointment;
            if (normalizedDate.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
                // Format: "2025-11-27T11:00" - add seconds and assume local timezone
                normalizedDate = normalizedDate + ':00';
            }
            
            appointmentDate = new Date(normalizedDate);
            if (isNaN(appointmentDate.getTime())) {
                console.error(`[Sync Next] Invalid date format: ${nextAppointment} (normalized: ${normalizedDate})`);
                return NextResponse.json({ error: `Invalid date format: ${nextAppointment}` }, { status: 400 });
            }
            
            console.log(`[Sync Next] Parsed date: ${nextAppointment} -> ${appointmentDate.toISOString()}`);
        } catch (e: any) {
            console.error(`[Sync Next] Error parsing date: ${nextAppointment}`, e);
            return NextResponse.json({ error: `Error parsing date: ${nextAppointment} - ${e.message}` }, { status: 400 });
        }
        
        // Check if session already exists for this client and date
        // Compare by date only (ignore time) to match frontend logic
        const appointmentDateStr = appointmentDate.toISOString().split('T')[0]; // Date only (YYYY-MM-DD)
        const startOfDay = new Date(appointmentDateStr + 'T00:00:00.000Z');
        const endOfDay = new Date(appointmentDateStr + 'T23:59:59.999Z');
        
        const { data: existingSessions } = await supabase
            .from('sessions')
            .select('id, date')
            .eq('client_id', clientId)
            .gte('date', startOfDay.toISOString())
            .lte('date', endOfDay.toISOString());
        
        if (existingSessions && existingSessions.length > 0) {
            return NextResponse.json({ 
                message: 'Session already exists for this nextAppointment',
                created: false,
                sessionId: existingSessions[0].id,
                existingDate: existingSessions[0].date
            });
        }
        
        // Create session
        const sessionData: any = {
            id: `apt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            client_id: clientId,
            date: appointmentDate.toISOString(),
            duration: 60, // Default duration
            type: 'Therapy Session',
            notes: '',
            updated_at: new Date().toISOString()
        };
        
        // Add metadata if fee/currency exists
        if (metadata.sessionFee || metadata.currency) {
            sessionData.metadata = {
                fee: metadata.sessionFee || 80,
                currency: metadata.currency || 'EUR',
                status: 'confirmed',
                paymentStatus: 'unpaid'
            };
        }
        
        const { error: insertError, data: insertedSession } = await supabase
            .from('sessions')
            .insert([sessionData])
            .select()
            .single();
        
        if (insertError) {
            console.error(`[Sync Next] Error creating session for ${client.name}:`, insertError);
            return NextResponse.json({ error: `Failed to create session: ${insertError.message}` }, { status: 500 });
        }
        
        return NextResponse.json({
            success: true,
            created: true,
            sessionId: insertedSession.id,
            message: `Session created for ${client.name}`
        });
        
    } catch (error: any) {
        console.error('[Sync Next] Error:', error);
        return NextResponse.json({
            error: `Failed to sync: ${error?.message || 'Unknown error'}`,
            stack: error?.stack
        }, { status: 500 });
    }
}

