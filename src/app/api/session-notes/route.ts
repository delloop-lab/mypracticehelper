import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkAuthentication } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        // Check authentication (handles both new and fallback methods)
        const { userId, isFallback, userEmail } = await checkAuthentication(request);
        
        // If fallback auth, show legacy data (notes without user_id)
        if (isFallback && userEmail === 'claire@claireschillaci.com') {
            console.log('[Session Notes API] Fallback auth detected, showing legacy notes (no user_id)');
            const [notesResult, recordingsResult, sessionsResult] = await Promise.all([
                supabase
                    .from('session_notes')
                    .select('*')
                    .is('user_id', null)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('recordings')
                    .select(`
                        *,
                        clients (id, name)
                    `)
                    .is('user_id', null)
                    .not('transcript', 'is', null)
                    .neq('transcript', '')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('sessions')
                    .select('*')
                    .is('user_id', null)
                    .order('date', { ascending: false })
            ]);
            
            // Continue with existing mapping logic below...
            const notesData = notesResult.data || [];
            const recordingsData = recordingsResult.data || [];
            const sessionsData = sessionsResult.data || [];
            
            // Get all unique client IDs from all sources
            const clientIds = new Set<string>();
            notesData.forEach((note: any) => {
                if (note.client_id) clientIds.add(note.client_id);
            });
            recordingsData.forEach((recording: any) => {
                if (recording.client_id) clientIds.add(recording.client_id);
            });
            sessionsData.forEach((session: any) => {
                if (session.client_id) clientIds.add(session.client_id);
            });
            
            // Fetch client names for all client IDs
            const clientsMap: Record<string, string> = {};
            if (clientIds.size > 0) {
                const { data: clientsData } = await supabase
                    .from('clients')
                    .select('id, name')
                    .in('id', Array.from(clientIds));
                
                if (clientsData) {
                    clientsData.forEach((client: any) => {
                        clientsMap[client.id] = client.name;
                    });
                }
            }
            
            // Map sessions to date strings
            const sessionsMap: Record<string, string> = {};
            sessionsData.forEach((session: any) => {
                if (session.id && session.date) {
                    sessionsMap[session.id] = session.date;
                }
            });
            
            // Map session notes to frontend format
            const mappedSessionNotes = notesData.map((note: any) => {
                const clientId = note.client_id;
                const sessionId = note.session_id;
                
                const clientName = clientId && clientsMap[clientId] 
                    ? clientsMap[clientId] 
                    : 'Unknown Client';
                
                const sessionDate = sessionId && sessionsMap[sessionId]
                    ? sessionsMap[sessionId]
                    : note.created_at || new Date().toISOString();
                
                return {
                    id: note.id,
                    clientName: clientName,
                    clientId: clientId,
                    sessionDate: sessionDate,
                    content: note.content || '',
                    createdDate: note.created_at || new Date().toISOString(),
                    attachments: note.attachments || [],
                    source: 'session_note'
                };
            });
            
            // Map recordings
            const uniqueRecordingsMap = new Map<string, any>();
            recordingsData.forEach((recording: any) => {
                if (recording.id && !uniqueRecordingsMap.has(recording.id)) {
                    uniqueRecordingsMap.set(recording.id, recording);
                }
            });
            const uniqueRecordings = Array.from(uniqueRecordingsMap.values());
            
            const mappedRecordingNotes = uniqueRecordings.map((recording: any) => {
                const clientId = recording.client_id;
                const clientName = clientId && clientsMap[clientId] 
                    ? clientsMap[clientId] 
                    : recording.clients?.name || 'Unknown Client';
                
                return {
                    id: `recording-${recording.id}`,
                    clientName: clientName,
                    clientId: clientId,
                    sessionDate: recording.created_at || recording.date || new Date().toISOString(),
                    content: recording.transcript || '',
                    createdDate: recording.created_at || new Date().toISOString(),
                    transcript: recording.transcript,
                    attachments: recording.attachments || [],
                    source: 'recording',
                    recordingId: recording.id,
                    audioURL: recording.audio_url || null
                };
            });
            
            // Map sessions
            const mappedSessions = sessionsData.map((session: any) => {
                const clientId = session.client_id;
                const clientName = clientId && clientsMap[clientId] 
                    ? clientsMap[clientId] 
                    : 'Unassigned';
                
                return {
                    id: `session-${session.id}`,
                    clientName: clientName,
                    clientId: clientId,
                    sessionDate: session.date || session.created_at || new Date().toISOString(),
                    content: session.notes || '',
                    createdDate: session.created_at || session.date || new Date().toISOString(),
                    source: 'session',
                    hasNotes: false
                };
            });
            
            // Combine all notes
            const notesMap = new Map<string, any>();
            mappedSessionNotes.forEach((note: any) => {
                if (note.id) notesMap.set(note.id, note);
            });
            mappedRecordingNotes.forEach((note: any) => {
                if (note.id && !notesMap.has(note.id)) {
                    notesMap.set(note.id, note);
                }
            });
            mappedSessions.forEach((session: any) => {
                if (session.id && !session.hasNotes && !notesMap.has(session.id)) {
                    notesMap.set(session.id, session);
                }
            });
            
            const allNotes = Array.from(notesMap.values()).sort((a, b) => {
                return new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime();
            });
            
            return NextResponse.json(allNotes);
        }
        
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch session notes, recordings with transcripts, and sessions (filtered by user_id)
        const [notesResult, recordingsResult, sessionsResult] = await Promise.all([
            supabase
                .from('session_notes')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false }),
            supabase
                .from('recordings')
                .select(`
                    *,
                    clients (id, name)
                `)
                .eq('user_id', userId)
                .not('transcript', 'is', null)
                .neq('transcript', '')
                .order('created_at', { ascending: false }),
            supabase
                .from('sessions')
                .select('*')
                .eq('user_id', userId)
                .order('date', { ascending: false })
        ]);

        const notesData = notesResult.data || [];
        const notesError = notesResult.error;
        const recordingsData = recordingsResult.data || [];
        const recordingsError = recordingsResult.error;
        const sessionsData = sessionsResult.data || [];
        const sessionsError = sessionsResult.error;

        if (notesError) {
            console.error('Error fetching session notes:', notesError);
        }
        if (recordingsError) {
            console.error('Error fetching recordings:', recordingsError);
        }
        if (sessionsError) {
            console.error('Error fetching sessions:', sessionsError);
        }

        // Get all unique client IDs from all sources
        const allClientIds = [
            ...new Set([
                ...notesData.map((n: any) => n.client_id).filter(Boolean),
                ...recordingsData.map((r: any) => r.client_id).filter(Boolean),
                ...sessionsData.map((s: any) => s.client_id).filter(Boolean)
            ])
        ];

        // Get all unique session IDs
        const sessionIds = [...new Set(notesData.map((n: any) => n.session_id).filter(Boolean))];

        // Fetch clients
        let clientsMap: Record<string, string> = {};
        if (allClientIds.length > 0) {
            const { data: clientsData } = await supabase
                .from('clients')
                .select('id, name')
                .in('id', allClientIds);
            
            if (clientsData) {
                clientsMap = clientsData.reduce((acc: Record<string, string>, client: any) => {
                    acc[client.id] = client.name;
                    return acc;
                }, {});
            }
        }

        // Build sessions map for session notes that reference sessions
        let sessionsMap: Record<string, string> = {};
        if (sessionIds.length > 0) {
            const sessionIdsFromNotes = sessionsData.filter((s: any) => sessionIds.includes(s.id));
            sessionIdsFromNotes.forEach((session: any) => {
                sessionsMap[session.id] = session.date;
            });
        }

        // Map session notes to frontend format
        const mappedSessionNotes = notesData.map((note: any) => {
            const clientId = note.client_id;
            const sessionId = note.session_id;
            
            const clientName = clientId && clientsMap[clientId] 
                ? clientsMap[clientId] 
                : 'Unknown Client';
            
            const sessionDate = sessionId && sessionsMap[sessionId]
                ? sessionsMap[sessionId]
                : note.created_at || new Date().toISOString();
            
            return {
                id: note.id,
                clientName: clientName,
                clientId: clientId,
                sessionDate: sessionDate,
                content: note.content || '',
                createdDate: note.created_at || new Date().toISOString(),
                attachments: note.attachments || [],
                source: 'session_note' // Mark as session note
            };
        });

        // Deduplicate recordings by ID before mapping
        const uniqueRecordingsMap = new Map<string, any>();
        recordingsData.forEach((recording: any) => {
            if (recording.id && !uniqueRecordingsMap.has(recording.id)) {
                uniqueRecordingsMap.set(recording.id, recording);
            }
        });
        const uniqueRecordings = Array.from(uniqueRecordingsMap.values());

        // Map recordings with transcripts to session notes format
        const mappedRecordingNotes = uniqueRecordings.map((recording: any) => {
            const clientId = recording.client_id;
            const clientName = recording.clients?.name || (clientId && clientsMap[clientId]) || 'Unknown Client';
            
            // Extract transcript / notes content for session notes view
            let transcriptContent = '';
            let rawTranscript = '';
            if (recording.transcript) {
                try {
                    // Try to parse as JSON – supports multiple historical formats:
                    // 1) Array of note sections
                    // 2) Object with { content }
                    // 3) New format: { transcript: string, notes: NoteSection[] }
                    const parsed = JSON.parse(recording.transcript);

                    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                        // New format: { transcript, notes }
                        if (typeof (parsed as any).transcript === 'string') {
                            rawTranscript = (parsed as any).transcript;
                        }
                        if (Array.isArray((parsed as any).notes) && (parsed as any).notes.length > 0) {
                            transcriptContent = (parsed as any).notes
                                .map((n: any) => (typeof n === 'string' ? n : (n.content || n.text || '')))
                                .join('\n\n');
                        } else if ((parsed as any).content) {
                            transcriptContent = (parsed as any).content;
                        } else if ((parsed as any).transcript) {
                            transcriptContent = (parsed as any).transcript;
                        } else {
                            transcriptContent = recording.transcript;
                        }
                    } else if (Array.isArray(parsed) && parsed.length > 0) {
                        // Old format: array of note sections
                        transcriptContent = parsed.map((n: any) =>
                            typeof n === 'string' ? n : (n.content || n.text || '')
                        ).join('\n\n');
                    } else {
                        transcriptContent = recording.transcript;
                    }
                } catch {
                    // If not JSON, use as plain text
                    transcriptContent = recording.transcript;
                }
            }

            // Ensure unique ID by using recording ID (which should be UUID)
            return {
                id: `recording-${recording.id}`, // Prefix to avoid conflicts with session notes
                clientName: clientName,
                clientId: clientId,
                sessionDate: recording.created_at || new Date().toISOString(),
                content: transcriptContent,
                transcript: rawTranscript || transcriptContent,
                createdDate: recording.created_at || new Date().toISOString(),
                attachments: [],
                source: 'recording', // Mark as recording
                recordingId: recording.id, // Keep original recording ID
                audioURL: recording.audio_url || null
            };
        });

        // Map sessions (appointments) to session notes format
        // Only include sessions that don't already have session notes
        const sessionsWithNotes = new Set(notesData.map((n: any) => n.session_id).filter(Boolean));
        const mappedSessions = sessionsData
            .filter((session: any) => {
                // Include all sessions, but prioritize showing those without notes
                // This ensures Calendly appointments appear even if no notes exist yet
                return true;
            })
            .map((session: any) => {
                const clientId = session.client_id;
                const clientName = clientId && clientsMap[clientId] 
                    ? clientsMap[clientId] 
                    : 'Unknown Client';
                
                // Check if this session has notes
                const hasNotes = sessionsWithNotes.has(session.id);
                
                // Get metadata
                let metadata = {};
                try {
                    if (session.metadata && typeof session.metadata === 'object') {
                        metadata = session.metadata;
                    }
                } catch (e) {
                    metadata = {};
                }
                
                // Build content from session notes or session info
                let content = '';
                if (hasNotes) {
                    // If session has notes, the notes will be shown separately
                    // But we still show the session as a placeholder
                    content = `Session scheduled: ${session.type || 'Therapy Session'}\n${session.notes || ''}`;
                } else {
                    // Show session details for appointments without notes
                    const source = (metadata as any).source || 'manual';
                    const isCalendly = source === 'calendly';
                    content = isCalendly 
                        ? `📅 Booked via Calendly\n\nSession Type: ${session.type || 'Therapy Session'}\nDuration: ${session.duration || 60} minutes\n${session.notes || ''}`
                        : `📅 Scheduled Session\n\nSession Type: ${session.type || 'Therapy Session'}\nDuration: ${session.duration || 60} minutes\n${session.notes || ''}`;
                }
                
                return {
                    id: `session-${session.id}`, // Prefix to avoid conflicts
                    clientName: clientName,
                    clientId: clientId,
                    sessionDate: session.date || session.created_at || new Date().toISOString(),
                    content: content,
                    createdDate: session.created_at || session.date || new Date().toISOString(),
                    attachments: [],
                    source: 'session', // Mark as session/appointment
                    sessionId: session.id, // Keep original session ID
                    hasNotes: hasNotes, // Flag to indicate if notes exist
                    metadata: metadata
                };
            });

        // Deduplicate all notes by ID to prevent duplicate keys
        const notesMap = new Map<string, any>();
        
        // Add session notes first
        mappedSessionNotes.forEach((note: any) => {
            if (note.id) {
                notesMap.set(note.id, note);
            }
        });
        
        // Add recordings (will overwrite if same ID exists, but shouldn't happen due to prefix)
        mappedRecordingNotes.forEach((note: any) => {
            if (note.id) {
                // If ID already exists, log warning but keep the first one
                if (notesMap.has(note.id)) {
                    console.warn(`Duplicate note ID detected: ${note.id}. Keeping first occurrence.`);
                } else {
                    notesMap.set(note.id, note);
                }
            }
        });
        
        // Add sessions (appointments) - these will show Calendly bookings
        // Only add sessions that don't already have notes (to avoid duplicates)
        mappedSessions.forEach((session: any) => {
            if (session.id && !session.hasNotes) {
                // Only add sessions without existing notes to avoid showing duplicates
                if (!notesMap.has(session.id)) {
                    notesMap.set(session.id, session);
                }
            }
        });

        // Convert map to array and sort by created date (newest first)
        const allNotes = Array.from(notesMap.values()).sort((a, b) => {
            return new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime();
        });

        console.log(`Returning ${allNotes.length} total notes (${mappedSessionNotes.length} session notes + ${mappedRecordingNotes.length} recordings + ${mappedSessions.length} sessions, ${uniqueRecordings.length} unique recordings)`);
        return NextResponse.json(allNotes);
    } catch (error) {
        console.error('Error fetching session notes:', error);
        return NextResponse.json({ error: 'Failed to fetch session notes' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        // Check authentication
        const { userId, isFallback, userEmail } = await checkAuthentication(request);
        
        // For fallback auth, we need to create the user first or use a temporary ID
        // For now, reject saves if user doesn't exist (they need to run migration)
        if (isFallback) {
            return NextResponse.json({ 
                error: 'User account not found. Please run the database migration to create your user account.',
                requiresMigration: true
            }, { status: 403 });
        }
        
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const notes = await request.json();

        if (!Array.isArray(notes)) {
            return NextResponse.json({ error: 'Notes must be an array' }, { status: 400 });
        }

        // CRITICAL: DO NOT DELETE SESSION NOTES - This function should only upsert/update notes
        // Deleting notes based on what's NOT in the list is dangerous and can cause data loss
        // Only upsert the notes provided - do NOT delete any notes

        // Get all clients for this user to map client names to IDs
        const { data: allClients } = await supabase
            .from('clients')
            .select('id, name')
            .eq('user_id', userId);
        const clientNameToIdMap: Record<string, string> = {};
        if (allClients) {
            allClients.forEach((client: any) => {
                clientNameToIdMap[client.name] = client.id;
            });
        }

        // Get all sessions for this user to map session dates to IDs
        const { data: allSessions } = await supabase
            .from('sessions')
            .select('id, date, client_id')
            .eq('user_id', userId);
        const sessionDateToIdMap: Record<string, string> = {};
        if (allSessions) {
            allSessions.forEach((session: any) => {
                const sessionKey = `${session.client_id}_${session.date}`;
                sessionDateToIdMap[sessionKey] = session.id;
            });
        }

        // Map frontend fields to DB fields
        const records = await Promise.all(notes.map(async (note: any) => {
            let clientId = note.clientId || note.client_id;
            let sessionId = note.sessionId || note.session_id;

            // If we have clientName but no clientId, try to find it
            if (!clientId && note.clientName) {
                clientId = clientNameToIdMap[note.clientName];
            }

            // If we have sessionDate but no sessionId, try to find it
            if (!sessionId && note.sessionDate && clientId) {
                const sessionKey = `${clientId}_${note.sessionDate}`;
                sessionId = sessionDateToIdMap[sessionKey];
            }

            return {
                id: note.id,
                client_id: clientId || null,
                session_id: sessionId || null,
                user_id: userId, // Always include user_id
                content: note.content || note.notes || '',
                created_at: note.createdDate || note.created_at || note.date || new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
        }));

        const { error } = await supabase
            .from('session_notes')
            .upsert(records);

        if (error) {
            console.error('Supabase error saving session notes:', error);
            throw error;
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error saving session notes:', error);
        return NextResponse.json({ 
            error: `Failed to save session notes: ${error?.message || 'Unknown error'}` 
        }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        // Check authentication
        const { userId, isFallback } = await checkAuthentication(request);
        
        // Reject write operations for fallback users (they need to run migration)
        if (isFallback) {
            return NextResponse.json({ 
                error: 'User account not found. Please run the database migration to create your user account.',
                requiresMigration: true
            }, { status: 403 });
        }
        
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const noteId = searchParams.get('id');

        if (!noteId) {
            return NextResponse.json({ error: 'Session note ID is required' }, { status: 400 });
        }

        // Verify the note belongs to this user before deleting
        // Try to find the note - it might be a UUID or a timestamp string
        const { data: existingNote, error: fetchError } = await supabase
            .from('session_notes')
            .select('id, user_id, client_id, session_id')
            .eq('id', noteId)
            .single();

        if (fetchError || !existingNote) {
            console.error('[Session Notes DELETE] Note not found:', {
                noteId,
                error: fetchError,
                userId
            });
            
            // If note not found by ID, it might be a legacy note or one that was never saved
            // Return a more helpful error message
            return NextResponse.json({ 
                error: 'Session note not found. It may have already been deleted or never saved to the database.',
                noteId: noteId
            }, { status: 404 });
        }

        // Verify ownership - allow deletion if user_id matches OR if user_id is null (legacy notes)
        if (existingNote.user_id && existingNote.user_id !== userId) {
            console.error('[Session Notes DELETE] Ownership mismatch:', {
                noteId,
                noteUserId: existingNote.user_id,
                requestUserId: userId
            });
            return NextResponse.json({ error: 'Unauthorized: You do not own this session note' }, { status: 403 });
        }

        // Delete the session note
        // If user_id is null (legacy note), delete without user_id check
        // Otherwise, ensure user_id matches
        let deleteQuery = supabase
            .from('session_notes')
            .delete()
            .eq('id', noteId);
        
        // Only add user_id filter if the note has a user_id
        if (existingNote.user_id) {
            deleteQuery = deleteQuery.eq('user_id', userId);
        }
        
        const { error } = await deleteQuery;

        if (error) {
            console.error('Supabase error deleting session note:', error);
            return NextResponse.json({ error: `Failed to delete: ${error.message}` }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting session note:', error);
        return NextResponse.json({ 
            error: `Failed to delete session note: ${error?.message || 'Unknown error'}` 
        }, { status: 500 });
    }
}

