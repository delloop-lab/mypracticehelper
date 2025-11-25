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

        if (!file || !metadataString) {
            return NextResponse.json({ error: 'Missing file or metadata' }, { status: 400 });
        }

        const metadata = JSON.parse(metadataString);
        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = `${metadata.id}.webm`; // Assuming webm from MediaRecorder

        await saveAudioFile(fileName, buffer);

        // Update metadata with file path/url
        // We'll serve it via an API route
        const newRecording = {
            ...metadata,
            audioURL: `/api/audio/${fileName}`,
            fileName: fileName
        };

        const recordings = await getRecordings();
        recordings.unshift(newRecording);
        await saveRecordings(recordings);

        return NextResponse.json(newRecording);
    } catch (error) {
        console.error('Error saving recording:', error);
        return NextResponse.json({ error: 'Failed to save recording' }, { status: 500 });
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
