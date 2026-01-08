"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Play, Pause, Download, Trash2, FileAudio, Calendar, Clock, Search, Filter, User, SortAsc, SortDesc, Edit, Mic, List, Upload } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoiceNotes } from "@/components/voice-notes";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface NoteSection {
    title: string;
    content: string;
}

interface Recording {
    id: string;
    date: string;
    duration: number;
    audioURL: string;
    transcript: string;
    clientName?: string;
    clientId?: string;
    client_id?: string;
    session_id?: string;
    sessionId?: string;
    notes?: NoteSection[];
}

type SortOption = 'date-desc' | 'date-asc' | 'client-asc' | 'client-desc' | 'duration-desc' | 'duration-asc';

function RecordingsContent() {
    const searchParams = useSearchParams();
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedClient, setSelectedClient] = useState<string>("all");
    const [sortBy, setSortBy] = useState<SortOption>('date-desc');
    const [editingRecording, setEditingRecording] = useState<Recording | null>(null);
    const [editClientName, setEditClientName] = useState("");
    const [editClientId, setEditClientId] = useState<string | undefined>(undefined);
    const [editSessionId, setEditSessionId] = useState<string | undefined>(undefined);
    const [pastSessions, setPastSessions] = useState<{ id: string; date: string; type: string; time: string }[]>([]);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; recording: Recording | null }>({ isOpen: false, recording: null });
    // Default to "history" for SSR, then update to "new" on mobile after hydration
    const [activeTab, setActiveTab] = useState("history");

    const [clients, setClients] = useState<{ id: string, name: string }[]>([]);
    const [calculatedDurations, setCalculatedDurations] = useState<Record<string, number>>({});

    // Set initial tab based on screen size after hydration - always "new" on mobile
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const isMobile = window.innerWidth < 768;
            if (isMobile) {
                setActiveTab("new");
            }
        }
    }, []);

    useEffect(() => {
        const clientParam = searchParams.get('client');
        if (clientParam) {
            setSelectedClient(clientParam);
            // Only switch to history if not on mobile (desktop only)
            if (typeof window !== 'undefined' && window.innerWidth >= 768) {
                setActiveTab("history");
            } else if (typeof window !== 'undefined' && window.innerWidth < 768) {
                // Keep "new" tab on mobile even when client param is present
                setActiveTab("new");
            }
        }
    }, [searchParams]);

    // Handle window resize to update tab on mobile/desktop switch
    useEffect(() => {
        const handleResize = () => {
            if (typeof window !== 'undefined') {
                if (window.innerWidth < 768 && activeTab === "history") {
                    // On mobile, default to "new" tab
                    setActiveTab("new");
                }
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [activeTab]);

    useEffect(() => {
        // Load immediately on mount
        loadRecordings();
        loadClients();

        // Reload when window gains focus
        const handleFocus = () => {
            loadRecordings();
            loadClients();
        };

        // Reload when recordings are updated (e.g. from VoiceNotes component)
        const handleUpdate = () => {
            loadRecordings();
            // Optionally switch to history tab to show new recording
            // setActiveTab("history"); 
        };

        window.addEventListener('focus', handleFocus);
        window.addEventListener('recordings-updated', handleUpdate);

        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('recordings-updated', handleUpdate);
        };
    }, []);

    const loadClients = async () => {
        try {
            console.log('[Recordings] Loading clients...');
            const response = await fetch('/api/clients');
            if (response.ok) {
                const data = await response.json();
                console.log('[Recordings] Loaded', data.length, 'clients');
                setClients(data);
            } else {
                console.error('[Recordings] Failed to load clients:', response.status);
            }
        } catch (error) {
            console.error('[Recordings] Error loading clients:', error);
        }
    };

    const loadRecordings = async () => {
        try {
            const response = await fetch('/api/recordings', {
                credentials: 'include', // Include cookies for authentication
            });
            
            console.log('[Recordings] Fetch response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('[Recordings] Received data:', { count: data.length, data });
                // Remove duplicates by ID (keep first occurrence)
                const uniqueRecordings: Recording[] = Array.from(
                    new Map((data as Recording[]).map((r: Recording) => [r.id, r])).values()
                );
                console.log(`[Recordings] Loaded ${data.length} recordings, ${uniqueRecordings.length} unique`);
                if (data.length !== uniqueRecordings.length) {
                    console.warn(`[Recordings] Found ${data.length - uniqueRecordings.length} duplicate recordings`);
                }
                setRecordings(uniqueRecordings);
                setRefreshKey(prev => prev + 1);
                
                // Calculate durations for recordings with duration 0
                uniqueRecordings.forEach(recording => {
                    if (recording.duration === 0 && recording.audioURL && !calculatedDurations[recording.id]) {
                        calculateDurationFromAudio(recording.id, recording.audioURL);
                    }
                });
            } else {
                const errorText = await response.text();
                console.error('[Recordings] Failed to load recordings:', response.status, errorText);
            }
        } catch (error) {
            console.error('Error loading recordings:', error);
        }
    };

    const calculateDurationFromAudio = async (recordingId: string, audioURL: string) => {
        try {
            const audio = new Audio(audioURL);
            await new Promise<void>((resolve) => {
                let resolved = false;
                const finish = () => {
                    if (!resolved) {
                        resolved = true;
                        resolve();
                    }
                };
                audio.onloadedmetadata = () => {
                    if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
                        const duration = Math.floor(audio.duration);
                        console.log(`[Recordings] Calculated duration for ${recordingId}:`, duration, 'seconds');
                        setCalculatedDurations(prev => ({ ...prev, [recordingId]: duration }));
                    }
                    finish();
                };
                audio.onerror = () => {
                    console.warn(`[Recordings] Could not load audio metadata for ${recordingId}`);
                    finish();
                };
                audio.load();
                setTimeout(() => {
                    if (!calculatedDurations[recordingId]) {
                        console.warn(`[Recordings] Duration calculation timeout for ${recordingId}`);
                    }
                    finish();
                }, 5000);
            });
        } catch (err) {
            console.warn(`[Recordings] Error calculating duration for ${recordingId}:`, err);
        }
    };

    const saveRecordings = async (updatedRecordings: Recording[]) => {
        setRecordings(updatedRecordings);
        try {
            await fetch('/api/recordings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedRecordings),
            });
        } catch (error) {
            console.error('Error saving recordings:', error);
        }
    };

    // Get unique client names for filter
    const clientNames = useMemo(() => {
        const names = recordings
            .map(r => r.clientName)
            .filter((name): name is string => !!name);
        return Array.from(new Set(names)).sort();
    }, [recordings]);

    // Filter and sort recordings
    const filteredAndSortedRecordings = useMemo(() => {
        let filtered = recordings;

        // Filter by search query (searches in transcript and client name)
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(r =>
                r.transcript?.toLowerCase().includes(query) ||
                r.clientName?.toLowerCase().includes(query)
            );
        }

        // Filter by client (case-insensitive, trimmed)
        if (selectedClient !== "all") {
            const normalizedSelected = selectedClient.trim().toLowerCase();
            filtered = filtered.filter(r => {
                // First try ID match if we have client_id
                if (r.client_id || r.clientId) {
                    // Would need client list to match by ID, so fall back to name
                }
                // Match by name (case-insensitive, trimmed)
                if (r.clientName) {
                    return r.clientName.trim().toLowerCase() === normalizedSelected;
                }
                return false;
            });
        }

        // Sort
        const sorted = [...filtered].sort((a, b) => {
            switch (sortBy) {
                case 'date-desc':
                    return new Date(b.date).getTime() - new Date(a.date).getTime();
                case 'date-asc':
                    return new Date(a.date).getTime() - new Date(b.date).getTime();
                case 'client-asc':
                    return (a.clientName || '').localeCompare(b.clientName || '');
                case 'client-desc':
                    return (b.clientName || '').localeCompare(a.clientName || '');
                case 'duration-desc':
                    return b.duration - a.duration;
                case 'duration-asc':
                    return a.duration - b.duration;
                default:
                    return 0;
            }
        });

        return sorted;
    }, [recordings, searchQuery, selectedClient, sortBy]);

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

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

    const handlePlay = (id: string) => {
        if (playingId === id) {
            setPlayingId(null);
        } else {
            setPlayingId(id);
        }
    };

    const handleDownload = (recording: Recording) => {
        const a = document.createElement('a');
        a.href = recording.audioURL;
        const fileName = recording.clientName
            ? `${recording.clientName}-${recording.date}.webm`
            : `recording-${recording.date}.webm`;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleDeleteClick = (recording: Recording) => {
        setDeleteConfirm({ isOpen: true, recording });
    };

    const handleDelete = async () => {
        if (!deleteConfirm.recording) return;

        try {
            const response = await fetch(`/api/recordings?id=${encodeURIComponent(deleteConfirm.recording.id)}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                // Remove from local state
                const updatedRecordings = recordings.filter(r => r.id !== deleteConfirm.recording!.id);
                setRecordings(updatedRecordings);
                setDeleteConfirm({ isOpen: false, recording: null });
            } else {
                const error = await response.json();
                console.error('Failed to delete recording:', error);
                alert(`Failed to delete recording: ${error.error || 'Unknown error'}`);
                // Reload from server to keep data consistent
                await loadRecordings();
            }
        } catch (error) {
            console.error('Error deleting recording:', error);
            alert(`Failed to delete recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
            await loadRecordings();
        }
    };

    const handleEditClient = async (recording: Recording) => {
        console.log('[Recordings] handleEditClient called for recording:', recording.id);
        console.log('[Recordings] Recording client info:', { clientName: recording.clientName, clientId: recording.clientId, client_id: recording.client_id });
        setEditingRecording(recording);
        setEditClientName(recording.clientName || "");
        setPastSessions([]); // Reset sessions first
        
        // Set clientId if available, otherwise find it by name
        const clientId = recording.client_id || recording.clientId;
        if (clientId) {
            setEditClientId(clientId);
            // Load past sessions for this client
            await loadPastSessionsForClient(clientId, recording.clientName);
        } else if (recording.clientName) {
            // Find client ID by name
            const client = clients.find(c => c.name === recording.clientName);
            if (client?.id) {
                setEditClientId(client.id);
                await loadPastSessionsForClient(client.id, recording.clientName);
            } else {
                console.log('[Recordings] Client not found by name, cannot load sessions');
                setEditClientId(undefined);
            }
        } else {
            console.log('[Recordings] No client info on recording, sessions will load when client is selected');
            setEditClientId(undefined);
        }
        
        // Set session_id if available
        setEditSessionId(recording.session_id || recording.sessionId || undefined);
    };
    
    const loadPastSessionsForClient = async (clientId: string, clientName?: string) => {
        console.log('[Recordings] ========== Loading past sessions ==========');
        console.log('[Recordings] Client ID:', clientId);
        console.log('[Recordings] Client Name:', clientName);
        console.log('[Recordings] Clients available:', clients.length);
        setIsLoadingSessions(true);
        try {
            const response = await fetch('/api/appointments');
            if (response.ok) {
                const appointments = await response.json();
                console.log('[Recordings] Total appointments from API:', appointments.length);
                const now = new Date();
                
                // Find client by ID or use the provided name
                const client = clients.find(c => c.id === clientId);
                const searchName = client?.name || clientName;
                console.log('[Recordings] Found client:', client ? client.name : 'NOT IN LIST');
                console.log('[Recordings] Searching for sessions with name:', searchName);
                
                if (!searchName) {
                    console.log('[Recordings] No client name to search, clearing sessions');
                    setPastSessions([]);
                    setIsLoadingSessions(false);
                    return;
                }
                
                // Log all appointments for debugging
                console.log('[Recordings] All appointments:', appointments.map((a: any) => ({
                    id: a.id,
                    clientName: a.clientName,
                    clientId: a.clientId || a.client_id,
                    date: a.date
                })));
                
                // Filter to past sessions for this client (match by client name or ID)
                const past = appointments
                    .filter((apt: any) => {
                        const aptDate = new Date(apt.date);
                        const isPast = aptDate < now;
                        // Match by client name OR client ID
                        const matchesClient = 
                            apt.clientName === searchName || 
                            apt.clientName?.toLowerCase() === searchName?.toLowerCase() ||
                            apt.clientId === clientId || 
                            apt.client_id === clientId;
                        console.log('[Recordings] Checking apt:', apt.id, 'clientName:', apt.clientName, 'matches:', matchesClient, 'isPast:', isPast);
                        return isPast && matchesClient;
                    })
                    .map((apt: any) => ({
                        id: apt.id,
                        date: apt.date,
                        type: apt.type || 'Session',
                        time: apt.time || new Date(apt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }))
                    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Most recent first
                setPastSessions(past);
                console.log('[Recordings] ✅ Loaded', past.length, 'past sessions for client', searchName);
            } else {
                console.error('[Recordings] Failed to fetch appointments:', response.status);
            }
        } catch (error) {
            console.error('[Recordings] Error loading past sessions:', error);
            setPastSessions([]);
        }
        setIsLoadingSessions(false);
    };

    const handleSaveClient = async () => {
        if (!editingRecording) return;

        // Find the selected client to get both name and ID
        const selectedClient = clients.find(c => c.name === editClientName.trim());
        const clientName = editClientName.trim() || selectedClient?.name;
        const clientId = selectedClient?.id || editClientId;
        
        // Regenerate structured notes with correct client if notes exist
        let updatedNotes = editingRecording.notes;
        if (editingRecording.notes && editingRecording.notes.length > 0 && editingRecording.transcript && clientName) {
            try {
                // Fetch therapist name - the therapist is the person whose FIRST and LAST names are in their profile
                let therapistName: string | undefined = undefined;
                const userResponse = await fetch('/api/auth/me');
                if (userResponse.ok) {
                    const userData = await userResponse.json() as { first_name?: string | null; last_name?: string | null; email?: string };
                    console.log('[Recordings] User data for therapist name:', { first_name: userData.first_name, last_name: userData.last_name, email: userData.email });
                    
                    // Build therapist name from first_name and last_name (even if one is null)
                    const nameParts: string[] = [];
                    if (userData.first_name && userData.first_name.trim()) {
                        nameParts.push(userData.first_name.trim());
                    }
                    if (userData.last_name && userData.last_name.trim()) {
                        nameParts.push(userData.last_name.trim());
                    }
                    
                    if (nameParts.length > 0) {
                        therapistName = nameParts.join(' ').trim();
                        console.log('[Recordings] Therapist name from profile:', therapistName);
                    } else if (userData.email) {
                        // Fallback: Extract from email if first_name/last_name are not available
                        const emailParts = userData.email.split('@')[0].split('.');
                        if (emailParts.length > 1) {
                            therapistName = emailParts.map(part => 
                                part.charAt(0).toUpperCase() + part.slice(1)
                            ).join(' ');
                        } else {
                            therapistName = emailParts[0].charAt(0).toUpperCase() + emailParts[0].slice(1);
                        }
                        console.log('[Recordings] Therapist name from email fallback:', therapistName);
                    }
                }
                
                // Regenerate structured notes with correct metadata
                const response = await fetch('/api/ai/process-transcript', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        transcript: editingRecording.transcript,
                        clientName: clientName,
                        therapistName,
                        sessionDate: editingRecording.date,
                        duration: editingRecording.duration
                    })
                });
                
                if (response.ok) {
                    const data = await response.json() as { structured?: string };
                    if (data.structured) {
                        // Update the notes with regenerated content
                        updatedNotes = [{ title: "Session Notes", content: data.structured }];
                    }
                }
            } catch (err) {
                console.warn('Could not regenerate structured notes:', err);
            }
        }
        
        const updatedRecordings = recordings.map(r =>
            r.id === editingRecording.id
                ? { 
                    ...r, 
                    clientName: clientName || undefined,
                    client_id: clientId || undefined,
                    clientId: clientId || undefined,
                    session_id: editSessionId || undefined,
                    sessionId: editSessionId || undefined,
                    notes: updatedNotes || r.notes
                }
                : r
        );
        
        // Persist the changes
        saveRecordings(updatedRecordings);
        // Notify other components (e.g., Clients page) that recordings have changed
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event('recordings-updated'));
        }
        setEditingRecording(null);
        setEditClientName("");
        setEditClientId(undefined);
    };

    const highlightText = (text: string, query: string) => {
        if (!query) return text;
        const parts = text.split(new RegExp(`(${query})`, 'gi'));
        return parts.map((part, i) =>
            part.toLowerCase() === query.toLowerCase() ? (
                <mark key={i} className="bg-yellow-200 dark:bg-yellow-800">{part}</mark>
            ) : (
                part
            )
        );
    };

    const getTranscriptPreview = (text: string, maxLength: number = 120) => {
        if (!text) return '';
        const firstLine = text.split('\n')[0].trim();
        const slice = firstLine.slice(0, maxLength).trimEnd();
        if (firstLine.length > maxLength) {
            return slice + '...';
        }
        return slice;
    };

    return (
        <TooltipProvider>
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-7xl">
                <div className="mb-8">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">Recording</h1>
                    <div className="text-sm sm:text-base text-muted-foreground space-y-1">
                        <p>Record Clinical Notes with AI transcription</p>
                        <p>Upload Session Recording for AI Clinical Analysis</p>
                    </div>
                </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                    <TabsTrigger value="new" className="gap-2">
                        <Mic className="h-4 w-4" />
                        New Recording
                    </TabsTrigger>
                    <TabsTrigger value="history" className="gap-2">
                        <List className="h-4 w-4" />
                        History
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="new" className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight">New Voice Recording / Upload Session Recording</h2>
                    </div>
                    <VoiceNotes />
                </TabsContent>

                <TabsContent value="history" className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight">Recording History</h2>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button onClick={loadRecordings} variant="outline" size="sm">
                                    Refresh List
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Refresh Recording List</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>

                    {/* Filters and Search */}
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Filter className="h-5 w-5 text-purple-500" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Filter & Search Options</p>
                                    </TooltipContent>
                                </Tooltip>
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
                                            placeholder="Search transcripts..."
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
                                            <SelectItem value="date-desc">Date (Newest First)</SelectItem>
                                            <SelectItem value="date-asc">Date (Oldest First)</SelectItem>
                                            <SelectItem value="client-asc">Client (A-Z)</SelectItem>
                                            <SelectItem value="client-desc">Client (Z-A)</SelectItem>
                                            <SelectItem value="duration-desc">Duration (Longest)</SelectItem>
                                            <SelectItem value="duration-asc">Duration (Shortest)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Results count */}
                            <div className="text-sm text-muted-foreground">
                                Showing {filteredAndSortedRecordings.length} of {recordings.length} recordings
                            </div>
                        </CardContent>
                    </Card>

                    {/* Recordings List */}
                    {recordings.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-16">
                                <FileAudio className="h-16 w-16 text-muted-foreground mb-4" />
                                <h3 className="text-xl font-semibold mb-2">No recordings yet</h3>
                                <p className="text-muted-foreground text-center max-w-md">
                                    Clinical Notes recordings will appear here. Switch to the "New Recording" tab to create Clinical Note
                                </p>
                                <Button className="mt-6" onClick={() => setActiveTab("new")}>
                                    Start Recording
                                </Button>
                            </CardContent>
                        </Card>
                    ) : filteredAndSortedRecordings.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-16">
                                <Search className="h-16 w-16 text-blue-500 mb-4" />
                                <h3 className="text-xl font-semibold mb-2">No matching recordings</h3>
                                <p className="text-muted-foreground text-center max-w-md">
                                    Try adjusting your search or filters
                                </p>
                                <Button
                                    className="mt-6"
                                    variant="outline"
                                    onClick={() => {
                                        setSearchQuery("");
                                        setSelectedClient("all");
                                    }}
                                >
                                    Clear Filters
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            <AnimatePresence>
                                {filteredAndSortedRecordings.map((recording, index) => (
                                    <motion.div
                                        key={`recording-${recording.id}-${index}`}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        transition={{ delay: index * 0.05 }}
                                    >
                                        <Card>
                                            <CardHeader>
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <CardTitle className="flex items-center gap-2">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <FileAudio className="h-5 w-5 text-primary" />
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>Audio Recording</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                            {(recording.clientId || recording.client_id) && recording.clientName ? (
                                                                <Link
                                                                    href={`/clients?highlight=${recording.clientId || recording.client_id}`}
                                                                    className="hover:underline text-primary"
                                                                >
                                                                    {recording.clientName}
                                                                </Link>
                                                            ) : (
                                                                recording.clientName || "Unassigned Session"
                                                            )}
                                                        </CardTitle>
                                                        <CardDescription className="flex items-center gap-4 mt-2 flex-wrap">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <span className="flex items-center gap-1">
                                                                        <Calendar className="h-4 w-4 text-blue-500" />
                                                                        {formatDate(recording.date)}
                                                                    </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>Recording Date & Time</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <span className="flex items-center gap-1">
                                                                        <Clock className="h-4 w-4 text-green-500" />
                                                                        {formatDuration(calculatedDurations[recording.id] || recording.duration)}
                                                                    </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>Duration: {formatDuration(calculatedDurations[recording.id] || recording.duration)}</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                            {/* Show recording type badge */}
                                                            {recording.notes && recording.notes.length > 0 && recording.notes.some(note => note.title === "AI-Structured Notes") ? (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium cursor-help">
                                                                            <Upload className="h-3 w-3" />
                                                                            Uploaded
                                                                        </span>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>Uploaded Audio File - Contains AI-Structured Notes</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            ) : (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium cursor-help">
                                                                            <Mic className="h-3 w-3" />
                                                                            Live Recording
                                                                        </span>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>Live Recording - Therapist's Voice Notes</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            )}
                                                        </CardDescription>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() => handleEditClient(recording)}
                                                                >
                                                                    <Edit className="h-4 w-4 text-blue-500" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>Assign Session</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() => handlePlay(recording.id)}
                                                                >
                                                                    {playingId === recording.id ? (
                                                                        <Pause className="h-4 w-4 text-green-500" />
                                                                    ) : (
                                                                        <Play className="h-4 w-4 text-green-500" />
                                                                    )}
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>{playingId === recording.id ? 'Pause' : 'Play'} Recording</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() => handleDownload(recording)}
                                                                >
                                                                    <Download className="h-4 w-4 text-purple-500" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>Download Recording</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() => handleDeleteClick(recording)}
                                                                >
                                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>Delete Recording</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                {(recording.transcript || (recording.notes && recording.notes.length > 0)) && (
                                                    <Accordion type="multiple" className="w-full">
                                                        {recording.transcript && (
                                                            <AccordionItem value="transcript">
                                                                <AccordionTrigger>
                                                                    <div className="flex flex-col items-start text-left gap-0.5">
                                                                        <span className="text-sm font-semibold">
                                                                            Transcript
                                                                        </span>
                                                                        <span className="text-xs text-muted-foreground truncate max-w-[260px]">
                                                                            {getTranscriptPreview(recording.transcript)}
                                                                        </span>
                                                                    </div>
                                                                </AccordionTrigger>
                                                                <AccordionContent>
                                                                    <div className="rounded-lg bg-muted/50 p-4">
                                                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                                                            {searchQuery
                                                                                ? highlightText(recording.transcript, searchQuery)
                                                                                : recording.transcript}
                                                                        </p>
                                                                    </div>
                                                                </AccordionContent>
                                                            </AccordionItem>
                                                        )}

                                                        {recording.notes && recording.notes.length > 0 && recording.notes.some(note => note.title === "AI-Structured Notes") && (
                                                            <AccordionItem value="ai-notes">
                                                                <AccordionTrigger>
                                                                    <div className="flex flex-col items-start text-left">
                                                                        <span className="text-sm font-semibold">AI-Structured Notes</span>
                                                                    </div>
                                                                </AccordionTrigger>
                                                                <AccordionContent>
                                                                    <div className="space-y-3">
                                                                        {recording.notes
                                                                            .filter(note => note.title === "AI-Structured Notes")
                                                                            .map((note, noteIndex) => (
                                                                                <div key={noteIndex} className="rounded-lg border border-primary/20 bg-card p-4">
                                                                                    <h5 className="text-sm font-semibold mb-2 text-primary">{note.title}</h5>
                                                                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                                                                        {note.content}
                                                                                    </p>
                                                                                </div>
                                                                            ))}
                                                                    </div>
                                                                </AccordionContent>
                                                            </AccordionItem>
                                                        )}
                                                    </Accordion>
                                                )}

                                                {playingId === recording.id && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                    >
                                                        <audio
                                                            controls
                                                            src={recording.audioURL}
                                                            className="w-full"
                                                            autoPlay
                                                        />
                                                    </motion.div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}

                    {/* Edit Client Dialog */}
                    <Dialog open={!!editingRecording} onOpenChange={(open: boolean) => {
                        if (!open) {
                            setEditingRecording(null);
                            setEditClientName("");
                            setEditClientId(undefined);
                            setEditSessionId(undefined);
                            setPastSessions([]);
                        }
                    }}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Assign Client & Session</DialogTitle>
                                <DialogDescription>
                                    Assign this recording to a client and optionally link it to a past session
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="client-name">Client Name *</Label>
                                    {clients.length > 0 ? (
                                        <Select 
                                            value={editClientName || undefined} 
                                            onValueChange={async (value) => {
                                                console.log('[Recordings] Client selected from dropdown:', value);
                                                setEditClientName(value);
                                                const selectedClient = clients.find(c => c.name === value);
                                                console.log('[Recordings] Found selected client:', selectedClient);
                                                if (selectedClient?.id) {
                                                    setEditClientId(selectedClient.id);
                                                    await loadPastSessionsForClient(selectedClient.id, value);
                                                } else {
                                                    setEditClientId(undefined);
                                                    setPastSessions([]);
                                                }
                                                // Clear session selection when client changes
                                                setEditSessionId(undefined);
                                            }}
                                        >
                                            <SelectTrigger id="client-name">
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
                                    ) : (
                                        <div className="space-y-2">
                                            <Input
                                                id="client-name"
                                                placeholder="Enter client name"
                                                value={editClientName}
                                                onChange={(e) => setEditClientName(e.target.value)}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                No clients found. <a href="/clients" className="text-primary hover:underline">Add a client</a> first or type a name.
                                            </p>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Session dropdown - always show when client is selected */}
                                {editClientName && (
                                    <div className="space-y-2">
                                        <Label htmlFor="session-select">Link to Past Session (Optional)</Label>
                                        {isLoadingSessions ? (
                                            <div className="text-sm text-muted-foreground p-2 border rounded">
                                                Loading sessions...
                                            </div>
                                        ) : pastSessions.length > 0 ? (
                                            <>
                                                <Select 
                                                    value={editSessionId || "none"} 
                                                    onValueChange={(value) => {
                                                        console.log('[Recordings] Session selected:', value);
                                                        setEditSessionId(value === "none" ? undefined : value);
                                                    }}
                                                >
                                                    <SelectTrigger id="session-select">
                                                        <SelectValue placeholder="Select a past session (optional)" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">No session (unlinked)</SelectItem>
                                                        {pastSessions.map(session => (
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
                                                    Linking to a session will show this recording in the client's Session Notes
                                                </p>
                                            </>
                                        ) : (
                                            <div className="text-xs text-amber-600 dark:text-amber-400 p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
                                                ⚠️ No past sessions found for this client. 
                                                <br />
                                                <span className="text-muted-foreground">Check that the client has sessions logged in their profile, or log a session first.</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => {
                                    setEditingRecording(null);
                                    setEditClientName("");
                                    setEditClientId(undefined);
                                    setEditSessionId(undefined);
                                    setPastSessions([]);
                                }}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSaveClient} disabled={!editClientName.trim()}>
                                    Save
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Delete Confirmation Dialog */}
                    <DeleteConfirmationDialog
                        open={deleteConfirm.isOpen}
                        onOpenChange={(open) => setDeleteConfirm({ isOpen: open, recording: deleteConfirm.recording })}
                        onConfirm={handleDelete}
                        title="Delete Recording"
                        description={
                            deleteConfirm.recording
                                ? `Are you sure you want to delete the recording from ${new Date(deleteConfirm.recording.date).toLocaleDateString()}${deleteConfirm.recording.clientName ? ` for ${deleteConfirm.recording.clientName}` : ''}? This will permanently remove the audio file and transcript. This action cannot be undone.`
                                : "Are you sure you want to delete this recording? This action cannot be undone."
                        }
                        itemName={deleteConfirm.recording ? `${deleteConfirm.recording.clientName || 'Unnamed'} - ${new Date(deleteConfirm.recording.date).toLocaleDateString()}` : undefined}
                    />
                </TabsContent>
            </Tabs>
            </div>
        </TooltipProvider>
    );
}

export default function RecordingsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <RecordingsContent />
        </Suspense>
    );
}
