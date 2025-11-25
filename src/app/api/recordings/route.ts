import { NextResponse } from 'next/server';
import { getRecordings, saveRecordings, saveAudioFile } from '@/lib/storage';

export async function GET() {
    try {
        const recordings = await getRecordings();
        return NextResponse.json(recordings);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch recordings' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const metadataString = formData.get('data') as string;

        console.log('Received recording request');
        console.log('File:', file ? `${file.name} (${file.size} bytes)` : 'NO FILE');
        console.log('Metadata string:', metadataString);

        if (!file || !metadataString) {
            console.error('Missing file or metadata');
            return NextResponse.json({ error: 'Missing file or metadata' }, { status: 400 });
        }

        const metadata = JSON.parse(metadataString);
        console.log('Parsed metadata:', metadata);

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = `${metadata.id}.webm`; // Assuming webm from MediaRecorder

        console.log('Uploading audio file:', fileName);
        await saveAudioFile(fileName, buffer);
        console.log('Audio file uploaded successfully');

        // Update metadata with file path/url
        // We'll serve it via an API route
        const newRecording = {
            ...metadata,
            audioURL: `/api/audio/${fileName}`,
            fileName: fileName
        };

        console.log('Fetching existing recordings...');
        const recordings = await getRecordings();
        console.log('Existing recordings count:', recordings.length);

        recordings.unshift(newRecording);

        console.log('Saving updated recordings...');
        await saveRecordings(recordings);
        console.log('Recordings saved successfully');

        return NextResponse.json(newRecording);
    } catch (error) {
        console.error('Error saving recording:', error);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        console.error('Error message:', error instanceof Error ? error.message : String(error));
        return NextResponse.json({
            error: 'Failed to save recording',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const updates = await request.json();
        const recordings = await getRecordings();

        // If it's an array, replace the whole list (for reordering/deleting)
        // If it's a single object, update that one. 
        // For simplicity, let's assume the frontend sends the full updated list for deletions/edits
        // OR we can handle specific updates.

        // Let's support sending the full list for now as that matches the previous localStorage logic
        if (Array.isArray(updates)) {
            await saveRecordings(updates);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid update format' }, { status: 400 });

    } catch (error) {
        return NextResponse.json({ error: 'Failed to update recordings' }, { status: 500 });
    }
}
