import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkAuthentication } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        // Check authentication
        const { userId, isFallback } = await checkAuthentication(request);
        
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        // Reject for fallback users
        if (isFallback) {
            return NextResponse.json({ 
                error: 'Please run the migration script to assign your data to your user account before uploading.' 
            }, { status: 403 });
        }

        const body = await request.json();
        const { fileName, contentType, bucket = 'audio' } = body;

        if (!fileName) {
            return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
        }

        // Validate bucket name (only allow specific buckets)
        const allowedBuckets = ['audio', 'documents'];
        if (!allowedBuckets.includes(bucket)) {
            return NextResponse.json({ error: 'Invalid bucket' }, { status: 400 });
        }

        // Generate a signed URL for uploading
        // The URL is valid for 1 hour (3600 seconds)
        const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUploadUrl(fileName);

        if (error) {
            console.error('Error creating signed URL:', error);
            return NextResponse.json({ 
                error: 'Failed to create upload URL',
                details: error.message 
            }, { status: 500 });
        }

        // Also get the public URL for after upload
        const { data: publicUrlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(fileName);

        return NextResponse.json({
            signedUrl: data.signedUrl,
            token: data.token,
            path: data.path,
            publicUrl: publicUrlData.publicUrl
        });

    } catch (error: any) {
        console.error('Error in signed-url API:', error);
        return NextResponse.json({ 
            error: 'Failed to generate signed URL',
            details: error?.message || 'Unknown error'
        }, { status: 500 });
    }
}
