import { NextResponse } from 'next/server';
import { saveClients } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

export async function POST() {
    try {
        const results: any = {
            clients: { restored: [], errors: [] },
            sessions: { restored: [], errors: [] },
            sessionNotes: { restored: [], errors: [] }
        };

        // 1. Restore ALL Clients from backup
        try {
            const clientsFile = path.join(process.cwd(), 'data', 'clients.json');
            if (fs.existsSync(clientsFile)) {
                const clientsData = fs.readFileSync(clientsFile, 'utf8');
                const clients = JSON.parse(clientsData);
                
                // Restore ALL clients from backup
                if (clients.length > 0) {
                    await saveClients(clients);
                    results.clients.restored = clients.map((c: any) => c.name);
                    console.log(`[Restore] Restored ${clients.length} clients:`, results.clients.restored);
                }
            } else {
                results.clients.errors.push('Clients backup file not found');
            }
        } catch (error: any) {
            console.error('[Restore] Error restoring clients:', error);
            results.clients.errors.push(error.message);
        }

        // 2. Restore Sessions/Appointments
        try {
            const appointmentsFile = path.join(process.cwd(), 'data', 'appointments.json');
            if (fs.existsSync(appointmentsFile)) {
                const appointmentsData = fs.readFileSync(appointmentsFile, 'utf8');
                const appointments = JSON.parse(appointmentsData);
                
                // Get all clients to map clientName to client_id
                const { data: allClients } = await supabase.from('clients').select('id, name');
                const clientMap = new Map((allClients || []).map((c: any) => [c.name.toLowerCase(), c.id]));
                
                const sessionsToRestore = [];
                for (const apt of appointments) {
                    // Try multiple name variations
                    let clientId = clientMap.get(apt.clientName.toLowerCase()) || 
                                  clientMap.get(apt.clientName) ||
                                  clientMap.get(apt.clientName.trim().toLowerCase());
                    
                    if (!clientId) {
                        // Try partial match (e.g., "Lilli D Schillaci" vs "Lilly Schillaci")
                        for (const [name, id] of clientMap.entries()) {
                            if (apt.clientName.toLowerCase().includes(name.toLowerCase()) || 
                                name.toLowerCase().includes(apt.clientName.toLowerCase())) {
                                clientId = id;
                                break;
                            }
                        }
                    }
                    
                    if (!clientId) {
                        results.sessions.errors.push(`Client "${apt.clientName}" not found for appointment ${apt.id}`);
                        continue;
                    }
                    
                    // Combine date and time
                    let dateValue = apt.date;
                    if (apt.time && !apt.date.includes('T')) {
                        const timeStr = apt.time.length === 5 ? `${apt.time}:00` : apt.time;
                        dateValue = `${apt.date}T${timeStr}`;
                    }
                    
                    const metadata: any = {};
                    if (apt.fee !== undefined) metadata.fee = apt.fee;
                    if (apt.currency) metadata.currency = apt.currency;
                    if (apt.paymentStatus) metadata.paymentStatus = apt.paymentStatus;
                    if (apt.status) metadata.status = apt.status;
                    if (apt.paymentMethod) metadata.paymentMethod = apt.paymentMethod;
                    
                    sessionsToRestore.push({
                        id: apt.id,
                        client_id: clientId,
                        date: dateValue,
                        duration: apt.duration,
                        type: apt.type,
                        notes: apt.notes || '',
                        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
                        updated_at: new Date().toISOString()
                    });
                }
                
                if (sessionsToRestore.length > 0) {
                    const { error } = await supabase.from('sessions').upsert(sessionsToRestore);
                    if (error) {
                        results.sessions.errors.push(error.message);
                    } else {
                        results.sessions.restored = appointments.map((a: any) => `${a.clientName} - ${a.date}`);
                    }
                }
            }
        } catch (error: any) {
            results.sessions.errors.push(error.message);
        }

        // 3. Restore Session Notes
        try {
            const notesFile = path.join(process.cwd(), 'data', 'session-notes.json');
            if (fs.existsSync(notesFile)) {
                const notesData = fs.readFileSync(notesFile, 'utf8');
                const notes = JSON.parse(notesData);
                
                // Get all clients to map clientName to client_id
                const { data: allClients } = await supabase.from('clients').select('id, name');
                const clientMap = new Map((allClients || []).map((c: any) => [c.name.toLowerCase(), c.id]));
                
                // Get all sessions to map session date/client to session_id
                const { data: allSessions } = await supabase.from('sessions').select('id, client_id, date');
                const sessionMap = new Map();
                (allSessions || []).forEach((s: any) => {
                    const key = `${s.client_id}-${s.date.split('T')[0]}`;
                    sessionMap.set(key, s.id);
                });
                
                const notesToRestore = [];
                for (const note of notes) {
                    // Try multiple name variations
                    let clientId = clientMap.get(note.clientName.toLowerCase()) || 
                                  clientMap.get(note.clientName) ||
                                  clientMap.get(note.clientName.trim().toLowerCase());
                    
                    if (!clientId) {
                        // Try partial match
                        for (const [name, id] of clientMap.entries()) {
                            if (note.clientName.toLowerCase().includes(name.toLowerCase()) || 
                                name.toLowerCase().includes(note.clientName.toLowerCase())) {
                                clientId = id;
                                break;
                            }
                        }
                    }
                    
                    if (!clientId) {
                        results.sessionNotes.errors.push(`Client "${note.clientName}" not found for note ${note.id}`);
                        continue;
                    }
                    
                    // Try to find session_id
                    const sessionDate = note.sessionDate ? note.sessionDate.split('T')[0] : null;
                    let sessionId = null;
                    if (sessionDate) {
                        const key = `${clientId}-${sessionDate}`;
                        sessionId = sessionMap.get(key) || null;
                    }
                    
                    notesToRestore.push({
                        id: note.id,
                        client_id: clientId,
                        session_id: sessionId,
                        content: note.content,
                        created_at: note.createdDate || new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });
                }
                
                if (notesToRestore.length > 0) {
                    const { error } = await supabase.from('session_notes').upsert(notesToRestore);
                    if (error) {
                        results.sessionNotes.errors.push(error.message);
                    } else {
                        results.sessionNotes.restored = notes.map((n: any) => `${n.clientName} - ${n.sessionDate || 'unknown date'}`);
                    }
                }
            }
        } catch (error: any) {
            results.sessionNotes.errors.push(error.message);
        }

        return NextResponse.json({
            success: true,
            results,
            message: 'Restore completed. Check results for details.'
        });
        
    } catch (error: any) {
        console.error('Error restoring data:', error);
        return NextResponse.json({ 
            error: `Failed to restore: ${error?.message || 'Unknown error'}` 
        }, { status: 500 });
    }
}

