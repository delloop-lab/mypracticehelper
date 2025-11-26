import { NextResponse } from 'next/server';
import { downloadDocumentFile } from '@/lib/storage';
import fs from 'fs';
import path from 'path';

export async function GET(
    request: Request,
    props: { params: Promise<{ filename: string }> }
) {
    const params = await props.params;
    const filename = params.filename;
    
    let fileBuffer: Buffer;
    
    // In production, always use Supabase storage
    // In development, try local folder first, then Supabase
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (!isProduction) {
        // Development: Try local file first
        const localFilePath = path.join(process.cwd(), 'data', 'documents', filename);
        try {
            if (fs.existsSync(localFilePath)) {
                fileBuffer = fs.readFileSync(localFilePath);
                console.log(`[DEV] Serving document from local file: ${localFilePath}`);
            } else {
                // Fallback to Supabase storage
                fileBuffer = await downloadDocumentFile(filename);
                console.log(`[DEV] Serving document from Supabase storage: ${filename}`);
            }
        } catch (error) {
            console.error('Error loading document:', error);
            return new NextResponse('File not found', { status: 404 });
        }
    } else {
        // Production: Always use Supabase storage
        try {
            fileBuffer = await downloadDocumentFile(filename);
            console.log(`[PROD] Serving document from Supabase storage: ${filename}`);
        } catch (error) {
            console.error('Error loading document from Supabase:', error);
            return new NextResponse('File not found', { status: 404 });
        }
    }

    // Determine content type with comprehensive file type support
    let contentType = 'application/octet-stream';
    const ext = filename.toLowerCase();

    // Documents
    if (ext.endsWith('.pdf')) contentType = 'application/pdf';
    if (ext.endsWith('.txt')) contentType = 'text/plain';
    if (ext.endsWith('.doc')) contentType = 'application/msword';
    if (ext.endsWith('.docx')) contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (ext.endsWith('.odt')) contentType = 'application/vnd.oasis.opendocument.text';
    if (ext.endsWith('.rtf')) contentType = 'application/rtf';

    // Spreadsheets
    if (ext.endsWith('.xls')) contentType = 'application/vnd.ms-excel';
    if (ext.endsWith('.xlsx')) contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (ext.endsWith('.ods')) contentType = 'application/vnd.oasis.opendocument.spreadsheet';

    // Presentations
    if (ext.endsWith('.ppt')) contentType = 'application/vnd.ms-powerpoint';
    if (ext.endsWith('.pptx')) contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    if (ext.endsWith('.odp')) contentType = 'application/vnd.oasis.opendocument.presentation';

    // Images
    if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) contentType = 'image/jpeg';
    if (ext.endsWith('.png')) contentType = 'image/png';
    if (ext.endsWith('.gif')) contentType = 'image/gif';
    if (ext.endsWith('.webp')) contentType = 'image/webp';
    if (ext.endsWith('.svg')) contentType = 'image/svg+xml';

    // Log for debugging
    console.log('=== Document Serving Debug ===');
    console.log('Filename:', filename);
    console.log('File extension:', ext);
    console.log('Content-Type:', contentType);
    console.log('Content-Disposition:', 'inline');
    console.log('File size:', fileBuffer.length, 'bytes');
    console.log('=============================');

    return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
            'Content-Type': contentType,
            'Content-Disposition': `inline; filename="${filename}"`,
        },
    });
}
