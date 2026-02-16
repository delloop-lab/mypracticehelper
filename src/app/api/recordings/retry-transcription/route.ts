import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkAuthentication } from '@/lib/auth';

/** Validate transcript payload before any DB update. Prevents null/empty/invalid overwrites. */
function validateTranscriptPayload(payload: string): { valid: boolean; error?: string } {
    if (payload == null) return { valid: false, error: 'Transcript payload is null' };
    if (typeof payload !== 'string') return { valid: false, error: 'Transcript payload must be a string' };
    if (payload.trim() === '') return { valid: false, error: 'Transcript payload is empty' };
    let parsed: unknown;
    try {
        parsed = JSON.parse(payload);
    } catch {
        return { valid: false, error: 'Transcript payload is invalid JSON' };
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { valid: false, error: 'Transcript payload must be a JSON object' };
    }
    const t = (parsed as Record<string, unknown>).transcript;
    if (t == null) return { valid: false, error: 'Transcript payload missing "transcript" field' };
    if (typeof t !== 'string') return { valid: false, error: '"transcript" field must be a string' };
    if (String(t).trim() === '') return { valid: false, error: '"transcript" field is empty' };
    return { valid: true };
}

/** Check if existing transcript is non-empty (would trigger non-destructive behaviour). */
function hasExistingTranscript(transcript: string | null | undefined): boolean {
    if (transcript == null || typeof transcript !== 'string') return false;
    return transcript.trim().length > 0;
}

/** Extract storage path from audio_url or recording id. Supports legacy {id}.webm and new recordings/{uuid}.webm. */
function getAudioFileName(audioUrl: string | null | undefined, recordingId: string): string {
    if (!audioUrl || typeof audioUrl !== 'string') return `${recordingId}.webm`;
    if (audioUrl.includes('/api/audio/')) return audioUrl.replace(/.*\/api\/audio\//, '').split('?')[0].trim();
    const match = audioUrl.match(/\/([^/]+\.(webm|m4a|mp3|wav|mp4|ogg|mpeg))$/i);
    if (match) return match[1];
    if (audioUrl.includes('/audio/')) return audioUrl.split('/audio/').pop()?.split('?')[0].trim() || `${recordingId}.webm`;
    if (/^[^/]+\.(webm|m4a|mp3|wav|mp4|ogg|mpeg)$/i.test(audioUrl.trim())) return audioUrl.trim();
    return `${recordingId}.webm`;
}

/** Parse existing transcript JSON to preserve notes. */
function parseTranscriptPayload(transcriptRaw: string | null): { transcript: string; notes: unknown[] } {
    if (!transcriptRaw || typeof transcriptRaw !== 'string') return { transcript: '', notes: [] };
    try {
        const parsed = JSON.parse(transcriptRaw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return {
                transcript: parsed.transcript || '',
                notes: Array.isArray(parsed.notes) ? parsed.notes : []
            };
        }
        return { transcript: '', notes: [] };
    } catch {
        return { transcript: transcriptRaw, notes: [] };
    }
}

export async function POST(request: Request) {
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

        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
            return NextResponse.json(
                { error: 'Transcription service is not configured' },
                { status: 500 }
            );
        }

        const body = await request.json();
        const { id, force } = body;
        if (!id || typeof id !== 'string') {
            return NextResponse.json({ error: 'Recording id is required' }, { status: 400 });
        }
        const forceOverwrite = force === true;

        const { data: recording, error: fetchError } = await supabase
            .from('recordings')
            .select('id, user_id, audio_url, transcript')
            .eq('id', id)
            .is('deleted_at', null)
            .single();

        if (fetchError || !recording) {
            return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
        }
        if (recording.user_id !== userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const fileName = getAudioFileName(recording.audio_url, recording.id);
        const { data: audioData, error: downloadError } = await supabase.storage
            .from('audio')
            .download(fileName);

        if (downloadError || !audioData) {
            return NextResponse.json(
                { error: 'Audio file not found in storage' },
                { status: 404 }
            );
        }

        const arrayBuffer = await audioData.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const formData = new FormData();
        formData.append('file', new Blob([buffer], { type: 'audio/webm' }), fileName);
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'json');

        const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${openaiApiKey}` },
            body: formData
        });

        if (!whisperRes.ok) {
            const errText = await whisperRes.text();
            console.error('[Retry transcription] Whisper error:', errText.slice(0, 300));
            return NextResponse.json(
                { error: 'Transcription failed' },
                { status: 500 }
            );
        }

        const whisperData = await whisperRes.json();
        const transcriptText: string = (whisperData?.text ?? '').trim();
        if (!transcriptText) {
            return NextResponse.json(
                { error: 'Transcription produced empty result' },
                { status: 500 }
            );
        }

        const existing = parseTranscriptPayload(recording.transcript);
        const newPayload = JSON.stringify({
            transcript: transcriptText,
            notes: existing.notes
        });

        const validation = validateTranscriptPayload(newPayload);
        if (!validation.valid) {
            console.error('[Retry transcription] Validation failed:', validation.error);
            return NextResponse.json(
                { error: validation.error || 'Invalid transcript payload' },
                { status: 400 }
            );
        }

        const hasExisting = hasExistingTranscript(recording.transcript);
        if (hasExisting && !forceOverwrite) {
            const { error: attemptError } = await supabase
                .from('recordings')
                .update({ transcript_latest_attempt: newPayload })
                .eq('id', id)
                .eq('user_id', userId);
            if (attemptError) {
                console.error('[Retry transcription] Failed to store transcript_latest_attempt:', attemptError);
                return NextResponse.json({ error: 'Failed to store transcription attempt' }, { status: 500 });
            }
            return NextResponse.json({
                success: true,
                transcript: transcriptText,
                preserved: true,
                message: 'Existing transcript preserved. New transcription stored in transcript_latest_attempt. Use force=true to overwrite.'
            });
        }

        const { error: updateError } = await supabase
            .from('recordings')
            .update({ transcript: newPayload, transcript_latest_attempt: null })
            .eq('id', id)
            .eq('user_id', userId);

        if (updateError) {
            console.error('[Retry transcription] DB update error:', updateError);
            return NextResponse.json({ error: 'Failed to save transcript' }, { status: 500 });
        }

        return NextResponse.json({ success: true, transcript: transcriptText });
    } catch (error) {
        console.error('[Retry transcription] Error:', error);
        return NextResponse.json(
            { error: 'Failed to retry transcription' },
            { status: 500 }
        );
    }
}
