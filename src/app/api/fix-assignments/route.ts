import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST() {
    try {
        const results: any = {
            sessionsFixed: 0,
            sessionsErrors: [],
            notesFixed: 0,
            notesErrors: []
        };

        // 1. Get all clients
        const { data: allClients } = await supabase.from('clients').select('id, name');
        if (!allClients) {
            return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
        }

        // Create a comprehensive client name map (case-insensitive, handles variations)
        const clientMap = new Map();
        allClients.forEach((c: any) => {
            const name = c.name.toLowerCase().trim();
            clientMap.set(name, c.id);
            clientMap.set(c.name, c.id); // Also store original case
            // Store first name + last name variations
            const parts = c.name.split(' ');
            if (parts.length > 1) {
                const firstName = parts[0].toLowerCase();
                const lastName = parts[parts.length - 1].toLowerCase();
                clientMap.set(`${firstName} ${lastName}`, c.id);
                // Handle "Lilli D Schillaci" -> "Lilly Schillaci"
                if (parts.length === 3) {
                    clientMap.set(`${parts[0]} ${parts[2]}`, c.id);
                }
            }
        });

        console.log('[Fix Assignments] Client map:', Array.from(clientMap.entries()));

        // 2. Fix Sessions - Get all sessions with null or potentially wrong client_id
        const { data: allSessions, error: sessionsError } = await supabase
            .from('sessions')
            .select('id, client_id, date, type, notes');

        if (sessionsError) {
            results.sessionsErrors.push(sessionsError.message);
        } else if (allSessions) {
            // Get sessions that need fixing (null client_id or need verification)
            const sessionsToFix = [];
            
            for (const session of allSessions) {
                // If client_id is null, we need to find it
                // But we don't have clientName in sessions table, so we need to check if join fails
                const { data: sessionWithClient } = await supabase
                    .from('sessions')
                    .select('*, clients!inner(id, name)')
                    .eq('id', session.id)
                    .single();

                // If join fails or client_id is null, try to find by matching existing sessions
                if (!sessionWithClient || !session.client_id) {
                    // We'll need to update based on backup data or manual matching
                    // For now, let's check if we can match by checking appointments backup
                    sessionsToFix.push(session);
                }
            }

            // Re-fetch from backup and match properly
            const fs = require('fs');
            const path = require('path');
            const appointmentsFile = path.join(process.cwd(), 'data', 'appointments.json');
            
            if (fs.existsSync(appointmentsFile)) {
                const appointmentsData = fs.readFileSync(appointmentsFile, 'utf8');
                const appointments = JSON.parse(appointmentsData);

                for (const apt of appointments) {
                    // Find matching session
                    const session = allSessions.find((s: any) => s.id === apt.id);
                    if (!session) continue;

                    // Find client by name (try multiple variations)
                    let clientId = clientMap.get(apt.clientName.toLowerCase()) ||
                                  clientMap.get(apt.clientName) ||
                                  clientMap.get(apt.clientName.trim().toLowerCase());

                    // Try partial match
                    if (!clientId) {
                        for (const [name, id] of clientMap.entries()) {
                            if (apt.clientName.toLowerCase().includes(name.toLowerCase()) ||
                                name.toLowerCase().includes(apt.clientName.toLowerCase())) {
                                clientId = id;
                                break;
                            }
                        }
                    }

                    // Try removing middle initial (e.g., "Lilli D Schillaci" -> "Lilly Schillaci")
                    if (!clientId && apt.clientName.includes(' ')) {
                        const parts = apt.clientName.split(' ');
                        if (parts.length === 3) {
                            const withoutMiddle = `${parts[0]} ${parts[2]}`;
                            clientId = clientMap.get(withoutMiddle.toLowerCase()) ||
                                      clientMap.get(withoutMiddle);
                        }
                    }

                    if (clientId && session.client_id !== clientId) {
                        const { error } = await supabase
                            .from('sessions')
                            .update({ client_id: clientId })
                            .eq('id', session.id);

                        if (error) {
                            results.sessionsErrors.push(`Failed to update session ${session.id}: ${error.message}`);
                        } else {
                            results.sessionsFixed++;
                            console.log(`[Fix Assignments] Fixed session ${session.id}: ${apt.clientName} -> ${clientId}`);
                        }
                    } else if (!clientId) {
                        results.sessionsErrors.push(`Could not find client for session ${session.id} (clientName: "${apt.clientName}")`);
                    }
                }
            }
        }

        // 3. Fix Session Notes
        const { data: allNotes, error: notesError } = await supabase
            .from('session_notes')
            .select('id, client_id, session_id, content, created_at');

        if (notesError) {
            results.notesErrors.push(notesError.message);
        } else if (allNotes) {
            // Re-fetch from backup
            const fs = require('fs');
            const path = require('path');
            const notesFile = path.join(process.cwd(), 'data', 'session-notes.json');
            
            if (fs.existsSync(notesFile)) {
                const notesData = fs.readFileSync(notesFile, 'utf8');
                const backupNotes = JSON.parse(notesData);

                for (const backupNote of backupNotes) {
                    // Find matching note
                    const note = allNotes.find((n: any) => n.id === backupNote.id);
                    if (!note) continue;

                    // Find client by name
                    let clientId = clientMap.get(backupNote.clientName.toLowerCase()) ||
                                  clientMap.get(backupNote.clientName) ||
                                  clientMap.get(backupNote.clientName.trim().toLowerCase());

                    // Try partial match
                    if (!clientId) {
                        for (const [name, id] of clientMap.entries()) {
                            if (backupNote.clientName.toLowerCase().includes(name.toLowerCase()) ||
                                name.toLowerCase().includes(backupNote.clientName.toLowerCase())) {
                                clientId = id;
                                break;
                            }
                        }
                    }

                    // Find session_id if we have sessionDate
                    let sessionId = note.session_id;
                    if (!sessionId && backupNote.sessionDate && clientId) {
                        const sessionDate = backupNote.sessionDate.split('T')[0];
                        const { data: matchingSession } = await supabase
                            .from('sessions')
                            .select('id')
                            .eq('client_id', clientId)
                            .gte('date', `${sessionDate}T00:00:00`)
                            .lte('date', `${sessionDate}T23:59:59`)
                            .limit(1)
                            .single();

                        if (matchingSession) {
                            sessionId = matchingSession.id;
                        }
                    }

                    if (clientId && note.client_id !== clientId) {
                        const updateData: any = { client_id: clientId };
                        if (sessionId) updateData.session_id = sessionId;

                        const { error } = await supabase
                            .from('session_notes')
                            .update(updateData)
                            .eq('id', note.id);

                        if (error) {
                            results.notesErrors.push(`Failed to update note ${note.id}: ${error.message}`);
                        } else {
                            results.notesFixed++;
                            console.log(`[Fix Assignments] Fixed note ${note.id}: ${backupNote.clientName} -> ${clientId}`);
                        }
                    } else if (!clientId) {
                        results.notesErrors.push(`Could not find client for note ${note.id} (clientName: "${backupNote.clientName}")`);
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            results,
            message: `Fixed ${results.sessionsFixed} sessions and ${results.notesFixed} session notes`
        });

    } catch (error: any) {
        console.error('Error fixing assignments:', error);
        return NextResponse.json({
            error: `Failed to fix assignments: ${error?.message || 'Unknown error'}`
        }, { status: 500 });
    }
}



