import { NextResponse } from 'next/server';
import { saveDocumentFile, getDocuments, saveDocuments, getClients, saveClients } from '@/lib/storage';
import { checkAuthentication } from '@/lib/auth';

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

export async function DELETE(request: Request) {
    try {
        // Check authentication
        const { userId, isFallback } = await checkAuthentication(request);
        
        if (isFallback) {
            return NextResponse.json({ 
                error: 'User account not found. Please run the database migration to create your user account.',
                requiresMigration: true
            }, { status: 403 });
        }
        
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const documentUrl = searchParams.get('url');
        const clientName = searchParams.get('clientName');

        if (!documentUrl) {
            return NextResponse.json({ error: 'Document URL is required' }, { status: 400 });
        }

        // Get all clients
        const clients = await getClients(false, userId);
        
        // Find the client with this document and remove it
        let found = false;
        const updatedClients = clients.map(client => {
            if (client.documents && client.documents.length > 0) {
                // Check if this client has the document by URL
                // If clientName is provided, also verify it matches for extra safety
                const hasDocument = client.documents.some((doc: any) => {
                    if (doc.url === documentUrl) {
                        // If clientName is provided, verify it matches
                        if (clientName) {
                            return client.name === clientName;
                        }
                        return true;
                    }
                    return false;
                });

                if (hasDocument) {
                    found = true;
                    return {
                        ...client,
                        documents: client.documents.filter((doc: any) => doc.url !== documentUrl)
                    };
                }
            }
            return client;
        });

        if (!found) {
            return NextResponse.json({ error: 'Document not found in any client record' }, { status: 404 });
        }

        // Save the updated clients
        await saveClients(updatedClients, userId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting document:', error);
        return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
    }
}

function formatSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
