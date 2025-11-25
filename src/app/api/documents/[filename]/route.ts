import { NextResponse } from 'next/server';
import { downloadDocumentFile } from '@/lib/storage';

export async function GET(
    request: Request,
    props: { params: Promise<{ filename: string }> }
) {
    const params = await props.params;
    const filename = params.filename;
    
    let fileBuffer: Buffer;
    try {
        fileBuffer = await downloadDocumentFile(filename);
    } catch (error) {
        console.error('Error downloading document from Supabase:', error);
        return new NextResponse('File not found', { status: 404 });
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
