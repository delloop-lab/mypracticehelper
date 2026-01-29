import { NextResponse } from 'next/server';
import { getRecordings, saveRecordings, saveAudioFile } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { checkAuthentication } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        // Check authentication (handles both new and fallback methods)
        const { userId, isFallback, userEmail } = await checkAuthentication(request);
        
        // If fallback auth, show legacy recordings (recordings without user_id)
        if (isFallback && userEmail === 'claire@claireschillaci.com') {
            const recordings = await getRecordings(null);
            return NextResponse.json(recordings);
        }
        
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        // Fetch recordings with user_id AND legacy recordings (user_id IS NULL) for migration period
        // This ensures users see their recordings even if some haven't been migrated yet
        const { data: userRecordings, error: userError } = await supabase
            .from('recordings')
            .select(`
                *,
                clients (name),
                sessions (id, date, type)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        
        const { data: legacyRecordings, error: legacyError } = await supabase
            .from('recordings')
            .select(`
                *,
                clients (name),
                sessions (id, date, type)
            `)
            .is('user_id', null)
            .order('created_at', { ascending: false });
        
        // Combine both sets and remove duplicates
        const allRecordings = [...(userRecordings || []), ...(legacyRecordings || [])];
        const uniqueRecordings = Array.from(
            new Map(allRecordings.map(r => [r.id, r])).values()
        );
        
        // Use the existing mapping logic from getRecordings
        const mappedRecordings = uniqueRecordings.map((recording: any) => {
            let notes: any[] = [];
            let transcriptText: string = recording.transcript || '';

            if (recording.transcript) {
                try {
                    const parsed = JSON.parse(recording.transcript);
                    if (Array.isArray(parsed)) {
                        notes = parsed;
                        transcriptText = notes.map((n: any) => n.text || n.content || '').join(' ');
                    } else if (typeof parsed === 'string') {
                        transcriptText = parsed;
                    } else if (parsed.transcript) {
                        transcriptText = parsed.transcript;
                        notes = parsed.notes || [];
                    }
                } catch {
                    transcriptText = recording.transcript;
                }
            }

            return {
                id: recording.id,
                date: recording.created_at || recording.date,
                duration: recording.duration || 0,
                audioURL: recording.audio_url || recording.audioURL || `/api/audio/${recording.id}.webm`,
                transcript: transcriptText,
                notes: notes,
                clientName: recording.clients?.name || recording.client_name || recording.clientName,
                clientId: recording.client_id || recording.clientId,
                client_id: recording.client_id,
                session_id: recording.session_id || null,
                sessionId: recording.session_id || null
            };
        });
        
        return NextResponse.json(mappedRecordings);
    } catch (error) {
        console.error('[Recordings API] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch recordings' }, { status: 500 });
    }
}

export async function POST(request: Request) {
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

        // Check content type to determine if this is a direct upload (JSON) or legacy (FormData)
        const contentType = request.headers.get('content-type') || '';
        
        if (contentType.includes('application/json')) {
            // NEW: Direct upload - audio was uploaded directly to Supabase, this is just metadata
            const body = await request.json();
            const { metadata, directUpload } = body;
            
            if (!metadata || !directUpload) {
                return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });
            }
            
            const newRecording = { ...metadata };
            const recordings = await getRecordings(userId);
            recordings.unshift(newRecording);
            await saveRecordings(recordings, userId);

            return NextResponse.json(newRecording);
        }
        
        // LEGACY: FormData with file upload through Vercel
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const metadataString = formData.get('data') as string;

        if (!file || !metadataString) {
            return NextResponse.json({ error: 'Missing file or metadata' }, { status: 400 });
        }

        const metadata = JSON.parse(metadataString);
        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = `${metadata.id}.webm`;

        await saveAudioFile(fileName, buffer);

        const newRecording = {
            ...metadata,
            audioURL: `/api/audio/${fileName}`,
            fileName: fileName
        };

        const recordings = await getRecordings(userId);
        recordings.unshift(newRecording);
        await saveRecordings(recordings, userId);

        return NextResponse.json(newRecording);
    } catch (error) {
        console.error('Error saving recording:', error instanceof Error ? error.message : error);
        return NextResponse.json({
            error: 'Failed to save recording',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
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

        const updates = await request.json();
        const recordings = await getRecordings(userId);

        // If it's an array, replace the whole list (for reordering/deleting)
        // If it's a single object, update that one. 
        // For simplicity, let's assume the frontend sends the full updated list for deletions/edits
        // OR we can handle specific updates.

        // Let's support sending the full list for now as that matches the previous localStorage logic
        if (Array.isArray(updates)) {
            await saveRecordings(updates, userId);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid update format' }, { status: 400 });

    } catch (error) {
        return NextResponse.json({ error: 'Failed to update recordings' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        // Check authentication (handles both new and fallback methods)
        const { userId, isFallback } = await checkAuthentication(request);
        
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Recording id is required' }, { status: 400 });
        }

        // Verify the recording exists and check ownership
        // Handle both cases: recordings with user_id and legacy recordings without user_id
        const { data: recording, error: fetchError } = await supabase
            .from('recordings')
            .select('id, user_id')
            .eq('id', id)
            .single();

        if (fetchError || !recording) {
            console.error('Error fetching recording or recording not found:', fetchError);
            return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
        }

        // Check ownership:
        // - If recording has user_id, it must match the current user
        // - If recording has no user_id (legacy), allow deletion for fallback users or if no user_id exists
        if (recording.user_id) {
            if (recording.user_id !== userId) {
                console.error('Recording belongs to different user:', { recordingUserId: recording.user_id, currentUserId: userId });
                return NextResponse.json({ error: 'Unauthorized: Recording belongs to a different user' }, { status: 403 });
            }
            // Delete with user_id check
            const { error } = await supabase
                .from('recordings')
                .delete()
                .eq('id', id)
                .eq('user_id', userId);
            
            if (error) {
                console.error('Error deleting recording:', error);
                return NextResponse.json({ error: `Failed to delete recording: ${error.message}` }, { status: 500 });
            }
        } else {
            // Legacy recording without user_id - allow deletion for fallback users or authenticated users
            // (This handles the migration period where recordings might not have user_id yet)
            const { error } = await supabase
                .from('recordings')
                .delete()
                .eq('id', id)
                .is('user_id', null);
            
            if (error) {
                console.error('Error deleting legacy recording:', error);
                return NextResponse.json({ error: `Failed to delete recording: ${error.message}` }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Unexpected error deleting recording:', error);
        return NextResponse.json({ 
            error: `Failed to delete recording: ${error?.message || 'Unknown error'}` 
        }, { status: 500 });
    }
}
