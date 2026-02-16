import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Audio file delivery - supports both legacy and new path formats.
 * Legacy: /api/audio/{id}.webm (e.g. 1739123456789.webm at bucket root)
 * New: /api/audio/recordings/{uuid}.webm (recordings/ subfolder)
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ path?: string[] }> }
) {
    const pathParam = (await params).path;
    const storagePath = pathParam && pathParam.length > 0 ? pathParam.join('/') : null;

    if (!storagePath) {
        return new NextResponse('File path required', { status: 400 });
    }

    try {
        const { data, error } = await supabase.storage
            .from('audio')
            .download(storagePath);

        if (error || !data) {
            console.error('[Audio API] Error downloading:', error);
            return new NextResponse('File not found', { status: 404 });
        }

        const arrayBuffer = await data.arrayBuffer();

        return new NextResponse(arrayBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'audio/webm',
                'Content-Length': arrayBuffer.byteLength.toString(),
                'Cache-Control': 'public, max-age=31536000',
            },
        });
    } catch (err) {
        console.error('[Audio API] Unexpected error:', err);
        return new NextResponse('Error fetching audio', { status: 500 });
    }
}
