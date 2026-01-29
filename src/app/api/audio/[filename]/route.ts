import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ filename: string }> }
) {
    const filename = (await params).filename;
    
    try {
        // Download the file from Supabase Storage (works regardless of bucket public settings)
        const { data, error } = await supabase.storage
            .from('audio')
            .download(filename);
        
        if (error || !data) {
            console.error('[Audio API] Error downloading:', error);
            return new NextResponse('File not found', { status: 404 });
        }
        
        // Convert Blob to ArrayBuffer and return as audio stream
        const arrayBuffer = await data.arrayBuffer();
        
        return new NextResponse(arrayBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'audio/webm',
                'Content-Length': arrayBuffer.byteLength.toString(),
                'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
            },
        });
    } catch (err) {
        console.error('[Audio API] Unexpected error:', err);
        return new NextResponse('Error fetching audio', { status: 500 });
    }
}
