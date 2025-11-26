import { NextResponse } from 'next/server';

/**
 * Transcribe an uploaded audio file (e.g. .m4a) using OpenAI's Speech-to-Text API.
 *
 * This route expects multipart/form-data with:
 * - file: the audio File (required)
 *
 * It returns JSON:
 * { transcript: string }
 */
export async function POST(request: Request) {
    try {
        const openaiApiKey = process.env.OPENAI_API_KEY;

        if (!openaiApiKey) {
            console.error('OPENAI_API_KEY is not configured');
            return NextResponse.json(
                { error: 'Transcription service is not configured' },
                { status: 500 }
            );
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json(
                { error: 'No audio file provided' },
                { status: 400 }
            );
        }

        console.log('[Transcribe Upload] Received file:', file.name, file.type, file.size, 'bytes');

        // Prepare multipart/form-data for OpenAI
        const upstreamForm = new FormData();
        upstreamForm.append('file', file);
        upstreamForm.append('model', 'whisper-1'); // supports m4a and is stable
        // Optional: you can set language here, e.g. 'en'
        // upstreamForm.append('language', 'en');
        upstreamForm.append('response_format', 'json');

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${openaiApiKey}`,
            },
            body: upstreamForm,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Transcribe Upload] OpenAI API error:', errorText);

            // Surface a trimmed version of the OpenAI error to the client for debugging
            const snippet = errorText.slice(0, 500);
            return NextResponse.json(
                {
                    error: 'Failed to transcribe audio file',
                    detail: snippet,
                },
                { status: 500 }
            );
        }

        const data = await response.json();

        // OpenAI audio transcription responses typically have a `text` field for the transcript
        const transcript: string =
            (data && (data.text as string)) ||
            (typeof data === 'string' ? data : '') ||
            '';

        console.log('[Transcribe Upload] Transcript length:', transcript.length);

        if (!transcript) {
            return NextResponse.json(
                { error: 'Transcription produced empty result' },
                { status: 500 }
            );
        }

        return NextResponse.json({ transcript });
    } catch (error: any) {
        console.error('[Transcribe Upload] Unexpected error:', error);
        return NextResponse.json(
            {
                error: `Failed to transcribe audio file: ${error?.message || 'Unknown error'}`,
            },
            { status: 500 }
        );
    }
}


