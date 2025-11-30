import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST() {
    try {
        console.log('[Create From Next] Starting to create sessions from client nextAppointment fields...');
        
        // Get all clients with nextAppointment
        const { data: allClients, error: clientsError } = await supabase
            .from('clients')
            .select('id, name, metadata');
        
        if (clientsError) {
            console.error('[Create From Next] Error fetching clients:', clientsError);
            return NextResponse.json({ error: `Failed to fetch clients: ${clientsError.message}` }, { status: 500 });
        }
        
        if (!allClients || allClients.length === 0) {
            return NextResponse.json({ message: 'No clients found' });
        }
        
        const sessionsCreated: any[] = [];
        const errors: string[] = [];
        
        // Get existing sessions to avoid duplicates
        const { data: existingSessions } = await supabase
            .from('sessions')
            .select('id, client_id, date');
        
        const existingSessionKeys = new Set();
        (existingSessions || []).forEach((s: any) => {
            const key = `${s.client_id}_${s.date}`;
            existingSessionKeys.add(key);
        });
        
        for (const client of allClients) {
            if (!client.metadata) continue;
            
            let metadata: any = {};
            try {
                metadata = typeof client.metadata === 'string' ? JSON.parse(client.metadata) : client.metadata;
            } catch {
                continue;
            }
            
            const nextAppointment = metadata.nextAppointment;
            if (!nextAppointment) continue;
            
            // Parse the nextAppointment date
            let appointmentDate: Date;
            try {
                appointmentDate = new Date(nextAppointment);
                if (isNaN(appointmentDate.getTime())) {
                    errors.push(`Invalid date for ${client.name}: ${nextAppointment}`);
                    continue;
                }
            } catch (e) {
                errors.push(`Error parsing date for ${client.name}: ${nextAppointment}`);
                continue;
            }
            
            // Check if session already exists
            const sessionKey = `${client.id}_${appointmentDate.toISOString()}`;
            if (existingSessionKeys.has(sessionKey)) {
                console.log(`[Create From Next] Session already exists for ${client.name} on ${appointmentDate.toISOString()}`);
                continue;
            }
            
            // Create session
            const sessionData: any = {
                id: `apt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                client_id: client.id,
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
            
            const { error: insertError } = await supabase
                .from('sessions')
                .insert([sessionData]);
            
            if (insertError) {
                console.error(`[Create From Next] Error creating session for ${client.name}:`, insertError);
                errors.push(`${client.name}: ${insertError.message}`);
            } else {
                sessionsCreated.push({
                    clientName: client.name,
                    date: appointmentDate.toISOString()
                });
                console.log(`[Create From Next] Created session for ${client.name} on ${appointmentDate.toISOString()}`);
            }
        }
        
        return NextResponse.json({
            success: true,
            created: sessionsCreated.length,
            sessionsCreated,
            errors: errors.length > 0 ? errors : undefined
        });
        
    } catch (error: any) {
        console.error('[Create From Next] Error:', error);
        return NextResponse.json({
            error: `Failed to create sessions: ${error?.message || 'Unknown error'}`,
            stack: error?.stack
        }, { status: 500 });
    }
}






