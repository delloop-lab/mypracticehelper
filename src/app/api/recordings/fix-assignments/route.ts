import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST() {
    try {
        console.log('[Fix Recordings] Starting to fix missing client_id and session_id...');
        
        // Get all recordings - also try to get clientName from joined clients table
        const { data: allRecordings, error: recordingsError } = await supabase
            .from('recordings')
            .select(`
                *,
                clients (id, name)
            `)
            .order('created_at', { ascending: false });
        
        if (recordingsError) {
            console.error('[Fix Recordings] Error fetching recordings:', recordingsError);
            return NextResponse.json({ error: `Failed to fetch recordings: ${recordingsError.message}` }, { status: 500 });
        }
        
        if (!allRecordings || allRecordings.length === 0) {
            return NextResponse.json({ message: 'No recordings found' });
        }
        
        console.log(`[Fix Recordings] Found ${allRecordings.length} recordings`);
        
        // Get all clients for name matching
        const { data: allClients } = await supabase.from('clients').select('id, name');
        const clientMap = new Map<string, string>();
        const clientNameMap = new Map<string, string>(); // For exact name matching
        
        (allClients || []).forEach((c: any) => {
            if (!c.name) return;
            const normalizedName = c.name.toLowerCase().trim();
            clientMap.set(normalizedName, c.id);
            clientNameMap.set(c.name.trim(), c.id); // Also store exact name
        });
        console.log(`[Fix Recordings] Loaded ${allClients?.length || 0} clients for mapping`);
        
        // Get all sessions for date/client matching
        const { data: allSessions } = await supabase.from('sessions').select('id, client_id, date');
        const sessionMap = new Map();
        (allSessions || []).forEach((s: any) => {
            if (s.client_id && s.date) {
                // Create key: client_id + date (just date part, not time)
                const dateStr = s.date.split('T')[0];
                const key = `${s.client_id}_${dateStr}`;
                sessionMap.set(key, s.id);
            }
        });
        console.log(`[Fix Recordings] Loaded ${allSessions?.length || 0} sessions for mapping`);
        
        const results: any = {
            fixed: [],
            errors: [],
            skipped: []
        };
        
        // Check if recordings table has session_id column
        // Try to fetch one recording to see its structure
        const sampleRecording = allRecordings[0];
        const hasSessionId = 'session_id' in sampleRecording;
        console.log(`[Fix Recordings] Recordings table has session_id column: ${hasSessionId}`);
        
        for (const recording of allRecordings) {
            let needsUpdate = false;
            const updates: any = {};
            
            // Fix client_id if missing or null (check both null and empty string)
            const currentClientId = recording.client_id;
            const needsClientId = !currentClientId || currentClientId === null || currentClientId === '';
            
            if (needsClientId) {
                let clientId = null;
                
                // First, check if there's a clientName from joined clients table
                const joinedClientName = (recording.clients as any)?.name;
                if (joinedClientName) {
                    const normalizedName = joinedClientName.toLowerCase().trim();
                    clientId = clientMap.get(normalizedName) || clientNameMap.get(joinedClientName.trim());
                    if (clientId) {
                        console.log(`[Fix Recordings] Found client_id from joined client name for recording ${recording.id}: ${clientId}`);
                    }
                }
                
                // If still not found, try to find client by name in transcript
                if (!clientId && recording.transcript) {
                    const transcriptLower = recording.transcript.toLowerCase();
                    for (const [normalizedName, id] of clientMap.entries()) {
                        // Check if transcript contains the client name
                        if (transcriptLower.includes(normalizedName)) {
                            clientId = id;
                            console.log(`[Fix Recordings] Found client_id from transcript for recording ${recording.id}: ${clientId} (matched: ${normalizedName})`);
                            break;
                        }
                    }
                }
                
                // Try title
                if (!clientId && recording.title) {
                    const titleLower = recording.title.toLowerCase();
                    for (const [normalizedName, id] of clientMap.entries()) {
                        if (titleLower.includes(normalizedName)) {
                            clientId = id;
                            console.log(`[Fix Recordings] Found client_id from title for recording ${recording.id}: ${clientId} (matched: ${normalizedName})`);
                            break;
                        }
                    }
                }
                
                // Check if there's a client_name field (some recordings might have this)
                if (!clientId && (recording as any).client_name) {
                    const clientName = (recording as any).client_name;
                    const normalizedName = clientName.toLowerCase().trim();
                    clientId = clientMap.get(normalizedName) || clientNameMap.get(clientName.trim());
                    if (clientId) {
                        console.log(`[Fix Recordings] Found client_id from client_name field for recording ${recording.id}: ${clientId}`);
                    }
                }
                
                if (clientId) {
                    updates.client_id = clientId;
                    needsUpdate = true;
                } else {
                    results.errors.push(`Recording ${recording.id}: Could not find client_id (no client name found in transcript/title)`);
                }
            }
            
            // Fix session_id if missing and we have client_id
            const currentSessionId = recording.session_id;
            const needsSessionId = hasSessionId && (!currentSessionId || currentSessionId === null || currentSessionId === '') && (updates.client_id || recording.client_id);
            
            if (needsSessionId) {
                const clientId = updates.client_id || recording.client_id;
                const recordingDate = recording.created_at ? new Date(recording.created_at).toISOString().split('T')[0] : null;
                
                if (recordingDate) {
                    const sessionKey = `${clientId}_${recordingDate}`;
                    const sessionId = sessionMap.get(sessionKey);
                    
                    if (sessionId) {
                        updates.session_id = sessionId;
                        needsUpdate = true;
                        console.log(`[Fix Recordings] Found session_id for recording ${recording.id}: ${sessionId}`);
                    } else {
                        // Try to find session within a few days
                        let foundSessionId = null;
                        for (let dayOffset = -3; dayOffset <= 3; dayOffset++) {
                            const checkDate = new Date(recording.created_at);
                            checkDate.setDate(checkDate.getDate() + dayOffset);
                            const checkDateStr = checkDate.toISOString().split('T')[0];
                            const checkKey = `${clientId}_${checkDateStr}`;
                            if (sessionMap.has(checkKey)) {
                                foundSessionId = sessionMap.get(checkKey);
                                break;
                            }
                        }
                        
                        if (foundSessionId) {
                            updates.session_id = foundSessionId;
                            needsUpdate = true;
                            console.log(`[Fix Recordings] Found session_id for recording ${recording.id} (within 3 days): ${foundSessionId}`);
                        } else {
                            results.errors.push(`Recording ${recording.id}: Could not find matching session`);
                        }
                    }
                }
            }
            
            if (needsUpdate) {
                const { error: updateError } = await supabase
                    .from('recordings')
                    .update(updates)
                    .eq('id', recording.id);
                
                if (updateError) {
                    console.error(`[Fix Recordings] Error updating recording ${recording.id}:`, updateError);
                    results.errors.push(`Recording ${recording.id}: ${updateError.message}`);
                } else {
                    results.fixed.push({
                        id: recording.id,
                        updates
                    });
                }
            } else {
                results.skipped.push(recording.id);
            }
        }
        
        return NextResponse.json({
            success: true,
            message: `Fixed ${results.fixed.length} recordings`,
            results: {
                fixed: results.fixed.length,
                errors: results.errors.length,
                skipped: results.skipped.length,
                details: results
            }
        });
        
    } catch (error: any) {
        console.error('[Fix Recordings] Error:', error);
        return NextResponse.json({
            error: `Failed to fix recordings: ${error?.message || 'Unknown error'}`,
            stack: error?.stack
        }, { status: 500 });
    }
}

