"use client";

import { useState, useEffect, useMemo, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { File, Calendar, Search, Filter, Trash2, ExternalLink, FileText, Upload, Info, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ClientDocument {
    id: string;
    name: string;
    type: string;
    size: string;
    uploadedBy: string;
    uploadedDate: string;
    clientName: string | null;
    clientFirstName?: string;
    clientLastName?: string;
    category: string;
    url?: string;
    isUserDocument?: boolean; // Flag to identify user documents
}

type SortOption = 'date-desc' | 'date-asc' | 'client-asc' | 'client-desc' | 'client-first-asc' | 'client-first-desc' | 'client-last-asc' | 'client-last-desc' | 'name-asc' | 'name-desc';

function DocumentsContent() {
    const searchParams = useSearchParams();
    const [documents, setDocuments] = useState<ClientDocument[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedClient, setSelectedClient] = useState<string>("all");
    const [sortBy, setSortBy] = useState<SortOption>('date-desc');
    const [deleteDocumentConfirm, setDeleteDocumentConfirm] = useState<{ isOpen: boolean, document: ClientDocument | null }>({ isOpen: false, document: null });
    const [isUploading, setIsUploading] = useState(false);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [documentType, setDocumentType] = useState<'company' | 'client'>('company');
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [clients, setClients] = useState<any[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [showDocuments, setShowDocuments] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sync client filter from URL
    useEffect(() => {
        const clientParam = searchParams.get('client');
        if (clientParam) {
            setSelectedClient(clientParam);
        }
    }, [searchParams]);

    // Reload documents on focus (useful after uploads)
    useEffect(() => {
        loadDocuments();
        loadClients();
        const handleFocus = () => loadDocuments();
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, []);

    const loadClients = async () => {
        try {
            const response = await fetch('/api/clients', { credentials: 'include' });
            if (response.ok) {
                const clientsData = await response.json();
                setClients(clientsData);
            }
        } catch (error) {
            console.error('Error loading clients:', error);
        }
    };

    const loadDocuments = async () => {
        try {
            // Fetch client documents
            const clientsResponse = await fetch('/api/clients', { credentials: 'include' });
            const clientDocs: ClientDocument[] = [];
            const fileUrls: string[] = [];
            
            if (clientsResponse.ok) {
                const clients = await clientsResponse.json();
                
                clients.forEach((client: any) => {
                    if (client.documents && client.documents.length > 0) {
                        client.documents.forEach((doc: any) => {
                            if (doc.url) {
                                fileUrls.push(doc.url);
                            }
                            clientDocs.push({
                                id: doc.url || `${client.id}-${doc.name}`,
                                name: doc.name,
                                type: doc.name.split('.').pop()?.toLowerCase() || 'document',
                                size: 'Unknown',
                                uploadedBy: 'System',
                                uploadedDate: doc.date || new Date().toISOString(),
                                clientName: client.name,
                                clientFirstName: client.firstName,
                                clientLastName: client.lastName,
                                category: 'client',
                                url: doc.url,
                                isUserDocument: false,
                            });
                        });
                    }
                });
            }

            // Fetch user documents
            const userDocsResponse = await fetch('/api/documents', { credentials: 'include' });
            let userDocs: ClientDocument[] = [];
            
            if (userDocsResponse.ok) {
                userDocs = await userDocsResponse.json();
                userDocs.forEach((doc: any) => {
                    if (doc.url) {
                        fileUrls.push(doc.url);
                    }
                });
            }
            
            // Combine both types of documents
            const allDocs = [...clientDocs, ...userDocs];
            setDocuments(allDocs);
            
            // Fetch file sizes if we have URLs
            if (fileUrls.length > 0) {
                try {
                    const sizesResponse = await fetch('/api/documents/metadata', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ filenames: fileUrls }),
                    });
                    
                    if (sizesResponse.ok) {
                        const { sizes } = await sizesResponse.json();
                        // Update documents with actual sizes
                        setDocuments(prevDocs => 
                            prevDocs.map(doc => ({
                                ...doc,
                                size: sizes[doc.url || ''] || doc.size
                            }))
                        );
                    }
                } catch (sizeError) {
                    console.error('Error fetching file sizes:', sizeError);
                    // Continue with 'Unknown' sizes if fetch fails
                }
            }
        } catch (error) {
            console.error('Error loading documents:', error);
        }
    };

    const saveDocuments = async (updatedDocs: ClientDocument[]) => {
        setDocuments(updatedDocs);
        // This function is kept for compatibility but documents are now deleted via DELETE endpoint
    };

    // Unique client names for filter dropdown
    const clientNames = useMemo(() => {
        const names = documents.map(d => d.clientName).filter((n): n is string => !!n);
        return Array.from(new Set(names)).sort();
    }, [documents]);

    // Handle file selection - show dialog to choose document type
    const handleFileSelect = async (file: File | null) => {
        if (!file) return;

        // Validate file type
        const allowedTypes = ['.doc', '.docx', '.txt'];
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!allowedTypes.includes(fileExtension)) {
            alert('Only MS Word (.doc, .docx) and Text (.txt) files are allowed.');
            return;
        }

        // Validate file size (3 MB = 3 * 1024 * 1024 bytes)
        const maxSize = 3 * 1024 * 1024; // 3 MB
        if (file.size > maxSize) {
            alert('File size must be less than 3 MB.');
            return;
        }

        setSelectedFile(file);
        setUploadDialogOpen(true);
    };

    // Handle file input change
    const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        handleFileSelect(file);
        // Reset file input
        if (event.target) {
            event.target.value = '';
        }
    };

    // Handle drag and drop
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    // Handle actual upload after user selects type and client (if applicable)
    const handleConfirmUpload = async () => {
        if (!selectedFile) return;

        // Validate: if client document, must have selected client
        if (documentType === 'client' && !selectedClientId) {
            alert('Please select a client for this document.');
            return;
        }

        setIsUploading(true);
        setUploadDialogOpen(false);

        const formData = new FormData();
        formData.append('file', selectedFile);
        
        if (documentType === 'company') {
            formData.append('isUserDocument', 'true');
        } else {
            formData.append('clientId', selectedClientId);
        }

        try {
            const response = await fetch('/api/documents', {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });

            if (response.ok) {
                await loadDocuments(); // Reload documents to show the new one
                // Reset state
                setSelectedFile(null);
                setDocumentType('company');
                setSelectedClientId('');
            } else {
                const error = await response.json();
                alert(`Failed to upload document: ${error.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error uploading document:', error);
            alert('Error uploading document. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    // Filtering & sorting
    const filteredAndSortedDocuments = useMemo(() => {
        let filtered = documents;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(d =>
                d.name?.toLowerCase().includes(q) ||
                (d.clientName && d.clientName.toLowerCase().includes(q)) ||
                d.type?.toLowerCase().includes(q)
            );
        }
        // Filter by client (case-insensitive, trimmed)
        if (selectedClient !== "all") {
            if (selectedClient === "user-documents") {
                // Show only user documents
                filtered = filtered.filter(d => d.isUserDocument === true);
            } else {
                // Filter by specific client name
                const normalizedSelected = selectedClient.trim().toLowerCase();
                filtered = filtered.filter(d => {
                    if (d.clientName) {
                        return d.clientName.trim().toLowerCase() === normalizedSelected;
                    }
                    return false;
                });
            }
        }
        const sorted = [...filtered].sort((a, b) => {
            switch (sortBy) {
                case 'date-desc':
                    return new Date(b.uploadedDate).getTime() - new Date(a.uploadedDate).getTime();
                case 'date-asc':
                    return new Date(a.uploadedDate).getTime() - new Date(b.uploadedDate).getTime();
                case 'client-asc':
                    return (a.clientName || '').localeCompare(b.clientName || '');
                case 'client-desc':
                    return (b.clientName || '').localeCompare(a.clientName || '');
                case 'client-first-asc':
                    return (a.clientFirstName || a.clientName || '').localeCompare(b.clientFirstName || b.clientName || '');
                case 'client-first-desc':
                    return (b.clientFirstName || b.clientName || '').localeCompare(a.clientFirstName || a.clientName || '');
                case 'client-last-asc':
                    return (a.clientLastName || a.clientName || '').localeCompare(b.clientLastName || b.clientName || '');
                case 'client-last-desc':
                    return (b.clientLastName || b.clientName || '').localeCompare(a.clientLastName || a.clientName || '');
                case 'name-asc':
                    return (a.name || '').localeCompare(b.name || '');
                case 'name-desc':
                    return (b.name || '').localeCompare(a.name || '');
                default:
                    return 0;
            }
        });
        return sorted;
    }, [documents, searchQuery, selectedClient, sortBy]);

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handleView = (doc: ClientDocument) => {
        console.log('=== Viewing Document ===');
        console.log('Document:', doc.name);
        console.log('URL:', doc.url);
        console.log('Type:', doc.type);
        console.log('=======================');
        if (!doc.url) {
            console.error('No URL for document:', doc.name);
            return;
        }
        const officeTypes = ['odt', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'ods', 'odp'];
        const fileType = doc.type.toLowerCase();
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (officeTypes.includes(fileType) && !isLocalhost) {
            const fullUrl = `${window.location.origin}${doc.url}`;
            const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fullUrl)}&embedded=true`;
            console.log('Opening in Google Docs Viewer:', viewerUrl);
            window.open(viewerUrl, '_blank');
        } else {
            console.log('Opening directly in browser');
            window.open(doc.url, '_blank');
        }
    };

    const handleDeleteClick = (doc: ClientDocument) => {
        setDeleteDocumentConfirm({ isOpen: true, document: doc });
    };

    const confirmDeleteDocument = async () => {
        const doc = deleteDocumentConfirm.document;
        if (!doc || !doc.url) {
            console.error('Cannot delete document: missing document or URL');
            return;
        }

        try {
            // Build query params
            const params = new URLSearchParams();
            params.append('url', doc.url);
            if (doc.isUserDocument) {
                params.append('isUserDocument', 'true');
            } else if (doc.clientName) {
                params.append('clientName', doc.clientName);
            }

            const response = await fetch(`/api/documents?${params.toString()}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            if (response.ok) {
                // Remove from local state and reload documents
                const updated = documents.filter(d => d.id !== doc.id);
                setDocuments(updated);
                // Reload to ensure sync with server
                await loadDocuments();
                setDeleteDocumentConfirm({ isOpen: false, document: null });
            } else {
                const error = await response.json();
                alert(`Failed to delete document: ${error.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error deleting document:', error);
            alert('Failed to delete document. Please try again.');
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2">Documents</h1>
                <p className="text-muted-foreground">View and manage clients and company documents</p>
            </div>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold tracking-tight">Document Library</h2>
                    <div className="flex gap-2">
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setShowDocuments(!showDocuments)}
                            className="flex items-center gap-2"
                        >
                            {showDocuments ? (
                                <>
                                    <ChevronUp className="h-4 w-4" />
                                    Hide Documents
                                </>
                            ) : (
                                <>
                                    <ChevronDown className="h-4 w-4" />
                                    Show Documents
                                </>
                            )}
                        </Button>
                        <Button onClick={loadDocuments} variant="outline" size="sm">Refresh List</Button>
                    </div>
                </div>
                
                {/* Drag and Drop Upload Zone */}
                <Card className={`border-2 border-dashed transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-muted-foreground/25 hover:border-primary/50'}`}>
                    <CardContent 
                        className="flex flex-col items-center justify-center py-12 cursor-pointer"
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileInputChange}
                            className="hidden"
                            id="document-upload"
                            accept=".doc,.docx,.txt"
                            disabled={isUploading}
                        />
                        <Upload className={`h-12 w-12 mb-4 transition-colors ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                        <h3 className="text-lg font-semibold mb-2">
                            {isDragging ? 'Drop file here' : 'Drag and drop files here'}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2">
                            or click to browse
                        </p>
                        <p className="text-xs text-muted-foreground">
                            MS Word (.doc, .docx) and Text (.txt) files only, max 3 MB
                        </p>
                    </CardContent>
                </Card>

                {/* Filters and Search */}
                {showFilters && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Filter className="h-5 w-5 text-purple-500" />
                            Filter & Search
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Search */}
                            <div className="space-y-2">
                                <Label htmlFor="search">Search</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500" />
                                    <Input id="search" placeholder="Search documents..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
                                </div>
                            </div>
                            {/* Client Filter */}
                            <div className="space-y-2">
                                <Label htmlFor="client-filter">Filter by Client</Label>
                                <Select value={selectedClient} onValueChange={setSelectedClient}>
                                    <SelectTrigger id="client-filter">
                                        <SelectValue placeholder="All Clients" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Documents</SelectItem>
                                        <SelectItem value="user-documents">Company Documents</SelectItem>
                                        {clientNames.map(name => (
                                            <SelectItem key={name} value={name}>{name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {/* Sort */}
                            <div className="space-y-2">
                                <Label htmlFor="sort">Sort By</Label>
                                <Select value={sortBy} onValueChange={v => setSortBy(v as SortOption)}>
                                    <SelectTrigger id="sort">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="date-desc">Date (Newest First)</SelectItem>
                                        <SelectItem value="date-asc">Date (Oldest First)</SelectItem>
                                        <SelectItem value="client-asc">Client (A-Z)</SelectItem>
                                        <SelectItem value="client-desc">Client (Z-A)</SelectItem>
                                        <SelectItem value="client-first-asc">First Name (A-Z)</SelectItem>
                                        <SelectItem value="client-first-desc">First Name (Z-A)</SelectItem>
                                        <SelectItem value="client-last-asc">Last Name (A-Z)</SelectItem>
                                        <SelectItem value="client-last-desc">Last Name (Z-A)</SelectItem>
                                        <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                                        <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        {/* Results count and Show Documents button */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">
                                Showing {filteredAndSortedDocuments.length} of {documents.length} documents
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowDocuments(!showDocuments)}
                                className="flex items-center gap-2"
                            >
                                {showDocuments ? (
                                    <>
                                        <ChevronUp className="h-4 w-4" />
                                        Hide Documents
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown className="h-4 w-4" />
                                        Show Documents
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
                )}
                {/* Documents List */}
                {showDocuments && (
                    <>
                    {documents.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-16">
                            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                            <h3 className="text-xl font-semibold mb-2">No documents yet</h3>
                            <p className="text-muted-foreground text-center max-w-md">Documents uploaded to client records will appear here.</p>
                        </CardContent>
                    </Card>
                ) : filteredAndSortedDocuments.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-16">
                            <Search className="h-16 w-16 text-blue-500 mb-4" />
                            <h3 className="text-xl font-semibold mb-2">No matching documents</h3>
                            <p className="text-muted-foreground text-center max-w-md">Try adjusting your search or filters</p>
                            <Button className="mt-6" variant="outline" onClick={() => { setSearchQuery(""); setSelectedClient("all"); }}>Clear Filters</Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        <AnimatePresence>
                            {filteredAndSortedDocuments.map((doc, index) => (
                                <motion.div key={doc.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ delay: index * 0.05 }}>
                                    <Card>
                                        <CardHeader>
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <CardTitle className="flex items-center gap-2">
                                                        <File className="h-5 w-5 text-primary" />
                                                        {doc.name}
                                                    </CardTitle>
                                                    <CardDescription className="flex items-center gap-4 mt-2">
                                                        <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{formatDate(doc.uploadedDate)}</span>
                                                        <span className="text-sm">{doc.isUserDocument ? "Company Document" : `Client: ${doc.clientName || "Unassigned"}`}</span>
                                                        <span className="text-sm">Size: {doc.size}</span>
                                                        <span className="text-sm uppercase">{doc.type}</span>
                                                    </CardDescription>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button variant="outline" size="icon" onClick={() => handleView(doc)} title="View document"><ExternalLink className="h-4 w-4 text-blue-500" /></Button>
                                                    <Button variant="outline" size="icon" onClick={() => handleDeleteClick(doc)} title="Delete document"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                                </div>
                                            </div>
                                        </CardHeader>
                                    </Card>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                    )}
                    </>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <DeleteConfirmationDialog
                open={deleteDocumentConfirm.isOpen}
                onOpenChange={(open) => {
                    setDeleteDocumentConfirm({ isOpen: open, document: deleteDocumentConfirm.document });
                }}
                onConfirm={confirmDeleteDocument}
                title="Delete Document"
                description={`Are you sure you want to delete "${deleteDocumentConfirm.document?.name}"? ${deleteDocumentConfirm.document?.isUserDocument ? "This will permanently remove your document." : `This will permanently remove the document from ${deleteDocumentConfirm.document?.clientName || "the client"}'s record.`} This action cannot be undone.`}
                itemName={deleteDocumentConfirm.document?.name}
            />

            {/* Upload Document Dialog */}
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload Document</DialogTitle>
                        <DialogDescription>
                            Select whether this document is for the Company or for a specific Client.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Document Type</Label>
                            <Select value={documentType} onValueChange={(value: 'company' | 'client') => setDocumentType(value)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="company">Company Document</SelectItem>
                                    <SelectItem value="client">Client Document</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {documentType === 'client' && (
                            <div className="space-y-2">
                                <Label>Select Client</Label>
                                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose a client..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {clients.map(client => (
                                            <SelectItem key={client.id} value={client.id}>
                                                {client.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {selectedFile && (
                            <div className="p-3 bg-muted rounded-md">
                                <p className="text-sm font-medium">Selected file:</p>
                                <p className="text-sm text-muted-foreground">{selectedFile.name}</p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setUploadDialogOpen(false);
                            setSelectedFile(null);
                            setDocumentType('company');
                            setSelectedClientId('');
                        }}>
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleConfirmUpload}
                            disabled={isUploading || (documentType === 'client' && !selectedClientId)}
                        >
                            {isUploading ? 'Uploading...' : 'Upload'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function DocumentsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <DocumentsContent />
        </Suspense>
    );
}
