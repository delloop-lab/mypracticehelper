import { supabase } from './supabase';

// Helper to map database fields to app fields if necessary
// Currently assuming 1:1 mapping for simplicity, but we might need adapters later

export async function getClients(includeArchived: boolean = false, userId?: string | null) {
    // Build query with optional user_id filter
    let query = supabase
        .from('clients')
        .select('*');
    
    // Filter by user_id if provided
    // If userId is provided, show only that user's clients
    // If userId is null but user is authenticated via fallback, show clients without user_id (migration period)
    if (userId) {
        // Show user's clients OR clients without user_id (for migration period)
        query = query.or(`user_id.eq.${userId},user_id.is.null`);
    } else {
        // No userId - show only clients without user_id (legacy data)
        query = query.is('user_id', null);
    }
    
    // Order by created_at
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
        console.error('[getClients] Error fetching clients:', error);
        console.error('[getClients] Error details:', JSON.stringify(error, null, 2));
        return [];
    }
    
    if (!data) {
        console.log('[getClients] No data returned from database');
        return [];
    }
    
    console.log(`[getClients] Total clients fetched from DB: ${data.length}`);
    console.log(`[getClients] includeArchived parameter: ${includeArchived}`);
    
    // Log all client names and archived status for debugging
    console.log('[getClients] All clients from database:');
    data.forEach((c: any) => {
        console.log(`  - "${c.name}" (id: ${c.id}), archived: ${c.archived}, archived_at: ${c.archived_at || 'null'}`);
    });
    
    // Check specifically for Claire and Lilli
    const claire = data.find((c: any) => c.name && (c.name.toLowerCase().includes('claire') || c.name.toLowerCase() === 'claire schillaci'));
    const lilli = data.find((c: any) => c.name && (c.name.toLowerCase().includes('lilli') || c.name.toLowerCase() === 'lilli schillaci'));
    console.log('[getClients] Claire found in DB:', claire ? { name: claire.name, archived: claire.archived } : 'NOT FOUND');
    console.log('[getClients] Lilli found in DB:', lilli ? { name: lilli.name, archived: lilli.archived } : 'NOT FOUND');
    
    // Filter archived clients manually (works even if column doesn't exist yet)
    let filteredData = data;
    if (includeArchived) {
        // Return only archived clients
        filteredData = data.filter((c: any) => c.archived === true);
        console.log(`[getClients] Filtered to ${filteredData.length} archived clients`);
        console.log('[getClients] Archived client names:', filteredData.map((c: any) => c.name));
    } else {
        // Return non-archived clients (archived is null, false, or undefined)
        // If archived field doesn't exist, include all clients
        filteredData = data.filter((c: any) => {
            const isArchived = c.archived === true;
            const isNotArchived = c.archived === undefined || c.archived === null || c.archived === false;
            return isNotArchived;
        });
        console.log(`[getClients] Filtered to ${filteredData.length} non-archived clients`);
        console.log('[getClients] Active client names:', filteredData.map((c: any) => c.name));
        
        // Log which clients were filtered out
        const archivedClients = data.filter((c: any) => c.archived === true);
        if (archivedClients.length > 0) {
            console.log(`[getClients] ⚠️ Filtered out ${archivedClients.length} archived clients:`, archivedClients.map((c: any) => `"${c.name}"`));
        }
    }

    // Parse JSON fields that are stored as text/jsonb if needed
    // The schema has specific columns, but the app might expect nested objects
    // We need to map the flat DB structure back to the nested app structure if needed
    // For now, let's assume the app adapts or we store complex objects in 'notes' or specific columns

    // Map from Supabase format to app format
    // The app expects: id, name, email, phone, notes, documents[], relationships[], firstName, lastName, etc.
    return filteredData.map(client => {
        // Try to parse metadata if stored as JSON
        let metadata: any = {};
        if (client.metadata) {
            try {
                metadata = typeof client.metadata === 'string' ? JSON.parse(client.metadata) : client.metadata;
            } catch {
                metadata = {};
            }
        }
        // If metadata column doesn't exist yet, metadata will be undefined/empty

        return {
            id: client.id,
            name: client.name || '',
            email: client.email || '',
            phone: client.phone || '',
            notes: client.notes || '',
            nextAppointment: metadata.nextAppointment || '',
            recordings: 0, // Will be calculated by frontend
            sessions: metadata.sessions || 0,
            documents: metadata.documents || [],
            relationships: metadata.relationships || [],
            firstName: metadata.firstName || client.name?.split(' ')[0] || '',
            lastName: metadata.lastName || client.name?.split(' ').slice(1).join(' ') || '',
            preferredName: metadata.preferredName || '',
            nationality: metadata.nationality || '',
            currency: metadata.currency || 'EUR',
            sessionFee: metadata.sessionFee || 0,
            gender: metadata.gender || undefined,
            dateOfBirth: metadata.dateOfBirth || '',
            mailingAddress: metadata.mailingAddress || '',
            emergencyContact: metadata.emergencyContact || undefined,
            medicalConditions: metadata.medicalConditions || '',
            currentMedications: metadata.currentMedications || '',
            doctorInfo: metadata.doctorInfo || undefined,
            archived: client.archived || false,
            archivedAt: client.archived_at || undefined,
            createdAt: client.created_at || undefined,
            newClientFormSigned: client.new_client_form_signed || false
        };
    });
}

export async function saveClients(clients: any[], userId?: string | null) {
    // CRITICAL: DO NOT DELETE CLIENTS - This function should only upsert/update clients
    // Deleting clients based on what's NOT in the list is dangerous and can cause data loss
    // If clients are archived or filtered out, they would be deleted accidentally
    
    // Only upsert the clients provided - do NOT delete any clients
    // Store basic fields in columns and extra fields in metadata JSONB
    const records = clients.map(client => {
        // Extract metadata fields
        const metadata: any = {
            nextAppointment: client.nextAppointment || '',
            sessions: client.sessions || 0,
            documents: client.documents || [],
            relationships: client.relationships || [],
            firstName: client.firstName || '',
            lastName: client.lastName || '',
            preferredName: client.preferredName || '',
            nationality: client.nationality || '',
            currency: client.currency || 'EUR',
            sessionFee: client.sessionFee || 0,
            gender: client.gender || undefined,
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
            metadata: metadata, // Store as JSONB
            archived: client.archived || false,
            archived_at: client.archivedAt ? new Date(client.archivedAt).toISOString() : null,
            user_id: userId || client.user_id || null, // Include user_id
            new_client_form_signed: client.newClientFormSigned || false,
            updated_at: new Date().toISOString()
        };
    });

    const { error } = await supabase
        .from('clients')
        .upsert(records);

    if (error) {
        console.error('Error saving clients:', error);
        throw error;
    }
}

export async function getRecordings(userId?: string | null) {
    // Build query with optional user_id filter
    // Exclude soft-deleted (deleted_at IS NULL) per RECORDINGS_TRANSCRIPTION_AUDIT.md
    let query = supabase
        .from('recordings')
        .select(`
            *,
            clients (name)
        `)
        .is('deleted_at', null);
    
    // Filter by user_id if provided (recordings table has user_id column)
    if (userId) {
        query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching recordings:', error);
        return [];
    }

    // Map from Supabase format to app format
    return (data || []).map(recording => {
        let notes: any[] = [];
        let transcriptText: string = recording.transcript || '';

        if (recording.transcript) {
            try {
                const parsed = JSON.parse(recording.transcript);

                // New format: { transcript: string, notes: NoteSection[] }
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    if (typeof parsed.transcript === 'string') {
                        transcriptText = parsed.transcript;
                    }
                    if (Array.isArray(parsed.notes)) {
                        notes = parsed.notes;
                    } else if (parsed.content) {
                        notes = [{ title: 'Session Notes', content: parsed.content }];
                    }
                }
                // Old format: transcript is an array of note sections
                else if (Array.isArray(parsed)) {
                    notes = parsed;
                    // Derive a plain-text transcript from the notes contents
                    transcriptText = parsed
                        .map((n: any) => (typeof n === 'string' ? n : (n.content || '')))
                        .join('\n\n');
                } else {
                    // Fallback: treat as plain text content
                    notes = [{ title: 'Session Notes', content: recording.transcript }];
                    transcriptText = recording.transcript;
                }
            } catch {
                // If not JSON, treat as plain text
                notes = [{ title: 'Session Notes', content: recording.transcript }];
                transcriptText = recording.transcript;
            }
        }

        // Get client name from joined data or from a stored clientName field
        const clientName = recording.clients?.name || recording.client_name || null;
        // Get client_id from the recording (this is what we use for matching)
        const client_id = recording.client_id || null;

        return {
            id: recording.id,
            date: recording.created_at || recording.date,
            duration: recording.duration || 0,
            transcript: transcriptText,
            notes: notes,
            audioURL: recording.audio_url || recording.audioURL || `/api/audio/${recording.id}.webm`,
            fileName: recording.audio_url ? recording.audio_url.split('/').pop() : `${recording.id}.webm`,
            clientName: clientName,
            client_id: client_id, // Include client_id for matching
            clientId: client_id, // Also include clientId for backward compatibility
            session_id: recording.session_id || null, // Include session_id if available
            sessionId: recording.session_id || null, // Also include sessionId for backward compatibility
            title: recording.title || 'Untitled Recording'
        };
    });
}

export async function saveRecordings(recordings: any[], userId?: string | null) {
    // CRITICAL: DO NOT DELETE RECORDINGS - This function should only upsert/update recordings
    // Deleting recordings based on what's NOT in the list is dangerous and can cause data loss
    
    // Only upsert the recordings provided - do NOT delete any recordings

    // Get all clients for this user to map clientName to client_id
    let clientQuery = supabase.from('clients').select('id, name');
    if (userId) {
        clientQuery = clientQuery.eq('user_id', userId);
    }
    const { data: allClients } = await clientQuery;
    
    // Create case-insensitive, trimmed name map (handle duplicates by taking first)
    const clientMap = new Map<string, string>();
    const nameToIds = new Map<string, string[]>();
    
    (allClients || []).forEach(c => {
        const normalizedName = c.name.trim().toLowerCase();
        if (!nameToIds.has(normalizedName)) {
            nameToIds.set(normalizedName, []);
        }
        nameToIds.get(normalizedName)!.push(c.id);
        // Map uses first occurrence (warn if duplicates exist)
        if (!clientMap.has(normalizedName)) {
            clientMap.set(normalizedName, c.id);
        }
    });
    
    // Log warnings for duplicate names
    nameToIds.forEach((ids, name) => {
        if (ids.length > 1) {
            console.warn(`Duplicate client name detected: "${name}" (${ids.length} clients). Using first ID: ${ids[0]}`);
        }
    });

    const records = await Promise.all(recordings.map(async (r) => {
        // Map clientName to client_id
        let client_id = r.client_id || r.clientId || null;
        if (r.clientName && !client_id) {
            // Normalize name for matching (trim, lowercase)
            const normalizedName = r.clientName.trim().toLowerCase();
            client_id = clientMap.get(normalizedName) || null;
            if (!client_id) {
                console.warn(`Could not find client_id for name: "${r.clientName}". Recording will be unassigned.`);
            }
        }

        // Store both transcript and notes in a single JSON object for backward compatibility
        const transcriptPayload = {
            transcript: r.transcript || '',
            notes: Array.isArray(r.notes) ? r.notes : (r.notes ? [r.notes] : [])
        };

        const transcript = JSON.stringify(transcriptPayload);

        return {
            id: r.id,
            client_id: client_id,
            session_id: r.session_id || r.sessionId || null, // Include session_id if available
            user_id: userId || r.user_id || null, // Include user_id
            title: r.title || 'Untitled Recording',
            transcript: transcript,
            audio_url: r.audioURL || r.audioUrl || '', // Handle both audioURL and audioUrl
            duration: r.duration || 0,
            created_at: r.date || r.created_at || new Date().toISOString()
        };
    }));

    const { error } = await supabase
        .from('recordings')
        .upsert(records);

    if (error) {
        console.error('Error saving recordings:', error);
        throw error;
    }
}

// Real Supabase Storage implementation
export async function saveAudioFile(fileName: string, buffer: Buffer) {
    // Upload to 'audio' bucket
    const { data, error } = await supabase.storage
        .from('audio')
        .upload(fileName, buffer, {
            contentType: 'audio/webm', // Correct content type for webm files
            upsert: true
        });

    if (error) {
        console.error('Error uploading audio:', error);
        throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from('audio')
        .getPublicUrl(fileName);

    return urlData.publicUrl;
}

export async function saveDocumentFile(fileName: string, buffer: Buffer) {
    // Upload to 'documents' bucket
    const { data, error } = await supabase.storage
        .from('documents')
        .upload(fileName, buffer, {
            upsert: true
        });

    if (error) {
        console.error('Error uploading document:', error);
        throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

    return urlData.publicUrl;
}

export async function downloadDocumentFile(fileName: string) {
    const { data, error } = await supabase.storage
        .from('documents')
        .download(fileName);

    if (error || !data) {
        console.error('Error downloading document:', error);
        throw error;
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

export async function getDocumentFileSize(fileName: string): Promise<number | null> {
    try {
        // Extract the filename from various URL formats
        let path = fileName;
        
        if (fileName.includes('/')) {
            // Handle different URL formats:
            // 1. /api/documents/1234567890-filename.txt -> 1234567890-filename.txt
            // 2. https://...supabase.co/storage/v1/object/public/documents/1234567890-filename.txt -> 1234567890-filename.txt
            // 3. documents/1234567890-filename.txt -> 1234567890-filename.txt
            
            const urlParts = fileName.split('/');
            // Get the last part which should be the filename
            path = urlParts[urlParts.length - 1];
            
            // If it's an API route, the filename is after /documents/
            if (fileName.includes('/api/documents/')) {
                const apiIndex = fileName.indexOf('/api/documents/');
                path = fileName.substring(apiIndex + '/api/documents/'.length);
            }
            // If it's a Supabase storage URL, extract from the path
            else if (fileName.includes('/storage/v1/object/public/documents/')) {
                const storageIndex = fileName.indexOf('/storage/v1/object/public/documents/');
                path = fileName.substring(storageIndex + '/storage/v1/object/public/documents/'.length);
            }
        }

        // Try to get file info directly by listing the parent directory
        // First, try to extract directory path if any
        const pathParts = path.split('/');
        const filename = pathParts[pathParts.length - 1];
        const directory = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '';

        // List files in the directory to find the matching file
        const { data, error } = await supabase.storage
            .from('documents')
            .list(directory || '', {
                limit: 1000,
                offset: 0,
            });

        if (error) {
            console.error('Error getting document metadata:', error);
            return null;
        }

        // Find the matching file by name
        const file = data?.find(f => {
            const fullPath = directory ? `${directory}/${f.name}` : f.name;
            return f.name === filename || fullPath === path || fileName.includes(f.name);
        });

        if (file) {
            // Supabase storage file objects have metadata with size
            if (file.metadata && file.metadata.size) {
                return parseInt(file.metadata.size);
            }
            // Some Supabase versions return size directly
            if ((file as any).size) {
                return (file as any).size;
            }
        }

        return null;
    } catch (error) {
        console.error('Error getting document file size:', error);
        return null;
    }
}

export function formatFileSize(bytes: number | null): string {
    if (!bytes || bytes === 0) return 'Unknown';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export async function getDocuments() {
    // Fetch documents metadata from DB if we had a table, 
    // or list from storage bucket (less detailed)
    // For now, we'll return an empty list or implement a 'documents' table later
    // The app expects a list of objects with metadata.
    return [];
}

export async function saveDocuments(documents: any[]) {
    // This was used to save the metadata JSON file.
    // In a real app, we should save this to a 'documents' table in Supabase.
    // For now, we'll log it.
    console.log('Saving documents metadata (should be in DB)', documents);
}


