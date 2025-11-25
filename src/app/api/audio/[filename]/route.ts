import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
    request: Request,
    props: { params: Promise<{ filename: string }> }
) {
    const params = await props.params;
    const filename = params.filename;
    const filePath = path.join(process.cwd(), 'data', 'recordings', filename);

    if (!fs.existsSync(filePath)) {
        return new NextResponse('File not found', { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);

    // Determine content type
    let contentType = 'audio/webm';
    if (filename.endsWith('.mp3')) contentType = 'audio/mpeg';
    if (filename.endsWith('.wav')) contentType = 'audio/wav';

    return new NextResponse(fileBuffer, {
        headers: {
            'Content-Type': contentType,
            'Content-Length': fileBuffer.length.toString(),
        },
    });
}
