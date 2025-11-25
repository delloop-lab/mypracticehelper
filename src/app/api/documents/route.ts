import { NextResponse } from 'next/server';
import { saveDocumentFile, getDocuments, saveDocuments } from '@/lib/storage';

export async function GET() {
    try {
        const documents = await getDocuments();
        return NextResponse.json(documents);
    } catch (error) {
        console.error('Error fetching documents:', error);
        return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${timestamp}-${safeName}`;

        await saveDocumentFile(fileName, buffer);

        const newDocument = {
            id: timestamp.toString(),
            name: file.name,
            type: file.name.split('.').pop()?.toLowerCase() || 'document',
            size: formatSize(file.size),
            uploadedBy: "Dr. Smith", // Hardcoded for now as we don't have auth
            uploadedDate: new Date().toISOString(),
            clientName: "General", // Default, could be passed in formData
            category: "other", // Default, could be passed in formData
            isEncrypted: true
        };

        const documents = await getDocuments();
        await saveDocuments([...documents, newDocument]);

        // Return format expected by client code
        return NextResponse.json({
            success: true,
            originalName: file.name,
            url: `/api/documents/${fileName}`,
            document: newDocument
        });
    } catch (error) {
        console.error('Error saving document:', error);
        return NextResponse.json({ error: 'Failed to save document' }, { status: 500 });
    }
}

function formatSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
