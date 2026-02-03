import { NextResponse } from 'next/server';
import { saveDocumentFile, getDocuments, saveDocuments, getClients, saveClients } from '@/lib/storage';
import { checkAuthentication } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
    try {
        // Check authentication
        const { userId, isFallback } = await checkAuthentication(request);
        
        if (!userId && !isFallback) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch user documents from user_documents table
        let userDocuments: any[] = [];
        if (userId) {
            const { data, error } = await supabase
                .from('user_documents')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('Error fetching user documents:', error);
            } else {
                userDocuments = (data || []).map(doc => ({
                    id: doc.id,
                    name: doc.name,
                    type: doc.type || doc.name.split('.').pop()?.toLowerCase() || 'document',
                    size: doc.size || 'Unknown',
                    uploadedBy: 'Company',
                    uploadedDate: doc.created_at || new Date().toISOString(),
                    clientName: null, // User documents don't have a client
                    category: doc.category || 'user',
                    url: doc.url,
                    isUserDocument: true // Flag to identify user documents
                }));
            }
        }

        return NextResponse.json(userDocuments);
    } catch (error) {
        console.error('Error fetching documents:', error);
        return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }
}

export async function POST(request: Request) {
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

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const isUserDocument = formData.get('isUserDocument') === 'true'; // Flag to indicate company document
        const clientId = formData.get('clientId') as string | null; // Client ID if this is a client document
        const sessionId = formData.get('sessionId') as string | null; // Session ID if attaching to a specific session

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file type
        const allowedExtensions = ['.doc', '.docx', '.txt', '.pdf', '.jpg', '.jpeg', '.png'];
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!allowedExtensions.includes(fileExtension)) {
            return NextResponse.json({ 
                error: 'Only MS Word (.doc, .docx), Text (.txt), PDF (.pdf), and Image (.jpg, .jpeg, .png) files are allowed.' 
            }, { status: 400 });
        }

        // Validate file size (10 MB = 10 * 1024 * 1024 bytes)
        const maxSize = 10 * 1024 * 1024; // 10 MB
        if (file.size > maxSize) {
            return NextResponse.json({ 
                error: 'File size must be less than 10 MB.' 
            }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${timestamp}-${safeName}`;

        // Upload file to Supabase storage
        const fileUrl = await saveDocumentFile(fileName, buffer);
        const documentUrl = `/api/documents/${fileName}`;

        // If this is a session attachment, add it to the session's metadata
        if (sessionId && clientId) {
            // Fetch the session
            const { data: session, error: sessionFetchError } = await supabase
                .from('sessions')
                .select('*')
                .eq('id', sessionId)
                .eq('user_id', userId)
                .single();

            if (sessionFetchError || !session) {
                console.error('Error fetching session:', sessionFetchError);
                return NextResponse.json({ error: 'Session not found' }, { status: 404 });
            }

            // Get client name for the response
            const clients = await getClients(false, userId);
            const client = clients.find(c => c.id === clientId);

            // Add document to session's metadata.attachments
            const newAttachment = {
                name: file.name,
                url: documentUrl,
                date: new Date().toISOString(),
            };

            const existingMetadata = session.metadata || {};
            const existingAttachments = existingMetadata.attachments || [];
            const updatedMetadata = {
                ...existingMetadata,
                attachments: [...existingAttachments, newAttachment]
            };

            // Update the session
            const { error: updateError } = await supabase
                .from('sessions')
                .update({ 
                    metadata: updatedMetadata,
                    updated_at: new Date().toISOString()
                })
                .eq('id', sessionId)
                .eq('user_id', userId);

            if (updateError) {
                console.error('Error updating session with attachment:', updateError);
                return NextResponse.json({ error: 'Failed to attach document to session' }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                originalName: file.name,
                url: documentUrl,
                attachedToSession: true,
                sessionId: sessionId,
                document: {
                    id: documentUrl,
                    name: file.name,
                    type: file.name.split('.').pop()?.toLowerCase() || 'document',
                    size: formatSize(file.size),
                    uploadedBy: 'System',
                    uploadedDate: new Date().toISOString(),
                    clientName: client?.name || 'Unknown',
                    sessionDate: session.date,
                    category: 'session',
                    url: documentUrl,
                    isUserDocument: false
                }
            });
        }

        // If this is a client document (no session), save it to the client's documents array
        if (clientId) {
            const clients = await getClients(false, userId);
            const client = clients.find(c => c.id === clientId);
            
            if (!client) {
                return NextResponse.json({ error: 'Client not found' }, { status: 404 });
            }

            // Add document to client's documents array
            const newDoc = {
                name: file.name,
                url: documentUrl,
                date: new Date().toISOString(),
            };

            const updatedClient = {
                ...client,
                documents: [...(client.documents || []), newDoc]
            };

            // Update clients array
            const updatedClients = clients.map(c => c.id === clientId ? updatedClient : c);
            await saveClients(updatedClients, userId);

            return NextResponse.json({
                success: true,
                originalName: file.name,
                url: documentUrl,
                document: {
                    id: documentUrl,
                    name: file.name,
                    type: file.name.split('.').pop()?.toLowerCase() || 'document',
                    size: formatSize(file.size),
                    uploadedBy: 'System',
                    uploadedDate: new Date().toISOString(),
                    clientName: client.name,
                    category: 'client',
                    url: documentUrl,
                    isUserDocument: false
                }
            });
        }

        // If this is a company document (not associated with a client), save to user_documents table
        if (isUserDocument) {
            const { data, error } = await supabase
                .from('user_documents')
                .insert({
                    id: timestamp.toString(),
                    user_id: userId,
                    name: file.name,
                    type: file.name.split('.').pop()?.toLowerCase() || 'document',
                    size: formatSize(file.size),
                    url: documentUrl,
                    category: 'user',
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                console.error('Error saving user document to database:', error);
                return NextResponse.json({ error: 'Failed to save document metadata' }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                originalName: file.name,
                url: documentUrl,
                document: {
                    id: data.id,
                    name: data.name,
                    type: data.type,
                    size: data.size,
                    uploadedBy: 'Company',
                    uploadedDate: data.created_at,
                    clientName: null,
                    category: data.category,
                    url: data.url,
                    isUserDocument: true
                }
            });
        }

        // Legacy behavior: return format expected by client code (for client document uploads)
        const newDocument = {
            id: timestamp.toString(),
            name: file.name,
            type: file.name.split('.').pop()?.toLowerCase() || 'document',
            size: formatSize(file.size),
            uploadedBy: "Dr. Smith",
            uploadedDate: new Date().toISOString(),
            clientName: "General",
            category: "other",
            isEncrypted: true
        };

        const documents = await getDocuments();
        await saveDocuments([...documents, newDocument]);

        return NextResponse.json({
            success: true,
            originalName: file.name,
            url: documentUrl,
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
        const isUserDocument = searchParams.get('isUserDocument') === 'true';

        if (!documentUrl) {
            return NextResponse.json({ error: 'Document URL is required' }, { status: 400 });
        }

        // If this is a user document, delete from user_documents table
        if (isUserDocument) {
            const { error } = await supabase
                .from('user_documents')
                .delete()
                .eq('url', documentUrl)
                .eq('user_id', userId);

            if (error) {
                console.error('Error deleting user document:', error);
                return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
            }

            return NextResponse.json({ success: true });
        }

        // Otherwise, handle client document deletion (existing logic)
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
