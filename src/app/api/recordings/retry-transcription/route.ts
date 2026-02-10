import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkAuthentication } from '@/lib/auth';

/** Extract storage filename from audio_url or recording id. */
function getAudioFileName(audioUrl: string | null | undefined, recordingId: string): string {
    if (!audioUrl || typeof audioUrl !== 'string') return `${recordingId}.webm`;
    const match = audioUrl.match(/\/([^/]+\.(webm|m4a|mp3|wav|mp4|ogg|mpeg))$/i);
    if (match) return match[1];
    if (audioUrl.includes('/api/audio/')) return audioUrl.replace(/.*\/api\/audio\//, '').split('?')[0].trim();
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
        const { id } = body;
        if (!id || typeof id !== 'string') {
            return NextResponse.json({ error: 'Recording id is required' }, { status: 400 });
        }

        const { data: recording, error: fetchError } = await supabase
            .from('recordings')
            .select('id, user_id, audio_url, transcript')
            .eq('id', id)
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
        const transcript: string = (whisperData?.text ?? '').trim();
        if (!transcript) {
            return NextResponse.json(
                { error: 'Transcription produced empty result' },
                { status: 500 }
            );
        }

        const existing = parseTranscriptPayload(recording.transcript);
        const newPayload = JSON.stringify({
            transcript,
            notes: existing.notes
        });

        const { error: updateError } = await supabase
            .from('recordings')
            .update({ transcript: newPayload })
            .eq('id', id)
            .eq('user_id', userId);

        if (updateError) {
            console.error('[Retry transcription] DB update error:', updateError);
            return NextResponse.json({ error: 'Failed to save transcript' }, { status: 500 });
        }

        return NextResponse.json({ success: true, transcript });
    } catch (error) {
        console.error('[Retry transcription] Error:', error);
        return NextResponse.json(
            { error: 'Failed to retry transcription' },
            { status: 500 }
        );
    }
}
