import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ filename: string }> }
) {
    const filename = (await params).filename;
    // Get public URL from Supabase Storage 'audio' bucket
    const { data } = supabase.storage.from('audio').getPublicUrl(filename);
    if (!data?.publicUrl) {
        return new NextResponse('File not found', { status: 404 });
    }
    // Redirect client to the public URL
    return NextResponse.redirect(data.publicUrl);
}
