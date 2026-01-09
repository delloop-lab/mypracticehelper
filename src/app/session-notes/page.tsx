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
import { FileText, Calendar, Search, Filter, Trash2, Edit, Plus, Upload, File, Mic, Play, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface SessionNote {
    id: string;
    clientName: string;
    clientId?: string;
    sessionDate: string;
    venue?: string; // Session venue (The Practice, WhatsApp, Phone, Video, Call Out)
    content: string; // Session notes content
    createdDate: string;
    transcript?: string; // Raw/natural transcript (for recordings or manual entry)
    audioURL?: string | null; // Audio URL (for recordings or manual entry)
    aiOverview?: string; // AI-generated overview
    attachments?: { name: string; url: string }[];
    source?: 'session_note' | 'recording' | 'session'; // Indicates if note came from session_notes table, recordings table, or sessions table
    recordingId?: string; // Original recording ID if source is 'recording'
    sessionId?: string; // Original session ID if source is 'session' or linked session
}

type SortOption = 'date-desc' | 'date-asc' | 'client-asc' | 'client-desc' | 'session-desc' | 'session-asc';

function SessionNotesContent() {
    const searchParams = useSearchParams();
    const [notes, setNotes] = useState<SessionNote[]>([]);
    const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedClient, setSelectedClient] = useState<string>("all");
    const [selectedSource, setSelectedSource] = useState<string>("all"); // Filter by source type
    const [sortBy, setSortBy] = useState<SortOption>('session-desc');
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [editingNote, setEditingNote] = useState<SessionNote | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; note: SessionNote | null }>({ isOpen: false, note: null });
    const [formData, setFormData] = useState({
        clientName: "",
        clientId: undefined as string | undefined,
        sessionId: undefined as string | undefined,
        sessionDate: "",
        therapistName: "",
        content: "",
        transcript: "",
        audioURL: "",
        aiOverview: "",
        attachments: [] as { name: string; url: string }[]
    });
    const [availableSessions, setAvailableSessions] = useState<{ id: string; date: string; type: string; time: string }[]>([]);
    const [currentTherapist, setCurrentTherapist] = useState<string>("");
    
    // Fetch therapist name on mount (from logged-in user's first_name and last_name)
    useEffect(() => {
        const fetchTherapist = async () => {
            try {
                console.log('[Session Notes] ========== Fetching therapist name ==========');
                const response = await fetch('/api/auth/me');
                if (response.ok) {
                    const userData = await response.json();
                    console.log('[Session Notes] User data from /api/auth/me:', {
                        id: userData.id,
                        email: userData.email,
                        first_name: userData.first_name,
                        last_name: userData.last_name
                    });
                    
                    // Build therapist name from first_name and last_name
                    const nameParts: string[] = [];
                    if (userData.first_name && userData.first_name.trim()) {
                        nameParts.push(userData.first_name.trim());
                    }
                    if (userData.last_name && userData.last_name.trim()) {
                        nameParts.push(userData.last_name.trim());
                    }
                    
                    if (nameParts.length > 0) {
                        const therapist = nameParts.join(' ');
                        console.log('[Session Notes] ✅ Therapist name from profile:', therapist);
                        setCurrentTherapist(therapist);
                    } else {
                        // Fallback to email if first_name/last_name not set
                        console.warn('[Session Notes] ⚠️ first_name and last_name are empty in database!');
                        console.warn('[Session Notes] Run this SQL to fix: UPDATE users SET first_name = \'YourName\', last_name = \'YourLastName\' WHERE email = \'' + userData.email + '\';');
                        
                        if (userData.email) {
                            const emailParts = userData.email.split('@')[0].split('.');
                            const name = emailParts.map((part: string) => 
                                part.charAt(0).toUpperCase() + part.slice(1)
                            ).join(' ');
                            console.log('[Session Notes] Using email fallback:', name);
                            setCurrentTherapist(name + ' (update profile)');
                        }
                    }
                } else {
                    console.error('[Session Notes] ❌ Failed to fetch user:', response.status);
                }
            } catch (error) {
                console.error('[Session Notes] ❌ Error fetching therapist:', error);
            }
        };
        fetchTherapist();
    }, []);

    const getTranscriptPreview = (text: string, maxLength: number = 120) => {
        if (!text) return '';
        const firstLine = text.split('\n')[0].trim();
        const slice = firstLine.slice(0, maxLength).trimEnd();
        if (firstLine.length > maxLength) {
            return slice + '...';
        }
        return slice;
    };

    // Track if form is pre-filled from a session card (no need to show dropdowns)
    const [isPrefilledFromSession, setIsPrefilledFromSession] = useState(false);
    // Store original date string for display (ISO format from URL)
    const [originalSessionDate, setOriginalSessionDate] = useState<string>("");

    // Helper to convert ISO date to datetime-local format
    const convertToDatetimeLocal = (dateString: string): string => {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return '';
            }
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch {
            return '';
        }
    };

    useEffect(() => {
        const clientParam = searchParams.get('client');
        const clientIdParam = searchParams.get('clientId');
        const sessionIdParam = searchParams.get('sessionId');
        const dateParam = searchParams.get('date');
        const createParam = searchParams.get('create');

        console.log('[Session Notes] URL params:', { clientParam, clientIdParam, sessionIdParam, dateParam, createParam });

        // If all session info is provided, we're coming from a session card
        const isFromSessionCard = !!(clientParam && clientIdParam && sessionIdParam && dateParam && createParam === 'true');
        setIsPrefilledFromSession(isFromSessionCard);

        if (clientParam) {
            setSelectedClient(clientParam);
            
            // Store original date for display
            if (dateParam) {
                console.log('[Session Notes] Processing date param:', dateParam);
                // Validate date before storing
                const testDate = new Date(dateParam);
                if (!isNaN(testDate.getTime())) {
                    setOriginalSessionDate(dateParam);
                    // Convert date to datetime-local format for input field
                    const formattedDate = convertToDatetimeLocal(dateParam);
                    console.log('[Session Notes] Converted date:', formattedDate);
                    setFormData(prev => ({
                        ...prev,
                        clientName: clientParam,
                        clientId: clientIdParam || undefined,
                        sessionId: sessionIdParam || undefined,
                        sessionDate: formattedDate || prev.sessionDate
                    }));
                } else {
                    console.warn('[Session Notes] Invalid date param:', dateParam);
                    setOriginalSessionDate('');
                    setFormData(prev => ({
                        ...prev,
                        clientName: clientParam,
                        clientId: clientIdParam || undefined,
                        sessionId: sessionIdParam || undefined
                    }));
                }
            } else {
                setFormData(prev => ({
                    ...prev,
                    clientName: clientParam,
                    clientId: clientIdParam || undefined,
                    sessionId: sessionIdParam || undefined
                }));
            }
            
            // Load sessions if clientId is provided (not needed if pre-filled)
            if (clientIdParam && clients.length > 0 && !isFromSessionCard) {
                loadSessionsForClient(clientIdParam);
            }
        }

        if (dateParam && !clientParam) {
            // Handle date param even if client param is missing
            const testDate = new Date(dateParam);
            if (!isNaN(testDate.getTime())) {
                setOriginalSessionDate(dateParam);
                const formattedDate = convertToDatetimeLocal(dateParam);
                if (formattedDate) {
                    setFormData(prev => ({ ...prev, sessionDate: formattedDate }));
                }
            }
        }

        if (createParam === 'true') {
            setIsCreateDialogOpen(true);
        }
    }, [searchParams, clients]);

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
            console.log('[Session Notes] Loading clients...');
            const response = await fetch('/api/clients');
            if (response.ok) {
                const data = await response.json();
                console.log('[Session Notes] Loaded', data.length, 'clients');
                if (data.length > 0) {
                    console.log('[Session Notes] Sample client:', { id: data[0].id, name: data[0].name });
                }
                setClients(data);
            } else {
                console.error('[Session Notes] Failed to load clients:', response.status);
            }
        } catch (error) {
            console.error('[Session Notes] Error loading clients:', error);
        }
    };

    const loadNotes = async () => {
        try {
            console.log('[Session Notes] Loading notes from API...');
            const response = await fetch('/api/session-notes');
            if (response.ok) {
                const data = await response.json();
                console.log('[Session Notes] Loaded', data?.length || 0, 'notes');
                if (data && data.length > 0) {
                    const sampleNote = data[0];
                    console.log('[Session Notes] Sample note:', {
                        id: sampleNote.id,
                        clientName: sampleNote.clientName,
                        hasTranscript: !!sampleNote.transcript,
                        transcriptLength: sampleNote.transcript?.length || 0,
                        hasAudioURL: !!sampleNote.audioURL,
                        hasAiOverview: !!sampleNote.aiOverview,
                        contentLength: sampleNote.content?.length || 0
                    });
                }
                setNotes(data || []);
            } else {
                console.error('[Session Notes] Failed to load notes:', response.status, response.statusText);
                const errorData = await response.json().catch(() => ({}));
                console.error('[Session Notes] Error data:', errorData);
            }
        } catch (error) {
            console.error('[Session Notes] Error loading notes:', error);
        }
    };

    const saveNotes = async (updatedNotes: SessionNote[]) => {
        console.log('[Session Notes] saveNotes called with notes:', updatedNotes.length);
        const noteToSave = updatedNotes.find(n => 
            (editingNote && n.id === editingNote.id) || 
            (!editingNote && n.id === updatedNotes[updatedNotes.length - 1]?.id)
        );
        if (noteToSave) {
            console.log('[Session Notes] Note being saved:', {
                id: noteToSave.id,
                clientName: noteToSave.clientName,
                clientId: noteToSave.clientId,
                sessionId: noteToSave.sessionId,
                transcript: noteToSave.transcript,
                transcriptLength: noteToSave.transcript?.length || 0,
                audioURL: noteToSave.audioURL,
                aiOverview: noteToSave.aiOverview,
                content: noteToSave.content?.substring(0, 100)
            });
        }
        
        setNotes(updatedNotes);
        try {
            const response = await fetch('/api/session-notes', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedNotes),
            });
            
            if (response.ok) {
                console.log('[Session Notes] Successfully saved notes');
                const responseData = await response.json().catch(() => ({}));
                console.log('[Session Notes] Save response:', responseData);
            } else {
                console.error('[Session Notes] Failed to save notes:', response.status, response.statusText);
                const errorData = await response.json().catch(() => ({}));
                console.error('[Session Notes] Error data:', errorData);
            }
        } catch (error) {
            console.error('[Session Notes] Error saving session notes:', error);
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

        // Filter by source type
        if (selectedSource !== "all") {
            filtered = filtered.filter(n => {
                if (selectedSource === "session_note") {
                    return n.source === 'session_note' || n.source === undefined;
                }
                return n.source === selectedSource;
            });
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
    }, [notes, searchQuery, selectedClient, selectedSource, sortBy]);

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const loadSessionsForClient = async (clientId: string) => {
        try {
            console.log('[Session Notes] ========== Loading sessions for client ==========');
            console.log('[Session Notes] clientId:', clientId);
            console.log('[Session Notes] clients array length:', clients.length);
            
            const response = await fetch('/api/appointments');
            if (response.ok) {
                const appointments = await response.json();
                console.log('[Session Notes] Total appointments loaded:', appointments.length);
                
                // Find client either by ID or by looking up in the clients array
                let client = clients.find(c => c.id === clientId);
                let clientName = client?.name;
                
                // If client not in local array, try to find by name in appointments
                if (!client && formData.clientName) {
                    clientName = formData.clientName;
                    console.log('[Session Notes] Using formData.clientName:', clientName);
                }
                
                if (!clientName) {
                    console.error('[Session Notes] Could not determine client name. clientId:', clientId, 'formData.clientName:', formData.clientName);
                    setAvailableSessions([]);
                    return;
                }
                
                console.log('[Session Notes] Looking for sessions with clientName:', clientName);
                
                // Get all sessions for this client (past and future)
                const sessions = appointments
                    .filter((apt: any) => {
                        const matches = apt.clientName === clientName;
                        if (matches) {
                            console.log('[Session Notes] MATCH:', apt.clientName, apt.date, apt.id);
                        }
                        return matches;
                    })
                    .map((apt: any) => ({
                        id: apt.id,
                        date: apt.date,
                        type: apt.type || 'Session',
                        time: apt.time || new Date(apt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }))
                    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Most recent first
                
                console.log('[Session Notes] ========== Found', sessions.length, 'sessions ==========');
                if (sessions.length > 0) {
                    console.log('[Session Notes] First session:', sessions[0]);
                }
                setAvailableSessions(sessions);
            } else {
                console.error('[Session Notes] Failed to load appointments:', response.status);
                setAvailableSessions([]);
            }
        } catch (error) {
            console.error('[Session Notes] Error loading sessions:', error);
            setAvailableSessions([]);
        }
    };

    const handleCreate = async () => {
        console.log('[Session Notes] handleCreate - current therapist:', currentTherapist);
        setEditingNote(null);
        const initialFormData = {
            clientName: "",
            clientId: undefined,
            sessionId: undefined,
            sessionDate: "",
            therapistName: currentTherapist, // Auto-fill therapist
            content: "",
            transcript: "",
            audioURL: "",
            aiOverview: "",
            attachments: []
        };
        setFormData(initialFormData);
        setAvailableSessions([]);
        setIsCreateDialogOpen(true);
        
        // If client is pre-selected from URL params, load sessions
        const clientIdParam = searchParams.get('clientId');
        if (clientIdParam) {
            await loadSessionsForClient(clientIdParam);
        }
    };

    const handleEdit = async (note: SessionNote) => {
        console.log('[Session Notes] handleEdit called with note:', {
            id: note.id,
            clientName: note.clientName,
            clientId: note.clientId,
            sessionId: note.sessionId,
            transcript: note.transcript ? `[${note.transcript.length} chars]` : 'null',
            audioURL: note.audioURL,
            aiOverview: note.aiOverview ? `[${note.aiOverview.length} chars]` : 'null'
        });
        
        if (note.source === 'recording') {
            alert('Voice note recordings cannot be edited from this page. The transcript is automatically generated from the audio recording.');
            return;
        }
        setEditingNote(note);
        setFormData({
            clientName: note.clientName,
            clientId: note.clientId,
            sessionId: note.sessionId,
            sessionDate: note.sessionDate,
            therapistName: currentTherapist, // Auto-fill therapist
            content: note.content,
            transcript: note.transcript || "",
            audioURL: note.audioURL || "",
            aiOverview: note.aiOverview || "",
            attachments: note.attachments || []
        });
        // Load sessions for this client
        if (note.clientId) {
            await loadSessionsForClient(note.clientId);
        }
        setIsCreateDialogOpen(true);
    };

    const handleSave = () => {
        console.log('[Session Notes] handleSave called with formData:', {
            clientName: formData.clientName,
            clientId: formData.clientId,
            sessionId: formData.sessionId,
            sessionDate: formData.sessionDate,
            content: formData.content,
            transcript: formData.transcript,
            audioURL: formData.audioURL,
            aiOverview: formData.aiOverview,
            hasContent: !!formData.content,
            hasTranscript: !!formData.transcript
        });
        
        if (!formData.clientName || !formData.sessionDate || !formData.content) {
            console.warn('[Session Notes] Validation failed:', {
                hasClientName: !!formData.clientName,
                hasSessionDate: !!formData.sessionDate,
                hasContent: !!formData.content
            });
            alert("Please fill in all required fields");
            return;
        }

        if (editingNote) {
            console.log('[Session Notes] Updating existing note:', editingNote.id);
            // Update existing note
            const updatedNote = { 
                ...editingNote, 
                ...formData,
                sessionId: formData.sessionId,
                transcript: formData.transcript,
                audioURL: formData.audioURL,
                aiOverview: formData.aiOverview
            };
            console.log('[Session Notes] Updated note data:', updatedNote);
            const updatedNotes = notes.map(n =>
                n.id === editingNote.id ? updatedNote : n
            );
            saveNotes(updatedNotes);
        } else {
            console.log('[Session Notes] Creating new note');
            // Create new note
            const newNote: SessionNote = {
                id: Date.now().toString(),
                ...formData,
                sessionId: formData.sessionId,
                transcript: formData.transcript,
                audioURL: formData.audioURL,
                aiOverview: formData.aiOverview,
                createdDate: new Date().toISOString()
            };
            console.log('[Session Notes] New note data:', newNote);
            saveNotes([...notes, newNote]);
        }

        setIsCreateDialogOpen(false);
    };

    const handleDeleteClick = (id: string) => {
        const note = notes.find(n => n.id === id);
        if (note?.source === 'session') {
            alert('This is a session/appointment, not a session note. Sessions cannot be deleted from this page. Please go to Schedule to manage sessions.');
            return;
        }
        if (note) {
            setDeleteConfirm({ isOpen: true, note: note });
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirm.note) return;

        // Don't delete sessions from this page
        if (deleteConfirm.note.source === 'session') {
            alert('This is a session/appointment, not a session note. Sessions cannot be deleted from this page. Please go to Schedule to manage sessions.');
            setDeleteConfirm({ isOpen: false, note: null });
            return;
        }

        // Handle recording deletion
        if (deleteConfirm.note.source === 'recording' && deleteConfirm.note.recordingId) {
            console.log('[Session Notes] Attempting to delete recording:', {
                id: deleteConfirm.note.recordingId,
                clientName: deleteConfirm.note.clientName,
                sessionDate: deleteConfirm.note.sessionDate
            });

            try {
                const response = await fetch(`/api/recordings?id=${encodeURIComponent(deleteConfirm.note.recordingId)}`, {
                    method: 'DELETE',
                });

                if (response.ok) {
                    console.log('[Session Notes] Successfully deleted recording');
                    // Remove from local state and reload notes
                    const updatedNotes = notes.filter(n => n.id !== deleteConfirm.note!.id);
                    setNotes(updatedNotes);
                    // Reload to ensure sync with server
                    await loadNotes();
                    setDeleteConfirm({ isOpen: false, note: null });
                } else {
                    const error = await response.json();
                    console.error('[Session Notes] Delete recording failed:', error);
                    alert(`Failed to delete recording: ${error.error || 'Unknown error'}`);
                }
            } catch (error) {
                console.error('Error deleting recording:', error);
                alert(`Failed to delete recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            return;
        }

        // Delete actual session notes (source === 'session_note' or undefined)
        console.log('[Session Notes] Attempting to delete note:', {
            id: deleteConfirm.note.id,
            clientName: deleteConfirm.note.clientName,
            sessionDate: deleteConfirm.note.sessionDate,
            source: deleteConfirm.note.source
        });

        try {
            const response = await fetch(`/api/session-notes?id=${encodeURIComponent(deleteConfirm.note.id)}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                console.log('[Session Notes] Successfully deleted note');
                // Remove from local state and reload notes
                const updatedNotes = notes.filter(n => n.id !== deleteConfirm.note!.id);
                setNotes(updatedNotes);
                // Reload to ensure sync with server
                await loadNotes();
                setDeleteConfirm({ isOpen: false, note: null });
            } else {
                const error = await response.json();
                console.error('[Session Notes] Delete failed:', error);
                alert(`Failed to delete session note: ${error.error || 'Unknown error'}\n\nNote ID: ${deleteConfirm.note.id}\n\nIf this note was never saved to the database, it may not be deletable.`);
            }
        } catch (error) {
            console.error('Error deleting session note:', error);
            alert(`Failed to delete session note: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check the browser console for details.`);
        }
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

                            {/* Source Type Filter */}
                            <div className="space-y-2">
                                <Label htmlFor="source-filter">Filter by Type</Label>
                                <Select value={selectedSource} onValueChange={setSelectedSource}>
                                    <SelectTrigger id="source-filter">
                                        <SelectValue placeholder="All Types" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Types</SelectItem>
                                        <SelectItem value="session_note">Session Notes Only</SelectItem>
                                        <SelectItem value="session">Sessions Only</SelectItem>
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
                                                                href={`/clients?highlight=${note.clientId}${note.sessionId ? `&session=${note.sessionId}` : ''}`}
                                                                className="hover:underline text-primary"
                                                            >
                                                                {note.clientName}
                                                            </Link>
                                                        ) : (
                                                            note.clientName
                                                        )}
                                                    </CardTitle>
                                                    <CardDescription>
                                                        <div className="flex flex-col gap-1 mt-1">
                                                            <div className="flex items-center gap-1">
                                                                <Calendar className="h-3 w-3" />
                                                                Session: {formatDate(note.sessionDate)}
                                                            </div>
                                                            <div className="flex items-center gap-4 flex-wrap">
                                                                <span className="flex items-center gap-1 text-xs">
                                                                    <MapPin className="h-3 w-3" />
                                                                    Venue: {note.venue || "The Practice"}
                                                                </span>
                                                                {note.source !== 'session' && (
                                                                    <span className="text-xs">
                                                                        Created: {formatDate(note.createdDate)}
                                                                    </span>
                                                                )}
                                                                {note.source === 'recording' && (
                                                                    <span className="flex items-center gap-1 text-xs text-purple-600">
                                                                        <Mic className="h-3 w-3" />
                                                                        Voice Note
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </CardDescription>
                                                </div>
                                                <div className="flex gap-2">
                                                    {/* View Client/Session button */}
                                                    {note.clientId && (
                                                        <Link
                                                            href={`/clients?highlight=${note.clientId}${note.sessionId ? `&session=${note.sessionId}` : ''}`}
                                                            title="View client profile"
                                                        >
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                            >
                                                                <FileText className="h-4 w-4 text-green-500" />
                                                            </Button>
                                                        </Link>
                                                    )}
                                                    {note.source !== 'recording' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleEdit(note)}
                                                            title="Edit note"
                                                        >
                                                            <Edit className="h-4 w-4 text-blue-500" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDeleteClick(note.id)}
                                                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
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
                                                                    <span className="text-sm font-semibold">AI Clinical Assessment</span>
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
                                                <div className="space-y-4">
                                                    {note.transcript && (
                                                        <div>
                                                            <p className="text-sm font-semibold mb-2">Transcript:</p>
                                                            <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded">{note.transcript}</p>
                                                        </div>
                                                    )}
                                                    {note.audioURL && (
                                                        <div>
                                                            <p className="text-sm font-semibold mb-2">Audio Recording:</p>
                                                            <audio controls className="w-full">
                                                                <source src={note.audioURL} type="audio/webm" />
                                                                <source src={note.audioURL} type="audio/mp3" />
                                                                Your browser does not support the audio element.
                                                            </audio>
                                                        </div>
                                                    )}
                                                    {note.aiOverview && (
                                                        <div>
                                                            <p className="text-sm font-semibold mb-2">AI Session Overview:</p>
                                                            <p className="text-sm whitespace-pre-wrap bg-primary/10 p-3 rounded">{note.aiOverview}</p>
                                                        </div>
                                                    )}
                                                    {note.content && (
                                                        <div>
                                                            <p className="text-sm font-semibold mb-2">Session Notes:</p>
                                                            <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                                                        </div>
                                                    )}
                                                </div>
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
            <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
                setIsCreateDialogOpen(open);
                if (!open) {
                    setIsPrefilledFromSession(false); // Reset when dialog closes
                    setOriginalSessionDate(""); // Reset original date
                }
            }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingNote ? "Edit Session Note" : "New Session Note"}</DialogTitle>
                        <DialogDescription>
                            {isPrefilledFromSession 
                                ? "Add notes for this session"
                                : "Document your therapy session and observations (not Clinical Notes)"
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {/* Show session info summary when pre-filled from session card */}
                        {isPrefilledFromSession ? (
                            <div className="p-4 bg-muted rounded-lg border">
                                <div className="flex items-center gap-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">Client:</span>{" "}
                                        <strong>{formData.clientName}</strong>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Session:</span>{" "}
                                        <strong>
                                            {originalSessionDate 
                                                ? (() => {
                                                    const date = new Date(originalSessionDate);
                                                    if (isNaN(date.getTime())) {
                                                        return 'Invalid date';
                                                    }
                                                    return date.toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    });
                                                })()
                                                : formData.sessionDate
                                                    ? (() => {
                                                        const date = new Date(formData.sessionDate);
                                                        if (isNaN(date.getTime())) {
                                                            return 'Invalid date';
                                                        }
                                                        return date.toLocaleDateString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        });
                                                    })()
                                                    : 'Not specified'
                                            }
                                        </strong>
                                    </div>
                                </div>
                            </div>
                        ) : (
                        <>
                        <div className="space-y-2">
                            <Label htmlFor="client">Client *</Label>
                            <Select
                                value={formData.clientName}
                                onValueChange={async (value) => {
                                    console.log('[Session Notes Dialog] Client selected:', value);
                                    const selectedClient = clients.find(c => c.name === value);
                                    console.log('[Session Notes Dialog] Selected client object:', selectedClient);
                                    const newClientId = selectedClient?.id;
                                    console.log('[Session Notes Dialog] Setting clientId to:', newClientId);
                                    
                                    // Update form data with new client
                                    setFormData(prev => ({
                                        ...prev,
                                        clientName: value,
                                        clientId: newClientId,
                                        sessionId: undefined, // Clear session when client changes
                                        sessionDate: "" // Clear date when client changes
                                    }));
                                    
                                    // Load sessions for this client
                                    if (newClientId) {
                                        console.log('[Session Notes Dialog] Loading sessions for clientId:', newClientId);
                                        try {
                                            await loadSessionsForClient(newClientId);
                                            console.log('[Session Notes Dialog] Sessions loaded, count:', availableSessions.length);
                                        } catch (err) {
                                            console.error('[Session Notes Dialog] Error loading sessions:', err);
                                        }
                                    } else {
                                        console.log('[Session Notes Dialog] No clientId found for client:', value);
                                        setAvailableSessions([]);
                                    }
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

                        {/* Session Selection - always show when client is selected */}
                        {formData.clientName && (
                            <div className="space-y-2">
                                <Label htmlFor="session-select">Select Session *</Label>
                                {availableSessions.length > 0 ? (
                                    <>
                                        <Select
                                            value={formData.sessionId || "none"}
                                            onValueChange={(value) => {
                                                if (value === "none") {
                                                    setFormData({
                                                        ...formData,
                                                        sessionId: undefined,
                                                        sessionDate: formData.sessionDate || "" // Keep existing date if set
                                                    });
                                                } else {
                                                    const selectedSession = availableSessions.find(s => s.id === value);
                                                    if (selectedSession) {
                                                        // Convert ISO date to datetime-local format (YYYY-MM-DDTHH:mm)
                                                        const date = new Date(selectedSession.date);
                                                        const year = date.getFullYear();
                                                        const month = String(date.getMonth() + 1).padStart(2, '0');
                                                        const day = String(date.getDate()).padStart(2, '0');
                                                        const hours = String(date.getHours()).padStart(2, '0');
                                                        const minutes = String(date.getMinutes()).padStart(2, '0');
                                                        const datetimeLocal = `${year}-${month}-${day}T${hours}:${minutes}`;
                                                        
                                                        setFormData({
                                                            ...formData,
                                                            sessionId: selectedSession.id,
                                                            sessionDate: datetimeLocal
                                                        });
                                                    }
                                                }
                                            }}
                                        >
                                            <SelectTrigger id="session-select">
                                                <SelectValue placeholder="Select a session (optional)" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">No session (manual date)</SelectItem>
                                                {availableSessions.map(session => (
                                                    <SelectItem key={session.id} value={session.id}>
                                                        {new Date(session.date).toLocaleDateString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })} - {session.type}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">
                                            Select a session to link this note, or leave as "No session" to enter a manual date
                                        </p>
                                    </>
                                ) : (
                                    <div className="text-sm text-amber-600 dark:text-amber-400 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200 dark:border-amber-800">
                                        ⚠️ No sessions found for this client. Loading sessions... If no sessions appear, you can enter a manual date below, or go to Scheduling to create sessions for this client first.
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="session-date">Session Date & Time *</Label>
                            <Input
                                id="session-date"
                                type="datetime-local"
                                value={formData.sessionDate}
                                onChange={(e) => setFormData({ ...formData, sessionDate: e.target.value })}
                            />
                        </div>
                        </>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="content">Session Notes / Content *</Label>
                            <Textarea
                                id="content"
                                placeholder="Document your session observations, interventions, and client progress..."
                                className="min-h-[200px]"
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground">
                                To record Session Notes (not Clinical Notes)
                            </p>
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
                onOpenChange={(open) => setDeleteConfirm({ isOpen: open, note: deleteConfirm.note })}
                onConfirm={handleDelete}
                title={deleteConfirm.note?.source === 'recording' ? "Delete Recording" : "Delete Session Note"}
                description={
                    deleteConfirm.note
                        ? deleteConfirm.note.source === 'recording'
                            ? `Are you sure you want to delete the recording from ${new Date(deleteConfirm.note.sessionDate).toLocaleDateString()}${deleteConfirm.note.clientName ? ` for ${deleteConfirm.note.clientName}` : ''}? This will permanently remove the audio file and transcript. This action cannot be undone.`
                            : `Are you sure you want to delete the session note for ${deleteConfirm.note.clientName} from ${new Date(deleteConfirm.note.sessionDate).toLocaleDateString()}? This action cannot be undone.`
                        : "Are you sure you want to delete this item? This action cannot be undone."
                }
                itemName={deleteConfirm.note ? `${deleteConfirm.note.clientName || 'Unnamed'} - ${new Date(deleteConfirm.note.sessionDate).toLocaleDateString()}` : undefined}
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
