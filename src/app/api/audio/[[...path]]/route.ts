import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Parse a single Range: bytes=… header. Returns null if no range, slice bounds if valid, or 'invalid'.
 */
function parseByteRange(
    rangeHeader: string | null,
    totalLength: number
): { start: number; end: number } | 'invalid' | null {
    if (!rangeHeader) return null;
    const lower = rangeHeader.toLowerCase();
    if (!lower.startsWith('bytes=')) return null;
    let spec = rangeHeader.slice(rangeHeader.indexOf('=') + 1).trim();
    if (spec.includes(',')) return null;

    if (spec.startsWith('-')) {
        const suffixLen = parseInt(spec.slice(1), 10);
        if (!Number.isFinite(suffixLen) || suffixLen <= 0) return 'invalid';
        const start = Math.max(0, totalLength - suffixLen);
        return { start, end: totalLength - 1 };
    }

    const dash = spec.indexOf('-');
    if (dash === -1) return 'invalid';
    const rs = spec.slice(0, dash);
    const re = spec.slice(dash + 1);
    let start = rs === '' ? 0 : parseInt(rs, 10);
    let end = re === '' ? totalLength - 1 : parseInt(re, 10);
    if (!Number.isFinite(start)) return 'invalid';
    if (re !== '' && !Number.isFinite(end)) return 'invalid';
    if (re === '') end = totalLength - 1;
    if (start < 0 || start >= totalLength) return 'invalid';
    if (end < start) return 'invalid';
    if (end >= totalLength) end = totalLength - 1;
    return { start, end };
}

/**
 * Audio file delivery - supports both legacy and new path formats.
 * Legacy: /api/audio/{id}.webm (e.g. 1739123456789.webm at bucket root)
 * New: /api/audio/recordings/{uuid}.webm (recordings/ subfolder)
 *
 * Supports Range requests so browsers can probe WebM and report duration on the native control bar.
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
        const totalLength = arrayBuffer.byteLength;
        const rangeParsed = parseByteRange(request.headers.get('range'), totalLength);

        if (rangeParsed === 'invalid') {
            return new NextResponse(null, {
                status: 416,
                headers: {
                    'Content-Range': `bytes */${totalLength}`,
                },
            });
        }

        if (rangeParsed) {
            const { start, end } = rangeParsed;
            const chunk = arrayBuffer.slice(start, end + 1);
            return new NextResponse(chunk, {
                status: 206,
                headers: {
                    'Content-Type': 'audio/webm',
                    'Content-Length': chunk.byteLength.toString(),
                    'Content-Range': `bytes ${start}-${end}/${totalLength}`,
                    'Accept-Ranges': 'bytes',
                    'Cache-Control': 'public, max-age=31536000',
                },
            });
        }

        return new NextResponse(arrayBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'audio/webm',
                'Content-Length': totalLength.toString(),
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=31536000',
            },
        });
    } catch (err) {
        console.error('[Audio API] Unexpected error:', err);
        return new NextResponse('Error fetching audio', { status: 500 });
    }
}
