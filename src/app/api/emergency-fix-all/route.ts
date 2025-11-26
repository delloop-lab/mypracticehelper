import { NextResponse } from 'next/server';
import { saveClients } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

export async function POST() {
    try {
        console.log('[EMERGENCY FIX] Starting comprehensive data recovery...');
        const results: any = {
            clients: { created: [], errors: [] },
            sessions: { fixed: 0, created: 0, errors: [] },
            sessionNotes: { fixed: 0, errors: [] }
        };

        // STEP 1: RESTORE ALL CLIENTS FROM BACKUP FIRST
        try {
            const clientsFile = path.join(process.cwd(), 'data', 'clients.json');
            if (fs.existsSync(clientsFile)) {
                const clientsData = fs.readFileSync(clientsFile, 'utf8');
                const backupClients = JSON.parse(clientsData);
                
                console.log(`[EMERGENCY FIX] Found ${backupClients.length} clients in backup`);
                
                // Get existing clients
                const { data: existingClients } = await supabase.from('clients').select('id, name');
                const existingIds = new Set((existingClients || []).map((c: any) => c.id));
                
                // Add Claire if not in backup
                const claireInBackup = backupClients.some((c: any) => 
                    c.name && c.name.toLowerCase().includes('claire')
                );
                
                if (!claireInBackup) {
                    backupClients.push({
                        id: Date.now().toString(),
                        name: "Claire Schillaci",
                        firstName: "Claire",
                        lastName: "Schillaci",
                        email: "claire@claireschillaci.com",
                        phone: "",
                        nextAppointment: "",
                        notes: "",
                        recordings: 0,
                        sessions: 0,
                        documents: [],
                        relationships: [],
                        currency: 'EUR',
                        sessionFee: 0,
                        archived: false
                    });
                    results.clients.created.push('Claire Schillaci');
                }
                
                // Restore all clients - use direct Supabase insert for better error handling
                const records = backupClients.map((client: any) => {
                    const metadata: any = {
                        nextAppointment: client.nextAppointment || '',
                        sessions: client.sessions || 0,
                        documents: client.documents || [],
                        relationships: client.relationships || [],
                        firstName: client.firstName || '',
                        lastName: client.lastName || '',
                        preferredName: client.preferredName || '',
                        currency: client.currency || 'EUR',
                        sessionFee: client.sessionFee || 0,
                        dateOfBirth: client.dateOfBirth || '',
                        mailingAddress: client.mailingAddress || '',
                        emergencyContact: client.emergencyContact,
                        medicalConditions: client.medicalConditions || '',
                        currentMedications: client.currentMedications || '',
                        doctorInfo: client.doctorInfo
                    };

                    return {
                        id: client.id,
                        name: client.name,
                        email: client.email || '',
                        phone: client.phone || '',
                        notes: client.notes || '',
                        metadata: metadata,
                        archived: client.archived || false,
                        archived_at: client.archivedAt ? new Date(client.archivedAt).toISOString() : null,
                        updated_at: new Date().toISOString()
                    };
                });

                const { error: upsertError, data: upsertedData } = await supabase
                    .from('clients')
                    .upsert(records)
                    .select();

                if (upsertError) {
                    console.error('[EMERGENCY FIX] Error upserting clients:', upsertError);
                    results.clients.errors.push(`Upsert error: ${upsertError.message}`);
                } else {
                    console.log(`[EMERGENCY FIX] Successfully restored ${backupClients.length} clients from backup`);
                    results.clients.created.push(...backupClients.map((c: any) => c.name));
                }
            } else {
                results.clients.errors.push('clients.json backup file not found');
            }
        } catch (error: any) {
            results.clients.errors.push(`Restore clients: ${error.message}`);
            console.error('[EMERGENCY FIX] Error restoring clients:', error);
        }

        // STEP 2: Get all clients with comprehensive name mapping (AFTER restoration)
        // Wait a moment for database to sync
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { data: allClients, error: fetchError } = await supabase.from('clients').select('id, name, metadata');
        
        if (fetchError) {
            console.error('[EMERGENCY FIX] Error fetching clients:', fetchError);
            results.clients.errors.push(`Fetch error: ${fetchError.message}`);
        }
        
        const clientMap = new Map();
        (allClients || []).forEach((c: any) => {
            if (!c.name) return;
            const name = c.name.toLowerCase().trim();
            clientMap.set(name, c.id);
            clientMap.set(c.name, c.id);
            
            // Extract firstName and lastName from metadata
            let firstName = '';
            let lastName = '';
            if (c.metadata) {
                try {
                    const metadata = typeof c.metadata === 'string' ? JSON.parse(c.metadata) : c.metadata;
                    firstName = metadata.firstName || '';
                    lastName = metadata.lastName || '';
                } catch (e) {
                    // Ignore parse errors
                }
            }
            
            // Map variations
            if (firstName && lastName) {
                clientMap.set(`${firstName.toLowerCase()} ${lastName.toLowerCase()}`, c.id);
            }
            // Handle Lilli/Lilly variations
            if (name.includes('lill') && name.includes('schillaci')) {
                clientMap.set('lilli schillaci', c.id);
                clientMap.set('lilly schillaci', c.id);
                clientMap.set('lilli d schillaci', c.id);
            }
            // Map "Arni" variations
            if (name === 'arni' || name.startsWith('arni')) {
                clientMap.set('arni', c.id);
            }
        });
        console.log(`[EMERGENCY FIX] Loaded ${allClients?.length || 0} clients for mapping`);
        console.log(`[EMERGENCY FIX] Client names in DB:`, (allClients || []).map((c: any) => c.name));
        console.log(`[EMERGENCY FIX] Client map entries:`, Array.from(clientMap.entries()).slice(0, 10));

        // STEP 3: Fix/restore all sessions from backup
        try {
            const appointmentsFile = path.join(process.cwd(), 'data', 'appointments.json');
            if (fs.existsSync(appointmentsFile)) {
                const appointmentsData = fs.readFileSync(appointmentsFile, 'utf8');
                const appointments = JSON.parse(appointmentsData);
                
                // Get all existing sessions
                const { data: existingSessions } = await supabase.from('sessions').select('*');
                const existingSessionIds = new Set((existingSessions || []).map((s: any) => s.id));
                
                const sessionsToUpsert = [];
                for (const apt of appointments) {
                    // Find client ID with fuzzy matching
                    let clientId = null;
                    const aptNameLower = apt.clientName.toLowerCase().trim();
                    
                    console.log(`[EMERGENCY FIX] Looking for client: "${apt.clientName}" (lowercase: "${aptNameLower}")`);
                    
                    // Try exact match
                    clientId = clientMap.get(aptNameLower) ||
                              clientMap.get(apt.clientName);
                    
                    if (clientId) {
                        console.log(`[EMERGENCY FIX] Found exact match for "${apt.clientName}": ${clientId}`);
                    }
                    
                    // Handle "Lilli D Schillaci" -> "Lilly Schillaci" mapping
                    if (!clientId && aptNameLower.includes('lill') && aptNameLower.includes('schillaci')) {
                        // Try "Lilly Schillaci" variations
                        clientId = clientMap.get('lilly schillaci') ||
                                  clientMap.get('lilli schillaci');
                        if (clientId) {
                            console.log(`[EMERGENCY FIX] Found Lilli/Lilly match for "${apt.clientName}": ${clientId}`);
                        }
                    }
                    
                    // Try removing middle initial (e.g., "Lilli D Schillaci" -> "Lilli Schillaci")
                    if (!clientId && apt.clientName.includes(' ')) {
                        const parts = apt.clientName.split(' ').filter((p: string) => p.length > 0);
                        if (parts.length === 3) {
                            // Remove middle name/initial
                            const withoutMiddle = `${parts[0]} ${parts[2]}`.toLowerCase();
                            clientId = clientMap.get(withoutMiddle);
                            if (clientId) {
                                console.log(`[EMERGENCY FIX] Found match without middle for "${apt.clientName}": ${clientId}`);
                            }
                        }
                        // Try first + last only
                        if (!clientId && parts.length >= 2) {
                            const firstLast = `${parts[0]} ${parts[parts.length - 1]}`.toLowerCase();
                            clientId = clientMap.get(firstLast);
                            if (clientId) {
                                console.log(`[EMERGENCY FIX] Found first+last match for "${apt.clientName}": ${clientId}`);
                            }
                        }
                    }
                    
                    // Try last name matching
                    if (!clientId) {
                        const lastName = apt.clientName.split(' ').pop()?.toLowerCase();
                        if (lastName) {
                            for (const [name, id] of clientMap.entries()) {
                                const nameParts = name.split(' ');
                                const nameLast = nameParts[nameParts.length - 1];
                                if (nameLast === lastName || name.includes(lastName)) {
                                    clientId = id;
                                    console.log(`[EMERGENCY FIX] Found last name match for "${apt.clientName}": ${clientId} (matched "${name}")`);
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (!clientId) {
                        console.error(`[EMERGENCY FIX] Could not find client for "${apt.clientName}". Available clients:`, Array.from(clientMap.keys()));
                        results.sessions.errors.push(`Could not find client for "${apt.clientName}"`);
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
                    
                    const sessionData: any = {
                        id: apt.id,
                        client_id: clientId,
                        date: dateValue,
                        duration: apt.duration,
                        type: apt.type,
                        notes: apt.notes || '',
                        updated_at: new Date().toISOString()
                    };
                    
                    if (Object.keys(metadata).length > 0) {
                        sessionData.metadata = metadata;
                    }
                    
                    sessionsToUpsert.push(sessionData);
                }
                
                if (sessionsToUpsert.length > 0) {
                    const { error } = await supabase.from('sessions').upsert(sessionsToUpsert);
                    if (error) {
                        results.sessions.errors.push(error.message);
                    } else {
                        results.sessions.fixed = sessionsToUpsert.length;
                        console.log(`[EMERGENCY FIX] Upserted ${sessionsToUpsert.length} sessions`);
                    }
                }
            }
        } catch (error: any) {
            results.sessions.errors.push(error.message);
        }

        // STEP 4: Fix all existing sessions that have null client_id
        try {
            const { data: unassignedSessions } = await supabase
                .from('sessions')
                .select('*')
                .is('client_id', null);
            
            if (unassignedSessions && unassignedSessions.length > 0) {
                console.log(`[EMERGENCY FIX] Found ${unassignedSessions.length} unassigned sessions`);
                // Try to match them from backup
                const appointmentsFile = path.join(process.cwd(), 'data', 'appointments.json');
                if (fs.existsSync(appointmentsFile)) {
                    const appointmentsData = fs.readFileSync(appointmentsFile, 'utf8');
                    const appointments = JSON.parse(appointmentsData);
                    
                    for (const session of unassignedSessions) {
                        const backupApt = appointments.find((a: any) => a.id === session.id);
                        if (backupApt) {
                            // Find client
                            let clientId = clientMap.get(backupApt.clientName.toLowerCase()) ||
                                          clientMap.get(backupApt.clientName);
                            
                            if (clientId) {
                                await supabase
                                    .from('sessions')
                                    .update({ client_id: clientId })
                                    .eq('id', session.id);
                                results.sessions.fixed++;
                            }
                        }
                    }
                }
            }
        } catch (error: any) {
            results.sessions.errors.push(`Unassigned fix: ${error.message}`);
        }

        // STEP 5: Fix session notes
        try {
            const notesFile = path.join(process.cwd(), 'data', 'session-notes.json');
            if (fs.existsSync(notesFile)) {
                const notesData = fs.readFileSync(notesFile, 'utf8');
                const notes = JSON.parse(notesData);
                
                // Get all sessions for matching
                const { data: allSessions } = await supabase.from('sessions').select('id, client_id, date');
                const sessionMap = new Map();
                (allSessions || []).forEach((s: any) => {
                    const key = `${s.client_id}-${s.date.split('T')[0]}`;
                    sessionMap.set(key, s.id);
                });
                
                for (const note of notes) {
                    // Find client with fuzzy matching
                    let clientId = null;
                    const noteNameLower = note.clientName.toLowerCase().trim();
                    
                    // Try exact match
                    clientId = clientMap.get(noteNameLower) ||
                              clientMap.get(note.clientName);
                    
                    // Handle "Lilly Schillaci" variations
                    if (!clientId && noteNameLower.includes('lill') && noteNameLower.includes('schillaci')) {
                        clientId = clientMap.get('lilly schillaci') ||
                                  clientMap.get('lilli schillaci');
                    }
                    
                    // Try removing middle initial
                    if (!clientId && note.clientName.includes(' ')) {
                        const parts = note.clientName.split(' ').filter((p: string) => p.length > 0);
                        if (parts.length === 3) {
                            const withoutMiddle = `${parts[0]} ${parts[2]}`.toLowerCase();
                            clientId = clientMap.get(withoutMiddle);
                        }
                        if (!clientId && parts.length >= 2) {
                            const firstLast = `${parts[0]} ${parts[parts.length - 1]}`.toLowerCase();
                            clientId = clientMap.get(firstLast);
                        }
                    }
                    
                    // Try last name matching
                    if (!clientId) {
                        const lastName = note.clientName.split(' ').pop()?.toLowerCase();
                        if (lastName) {
                            for (const [name, id] of clientMap.entries()) {
                                const nameParts = name.split(' ');
                                const nameLast = nameParts[nameParts.length - 1];
                                if (nameLast === lastName || name.includes(lastName)) {
                                    clientId = id;
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (!clientId) {
                        results.sessionNotes.errors.push(`Client "${note.clientName}" not found for note ${note.id}`);
                        continue;
                    }
                    
                    // Find session
                    let sessionId = null;
                    if (note.sessionDate) {
                        const sessionDate = note.sessionDate.split('T')[0];
                        const key = `${clientId}-${sessionDate}`;
                        sessionId = sessionMap.get(key);
                    }
                    
                    // Update note
                    const { error } = await supabase
                        .from('session_notes')
                        .update({
                            client_id: clientId,
                            session_id: sessionId
                        })
                        .eq('id', note.id);
                    
                    if (error) {
                        results.sessionNotes.errors.push(`Note ${note.id}: ${error.message}`);
                    } else {
                        results.sessionNotes.fixed++;
                    }
                }
            }
        } catch (error: any) {
            results.sessionNotes.errors.push(error.message);
        }

        // STEP 6: Fix all unassigned session notes
        try {
            const { data: unassignedNotes } = await supabase
                .from('session_notes')
                .select('*')
                .is('client_id', null);
            
            if (unassignedNotes && unassignedNotes.length > 0) {
                const notesFile = path.join(process.cwd(), 'data', 'session-notes.json');
                if (fs.existsSync(notesFile)) {
                    const notesData = fs.readFileSync(notesFile, 'utf8');
                    const backupNotes = JSON.parse(notesData);
                    
                    for (const note of unassignedNotes) {
                        const backupNote = backupNotes.find((n: any) => n.id === note.id);
                        if (backupNote) {
                            let clientId = clientMap.get(backupNote.clientName.toLowerCase()) ||
                                          clientMap.get(backupNote.clientName);
                            
                            if (clientId) {
                                await supabase
                                    .from('session_notes')
                                    .update({ client_id: clientId })
                                    .eq('id', note.id);
                                results.sessionNotes.fixed++;
                            }
                        }
                    }
                }
            }
        } catch (error: any) {
            results.sessionNotes.errors.push(`Unassigned notes fix: ${error.message}`);
        }

        return NextResponse.json({
            success: true,
            results,
            message: `Emergency fix completed. Created ${results.clients.created.length} clients, fixed ${results.sessions.fixed} sessions, fixed ${results.sessionNotes.fixed} notes.`
        });

    } catch (error: any) {
        console.error('[EMERGENCY FIX] Error:', error);
        return NextResponse.json({
            error: `Emergency fix failed: ${error?.message || 'Unknown error'}`,
            stack: error?.stack
        }, { status: 500 });
    }
}

