"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
import { Play, Pause, Download, Trash2, FileAudio, Calendar, Clock, Search, Filter, User, SortAsc, SortDesc, Edit, Mic, List } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoiceNotes } from "@/components/voice-notes";

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
    const [refreshKey, setRefreshKey] = useState(0);
    const [activeTab, setActiveTab] = useState("history");

    const [clients, setClients] = useState<{ id: string, name: string }[]>([]);

    useEffect(() => {
        const clientParam = searchParams.get('client');
        if (clientParam) {
            setSelectedClient(clientParam);
            setActiveTab("history");
        }
    }, [searchParams]);

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
            const response = await fetch('/api/clients');
            if (response.ok) {
                const data = await response.json();
                setClients(data);
            }
        } catch (error) {
            console.error('Error loading clients:', error);
        }
    };

    const loadRecordings = async () => {
        try {
            const response = await fetch('/api/recordings');
            if (response.ok) {
                const data = await response.json();
                setRecordings(data);
                setRefreshKey(prev => prev + 1);
            }
        } catch (error) {
            console.error('Error loading recordings:', error);
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
        return date.toLocaleDateString('en-US', {
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

    const handleDelete = (id: string) => {
        const updatedRecordings = recordings.filter(r => r.id !== id);
        saveRecordings(updatedRecordings);
    };

    const handleEditClient = (recording: Recording) => {
        setEditingRecording(recording);
        setEditClientName(recording.clientName || "");
        // Set clientId if available, otherwise find it by name
        const clientId = recording.client_id || recording.clientId;
        if (clientId) {
            setEditClientId(clientId);
        } else if (recording.clientName) {
            // Find client ID by name
            const client = clients.find(c => c.name === recording.clientName);
            setEditClientId(client?.id);
        } else {
            setEditClientId(undefined);
        }
    };

    const handleSaveClient = () => {
        if (!editingRecording) return;

        // Find the selected client to get both name and ID
        const selectedClient = clients.find(c => c.name === editClientName.trim());
        
        const updatedRecordings = recordings.map(r =>
            r.id === editingRecording.id
                ? { 
                    ...r, 
                    clientName: editClientName.trim() || undefined,
                    client_id: selectedClient?.id || editClientId || undefined,
                    clientId: selectedClient?.id || editClientId || undefined
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

    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-7xl">
            <div className="mb-8">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">Voice Notes</h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                    Record new sessions or manage your past recordings
                </p>
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

                <TabsContent value="new" className="space-y-4">
                    <VoiceNotes />
                </TabsContent>

                <TabsContent value="history" className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight">Recording History</h2>
                        <Button onClick={loadRecordings} variant="outline" size="sm">
                            Refresh List
                        </Button>
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
                                    Your session recordings will appear here. Switch to the "New Recording" tab to create your first recording.
                                </p>
                                <Button className="mt-6" onClick={() => setActiveTab("new")}>
                                    Start Recording
                                </Button>
                            </CardContent>
                        </Card>
                    ) : filteredAndSortedRecordings.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-16">
                                <Search className="h-16 w-16 text-muted-foreground mb-4" />
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
                                        key={recording.id}
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
                                                            <FileAudio className="h-5 w-5 text-primary" />
                                                            {recording.clientName || "Unassigned Session"}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6"
                                                                onClick={() => handleEditClient(recording)}
                                                            >
                                                                <Edit className="h-3 w-3" />
                                                            </Button>
                                                        </CardTitle>
                                                        <CardDescription className="flex items-center gap-4 mt-2">
                                                            <span className="flex items-center gap-1">
                                                                <Calendar className="h-4 w-4" />
                                                                {formatDate(recording.date)}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="h-4 w-4" />
                                                                {formatDuration(recording.duration)}
                                                            </span>
                                                        </CardDescription>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => handlePlay(recording.id)}
                                                        >
                                                            {playingId === recording.id ? (
                                                                <Pause className="h-4 w-4" />
                                                            ) : (
                                                                <Play className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => handleDownload(recording)}
                                                        >
                                                            <Download className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => handleDelete(recording.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
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

                                                {recording.transcript && (
                                                    <div className="rounded-lg bg-muted/50 p-4">
                                                        <h4 className="text-sm font-semibold mb-2">Transcript:</h4>
                                                        <p className="text-sm text-muted-foreground">
                                                            {searchQuery
                                                                ? highlightText(recording.transcript, searchQuery)
                                                                : recording.transcript}
                                                        </p>
                                                    </div>
                                                )}

                                                {recording.notes && recording.notes.length > 0 && (
                                                    <div className="space-y-3">
                                                        <h4 className="text-sm font-semibold">AI-Structured Notes:</h4>
                                                        {recording.notes.map((note, noteIndex) => (
                                                            <div key={noteIndex} className="rounded-lg border border-primary/20 bg-card p-4">
                                                                <h5 className="text-sm font-semibold mb-2 text-primary">{note.title}</h5>
                                                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                                                    {note.content}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}

                    {/* Edit Client Dialog */}
                    <Dialog open={!!editingRecording} onOpenChange={(open: boolean) => !open && setEditingRecording(null)}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Assign Client</DialogTitle>
                                <DialogDescription>
                                    Assign this recording to a client for better organization
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="client-name">Client Name</Label>
                                    {clients.length > 0 ? (
                                        <Select value={editClientName || undefined} onValueChange={setEditClientName}>
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
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setEditingRecording(null)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSaveClient}>
                                    Save
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default function RecordingsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <RecordingsContent />
        </Suspense>
    );
}
