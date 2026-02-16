import { NextResponse } from 'next/server';
import { getRecordings, saveRecordings, saveAudioFile } from '@/lib/storage';
import { supabase, getSupabaseAdmin } from '@/lib/supabase';
import { checkAuthentication } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        const { userId, isFallback, userEmail } = await checkAuthentication(request);
        const { searchParams } = new URL(request.url);
        const unallocatedOnly = searchParams.get('unallocated') === 'true';

        if (isFallback && userEmail === 'claire@claireschillaci.com') {
            const recordings = await getRecordings(null);
            const filtered = unallocatedOnly
                ? recordings.filter((r: any) => !(r.client_id ?? r.clientId) && !(r.session_id ?? r.sessionId))
                : recordings;
            return NextResponse.json(filtered);
        }
        
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const recordingSelect = `
                *,
                clients (name),
                sessions (id, date, type)
            `;
        const isMissingDeletedAtColumn = (error: any) =>
            String(error?.message || '').toLowerCase().includes('deleted_at');

        // Fetch recordings with user_id AND legacy recordings (user_id IS NULL) for migration period.
        // Prefer soft-delete filtering when column exists; gracefully fallback if migration not applied yet.
        let { data: userRecordings, error: userError } = await supabase
            .from('recordings')
            .select(recordingSelect)
            .eq('user_id', userId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (isMissingDeletedAtColumn(userError)) {
            const fallback = await supabase
                .from('recordings')
                .select(recordingSelect)
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            userRecordings = fallback.data || [];
            userError = fallback.error;
        }

        let { data: legacyRecordings, error: legacyError } = await supabase
            .from('recordings')
            .select(recordingSelect)
            .is('user_id', null)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (isMissingDeletedAtColumn(legacyError)) {
            const fallback = await supabase
                .from('recordings')
                .select(recordingSelect)
                .is('user_id', null)
                .order('created_at', { ascending: false });
            legacyRecordings = fallback.data || [];
            legacyError = fallback.error;
        }

        if (userError || legacyError) {
            console.error('[Recordings API] Query errors:', { userError, legacyError });
        }
        
        const allRecordings = [...(userRecordings || []), ...(legacyRecordings || [])];
        const uniqueRecordings = Array.from(
            new Map(allRecordings.map(r => [r.id, r])).values()
        );
        const toMap = unallocatedOnly
            ? uniqueRecordings.filter((r: any) => !r.session_id && !r.client_id)
            : uniqueRecordings;

        const mappedRecordings = toMap.map((recording: any) => {
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
                sessionId: recording.session_id || null,
                flagged: recording.flagged ?? false,
                flaggedAt: recording.flagged_at || null
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

export async function PATCH(request: Request) {
    try {
        const { userId, isFallback } = await checkAuthentication(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (isFallback) {
            return NextResponse.json({
                error: 'Please run the migration script to assign your data to your user account before making changes.',
            }, { status: 403 });
        }

        const body = await request.json();
        const { id } = body;
        if (!id) {
            return NextResponse.json({ error: 'Recording id is required' }, { status: 400 });
        }

        const isMissingDeletedAtColumn = (error: any) =>
            String(error?.message || '').toLowerCase().includes('deleted_at');

        let { data: recording, error: fetchError } = await supabase
            .from('recordings')
            .select('id, user_id')
            .eq('id', id)
            .is('deleted_at', null)
            .single();

        if (isMissingDeletedAtColumn(fetchError)) {
            const fallback = await supabase
                .from('recordings')
                .select('id, user_id')
                .eq('id', id)
                .single();
            recording = fallback.data;
            fetchError = fallback.error;
        }

        if (fetchError || !recording) {
            return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
        }
        if (recording.user_id !== userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const updates: Record<string, unknown> = {};
        if (body.client_id !== undefined) updates.client_id = body.client_id;
        if (body.session_id !== undefined) updates.session_id = body.session_id;
        if (body.flagged !== undefined) {
            updates.flagged = Boolean(body.flagged);
            updates.flagged_at = body.flagged ? new Date().toISOString() : null;
        }
        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 });
        }

        const { error } = await supabase
            .from('recordings')
            .update(updates)
            .eq('id', id)
            .eq('user_id', userId);

        if (error) {
            console.error('[Recordings PATCH] Error:', error);
            return NextResponse.json({ error: 'Failed to update recording' }, { status: 500 });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Recordings PATCH] Error:', error);
        return NextResponse.json({ error: 'Failed to update recording' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { userId } = await checkAuthentication(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const id = new URL(request.url).searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'Recording id is required' }, { status: 400 });
        }

        const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? getSupabaseAdmin() : supabase;

        const { data: recording, error: fetchError } = await db
            .from('recordings')
            .select('id, user_id')
            .eq('id', id)
            .single();

        if (fetchError || !recording) {
            console.error('[Recordings DELETE] Fetch failed:', fetchError?.message ?? 'no rows');
            return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
        }

        if (recording.user_id && recording.user_id !== userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { error } = recording.user_id
            ? await db.from('recordings').delete().eq('id', id).eq('user_id', userId)
            : await db.from('recordings').delete().eq('id', id).is('user_id', null);

        if (error) {
            console.error('[Recordings DELETE] Delete failed:', error.message);
            return NextResponse.json({ error: `Failed to delete: ${error.message}` }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Unexpected error deleting recording:', error);
        return NextResponse.json({ 
            error: `Failed to delete recording: ${error?.message || 'Unknown error'}` 
        }, { status: 500 });
    }
}
