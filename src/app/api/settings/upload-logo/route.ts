import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ error: 'Invalid file type. Please upload a PNG, JPG, GIF, or WebP image.' }, { status: 400 });
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            return NextResponse.json({ error: 'File too large. Maximum size is 5MB.' }, { status: 400 });
        }

        // Read file buffer
        const buffer = Buffer.from(await file.arrayBuffer());

        // Determine file extension and content type from MIME type
        let extension = 'png';
        let contentType = 'image/png';
        if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
            extension = 'jpg';
            contentType = 'image/jpeg';
        } else if (file.type === 'image/gif') {
            extension = 'gif';
            contentType = 'image/gif';
        } else if (file.type === 'image/webp') {
            extension = 'webp';
            contentType = 'image/webp';
        }

        // Upload to Supabase Storage 'documents' bucket
        // Use a fixed filename so we can replace it on subsequent uploads
        const logoFileName = `company-logo.${extension}`;

        // Delete old logo files with different extensions first
        const oldLogos = ['company-logo.png', 'company-logo.jpg', 'company-logo.jpeg', 'company-logo.gif', 'company-logo.webp'];
        for (const oldLogo of oldLogos) {
            if (oldLogo !== logoFileName) {
                try {
                    await supabase.storage
                        .from('documents')
                        .remove([oldLogo]);
                } catch (error) {
                    // Ignore errors if file doesn't exist
                    console.warn(`Could not remove old logo ${oldLogo}:`, error);
                }
            }
        }

        // Upload new logo to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('documents')
            .upload(logoFileName, buffer, {
                contentType: contentType,
                upsert: true, // Replace if exists
            });

        if (uploadError) {
            console.error('Error uploading logo to Supabase:', uploadError);
            return NextResponse.json({ 
                error: `Failed to upload logo: ${uploadError.message}` 
            }, { status: 500 });
        }

        // Get public URL from Supabase Storage
        const { data: urlData } = supabase.storage
            .from('documents')
            .getPublicUrl(logoFileName);

        if (!urlData?.publicUrl) {
            return NextResponse.json({ 
                error: 'Failed to get logo URL' 
            }, { status: 500 });
        }

        return NextResponse.json({ 
            success: true,
            logoPath: urlData.publicUrl, // Return full Supabase Storage URL
            message: 'Logo uploaded successfully'
        });
    } catch (error) {
        console.error('Error uploading logo:', error);
        return NextResponse.json({ 
            error: error instanceof Error ? error.message : 'Failed to upload logo' 
        }, { status: 500 });
    }
}

