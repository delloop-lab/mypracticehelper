"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { File, Calendar, Search, Filter, Trash2, ExternalLink, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ClientDocument {
    id: string;
    name: string;
    type: string;
    size: string;
    uploadedBy: string;
    uploadedDate: string;
    clientName: string;
    clientFirstName?: string;
    clientLastName?: string;
    category: string;
    url?: string;
}

type SortOption = 'date-desc' | 'date-asc' | 'client-asc' | 'client-desc' | 'client-first-asc' | 'client-first-desc' | 'client-last-asc' | 'client-last-desc' | 'name-asc' | 'name-desc';

function DocumentsContent() {
    const searchParams = useSearchParams();
    const [documents, setDocuments] = useState<ClientDocument[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedClient, setSelectedClient] = useState<string>("all");
    const [sortBy, setSortBy] = useState<SortOption>('date-desc');

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
        const handleFocus = () => loadDocuments();
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, []);

    const loadDocuments = async () => {
        try {
            const response = await fetch('/api/clients');
            if (response.ok) {
                const clients = await response.json();
                const allDocs: ClientDocument[] = [];
                const fileUrls: string[] = [];
                
                clients.forEach((client: any) => {
                    if (client.documents && client.documents.length > 0) {
                        client.documents.forEach((doc: any) => {
                            if (doc.url) {
                                fileUrls.push(doc.url);
                            }
                            allDocs.push({
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
                            });
                        });
                    }
                });
                
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
            }
        } catch (error) {
            console.error('Error loading documents:', error);
        }
    };

    const saveDocuments = async (updatedDocs: ClientDocument[]) => {
        setDocuments(updatedDocs);
        try {
            await fetch('/api/documents', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedDocs),
            });
        } catch (error) {
            console.error('Error saving documents:', error);
        }
    };

    // Unique client names for filter dropdown
    const clientNames = useMemo(() => {
        const names = documents.map(d => d.clientName).filter((n): n is string => !!n);
        return Array.from(new Set(names)).sort();
    }, [documents]);

    // Filtering & sorting
    const filteredAndSortedDocuments = useMemo(() => {
        let filtered = documents;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(d =>
                d.name?.toLowerCase().includes(q) ||
                d.clientName?.toLowerCase().includes(q) ||
                d.type?.toLowerCase().includes(q)
            );
        }
        // Filter by client (case-insensitive, trimmed)
        if (selectedClient !== "all") {
            const normalizedSelected = selectedClient.trim().toLowerCase();
            filtered = filtered.filter(d => {
                if (d.clientName) {
                    return d.clientName.trim().toLowerCase() === normalizedSelected;
                }
                return false;
            });
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

    const handleDelete = (id: string) => {
        const updated = documents.filter(d => d.id !== id);
        saveDocuments(updated);
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2">Documents</h1>
                <p className="text-muted-foreground">View and manage client documents</p>
            </div>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold tracking-tight">Document Library</h2>
                    <Button onClick={loadDocuments} variant="outline" size="sm">Refresh List</Button>
                </div>
                {/* Filters and Search */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Filter className="h-5 w-5" />
                            Filter & Search
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Search */}
                            <div className="space-y-2">
                                <Label htmlFor="search">Search</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                                        <SelectItem value="all">All Clients</SelectItem>
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
                        {/* Results count */}
                        <div className="text-sm text-muted-foreground">
                            Showing {filteredAndSortedDocuments.length} of {documents.length} documents
                        </div>
                    </CardContent>
                </Card>
                {/* Documents List */}
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
                            <Search className="h-16 w-16 text-muted-foreground mb-4" />
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
                                                        <span className="text-sm">Client: {doc.clientName || "Unassigned"}</span>
                                                        <span className="text-sm">Size: {doc.size}</span>
                                                        <span className="text-sm uppercase">{doc.type}</span>
                                                    </CardDescription>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button variant="outline" size="icon" onClick={() => handleView(doc)} title="View document"><ExternalLink className="h-4 w-4" /></Button>
                                                    <Button variant="outline" size="icon" onClick={() => handleDelete(doc.id)} title="Delete document"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                                </div>
                                            </div>
                                        </CardHeader>
                                    </Card>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
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
