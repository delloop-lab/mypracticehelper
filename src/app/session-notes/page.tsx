"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Calendar, Search, Filter, Trash2, Edit, Plus, Upload, File, Mic, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface SessionNote {
    id: string;
    clientName: string;
    clientId?: string;
    sessionDate: string;
    content: string; // AI-structured content for display
    createdDate: string;
    transcript?: string; // Raw/natural transcript (for recordings)
    attachments?: { name: string; url: string }[];
    source?: 'session_note' | 'recording'; // Indicates if note came from session_notes table or recordings table
    recordingId?: string; // Original recording ID if source is 'recording'
    audioURL?: string | null; // Audio URL if source is 'recording'
}

type SortOption = 'date-desc' | 'date-asc' | 'client-asc' | 'client-desc' | 'session-desc' | 'session-asc';

function SessionNotesContent() {
    const searchParams = useSearchParams();
    const [notes, setNotes] = useState<SessionNote[]>([]);
    const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedClient, setSelectedClient] = useState<string>("all");
    const [sortBy, setSortBy] = useState<SortOption>('date-desc');
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [editingNote, setEditingNote] = useState<SessionNote | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; noteId: string | null }>({ isOpen: false, noteId: null });
    const [formData, setFormData] = useState({
        clientName: "",
        clientId: undefined as string | undefined,
        sessionDate: "",
        content: "",
        attachments: [] as { name: string; url: string }[]
    });

    const getTranscriptPreview = (text: string, maxLength: number = 120) => {
        if (!text) return '';
        const firstLine = text.split('\n')[0].trim();
        const slice = firstLine.slice(0, maxLength).trimEnd();
        if (firstLine.length > maxLength) {
            return slice + '...';
        }
        return slice;
    };

    useEffect(() => {
        const clientParam = searchParams.get('client');
        const clientIdParam = searchParams.get('clientId');
        const dateParam = searchParams.get('date');
        const createParam = searchParams.get('create');

        if (clientParam) {
            setSelectedClient(clientParam);
            setFormData(prev => ({
                ...prev,
                clientName: clientParam,
                clientId: clientIdParam || undefined
            }));
        }

        if (dateParam) {
            setFormData(prev => ({ ...prev, sessionDate: dateParam }));
        }

        if (createParam === 'true') {
            setIsCreateDialogOpen(true);
        }
    }, [searchParams]);

    useEffect(() => {
        loadNotes();
        loadClients();

        const handleFocus = () => {
            loadNotes();
            loadClients();
        };

        window.addEventListener('focus', handleFocus);

        return () => {
            window.removeEventListener('focus', handleFocus);
        };
    }, []);

    const loadClients = async () => {
        try {
            const response = await fetch('/api/clients');
            if (response.ok) {
                const data = await response.json();
                setClients(data);
            }
        } catch (error) {
            console.error('Error loading clients:', error);
        }
    };

    const loadNotes = async () => {
        try {
            const response = await fetch('/api/session-notes');
            if (response.ok) {
                const data = await response.json();
                console.log('Session notes loaded:', data);
                console.log('Number of notes:', data?.length || 0);
                setNotes(data || []);
            } else {
                console.error('Failed to load session notes:', response.status, response.statusText);
                const errorData = await response.json().catch(() => ({}));
                console.error('Error data:', errorData);
            }
        } catch (error) {
            console.error('Error loading session notes:', error);
        }
    };

    const saveNotes = async (updatedNotes: SessionNote[]) => {
        setNotes(updatedNotes);
        try {
            await fetch('/api/session-notes', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedNotes),
            });
        } catch (error) {
            console.error('Error saving session notes:', error);
        }
    };

    // Get unique client names for filter
    const clientNames = useMemo(() => {
        const names = notes
            .map(n => n.clientName)
            .filter((name): name is string => !!name);
        return Array.from(new Set(names)).sort();
    }, [notes]);

    // Filter and sort notes
    const filteredAndSortedNotes = useMemo(() => {
        let filtered = notes;

        // Filter by search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(n =>
                n.content?.toLowerCase().includes(query) ||
                n.clientName?.toLowerCase().includes(query)
            );
        }

        // Filter by client
        if (selectedClient !== "all") {
            filtered = filtered.filter(n => n.clientName === selectedClient);
        }

        // Sort
        const sorted = [...filtered].sort((a, b) => {
            switch (sortBy) {
                case 'date-desc':
                    return new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime();
                case 'date-asc':
                    return new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime();
                case 'client-asc':
                    return (a.clientName || '').localeCompare(b.clientName || '');
                case 'client-desc':
                    return (b.clientName || '').localeCompare(a.clientName || '');
                case 'session-desc':
                    return new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime();
                case 'session-asc':
                    return new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime();
                default:
                    return 0;
            }
        });

        return sorted;
    }, [notes, searchQuery, selectedClient, sortBy]);

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleCreate = () => {
        setEditingNote(null);
        setFormData({
            clientName: "",
            clientId: undefined,
            sessionDate: "",
            content: "",
            attachments: []
        });
        setIsCreateDialogOpen(true);
    };

    const handleEdit = (note: SessionNote) => {
        if (note.source === 'recording') {
            alert('Voice note recordings cannot be edited from this page. The transcript is automatically generated from the audio recording.');
            return;
        }
        setEditingNote(note);
        setFormData({
            clientName: note.clientName,
            clientId: note.clientId,
            sessionDate: note.sessionDate,
            content: note.content,
            attachments: note.attachments || []
        });
        setIsCreateDialogOpen(true);
    };

    const handleSave = () => {
        if (!formData.clientName || !formData.sessionDate || !formData.content) {
            alert("Please fill in all required fields");
            return;
        }

        if (editingNote) {
            // Update existing note
            const updatedNotes = notes.map(n =>
                n.id === editingNote.id
                    ? { ...n, ...formData }
                    : n
            );
            saveNotes(updatedNotes);
        } else {
            // Create new note
            const newNote: SessionNote = {
                id: Date.now().toString(),
                ...formData,
                createdDate: new Date().toISOString()
            };
            saveNotes([...notes, newNote]);
        }

        setIsCreateDialogOpen(false);
    };

    const handleDeleteClick = (id: string) => {
        const note = notes.find(n => n.id === id);
        if (note?.source === 'recording') {
            alert('Voice note recordings cannot be deleted from this page. Please go to Voice Notes to manage recordings.');
            return;
        }
        setDeleteConfirm({ isOpen: true, noteId: id });
    };

    const handleDelete = () => {
        if (!deleteConfirm.noteId) return;
        const updatedNotes = notes.filter(n => n.id !== deleteConfirm.noteId);
        saveNotes(updatedNotes);
        setDeleteConfirm({ isOpen: false, noteId: null });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const uploadFormData = new FormData();
        uploadFormData.append('file', file);

        try {
            const response = await fetch('/api/documents', {
                method: 'POST',
                body: uploadFormData,
            });

            if (response.ok) {
                const data = await response.json();
                setFormData(prev => ({
                    ...prev,
                    attachments: [...prev.attachments, { name: data.originalName, url: data.url }]
                }));
            }
        } catch (error) {
            console.error('Error uploading file:', error);
        }
    };

    const removeAttachment = (index: number) => {
        setFormData(prev => ({
            ...prev,
            attachments: prev.attachments.filter((_, i) => i !== index)
        }));
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2">Session Notes</h1>
                <p className="text-muted-foreground">
                    Document and manage your therapy session notes
                </p>
            </div>

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold tracking-tight">Notes Library</h2>
                    <div className="flex gap-2">
                        <Button onClick={loadNotes} variant="outline" size="sm">
                            Refresh List
                        </Button>
                        <Button onClick={handleCreate} size="sm" className="bg-green-500 hover:bg-green-600 text-white">
                            <Plus className="mr-2 h-4 w-4" />
                            New Note
                        </Button>
                    </div>
                </div>

                {/* Filters and Search */}
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
                                    <Input
                                        id="search"
                                        placeholder="Search notes..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10"
                                    />
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
                                <Select value={sortBy} onValueChange={(value: string) => setSortBy(value as SortOption)}>
                                    <SelectTrigger id="sort">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="date-desc">Created (Newest First)</SelectItem>
                                        <SelectItem value="date-asc">Created (Oldest First)</SelectItem>
                                        <SelectItem value="session-desc">Session Date (Newest First)</SelectItem>
                                        <SelectItem value="session-asc">Session Date (Oldest First)</SelectItem>
                                        <SelectItem value="client-asc">Client (A-Z)</SelectItem>
                                        <SelectItem value="client-desc">Client (Z-A)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Results count */}
                        <div className="text-sm text-muted-foreground">
                            Showing {filteredAndSortedNotes.length} of {notes.length} notes
                        </div>
                    </CardContent>
                </Card>

                {/* Notes List */}
                {filteredAndSortedNotes.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-16">
                            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                            <h3 className="text-xl font-semibold mb-2">No notes found</h3>
                            <p className="text-muted-foreground text-center max-w-md mb-6">
                                {notes.length === 0
                                    ? "Start documenting your sessions by creating your first note"
                                    : "Try adjusting your search or filters"}
                            </p>
                            <Button onClick={handleCreate} className="bg-green-500 hover:bg-green-600 text-white">
                                <Plus className="mr-2 h-4 w-4" />
                                Create First Note
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        <AnimatePresence>
                            {filteredAndSortedNotes.map((note, index) => (
                                <motion.div
                                    key={note.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ delay: index * 0.05 }}
                                >
                                    <Card className="hover:shadow-md transition-shadow">
                                        <CardHeader>
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <CardTitle className="text-lg">
                                                        {note.clientId ? (
                                                            <Link
                                                                href="/clients"
                                                                className="hover:underline text-primary"
                                                            >
                                                                {note.clientName}
                                                            </Link>
                                                        ) : (
                                                            note.clientName
                                                        )}
                                                    </CardTitle>
                                                    <CardDescription>
                                                        <div className="flex items-center gap-4 mt-1">
                                                            <span className="flex items-center gap-1">
                                                                <Calendar className="h-3 w-3" />
                                                                Session: {formatDate(note.sessionDate)}
                                                            </span>
                                                            <span className="text-xs">
                                                                Created: {formatDate(note.createdDate)}
                                                            </span>
                                                            {note.source === 'recording' && (
                                                                <span className="flex items-center gap-1 text-xs text-purple-600">
                                                                    <Mic className="h-3 w-3" />
                                                                    Voice Note
                                                                </span>
                                                            )}
                                                        </div>
                                                    </CardDescription>
                                                </div>
                                                <div className="flex gap-2">
                                                    {note.source !== 'recording' && (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleEdit(note)}
                                                            >
                                                                <Edit className="h-4 w-4 text-blue-500" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleDeleteClick(note.id)}
                                                                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                    {note.source === 'recording' && note.audioURL && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => {
                                                                const audio = new Audio(note.audioURL!);
                                                                audio.play();
                                                            }}
                                                            title="Play audio"
                                                        >
                                                            <Play className="h-4 w-4 text-primary" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            {note.source === 'recording' ? (
                                                <>
                                                    <Accordion type="multiple" className="w-full">
                                                        {note.transcript && (
                                                            <AccordionItem value="transcript">
                                                                <AccordionTrigger>
                                                                    <div className="flex flex-col items-start text-left gap-0.5">
                                                                        <span className="text-sm font-semibold">
                                                                            Transcript
                                                                        </span>
                                                                        <span className="text-xs text-muted-foreground truncate max-w-[260px]">
                                                                            {getTranscriptPreview(note.transcript)}
                                                                        </span>
                                                                    </div>
                                                                </AccordionTrigger>
                                                                <AccordionContent>
                                                                    <p className="text-sm whitespace-pre-wrap">
                                                                        {note.transcript}
                                                                    </p>
                                                                </AccordionContent>
                                                            </AccordionItem>
                                                        )}
                                                        <AccordionItem value="ai-notes">
                                                            <AccordionTrigger>
                                                                <div className="flex flex-col items-start text-left">
                                                                    <span className="text-sm font-semibold">AI-Structured Notes</span>
                                                                </div>
                                                            </AccordionTrigger>
                                                            <AccordionContent>
                                                                <p className="text-sm whitespace-pre-wrap">
                                                                    {note.content}
                                                                </p>
                                                            </AccordionContent>
                                                        </AccordionItem>
                                                    </Accordion>
                                                </>
                                            ) : (
                                                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                                            )}
                                            {note.source === 'recording' && note.audioURL && (
                                                <div className="mt-4 pt-4 border-t">
                                                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                                                        <Mic className="h-4 w-4 text-purple-600" />
                                                        Audio Recording:
                                                    </p>
                                                    <audio controls className="w-full mt-2">
                                                        <source src={note.audioURL} type="audio/webm" />
                                                        <source src={note.audioURL} type="audio/mp3" />
                                                        Your browser does not support the audio element.
                                                    </audio>
                                                </div>
                                            )}
                                            {note.attachments && note.attachments.length > 0 && (
                                                <div className="mt-4 pt-4 border-t">
                                                    <p className="text-sm font-medium mb-2">Attachments:</p>
                                                    <div className="space-y-1">
                                                        {note.attachments.map((att, i) => (
                                                            <a
                                                                key={i}
                                                                href={att.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-2 text-sm text-primary hover:underline"
                                                            >
                                                                <File className="h-3 w-3" />
                                                                {att.name}
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingNote ? "Edit Session Note" : "New Session Note"}</DialogTitle>
                        <DialogDescription>
                            Document your therapy session details and observations
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="client">Client *</Label>
                            <Select
                                value={formData.clientName}
                                onValueChange={(value) => {
                                    const selectedClient = clients.find(c => c.name === value);
                                    setFormData({
                                        ...formData,
                                        clientName: value,
                                        clientId: selectedClient?.id
                                    });
                                }}
                            >
                                <SelectTrigger id="client">
                                    <SelectValue placeholder="Select a client" />
                                </SelectTrigger>
                                <SelectContent>
                                    {clients.map(client => (
                                        <SelectItem key={client.id} value={client.name}>
                                            {client.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="session-date">Session Date & Time *</Label>
                            <Input
                                id="session-date"
                                type="datetime-local"
                                value={formData.sessionDate}
                                onChange={(e) => setFormData({ ...formData, sessionDate: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="content">Session Notes *</Label>
                            <Textarea
                                id="content"
                                placeholder="Document your session observations, interventions, and client progress..."
                                className="min-h-[300px]"
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Attachments</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="file-upload"
                                    type="file"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                                <Label
                                    htmlFor="file-upload"
                                    className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-muted"
                                >
                                    <Upload className="h-4 w-4" />
                                    Upload File
                                </Label>
                            </div>
                            {formData.attachments.length > 0 && (
                                <div className="space-y-2 mt-2">
                                    {formData.attachments.map((att, index) => (
                                        <div key={index} className="flex items-center justify-between p-2 border rounded-md bg-muted/50">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <File className="h-4 w-4 flex-shrink-0" />
                                                <span className="text-sm truncate">{att.name}</span>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-red-500"
                                                onClick={() => removeAttachment(index)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} className={editingNote ? "" : "bg-green-500 hover:bg-green-600 text-white"}>
                            {editingNote ? "Update Note" : "Create Note"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <DeleteConfirmationDialog
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => setDeleteConfirm({ isOpen: open, noteId: deleteConfirm.noteId })}
                onConfirm={handleDelete}
                title="Delete Session Note"
                description="Are you sure you want to delete this session note? This action cannot be undone."
            />
        </div>
    );
}

export default function SessionNotesPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <SessionNotesContent />
        </Suspense>
    );
}
