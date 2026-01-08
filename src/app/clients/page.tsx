"use client";

import { useState, useEffect, useMemo, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus, User, Mail, Phone, Calendar, FileText, Mic, Hash, Edit, Trash2, Upload, File, ExternalLink, Users, FileSpreadsheet, ChevronDown, ChevronRight, RotateCcw, Search, Filter, SortAsc, SortDesc, CheckCircle2, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientImportExport } from "@/components/client-import-export";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { GDPRDeleteDialog } from "@/components/ui/gdpr-delete-dialog";

interface Appointment {
    id: string;
    clientName: string;
    date: string;
    time: string;
    duration: number;
    type: string;
    status: string;
    notes: string;
    clinicalNotes?: string;
    attachments?: ClientDocument[];
}

interface ClientDocument {
    name: string;
    url: string;
    date: string;
}

interface ClientRelationship {
    relatedClientId: string;
    type: string;
}

interface Client {
    id: string;
    name: string; // Full name (combined first + last)
    firstName?: string;
    lastName?: string;
    email: string;
    phone: string;
    nextAppointment: string;
    notes: string;
    recordings: number; // Kept for type compatibility but ignored in UI
    sessions: number;
    sessionFee?: number; // Session fee amount
    currency?: 'EUR' | 'GBP' | 'USD' | 'AUD'; // Currency for session fee
    documents?: ClientDocument[];
    relationships?: ClientRelationship[];
    archived?: boolean; // Whether client is archived
    archivedAt?: string; // When client was archived
    createdAt?: string; // Date when client was added
    newClientFormSigned?: boolean; // Whether new client form has been signed
    // Extended personal/medical fields
    gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say';
    dateOfBirth?: string;
    mailingAddress?: string;
    preferredName?: string;
    emergencyContact?: {
        name: string;
        phone: string;
    };
    medicalConditions?: string;
    currentMedications?: string;
    doctorInfo?: {
        name: string;
        phone: string;
    };
}

interface ClientsPageProps {
    autoOpenAddDialog?: boolean;
}

function ClientsPageContent({ autoOpenAddDialog = false }: ClientsPageProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [clients, setClients] = useState<Client[]>([]);
    const [recordings, setRecordings] = useState<any[]>([]);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(autoOpenAddDialog);
    const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
    const [isDocumentsExpanded, setIsDocumentsExpanded] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [clientDialogTab, setClientDialogTab] = useState<'profile' | 'sessions'>('profile');
    const [scrollToFormCheckbox, setScrollToFormCheckbox] = useState(false);
    const formCheckboxRef = useRef<HTMLDivElement>(null);
    const [formData, setFormData] = useState<Partial<Client>>({
        name: "",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        nextAppointment: "",
        notes: "",
        sessions: 0,
        sessionFee: undefined, // Empty by default - will use standard fee from settings
        currency: 'EUR', // Default to Euros
        documents: [],
        relationships: [],
        gender: undefined,
        dateOfBirth: "",
        mailingAddress: "",
        preferredName: "",
        emergencyContact: { name: "", phone: "" },
        medicalConditions: "",
        currentMedications: "",
        doctorInfo: { name: "", phone: "" },
        newClientFormSigned: false,
    });

    // Reciprocal Relationship State
    const [reciprocalQueue, setReciprocalQueue] = useState<{ sourceId: string, targetId: string, sourceName: string, targetName: string, initialType: string }[]>([]);
    const [currentReciprocal, setCurrentReciprocal] = useState<{ sourceId: string, targetId: string, sourceName: string, targetName: string, initialType: string } | null>(null);
    const [reciprocalType, setReciprocalType] = useState("");

    // Map relationship types to their reciprocals
    const getReciprocalRelationshipType = (type: string): string => {
        const reciprocalMap: Record<string, string> = {
            "Mum": "Daughter",
            "Mother": "Daughter",
            "Dad": "Son",
            "Father": "Son",
            "Daughter": "Mum",
            "Son": "Dad",
            "Wife": "Husband",
            "Husband": "Wife",
            "Partner": "Partner",
            "Sister": "Sister",
            "Brother": "Brother",
            "Friend": "Friend",
            "Guardian": "Ward",
            "Ward": "Guardian",
        };
        return reciprocalMap[type] || type;
    };

    const [showBulkImport, setShowBulkImport] = useState(false);
    const [showSearch, setShowSearch] = useState(false); // Hidden by default
    const [searchQuery, setSearchQuery] = useState("");
    const [searchField, setSearchField] = useState<string>("all"); // "all", "name", "email", "phone", "dateAdded", etc.
    const [dateAddedFilter, setDateAddedFilter] = useState<{ from?: string; to?: string }>({});
    const [sortBy, setSortBy] = useState<string>("name-asc"); // "name-asc", "name-desc", "dateAdded-asc", "dateAdded-desc"
    
    // Selection state
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());

    // Comprehensive search and filter logic
    const filteredClients = useMemo(() => {
        let filtered = clients;

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(client => {
                // Search in all fields if "all" is selected
                if (searchField === "all") {
                    const searchableText = [
                        client.name || '',
                        client.firstName || '',
                        client.lastName || '',
                        client.email || '',
                        client.phone || '',
                        client.preferredName || '',
                        client.notes || '',
                        client.mailingAddress || '',
                        client.medicalConditions || '',
                        client.currentMedications || '',
                        client.emergencyContact?.name || '',
                        client.emergencyContact?.phone || '',
                        client.doctorInfo?.name || '',
                        client.doctorInfo?.phone || '',
                        client.dateOfBirth || '',
                        client.currency || '',
                        client.sessionFee?.toString() || '',
                        client.createdAt ? new Date(client.createdAt).toLocaleDateString() : '',
                    ].join(' ').toLowerCase();

                    return searchableText.includes(query);
                } else {
                    // Search in specific field
                    switch (searchField) {
                        case "firstName":
                            return (
                                (client.firstName || '').toLowerCase().includes(query) ||
                                (client.preferredName || '').toLowerCase().includes(query)
                            );
                        case "lastName":
                            return (client.lastName || '').toLowerCase().includes(query);
                        case "name":
                            return (
                                (client.name || '').toLowerCase().includes(query) ||
                                (client.firstName || '').toLowerCase().includes(query) ||
                                (client.lastName || '').toLowerCase().includes(query) ||
                                (client.preferredName || '').toLowerCase().includes(query)
                            );
                        case "email":
                            return (client.email || '').toLowerCase().includes(query);
                        case "phone":
                            return (
                                (client.phone || '').toLowerCase().includes(query) ||
                                (client.emergencyContact?.phone || '').toLowerCase().includes(query) ||
                                (client.doctorInfo?.phone || '').toLowerCase().includes(query)
                            );
                        case "notes":
                            return (client.notes || '').toLowerCase().includes(query);
                        case "dateOfBirth":
                            return (client.dateOfBirth || '').toLowerCase().includes(query);
                        case "address":
                            return (client.mailingAddress || '').toLowerCase().includes(query);
                        case "medical":
                            return (
                                (client.medicalConditions || '').toLowerCase().includes(query) ||
                                (client.currentMedications || '').toLowerCase().includes(query)
                            );
                        case "dateAdded":
                            if (client.createdAt) {
                                const dateStr = new Date(client.createdAt).toLocaleDateString().toLowerCase();
                                return dateStr.includes(query);
                            }
                            return false;
                        default:
                            return true;
                    }
                }
            });
        }

        // Filter by date added range
        if (dateAddedFilter.from || dateAddedFilter.to) {
            filtered = filtered.filter(client => {
                if (!client.createdAt) return false;
                const clientDate = new Date(client.createdAt);
                const fromDate = dateAddedFilter.from ? new Date(dateAddedFilter.from) : null;
                const toDate = dateAddedFilter.to ? new Date(dateAddedFilter.to) : null;

                if (fromDate && clientDate < fromDate) return false;
                if (toDate) {
                    // Include the entire day
                    const toDateEnd = new Date(toDate);
                    toDateEnd.setHours(23, 59, 59, 999);
                    if (clientDate > toDateEnd) return false;
                }
                return true;
            });
        }

        // Sort based on selected option
        const sorted = [...filtered].sort((a, b) => {
            switch (sortBy) {
                case "name-asc":
                    // Sort alphabetically by name (A-Z)
                    const nameA = (a.firstName && a.lastName) 
                        ? `${a.firstName} ${a.lastName}`.toLowerCase().trim()
                        : (a.name || '').toLowerCase().trim();
                    const nameB = (b.firstName && b.lastName)
                        ? `${b.firstName} ${b.lastName}`.toLowerCase().trim()
                        : (b.name || '').toLowerCase().trim();
                    return nameA.localeCompare(nameB);
                
                case "name-desc":
                    // Sort reverse alphabetically by name (Z-A)
                    const nameA_desc = (a.firstName && a.lastName) 
                        ? `${a.firstName} ${a.lastName}`.toLowerCase().trim()
                        : (a.name || '').toLowerCase().trim();
                    const nameB_desc = (b.firstName && b.lastName)
                        ? `${b.firstName} ${b.lastName}`.toLowerCase().trim()
                        : (b.name || '').toLowerCase().trim();
                    return nameB_desc.localeCompare(nameA_desc);
                
                case "dateAdded-asc":
                    // Sort by date added (oldest first)
                    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return dateA - dateB;
                
                case "dateAdded-desc":
                    // Sort by date added (newest first)
                    const dateA_desc = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const dateB_desc = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return dateB_desc - dateA_desc;
                
                case "firstName-asc":
                    // Sort by first name (A-Z)
                    const firstNameA = (a.firstName || a.name?.split(' ')[0] || '').toLowerCase().trim();
                    const firstNameB = (b.firstName || b.name?.split(' ')[0] || '').toLowerCase().trim();
                    return firstNameA.localeCompare(firstNameB);
                
                case "firstName-desc":
                    // Sort by first name (Z-A)
                    const firstNameA_desc = (a.firstName || a.name?.split(' ')[0] || '').toLowerCase().trim();
                    const firstNameB_desc = (b.firstName || b.name?.split(' ')[0] || '').toLowerCase().trim();
                    return firstNameB_desc.localeCompare(firstNameA_desc);
                
                case "lastName-asc":
                    // Sort by last name (A-Z)
                    const lastNameA = (a.lastName || a.name?.split(' ').slice(1).join(' ') || '').toLowerCase().trim();
                    const lastNameB = (b.lastName || b.name?.split(' ').slice(1).join(' ') || '').toLowerCase().trim();
                    return lastNameA.localeCompare(lastNameB);
                
                case "lastName-desc":
                    // Sort by last name (Z-A)
                    const lastNameA_desc = (a.lastName || a.name?.split(' ').slice(1).join(' ') || '').toLowerCase().trim();
                    const lastNameB_desc = (b.lastName || b.name?.split(' ').slice(1).join(' ') || '').toLowerCase().trim();
                    return lastNameB_desc.localeCompare(lastNameA_desc);
                
                default:
                    // Default to alphabetical
                    const nameA_default = (a.firstName && a.lastName) 
                        ? `${a.firstName} ${a.lastName}`.toLowerCase().trim()
                        : (a.name || '').toLowerCase().trim();
                    const nameB_default = (b.firstName && b.lastName)
                        ? `${b.firstName} ${b.lastName}`.toLowerCase().trim()
                        : (b.name || '').toLowerCase().trim();
                    return nameA_default.localeCompare(nameB_default);
            }
        });

        return sorted;
    }, [clients, searchQuery, searchField, dateAddedFilter, sortBy]);

    useEffect(() => {
        if (autoOpenAddDialog) {
            setIsAddDialogOpen(true);
        }
    }, [autoOpenAddDialog]);

    // Initial load of clients and recordings
    useEffect(() => {
        loadClients();
        loadRecordings();
    }, [activeTab]); // Reload when tab changes

    // Open client details if client query parameter is present
    useEffect(() => {
        const clientName = searchParams.get('client');
        if (clientName && clients.length > 0 && !editingClient) {
            const client = clients.find(c => c.name === clientName || c.name.toLowerCase() === clientName.toLowerCase());
            if (client) {
                setEditingClient(client);
                setFormData(client);
                setIsAddDialogOpen(true);
            }
        }
    }, [searchParams, clients, editingClient]);

    // Scroll to form checkbox when dialog opens and scrollToFormCheckbox is true
    useEffect(() => {
        if (scrollToFormCheckbox && isAddDialogOpen && formCheckboxRef.current && clientDialogTab === 'profile') {
            // Small delay to ensure dialog is fully rendered
            setTimeout(() => {
                formCheckboxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Focus the checkbox after scrolling
                const checkbox = formCheckboxRef.current?.querySelector('#newClientFormSigned') as HTMLElement;
                if (checkbox) {
                    setTimeout(() => checkbox.focus(), 100);
                }
                setScrollToFormCheckbox(false); // Reset after scrolling
            }, 300);
        }
    }, [scrollToFormCheckbox, isAddDialogOpen, clientDialogTab]);

    // Listen for updates from the recordings page
    useEffect(() => {
        const handleUpdate = () => {
            loadRecordings();
        };
        window.addEventListener('recordings-updated', handleUpdate);
        return () => {
            window.removeEventListener('recordings-updated', handleUpdate);
        };
    }, []);

    // Process Reciprocal Queue - Automatically open target client's details
    useEffect(() => {
        if (!currentReciprocal && reciprocalQueue.length > 0 && clients.length > 0) {
            const next = reciprocalQueue[0];
            setCurrentReciprocal(next);
            setReciprocalQueue(prev => prev.slice(1));
            
            // Find the target client and open their details
            const targetClient = clients.find(c => c.id === next.targetId);
            if (targetClient) {
                // Get the suggested reciprocal type
                const suggestedType = getReciprocalRelationshipType(next.initialType);
                setReciprocalType(suggestedType);
                
                // Open the target client's details dialog
                setEditingClient(targetClient);
                // Calculate actual values from appointments
                const actualSessions = getClientAppointments(targetClient.name).length;
                const nextApt = getNextAppointment(targetClient.name);
                setFormData({
                    ...targetClient,
                    sessions: actualSessions,
                    nextAppointment: nextApt ? new Date(nextApt.date).toISOString().slice(0, 16) : '',
                    // Pre-populate with the reciprocal relationship
                    relationships: [
                        ...(targetClient.relationships || []),
                        { relatedClientId: next.sourceId, type: suggestedType }
                    ]
                });
                setIsAddDialogOpen(true);
            }
        }
    }, [currentReciprocal, reciprocalQueue, clients]);

    const loadClients = async () => {
        try {
            console.log('[Clients Page] Loading clients...', { activeTab });
            
            // Load clients based on active tab with cache-busting and credentials
            const url = activeTab === 'archived' 
                ? `/api/clients?archived=true&t=${Date.now()}` 
                : `/api/clients?t=${Date.now()}`;
            const response = await fetch(url, {
                credentials: 'include',
            });
            const data = response.ok ? await response.json() : [];
            
            console.log(`[Clients Page] ${activeTab === 'archived' ? 'Archived' : 'Active'} clients:`, data.length);
            setClients(data);
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
            }
        } catch (error) {
            console.error('Error loading recordings:', error);
        }
    };

    const getRecordingCount = (clientName: string) => {
        // Find the client by name to get their ID
        const client = clients.find(c => c.name === clientName);
        if (!client) return 0;

        // Normalize names for case-insensitive matching
        const normalizedClientName = clientName.trim().toLowerCase();

        // Filter recordings by:
        // 1. client_id or clientId matching client.id (from database) - PRIMARY METHOD
        // 2. clientName matching (case-insensitive, trimmed) - FALLBACK ONLY
        const count = recordings.filter(r => {
            // Primary: Match by ID (most reliable)
            if (r.client_id === client.id || r.clientId === client.id) {
                return true;
            }
            // Fallback: Match by name (case-insensitive, trimmed)
            if (r.clientName) {
                const normalizedRecordingName = r.clientName.trim().toLowerCase();
                return normalizedRecordingName === normalizedClientName;
            }
            return false;
        }).length;
        
        return count;
    };

    const getClientName = (id: string) => {
        return clients.find(c => c.id === id)?.name || "Unknown Client";
    };

    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [syncingNextAppointment, setSyncingNextAppointment] = useState<string | null>(null);
    
    // NEW: Check if a client's nextAppointment has a corresponding session
    const hasSessionForNextAppointment = (client: Client): boolean => {
        if (!client.nextAppointment) return false;
        try {
            const nextDate = new Date(client.nextAppointment);
            const nextDateStr = nextDate.toISOString().split('T')[0]; // Date only
            
            return appointments.some(apt => {
                // Match by client name (API only returns clientName, not client_id)
                const matchesClient = apt.clientName === client.name;
                
                if (!matchesClient) return false;
                
                const aptDate = new Date(apt.date);
                const aptDateStr = aptDate.toISOString().split('T')[0]; // Date only
                
                // Compare dates (ignore time for matching)
                return aptDateStr === nextDateStr;
            });
        } catch {
            return false;
        }
    };
    
    // NEW: Sync nextAppointment to session manually
    const handleSyncNextAppointment = async (clientId: string) => {
        setSyncingNextAppointment(clientId);
        try {
            // Get the nextAppointment from formData if editing, or from client if viewing
            const client = editingClient || clients.find(c => c.id === clientId);
            const nextAppointmentToSync = formData.nextAppointment || client?.nextAppointment;
            
            const response = await fetch('/api/appointments/sync-next', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    clientId,
                    nextAppointment: nextAppointmentToSync // Pass the current formData value
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                // Always reload appointments to sync UI state
                await loadAppointments();
                
                if (data.created) {
                    alert(`Session created successfully for ${data.message || 'this client'}`);
                } else {
                    // Session already exists - provide more helpful message
                    const message = data.existingDate 
                        ? `Session already exists for this date (${new Date(data.existingDate).toLocaleString()})`
                        : data.message || 'Session already exists or no nextAppointment set';
                    alert(message);
                }
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Failed to sync' }));
                alert(errorData.error || 'Failed to sync nextAppointment to session');
            }
        } catch (error) {
            console.error('Error syncing nextAppointment:', error);
            alert('Error syncing nextAppointment to session');
        } finally {
            setSyncingNextAppointment(null);
        }
    };
    
    const [activeSession, setActiveSession] = useState<Appointment | null>(null);
    const [sessionDialogTab, setSessionDialogTab] = useState<"notes" | "attachments">("notes");
    const [sessionNotes, setSessionNotes] = useState<any[]>([]);
    const [isLoadingSessionNotes, setIsLoadingSessionNotes] = useState(false);

    // Log Past Session State
    const [isLogSessionDialogOpen, setIsLogSessionDialogOpen] = useState(false);
    const [logSessionData, setLogSessionData] = useState({
        date: new Date().toISOString().split('T')[0],
        time: "12:00",
        duration: 50,
        type: "Therapy Session",
        notes: ""
    });

    const handleLogSession = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingClient) return;

        const newAppointment: Appointment = {
            id: `apt-${Date.now()}`,
            clientName: editingClient.name,
            date: logSessionData.date,
            time: logSessionData.time,
            duration: logSessionData.duration,
            type: logSessionData.type,
            status: "confirmed", // Past sessions are confirmed by default
            notes: logSessionData.notes,
            clinicalNotes: "",
            attachments: []
        };

        const updatedAppointments = [...appointments, newAppointment];
        setAppointments(updatedAppointments);

        try {
            await fetch('/api/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedAppointments),
            });
            setIsLogSessionDialogOpen(false);
            // Reset form
            setLogSessionData({
                date: new Date().toISOString().split('T')[0],
                time: "12:00",
                duration: 50,
                type: "Therapy Session",
                notes: ""
            });
        } catch (error) {
            console.error('Error logging session:', error);
        }
    };

    const handleOpenSession = async (session: Appointment, tab: "notes" | "attachments") => {
        setActiveSession(session);
        setSessionDialogTab(tab);
        if (tab === "notes") {
            await loadSessionNotes(session.id);
        }
    };

    // Handle highlight and session query parameters (from session-notes page)
    useEffect(() => {
        const highlightClientId = searchParams.get('highlight');
        const sessionId = searchParams.get('session');
        
        if (highlightClientId && clients.length > 0) {
            const client = clients.find(c => c.id === highlightClientId);
            if (client) {
                console.log('[Clients] Highlighting client from session-notes:', client.name);
                setEditingClient(client);
                setFormData(client);
                setIsAddDialogOpen(true);
                
                // If session ID is provided, find and open that session
                if (sessionId && appointments.length > 0) {
                    const session = appointments.find(apt => apt.id === sessionId);
                    if (session) {
                        console.log('[Clients] Opening session:', session.id, session.date);
                        // Open the session notes dialog after a short delay to allow client dialog to render
                        setTimeout(() => {
                            handleOpenSession(session, "notes");
                        }, 500);
                    } else {
                        console.log('[Clients] Session not found:', sessionId);
                    }
                }
                
                // Clear URL parameters after handling
                router.replace('/clients');
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, clients, appointments]);

    const loadSessionNotes = async (sessionId: string) => {
        setIsLoadingSessionNotes(true);
        try {
            const response = await fetch('/api/session-notes');
            if (response.ok) {
                const allNotes = await response.json();
                
                // Get the active session to match by client and date
                const session = appointments.find(apt => apt.id === sessionId);
                if (!session) {
                    setSessionNotes([]);
                    return;
                }

                // Filter notes for this specific session
                const notesForSession = allNotes.filter((note: any) => {
                    // For session notes: match by session_id first
                    if (note.session_id === sessionId || note.sessionId === sessionId) {
                        return true;
                    }
                    
                    // Also match by client ID and date for session notes
                    const noteClientId = note.clientId || note.client_id;
                    const sessionClientId = editingClient?.id;
                    const sessionDate = new Date(session.date).toISOString().split('T')[0];
                    const noteDate = note.sessionDate ? new Date(note.sessionDate).toISOString().split('T')[0] : null;
                    
                    // Match session notes by client ID and date
                    if (note.source === 'session_note' || !note.source) {
                        // Match by client ID and date
                        if (noteClientId && sessionClientId && noteClientId === sessionClientId && noteDate === sessionDate) {
                            return true;
                        }
                        
                        // Fallback: match by client name and date
                        if (note.clientName && session.clientName && 
                            note.clientName.toLowerCase() === session.clientName.toLowerCase() &&
                            noteDate === sessionDate) {
                            return true;
                        }
                    }
                    
                    // For recordings: ONLY match by session_id - recordings must be explicitly linked to a session
                    if (note.source === 'recording') {
                        // Only show recording if it's explicitly linked to THIS session
                        if (note.sessionId === sessionId || note.session_id === sessionId) {
                            console.log('[Load Session Notes] Recording matched by session_id:', note.id);
                            return true;
                        }
                        
                        // Don't show recordings that aren't linked to this specific session
                        // (They will appear in the Recordings page instead)
                        return false;
                    }
                    
                    return false;
                });
                
                console.log(`[Load Session Notes] Session ID: ${sessionId}, Client: ${session.clientName}, Client ID: ${editingClient?.id}`);
                console.log(`[Load Session Notes] Total notes available: ${allNotes.length}`);
                console.log(`[Load Session Notes] Notes for this client:`, allNotes.filter((n: any) => {
                    const noteClientId = n.clientId || n.client_id;
                    return noteClientId === editingClient?.id || n.clientName?.toLowerCase() === session.clientName?.toLowerCase();
                }));
                console.log(`[Load Session Notes] Found ${notesForSession.length} notes for session ${sessionId} (client: ${session.clientName})`);
                console.log(`[Load Session Notes] Matched notes:`, notesForSession);
                
                // Deduplicate notes by content and timestamp to prevent showing the same voice note twice
                // This can happen if the same recording exists in both recordings and session_notes tables
                const seenContentKeys = new Set<string>();
                const deduplicatedNotes = notesForSession.filter((note: any) => {
                    // Filter out empty notes (no content, no transcript, and no audioURL)
                    // These are likely failed recordings or orphaned entries
                    const hasContent = note.content && note.content.trim() !== '';
                    const hasTranscript = note.transcript && note.transcript.trim() !== '';
                    const hasAudio = note.audioURL;
                    
                    // If note has no meaningful content, exclude it (unless it's a session placeholder with content)
                    if (!hasContent && !hasTranscript && !hasAudio) {
                        // Allow session placeholders that have content (even if it's just session info)
                        if (note.source === 'session' && note.content && note.content.trim() !== '') {
                            // Keep session placeholders
                        } else {
                            console.log('[Load Session Notes] Filtering out empty note:', note.id, note.source);
                            return false;
                        }
                    }
                    
                    // Create a key from content + creation timestamp (rounded to the minute to handle slight differences)
                    const content = (note.content || note.transcript || '').trim().substring(0, 200);
                    const timestamp = note.createdDate || note.created_at || '';
                    const dateKey = timestamp ? new Date(timestamp).toISOString().substring(0, 16) : ''; // Round to minute
                    const key = `${content}-${dateKey}`;
                    
                    if (seenContentKeys.has(key)) {
                        console.log('[Load Session Notes] Removing duplicate note:', note.id);
                        return false;
                    }
                    seenContentKeys.add(key);
                    return true;
                });
                
                if (deduplicatedNotes.length !== notesForSession.length) {
                    console.log(`[Load Session Notes] Removed ${notesForSession.length - deduplicatedNotes.length} duplicate notes`);
                }
                
                setSessionNotes(deduplicatedNotes);
            }
        } catch (error) {
            console.error('Error loading session notes:', error);
        } finally {
            setIsLoadingSessionNotes(false);
        }
    };

    const saveActiveSession = async () => {
        if (!activeSession) return;

        const updatedAppointments = appointments.map(apt =>
            apt.id === activeSession.id ? activeSession : apt
        );

        setAppointments(updatedAppointments);

        try {
            await fetch('/api/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedAppointments),
            });
            setActiveSession(null);
        } catch (error) {
            console.error('Error saving session:', error);
        }
    };

    const handleSessionFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeSession) return;

        const uploadFormData = new FormData();
        uploadFormData.append('file', file);

        try {
            const response = await fetch('/api/documents', {
                method: 'POST',
                body: uploadFormData,
            });

            if (response.ok) {
                const data = await response.json();
                const newDoc: ClientDocument = {
                    name: data.originalName,
                    url: data.url,
                    date: new Date().toISOString(),
                };

                setActiveSession(prev => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        attachments: [...(prev.attachments || []), newDoc]
                    };
                });
            }
        } catch (error) {
            console.error('Error uploading document:', error);
        }
    };

    const handleRemoveSessionDocumentClick = (index: number) => {
        setDeleteSessionDocConfirm({ isOpen: true, index });
    };

    const confirmRemoveSessionDocument = () => {
        if (deleteSessionDocConfirm.index !== null) {
            setActiveSession(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    attachments: prev.attachments?.filter((_, i) => i !== deleteSessionDocConfirm.index) || []
                };
            });
            setDeleteSessionDocConfirm({ isOpen: false, index: null });
        }
    };

    const removeSessionDocument = (index: number) => {
        setActiveSession(prev => {
            if (!prev) return null;
            return {
                ...prev,
                attachments: prev.attachments?.filter((_, i) => i !== index) || []
            };
        });
    };

    useEffect(() => {
        loadAppointments();
    }, []);

    // Update form data when appointments change (to refresh calculated values)
    useEffect(() => {
        if (editingClient) {
            const actualSessions = getClientAppointments(editingClient.name).length;
            const nextApt = getNextAppointment(editingClient.name);
            setFormData(prev => ({
                ...prev,
                sessions: actualSessions,
                nextAppointment: nextApt ? new Date(nextApt.date).toISOString().slice(0, 16) : ''
            }));
        }
    }, [appointments, editingClient]);

    // Note: Sessions count is now user-editable and won't be auto-updated from appointments
    // Users can manually set the total number of sessions if needed

    const loadAppointments = async () => {
        try {
            const response = await fetch('/api/appointments');
            if (response.ok) {
                const data = await response.json();
                setAppointments(data);
            }
        } catch (error) {
            console.error('Error loading appointments:', error);
        }
    };

    const getClientAppointments = (clientName: string) => {
        if (!clientName) return [];
        // Normalize names for case-insensitive matching
        const normalizedClientName = clientName.trim().toLowerCase();
        return appointments
            .filter(apt => {
                if (!apt.clientName) return false;
                const normalizedAptName = apt.clientName.trim().toLowerCase();
                return normalizedAptName === normalizedClientName;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };

    const getLastAppointment = (clientName: string) => {
        const clientAppointments = getClientAppointments(clientName);
        if (clientAppointments.length === 0) return null;
        
        const now = new Date();
        // Filter to only past appointments and sort by date (newest first)
        const pastAppointments = clientAppointments
            .filter(apt => {
                const aptDate = new Date(apt.date);
                return aptDate < now; // Only appointments that have already passed
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        if (pastAppointments.length === 0) return null;
        // Return the most recent past appointment
        return pastAppointments[0];
    };

    const getNextAppointment = (clientName: string) => {
        if (!clientName) return null;
        const now = new Date();
        const normalizedClientName = clientName.trim().toLowerCase();
        
        // Get all future appointments for this client
        const futureAppointments = appointments
            .filter(apt => {
                const normalizedAptName = (apt.clientName || '').trim().toLowerCase();
                if (normalizedAptName !== normalizedClientName) return false;
                
                const aptDate = new Date(apt.date);
                return aptDate > now; // Only future appointments
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort by date ascending
        
        return futureAppointments.length > 0 ? futureAppointments[0] : null;
    };

    const getClientRelationships = (client: Client) => {
        if (!client.relationships || client.relationships.length === 0) return [];
        return client.relationships.map(rel => {
            const relatedClient = clients.find(c => c.id === rel.relatedClientId);
            // Display the reciprocal: stored type is "what I am to them", 
            // display should show "what they are to me"
            const displayType = getReciprocalRelationshipType(rel.type);
            return {
                ...rel,
                type: displayType,
                relatedClientName: relatedClient?.name || "Unknown"
            };
        });
    };

    const saveClients = async (updatedClients: Client[]) => {
        setClients(updatedClients);
        try {
            await fetch('/api/clients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedClients),
            });
        } catch (error) {
            console.error('Error saving clients:', error);
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
                const newDoc: ClientDocument = {
                    name: data.originalName,
                    url: data.url,
                    date: new Date().toISOString(),
                };

                setFormData(prev => ({
                    ...prev,
                    documents: [...(prev.documents || []), newDoc]
                }));
            }
        } catch (error) {
            console.error('Error uploading document:', error);
        }
    };

    const handleRemoveDocumentClick = (index: number) => {
        setDeleteDocumentConfirm({ isOpen: true, index });
    };

    const confirmRemoveDocument = () => {
        if (deleteDocumentConfirm.index !== null) {
            const updatedDocuments = formData.documents?.filter((_, i) => i !== deleteDocumentConfirm.index) || [];
            setFormData(prev => ({
                ...prev,
                documents: updatedDocuments
            }));
            
            // Also update the clients array immediately so the counter updates on the card
            if (editingClient) {
                const updatedClients = clients.map(c =>
                    c.id === editingClient.id
                        ? { ...c, documents: updatedDocuments }
                        : c
                );
                setClients(updatedClients);
            }
            
            setDeleteDocumentConfirm({ isOpen: false, index: null });
        }
    };

    const removeDocument = (index: number) => {
        setFormData(prev => ({
            ...prev,
            documents: prev.documents?.filter((_, i) => i !== index) || []
        }));
    };

    const addRelationship = () => {
        setFormData(prev => ({
            ...prev,
            relationships: [...(prev.relationships || []), { relatedClientId: "", type: "" }]
        }));
    };

    const updateRelationship = (index: number, field: keyof ClientRelationship, value: string) => {
        setFormData(prev => {
            const newrels = [...(prev.relationships || [])];
            newrels[index] = { ...newrels[index], [field]: value };
            return { ...prev, relationships: newrels };
        });
    };

    const handleRemoveRelationshipClick = (index: number) => {
        setDeleteRelationshipConfirm({ isOpen: true, index });
    };

    const confirmRemoveRelationship = () => {
        if (deleteRelationshipConfirm.index !== null) {
            setFormData(prev => ({
                ...prev,
                relationships: prev.relationships?.filter((_, i) => i !== deleteRelationshipConfirm.index) || []
            }));
            setDeleteRelationshipConfirm({ isOpen: false, index: null });
        }
    };

    const removeRelationship = (index: number) => {
        setFormData(prev => ({
            ...prev,
            relationships: prev.relationships?.filter((_, i) => i !== index) || []
        }));
    };

    const handleReciprocalSubmit = () => {
        if (!currentReciprocal) return;

        const updatedClients = clients.map(c => {
            if (c.id === currentReciprocal.targetId) {
                const existingRels = c.relationships || [];
                // Check if relationship already exists to avoid duplicates
                if (!existingRels.some(r => r.relatedClientId === currentReciprocal.sourceId)) {
                    return {
                        ...c,
                        relationships: [...existingRels, { relatedClientId: currentReciprocal.sourceId, type: reciprocalType }]
                    };
                }
            }
            return c;
        });

        saveClients(updatedClients);
        setCurrentReciprocal(null);
    };

    const handleReciprocalSkip = () => {
        setCurrentReciprocal(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        let savedClient: Client;
        let updatedClientsList: Client[];

        if (editingClient) {
            // Update existing client
            const combinedName = `${formData.firstName || ''} ${formData.lastName || ''}`.trim();
            // Only include sessionFee if it's a valid positive number, otherwise set to undefined
            const sessionFeeToSave = (formData.sessionFee && formData.sessionFee > 0) ? formData.sessionFee : undefined;
            savedClient = { ...editingClient, ...formData, name: combinedName, sessionFee: sessionFeeToSave } as Client;
            updatedClientsList = clients.map(c =>
                c.id === editingClient.id ? savedClient : c
            );
        } else {
            // Add new client
            // Only include sessionFee if it's a valid positive number, otherwise set to undefined
            const sessionFeeToSave = (formData.sessionFee && formData.sessionFee > 0) ? formData.sessionFee : undefined;
            savedClient = {
                id: Date.now().toString(),
                firstName: formData.firstName || "",
                lastName: formData.lastName || "",
                name: `${formData.firstName || ''} ${formData.lastName || ''}`.trim(),
                email: formData.email || "",
                phone: formData.phone || "",
                nextAppointment: formData.nextAppointment || "",
                notes: formData.notes || "",
                recordings: 0, // Legacy field
                sessions: formData.sessions || 0,
                sessionFee: sessionFeeToSave,
                currency: formData.currency || 'EUR',
                documents: formData.documents || [],
                relationships: formData.relationships || [],
                gender: formData.gender,
                dateOfBirth: formData.dateOfBirth || "",
                mailingAddress: formData.mailingAddress || "",
                preferredName: formData.preferredName || "",
                emergencyContact: formData.emergencyContact || { name: "", phone: "" },
                medicalConditions: formData.medicalConditions || "",
                currentMedications: formData.currentMedications || "",
                doctorInfo: formData.doctorInfo || { name: "", phone: "" },
                newClientFormSigned: formData.newClientFormSigned || false,
            };
            updatedClientsList = [...clients, savedClient];
        }

        await saveClients(updatedClientsList);
        
        // NEW: Automatically create session if nextAppointment is set
        if (savedClient.nextAppointment) {
            try {
                const syncResponse = await fetch('/api/appointments/sync-next', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        clientId: savedClient.id,
                        nextAppointment: savedClient.nextAppointment // Pass the value to ensure it's used
                    })
                });
                if (syncResponse.ok) {
                    const syncData = await syncResponse.json();
                    if (syncData.created) {
                        console.log(`[Client Save] ✅ Automatically created session for ${savedClient.name} from nextAppointment`);
                        // Reload appointments to show the new session
                        await loadAppointments();
                        // Trigger a custom event to notify other components (like schedule) to reload
                        window.dispatchEvent(new CustomEvent('appointments-updated'));
                    } else if (syncData.message && syncData.message.includes('already exists')) {
                        console.log(`[Client Save] ℹ️ Session already exists for ${savedClient.name}`);
                        // Still reload to sync UI state
                        await loadAppointments();
                        window.dispatchEvent(new CustomEvent('appointments-updated'));
                    }
                }
            } catch (error) {
                console.error('[Client Save] Error automatically syncing nextAppointment to session:', error);
                // Don't block save if sync fails
            }
        }
        
        // Check for missing reciprocal relationships BEFORE closing dialog
        const newQueue: typeof reciprocalQueue = [];
        if (savedClient.relationships) {
            savedClient.relationships.forEach(rel => {
                const targetClient = updatedClientsList.find(c => c.id === rel.relatedClientId);
                if (targetClient) {
                    const targetHasRel = targetClient.relationships?.some(r => r.relatedClientId === savedClient.id);
                    if (!targetHasRel) {
                        newQueue.push({
                            sourceId: savedClient.id,
                            targetId: targetClient.id,
                            sourceName: savedClient.name,
                            targetName: targetClient.name,
                            initialType: rel.type
                        });
                    }
                }
            });
        }

        // If there are reciprocal relationships needed, open the first target client's details
        if (newQueue.length > 0) {
            const firstReciprocal = newQueue[0];
            const targetClient = updatedClientsList.find(c => c.id === firstReciprocal.targetId);
            if (targetClient) {
                // Close current dialog
                setEditingClient(null);
                setIsAddDialogOpen(false);
                
                // Get suggested reciprocal type
                const suggestedType = getReciprocalRelationshipType(firstReciprocal.initialType);
                
                // Open target client's details with relationship pre-filled
                setTimeout(() => {
                    setEditingClient(targetClient);
                    setFormData({
                        ...targetClient,
                        relationships: [
                            ...(targetClient.relationships || []),
                            { relatedClientId: firstReciprocal.sourceId, type: suggestedType }
                        ]
                    });
                    setIsAddDialogOpen(true);
                    
                    // Add remaining to queue if any
                    if (newQueue.length > 1) {
                        setReciprocalQueue(newQueue.slice(1));
                    }
                }, 100);
                return; // Exit early, don't reset form yet
            }
        }

        // No reciprocal relationships needed, proceed normally
        setEditingClient(null);

        // Reset form
        setFormData({
            name: "",
            email: "",
            phone: "",
            nextAppointment: "",
            notes: "",
            sessions: 0,
            sessionFee: undefined, // Empty by default - will use standard fee from settings
            currency: 'EUR', // Default to Euros
            documents: [],
            relationships: [],
            gender: undefined,
            dateOfBirth: "",
            mailingAddress: "",
            preferredName: "",
            emergencyContact: { name: "", phone: "" },
            medicalConditions: "",
            currentMedications: "",
            doctorInfo: { name: "", phone: "" },
            newClientFormSigned: false,
        });
        setIsAddDialogOpen(false);
    };

    const handleEdit = (client: Client, tab: 'profile' | 'sessions' = 'profile', scrollToForm: boolean = false) => {
        // Don't open modal for archived clients when viewing archived tab
        if (activeTab === 'archived') {
            return; // Archived clients are view-only in the archived tab
        }
        setEditingClient(client);
        setClientDialogTab(tab);
        setScrollToFormCheckbox(scrollToForm);
        // Calculate actual values from appointments
        const actualSessions = getClientAppointments(client.name).length;
        const nextApt = getNextAppointment(client.name);
        setFormData({
            ...client,
            sessions: actualSessions,
            nextAppointment: nextApt ? new Date(nextApt.date).toISOString().slice(0, 16) : ''
        });
        setIsAddDialogOpen(true);
    };

    const handleToggleFormSigned = async (clientId: string, currentStatus: boolean) => {
        const newStatus = !currentStatus;
        try {
            const response = await fetch('/api/clients/toggle-form-signed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId, signed: newStatus })
            });

            if (response.ok) {
                // Update local state
                setClients(clients.map(c => 
                    c.id === clientId ? { ...c, newClientFormSigned: newStatus } : c
                ));
            } else {
                console.error('Failed to update form status');
                alert('Failed to update form status. Please try again.');
            }
        } catch (error) {
            console.error('Error toggling form status:', error);
            alert('Error updating form status. Please try again.');
        }
    };

    const handleBulkMarkFormsSigned = async () => {
        const unsignedCount = clients.filter(c => !c.newClientFormSigned && !c.archived).length;
        
        if (unsignedCount === 0) {
            alert('All clients already have their forms signed!');
            return;
        }

        const confirmMessage = `Are you sure you want to mark ${unsignedCount} client${unsignedCount > 1 ? 's' : ''} as having their New Client Form signed? This will also deactivate any related reminders.`;
        
        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            const response = await fetch('/api/clients/bulk-mark-forms-signed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });

            const data = await response.json();

            if (response.ok) {
                // Reload clients to reflect the changes
                await loadClients();
                alert(data.message || `Successfully marked ${data.updated || unsignedCount} client${(data.updated || unsignedCount) > 1 ? 's' : ''} as having forms signed.`);
            } else {
                alert(data.error || 'Failed to update clients. Please try again.');
            }
        } catch (error) {
            console.error('Error bulk marking forms as signed:', error);
            alert('Error updating clients. Please try again.');
        }
    };

    const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean, clientId: string | null, action: 'archive' | 'delete' | null }>({ isOpen: false, clientId: null, action: null });
    const [gdprDeleteOpen, setGdprDeleteOpen] = useState(false);
    const [gdprDeleteClientId, setGdprDeleteClientId] = useState<string | null>(null);
    const [deleteDocumentConfirm, setDeleteDocumentConfirm] = useState<{ isOpen: boolean, index: number | null }>({ isOpen: false, index: null });
    const [deleteRelationshipConfirm, setDeleteRelationshipConfirm] = useState<{ isOpen: boolean, index: number | null }>({ isOpen: false, index: null });
    const [deleteSessionDocConfirm, setDeleteSessionDocConfirm] = useState<{ isOpen: boolean, index: number | null }>({ isOpen: false, index: null });

    // Check if client has session notes or recordings
    const clientHasSessionData = async (clientId: string): Promise<boolean> => {
        try {
            // Check session notes
            const notesResponse = await fetch('/api/session-notes');
            if (notesResponse.ok) {
                const notes = await notesResponse.json();
                const client = clients.find(c => c.id === clientId);
                if (client) {
                    const hasNotes = notes.some((note: any) => 
                        note.clientId === clientId || 
                        note.client_id === clientId ||
                        note.clientName?.toLowerCase() === client.name?.toLowerCase()
                    );
                    if (hasNotes) return true;
                }
            }

            // Check recordings
            const recordingsResponse = await fetch('/api/recordings');
            if (recordingsResponse.ok) {
                const recordings = await recordingsResponse.json();
                const client = clients.find(c => c.id === clientId);
                if (client) {
                    const hasRecordings = recordings.some((recording: any) => 
                        recording.clientId === clientId || 
                        recording.client_id === clientId ||
                        recording.clientName?.toLowerCase() === client.name?.toLowerCase()
                    );
                    if (hasRecordings) return true;
                }
            }

            // Check appointments
            const hasAppointments = appointments.some(apt => {
                const client = clients.find(c => c.id === clientId);
                return client && apt.clientName?.toLowerCase() === client.name?.toLowerCase();
            });
            if (hasAppointments) return true;

            return false;
        } catch (error) {
            console.error('Error checking client session data:', error);
            // If we can't check, assume they have data to be safe
            return true;
        }
    };

    const handleDeleteClick = async (id: string) => {
        const client = clients.find(c => c.id === id);
        // If client is already archived, allow deletion. Otherwise, always archive.
        const action = client?.archived ? 'delete' : 'archive';
        console.log(`[Client Delete] Client ${id} is archived: ${client?.archived}, action: ${action}`);
        setDeleteConfirmation({ isOpen: true, clientId: id, action });
    };

    const handleGDPRDeleteClick = (id: string) => {
        setGdprDeleteClientId(id);
        setGdprDeleteOpen(true);
    };

    const confirmArchive = async () => {
        if (deleteConfirmation.clientId && deleteConfirmation.action === 'archive') {
            try {
                const response = await fetch('/api/clients/archive', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: deleteConfirmation.clientId, restore: false }),
                });
                if (response.ok) {
                    await loadClients();
                    setDeleteConfirmation({ isOpen: false, clientId: null, action: null });
                    // Refresh the page to ensure UI is updated
                    window.location.reload();
                } else {
                    alert('Failed to archive client');
                }
            } catch (error) {
                console.error('Error archiving client:', error);
                alert('Error archiving client');
            }
        }
    };

    const confirmDelete = async () => {
        if (deleteConfirmation.clientId && deleteConfirmation.action === 'delete') {
            const updatedClients = clients.filter(c => c.id !== deleteConfirmation.clientId);
            await saveClients(updatedClients);
            await loadClients();
            setDeleteConfirmation({ isOpen: false, clientId: null, action: null });
        }
    };

    const handleRestore = async (id: string) => {
        try {
            const response = await fetch('/api/clients/archive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, restore: true }),
            });

            if (response.ok) {
                await loadClients();
                // Close the dialog and refresh
                handleDialogClose();
            } else {
                alert('Failed to restore client');
            }
        } catch (error) {
            console.error('Error restoring client:', error);
            alert('Error restoring client');
        }
    };

    const confirmGDPRDelete = async () => {
        if (gdprDeleteClientId) {
            // Delete from database via API
            try {
                const response = await fetch(`/api/clients/gdpr-delete?id=${gdprDeleteClientId}`, {
                    method: 'DELETE',
                    credentials: 'include',
                });
                if (response.ok) {
                    // Close dialog first
                    setGdprDeleteOpen(false);
                    setGdprDeleteClientId(null);
                    // Then reload clients with a small delay to ensure deletion is complete
                    setTimeout(async () => {
                        await loadClients();
                    }, 100);
                } else {
                    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                    alert(`Failed to delete client: ${errorData.error || 'Please try again.'}`);
                }
            } catch (error) {
                console.error('Error deleting client:', error);
                alert('Error deleting client. Please try again.');
            }
        }
    };

    const handleDialogClose = () => {
        setIsAddDialogOpen(false);
        setEditingClient(null);
        setFormData({
            name: "",
            email: "",
            phone: "",
            nextAppointment: "",
            notes: "",
            sessions: 0,
            sessionFee: undefined, // Empty by default - will use standard fee from settings
            currency: 'EUR', // Default to Euros
            documents: [],
            relationships: [],
            gender: undefined,
            dateOfBirth: "",
            mailingAddress: "",
            preferredName: "",
            emergencyContact: { name: "", phone: "" },
            medicalConditions: "",
            currentMedications: "",
            doctorInfo: { name: "", phone: "" },
            newClientFormSigned: false,
        });
        // Remove client query parameter from URL to prevent dialog from reopening
        if (searchParams.get('client')) {
            router.replace('/clients');
        }
    };

    // Selection handlers
    const toggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode);
        if (isSelectionMode) {
            setSelectedClientIds(new Set());
        }
    };

    const toggleClientSelection = (clientId: string) => {
        setSelectedClientIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(clientId)) {
                newSet.delete(clientId);
            } else {
                newSet.add(clientId);
            }
            return newSet;
        });
    };

    const selectAllClients = () => {
        setSelectedClientIds(new Set(filteredClients.map(c => c.id)));
    };

    const clearSelection = () => {
        setSelectedClientIds(new Set());
    };

    const isAllSelected = filteredClients.length > 0 && filteredClients.every(c => selectedClientIds.has(c.id));
    const isSomeSelected = selectedClientIds.size > 0 && selectedClientIds.size < filteredClients.length;

    const handleSelectAll = () => {
        if (isAllSelected) {
            clearSelection();
        } else {
            selectAllClients();
        }
    };

    // Bulk delete function
    const handleBulkDelete = async () => {
        if (selectedClientIds.size === 0) return;

        const selectedCount = selectedClientIds.size;
        const confirmMessage = `Are you sure you want to permanently delete ${selectedCount} client${selectedCount > 1 ? 's' : ''}? This will remove all associated data including sessions, notes, recordings, and payments. This action cannot be undone.`;

        if (!confirm(confirmMessage)) {
            return;
        }

        const idsToDelete = Array.from(selectedClientIds);
        let successCount = 0;
        let failCount = 0;

        // Delete clients one by one
        for (const id of idsToDelete) {
            try {
                const response = await fetch(`/api/clients/gdpr-delete?id=${id}`, {
                    method: 'DELETE',
                    credentials: 'include',
                });
                if (response.ok) {
                    successCount++;
                } else {
                    failCount++;
                    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                    console.error(`Failed to delete client ${id}:`, errorData.error);
                }
            } catch (error) {
                failCount++;
                console.error(`Error deleting client ${id}:`, error);
            }
        }

        // Clear selection and reload clients
        setSelectedClientIds(new Set());
        setIsSelectionMode(false);
        await loadClients();

        // Show result message
        if (failCount === 0) {
            alert(`Successfully deleted ${successCount} client${successCount > 1 ? 's' : ''}.`);
        } else {
            alert(`Deleted ${successCount} client${successCount > 1 ? 's' : ''}. Failed to delete ${failCount} client${failCount > 1 ? 's' : ''}.`);
        }
    };

    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-7xl">
            <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex-1">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">Clients</h1>
                    <p className="text-sm sm:text-base text-muted-foreground mb-4">
                        Manage your clients
                    </p>
                    {/* Tabs for Active/Archived */}
                    <Tabs value={activeTab} onValueChange={(value) => {
                        setActiveTab(value as 'active' | 'archived');
                        setShowBulkImport(false); // Hide bulk import when switching tabs
                        setIsSelectionMode(false); // Exit selection mode when switching tabs
                        setSelectedClientIds(new Set()); // Clear selection when switching tabs
                    }}>
                        <TabsList>
                            <TabsTrigger value="active">Active Clients</TabsTrigger>
                            <TabsTrigger value="archived">Archived Clients</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                <div className="flex items-center gap-2">
                    {isSelectionMode ? (
                        <>
                            <Button
                                variant="outline"
                                onClick={toggleSelectionMode}
                                size="lg"
                            >
                                Cancel Selection
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleBulkDelete}
                                size="lg"
                                disabled={selectedClientIds.size === 0}
                            >
                                <Trash2 className="mr-2 h-5 w-5" />
                                Delete Selected ({selectedClientIds.size})
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="outline"
                            onClick={toggleSelectionMode}
                            size="lg"
                            disabled={filteredClients.length === 0}
                        >
                            Select Clients
                        </Button>
                    )}
                    {activeTab === 'active' && (
                        <>
                            {clients.filter(c => !c.newClientFormSigned && !c.archived).length > 0 && (
                                <Button 
                                    variant="outline"
                                    size="lg"
                                    onClick={handleBulkMarkFormsSigned}
                                    className="border-blue-500 text-blue-600 hover:bg-blue-50"
                                >
                                    <CheckCircle2 className="mr-2 h-5 w-5" />
                                    Mark All Forms Signed ({clients.filter(c => !c.newClientFormSigned && !c.archived).length})
                                </Button>
                            )}
                            <Button 
                                size="lg" 
                                className="bg-green-500 hover:bg-green-600 text-white"
                                onClick={() => setIsAddDialogOpen(true)}
                            >
                                <Plus className="mr-2 h-5 w-5" />
                                Add Client
                            </Button>
                        </>
                    )}
                </div>

                {activeTab === 'active' && (
                <Dialog open={isAddDialogOpen} onOpenChange={(open: boolean) => {
                    if (open) {
                        setIsAddDialogOpen(true);
                    } else {
                        handleDialogClose();
                    }
                }}>
                    <DialogTrigger asChild>
                        <div style={{ display: 'none' }}></div>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col">
                        <DialogHeader>
                            <DialogTitle>
                                {editingClient ? "Client Details" : "Add New Client"}
                            </DialogTitle>
                            <DialogDescription>
                                {editingClient
                                    ? `Manage information and sessions for ${editingClient.name}`
                                    : "Enter client information to add them to your practice"}
                            </DialogDescription>
                        </DialogHeader>

                        <Tabs value={clientDialogTab} onValueChange={(value) => setClientDialogTab(value as 'profile' | 'sessions')} className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="profile">Profile & Info</TabsTrigger>
                                <TabsTrigger value="sessions" disabled={!editingClient}>Sessions & Notes</TabsTrigger>
                            </TabsList>

                            <TabsContent value="profile" className="flex flex-col flex-1 min-h-0">
                                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                                    <div className="space-y-4 py-4 flex-1 overflow-y-auto">
                                        {/* Name */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="firstName">
                                                    <User className="inline h-4 w-4 mr-1 text-blue-500" />
                                                    First Name *
                                                </Label>
                                                <Input
                                                    id="firstName"
                                                    placeholder="John"
                                                    value={formData.firstName || ''}
                                                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="lastName">
                                                    <User className="inline h-4 w-4 mr-1 text-green-500" />
                                                    Last Name *
                                                </Label>
                                                <Input
                                                    id="lastName"
                                                    placeholder="Doe"
                                                    value={formData.lastName || ''}
                                                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {/* Known As */}
                                        <div className="space-y-2">
                                            <Label htmlFor="preferredName">
                                                <User className="inline h-4 w-4 mr-1 text-purple-500" />
                                                Known As
                                            </Label>
                                            <Input
                                                id="preferredName"
                                                placeholder="Nickname"
                                                value={formData.preferredName || ''}
                                                onChange={(e) => setFormData({ ...formData, preferredName: e.target.value })}
                                            />
                                        </div>

                                        {/* Email & Phone */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="email">
                                                    <Mail className="inline h-4 w-4 mr-1 text-blue-500" />
                                                    Email
                                                </Label>
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    placeholder="john@example.com"
                                                    value={formData.email || ''}
                                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="phone">
                                                    <Phone className="inline h-4 w-4 mr-1 text-green-500" />
                                                    Phone
                                                </Label>
                                                <Input
                                                    id="phone"
                                                    type="tel"
                                                    placeholder="(555) 123-4567"
                                                    value={formData.phone || ''}
                                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        {/* Next Appointment & Last Appointment */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="nextAppointment">
                                                    <Calendar className="inline h-4 w-4 mr-1 text-green-500" />
                                                    Next Appointment
                                                </Label>
                                                <Input
                                                    id="nextAppointment"
                                                    type="datetime-local"
                                                    value={editingClient && getNextAppointment(editingClient.name)
                                                        ? new Date(getNextAppointment(editingClient.name)!.date).toISOString().slice(0, 16)
                                                        : (formData.nextAppointment || '')}
                                                    onChange={(e) => setFormData({ ...formData, nextAppointment: e.target.value })}
                                                />
                                                {editingClient && !getNextAppointment(editingClient.name) && (
                                                    <p className="text-xs text-muted-foreground">No future appointments scheduled</p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="lastAppointment">
                                                    <Calendar className="inline h-4 w-4 mr-1 text-purple-500" />
                                                    Last Appointment
                                                </Label>
                                                <Input
                                                    id="lastAppointment"
                                                    type="text"
                                                    readOnly
                                                    value={editingClient && getLastAppointment(editingClient.name) 
                                                        ? new Date(getLastAppointment(editingClient.name)!.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                        : 'No appointments yet'}
                                                    className="bg-muted cursor-not-allowed"
                                                />
                                            </div>
                                        </div>

                                        {/* Gender & Date of Birth */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="gender">
                                                    <User className="inline h-4 w-4 mr-1 text-purple-500" />
                                                    Gender
                                                </Label>
                                                <Select
                                                    value={formData.gender || ''}
                                                    onValueChange={(val) => setFormData({ ...formData, gender: val as Client['gender'] })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select gender" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="male">Male</SelectItem>
                                                        <SelectItem value="female">Female</SelectItem>
                                                        <SelectItem value="other">Other</SelectItem>
                                                        <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="dateOfBirth">
                                                    <Calendar className="inline h-4 w-4 mr-1 text-blue-500" />
                                                    Date of Birth
                                                </Label>
                                                <Input
                                                    id="dateOfBirth"
                                                    type="date"
                                                    value={formData.dateOfBirth || ''}
                                                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        {/* Sessions & Fee */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="sessions">
                                                    <Hash className="inline h-4 w-4 mr-1 text-green-500" />
                                                    Total Sessions
                                                </Label>
                                                <Input
                                                    id="sessions"
                                                    type="number"
                                                    min="0"
                                                    placeholder="0"
                                                    value={editingClient ? getClientAppointments(editingClient.name).length : (formData.sessions || 0)}
                                                    onChange={(e) => setFormData({ ...formData, sessions: parseInt(e.target.value) || 0 })}
                                                />
                                                {editingClient && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Calculated from {getClientAppointments(editingClient.name).length} appointment{getClientAppointments(editingClient.name).length !== 1 ? 's' : ''} in calendar
                                                    </p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="sessionFee">
                                                    <FileText className="inline h-4 w-4 mr-1 text-pink-500" />
                                                    Discount Session Fee
                                                </Label>
                                                <div className="flex gap-2">
                                                    <Select
                                                        value={formData.currency || 'EUR'}
                                                        onValueChange={(value: 'EUR' | 'GBP' | 'USD' | 'AUD') => setFormData({ ...formData, currency: value })}
                                                    >
                                                        <SelectTrigger className="w-[100px]">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="EUR">€ EUR</SelectItem>
                                                            <SelectItem value="GBP">£ GBP</SelectItem>
                                                            <SelectItem value="USD">$ USD</SelectItem>
                                                            <SelectItem value="AUD">A$ AUD</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <div className="relative flex-1">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                                            {formData.currency === 'EUR' ? '€' :
                                                                formData.currency === 'GBP' ? '£' :
                                                                    formData.currency === 'AUD' ? 'A$' : '$'}
                                                        </span>
                                                        <Input
                                                            id="sessionFee"
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            placeholder="80"
                                                            value={formData.sessionFee || ''}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                // Allow empty string, otherwise parse as number
                                                                setFormData({ ...formData, sessionFee: value === '' ? undefined : parseFloat(value) || undefined });
                                                            }}
                                                            className="pl-10"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Mailing Address */}
                                        <div className="space-y-2">
                                            <Label htmlFor="mailingAddress">
                                                <FileText className="inline h-4 w-4 mr-1 text-blue-500" />
                                                Mailing Address
                                            </Label>
                                            <Textarea
                                                id="mailingAddress"
                                                placeholder="Street address, city, postcode (e.g., Lagos 8600-616)"
                                                rows={3}
                                                value={formData.mailingAddress || ''}
                                                onChange={(e) => setFormData({ ...formData, mailingAddress: e.target.value })}
                                                autoComplete="off"
                                            />
                                        </div>

                                        {/* Notes */}
                                        <div className="space-y-2">
                                            <Label htmlFor="notes">
                                                <FileText className="inline h-4 w-4 mr-1 text-green-500" />
                                                Notes
                                            </Label>
                                            <Textarea
                                                id="notes"
                                                placeholder="Additional notes about the client..."
                                                rows={4}
                                                value={formData.notes || ''}
                                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            />
                                        </div>

                                        {/* Documents */}
                                        {/* Documents */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label className="flex items-center gap-2 cursor-pointer" onClick={() => setIsDocumentsExpanded(!isDocumentsExpanded)}>
                                                    <File className="h-4 w-4 text-blue-500" />
                                                    Documents ({formData.documents?.length || 0})
                                                    {isDocumentsExpanded ? <ChevronDown className="h-3 w-3 text-blue-500" /> : <ChevronRight className="h-3 w-3 text-blue-500" />}
                                                </Label>
                                            </div>

                                            {isDocumentsExpanded && (
                                                <div className="space-y-2 pl-2 border-l-2 border-muted ml-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Input
                                                            id="file-upload"
                                                            type="file"
                                                            className="hidden"
                                                            onChange={handleFileUpload}
                                                        />
                                                        <Label
                                                            htmlFor="file-upload"
                                                            className="flex items-center gap-2 px-3 py-1.5 text-xs border rounded-md cursor-pointer hover:bg-muted"
                                                        >
                                                            <Upload className="h-3 w-3 text-purple-500" />
                                                            Upload Document
                                                        </Label>
                                                    </div>

                                                    {formData.documents && formData.documents.length > 0 ? (
                                                        <div className="space-y-2">
                                                            {formData.documents.map((doc, index) => (
                                                                <div key={index} className="flex items-center justify-between p-2 border rounded-md bg-muted/50 text-sm">
                                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                                        <File className="h-3 w-3 flex-shrink-0 text-blue-500" />
                                                                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                                                                            {doc.name}
                                                                        </a>
                                                                    </div>
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-6 w-6 text-red-500 hover:text-red-600"
                                                                        onClick={() => handleRemoveDocumentClick(index)}
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-muted-foreground italic">No documents attached.</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Relationships */}
                                        <div className="space-y-2">
                                            <Label>
                                                <Users className="inline h-4 w-4 mr-1 text-pink-500" />
                                                Relationships
                                            </Label>
                                            <div className="space-y-2">
                                                {formData.relationships?.map((rel, index) => (
                                                    <div key={index} className="flex items-center gap-2">
                                                        <Select
                                                            value={rel.relatedClientId}
                                                            onValueChange={(val) => updateRelationship(index, 'relatedClientId', val)}
                                                        >
                                                            <SelectTrigger className="w-[180px]">
                                                                <SelectValue placeholder="Select Client" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {clients
                                                                    .filter(c => c.id !== editingClient?.id) // Exclude self
                                                                    .sort((a, b) => (a.firstName || a.name || '').localeCompare(b.firstName || b.name || ''))
                                                                    .map(c => (
                                                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                                    ))
                                                                }
                                                            </SelectContent>
                                                        </Select>
                                                        <Input
                                                            placeholder="Relationship (e.g. Spouse)"
                                                            value={rel.type || ''}
                                                            onChange={(e) => updateRelationship(index, 'type', e.target.value)}
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-red-500"
                                                            onClick={() => removeRelationship(index)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                                <Button type="button" variant="outline" size="sm" onClick={addRelationship}>
                                                    <Plus className="h-3 w-3 mr-1" /> Add Relationship
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* New Client Form Signed */}
                                    <div className="space-y-2 pt-4 border-t" ref={formCheckboxRef}>
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="newClientFormSigned"
                                                checked={formData.newClientFormSigned || false}
                                                onCheckedChange={(checked) => setFormData({ ...formData, newClientFormSigned: checked === true })}
                                                className="h-4 w-4"
                                            />
                                            <Label htmlFor="newClientFormSigned" className="cursor-pointer flex items-center gap-2 text-sm">
                                                <FileText className="h-4 w-4 text-muted-foreground" />
                                                <span>New Client Form Signed</span>
                                            </Label>
                                        </div>
                                        <p className="text-xs text-muted-foreground ml-6">
                                            Check this box when the new client form has been completed and signed. This will stop daily reminders.
                                        </p>
                                    </div>
                                    
                                    <DialogFooter className="flex sm:justify-between gap-2 mt-2">
                                        {editingClient && (
                                            <div className="flex gap-2">
                                                {editingClient.archived ? (
                                                    <>
                                                        <Button
                                                            type="button"
                                                            variant="default"
                                                            className="bg-green-500 hover:bg-green-600 text-white"
                                                            onClick={() => handleRestore(editingClient.id)}
                                                        >
                                                            <RotateCcw className="mr-2 h-4 w-4" />
                                                            Restore Client
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            onClick={() => handleDeleteClick(editingClient.id)}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Delete Client
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            onClick={() => handleDeleteClick(editingClient.id)}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Archive Client
                                                        </Button>
                                                    </>
                                                )}
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    className="bg-red-700 hover:bg-red-800"
                                                    onClick={() => handleGDPRDeleteClick(editingClient.id)}
                                                >
                                                    GDPR Delete
                                                </Button>
                                            </div>
                                        )}
                                        <div className="flex gap-2 ml-auto">
                                            <Button type="button" variant="outline" onClick={handleDialogClose}>
                                                Cancel
                                            </Button>
                                            <Button type="submit" className={editingClient ? "" : "bg-green-500 hover:bg-green-600 text-white"}>
                                                {editingClient ? "Update Client" : "Add Client"}
                                            </Button>
                                        </div>
                                    </DialogFooter>
                                </form>
                            </TabsContent>

                            <TabsContent value="sessions" className="space-y-4 py-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold">Session History</h3>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="default"
                                            size="sm"
                                            className="bg-green-500 hover:bg-green-600 text-white"
                                            onClick={() => {
                                                // Navigate to schedule page with client pre-selected
                                                router.push(`/schedule?client=${encodeURIComponent(editingClient?.name || '')}`);
                                                handleDialogClose();
                                            }}
                                        >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Add Appointment
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setIsLogSessionDialogOpen(true)}
                                        >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Log Past Session
                                        </Button>
                                    </div>
                                </div>

                                {editingClient && getClientAppointments(editingClient.name).length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Calendar className="h-12 w-12 mx-auto mb-2 opacity-20" />
                                        <p>No sessions found for this client.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {editingClient && getClientAppointments(editingClient.name).map((apt) => (
                                            <Card key={apt.id} className="border-l-4 border-l-primary">
                                                <CardHeader className="p-4 pb-2">
                                                    <div className="flex items-center justify-between">
                                                        <CardTitle className="text-base">
                                                            {new Date(apt.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                        </CardTitle>
                                                        <span className="text-xs font-medium px-2 py-1 bg-secondary rounded-full">
                                                            {apt.type}
                                                        </span>
                                                    </div>
                                                    <CardDescription>
                                                        {apt.time} ({apt.duration} mins)
                                                    </CardDescription>
                                                </CardHeader>
                                                <CardContent className="p-4 pt-2">
                                                    {apt.notes && (
                                                        <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded mb-2">
                                                            {apt.notes}
                                                        </div>
                                                    )}
                                                    <div className="flex gap-2 mt-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="w-full"
                                                            onClick={() => handleOpenSession(apt, "notes")}
                                                        >
                                                            <FileText className="mr-2 h-3 w-3" />
                                                            Session Notes
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="w-full"
                                                            onClick={() => handleOpenSession(apt, "attachments")}
                                                        >
                                                            <Upload className="mr-2 h-3 w-3" />
                                                            Attachments
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </DialogContent>
                </Dialog>
                )}

                {/* Log Past Session Dialog */}
                <Dialog open={isLogSessionDialogOpen} onOpenChange={setIsLogSessionDialogOpen}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Log Past Session</DialogTitle>
                            <DialogDescription>
                                Manually record a session that has already occurred.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleLogSession}>
                            <div className="space-y-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="session-date">Date</Label>
                                        <Input
                                            id="session-date"
                                            type="date"
                                            value={logSessionData.date}
                                            onChange={(e) => setLogSessionData({ ...logSessionData, date: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="session-time">Time</Label>
                                        <Input
                                            id="session-time"
                                            type="time"
                                            value={logSessionData.time}
                                            onChange={(e) => setLogSessionData({ ...logSessionData, time: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="session-duration">Duration (minutes)</Label>
                                    <Input
                                        id="session-duration"
                                        type="number"
                                        value={logSessionData.duration}
                                        onChange={(e) => setLogSessionData({ ...logSessionData, duration: parseInt(e.target.value) || 0 })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="session-type">Type</Label>
                                    <Select
                                        value={logSessionData.type}
                                        onValueChange={(value) => setLogSessionData({ ...logSessionData, type: value })}
                                    >
                                        <SelectTrigger id="session-type">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Initial Consultation">Initial Consultation</SelectItem>
                                            <SelectItem value="Follow-up Session">Follow-up Session</SelectItem>
                                            <SelectItem value="Therapy Session">Therapy Session</SelectItem>
                                            <SelectItem value="Family Therapy">Family Therapy</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="session-notes">Notes</Label>
                                    <Textarea
                                        id="session-notes"
                                        placeholder="Brief session summary..."
                                        value={logSessionData.notes}
                                        onChange={(e) => setLogSessionData({ ...logSessionData, notes: e.target.value })}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsLogSessionDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit">Log Session</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Session Details Dialog */}
                <Dialog open={!!activeSession} onOpenChange={(open) => !open && setActiveSession(null)}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Session Details</DialogTitle>
                            <DialogDescription>
                                {activeSession && `${new Date(activeSession.date).toLocaleDateString()} - ${activeSession.type}`}
                            </DialogDescription>
                        </DialogHeader>

                        {activeSession && (
                            <Tabs defaultValue={sessionDialogTab} className="w-full" onValueChange={async (value) => {
                                setSessionDialogTab(value as "notes" | "attachments");
                                if (value === "notes") {
                                    await loadSessionNotes(activeSession.id);
                                }
                            }}>
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="notes">Session Notes</TabsTrigger>
                                    <TabsTrigger value="attachments">Attachments</TabsTrigger>
                                </TabsList>

                                <TabsContent value="notes" className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                                    {isLoadingSessionNotes ? (
                                        <p className="text-muted-foreground text-center py-8">Loading session notes...</p>
                                    ) : sessionNotes.length > 0 ? (
                                        <div className="space-y-4">
                                            {/* If there is any recording-based note with audio, show a shared audio player at the top */}
                                            {(() => {
                                                const recordingNote = sessionNotes.find((n: any) => n.source === 'recording' && n.audioURL);
                                                if (!recordingNote || !recordingNote.audioURL) return null;
                                                return (
                                                    <div className="border rounded-lg p-4 bg-muted/50">
                                                        <p className="text-sm font-medium mb-2 flex items-center gap-2">
                                                            <Mic className="h-4 w-4 text-purple-600" />
                                                            Audio Recording for this session
                                                        </p>
                                                        <audio controls className="w-full">
                                                            <source src={recordingNote.audioURL} type="audio/webm" />
                                                            <source src={recordingNote.audioURL} type="audio/mp3" />
                                                            Your browser does not support the audio element.
                                                        </audio>
                                                    </div>
                                                );
                                            })()}

                                            {sessionNotes.map((note, index) => {
                                                // Determine if this is an uploaded recording with AI Clinical Assessment
                                                const hasAIClinicalAssessment = note.content && 
                                                                                note.content.trim() !== '' && 
                                                                                note.transcript && 
                                                                                note.content !== note.transcript;
                                                
                                                return (
                                                <div key={note.id || index} className="border rounded-lg p-4 bg-muted/50 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-sm text-muted-foreground">
                                                            {note.createdDate || note.created_at 
                                                                ? new Date(note.createdDate || note.created_at).toLocaleString('en-GB', {
                                                                    day: '2-digit',
                                                                    month: '2-digit',
                                                                    year: 'numeric',
                                                                    hour: '2-digit',
                                                                    minute: '2-digit'
                                                                })
                                                                : 'No date'}
                                                        </div>
                                                        {note.source === 'recording' && (
                                                            <span className="flex items-center gap-1 text-xs text-purple-600">
                                                                {hasAIClinicalAssessment ? (
                                                                    <>
                                                                        <Mic className="h-3 w-3" />
                                                                        AI Clinical Assessment
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Mic className="h-3 w-3" />
                                                                        Voice Note
                                                                    </>
                                                                )}
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Show AI Clinical Assessment content ONLY for uploaded recordings */}
                                                    {/* For live recordings, content will be empty and we'll only show transcript */}
                                                    {note.content && 
                                                     note.content.trim() !== '' && 
                                                     note.transcript && 
                                                     note.content !== note.transcript && (
                                                        <div className="whitespace-pre-wrap text-sm mb-3">
                                                            {note.content}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Show transcript - for live recordings this is the only content, for uploaded it's the original */}
                                                    {note.transcript && (
                                                        <div className={note.content && note.content !== note.transcript ? "border-t pt-3 mt-3" : ""}>
                                                            <p className="text-xs font-medium text-muted-foreground mb-2">
                                                                {note.content && note.content !== note.transcript 
                                                                    ? "📝 Original Transcript (Client's Words):" 
                                                                    : "📝 Original Transcript (Therapist's Words):"}
                                                            </p>
                                                            <div className="whitespace-pre-wrap text-sm bg-muted/50 p-3 rounded text-muted-foreground">
                                                                {note.transcript}
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Fallback if no transcript and no content */}
                                                    {!note.transcript && !note.content && (
                                                        <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                                                            No content available
                                                        </div>
                                                    )}
                                                </div>
                                                );
                                            })}
                                            <div className="pt-4 border-t">
                                                <Button 
                                                    variant="outline" 
                                                    onClick={() => {
                                                        // Navigate to session notes page to create a new note for this session
                                                        // Ensure date is properly formatted and encoded
                                                        let dateParam = '';
                                                        if (activeSession.date) {
                                                            try {
                                                                // Convert to ISO string if it's not already
                                                                const date = new Date(activeSession.date);
                                                                if (!isNaN(date.getTime())) {
                                                                    dateParam = encodeURIComponent(date.toISOString());
                                                                } else {
                                                                    console.warn('[Clients] Invalid date in activeSession:', activeSession.date);
                                                                }
                                                            } catch (e) {
                                                                console.error('[Clients] Error processing date:', e);
                                                            }
                                                        }
                                                        console.log('[Clients] Navigating to session notes with date:', dateParam);
                                                        router.push(`/session-notes?client=${encodeURIComponent(activeSession.clientName)}&clientId=${editingClient?.id}&sessionId=${activeSession.id}&date=${dateParam}&create=true`);
                                                        setActiveSession(null);
                                                    }}
                                                >
                                                    Add Session Note
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <p className="text-muted-foreground text-center py-4">No session notes found for this session.</p>
                                            <div className="flex gap-2">
                                                <Button 
                                                    onClick={() => {
                                                        // Navigate to session notes page to create a new note for this session
                                                        // Ensure date is properly formatted and encoded
                                                        let dateParam = '';
                                                        if (activeSession.date) {
                                                            try {
                                                                // Convert to ISO string if it's not already
                                                                const date = new Date(activeSession.date);
                                                                if (!isNaN(date.getTime())) {
                                                                    dateParam = encodeURIComponent(date.toISOString());
                                                                } else {
                                                                    console.warn('[Clients] Invalid date in activeSession:', activeSession.date);
                                                                }
                                                            } catch (e) {
                                                                console.error('[Clients] Error processing date:', e);
                                                            }
                                                        }
                                                        console.log('[Clients] Navigating to session notes with date:', dateParam);
                                                        router.push(`/session-notes?client=${encodeURIComponent(activeSession.clientName)}&clientId=${editingClient?.id}&sessionId=${activeSession.id}&date=${dateParam}&create=true`);
                                                        setActiveSession(null);
                                                    }}
                                                >
                                                    Add Session Note
                                                </Button>
                                                <Button 
                                                    variant="outline"
                                                    onClick={saveActiveSession}
                                                >
                                                    Save Session Notes
                                                </Button>
                                            </div>
                                            <Textarea
                                                placeholder="Enter detailed session notes here (legacy field)..."
                                                className="min-h-[200px]"
                                                value={activeSession.clinicalNotes || ''}
                                                onChange={(e) => setActiveSession({ ...activeSession, clinicalNotes: e.target.value })}
                                            />
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="attachments" className="py-4 space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Input
                                                id="session-file-upload"
                                                type="file"
                                                className="hidden"
                                                onChange={handleSessionFileUpload}
                                            />
                                            <Label
                                                htmlFor="session-file-upload"
                                                className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-muted"
                                            >
                                                <Upload className="h-4 w-4" />
                                                Upload Attachment
                                            </Label>
                                        </div>

                                        {activeSession.attachments && activeSession.attachments.length > 0 && (
                                            <div className="space-y-2 mt-2">
                                                {activeSession.attachments.map((doc, index) => (
                                                    <div key={index} className="flex items-center justify-between p-2 border rounded-md bg-muted/50">
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            <File className="h-4 w-4 flex-shrink-0" />
                                                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline truncate">
                                                                {doc.name}
                                                            </a>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-red-500"
                                                            onClick={() => handleRemoveSessionDocumentClick(index)}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <Button onClick={saveActiveSession}>Save Attachments</Button>
                                </TabsContent>
                            </Tabs>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Archive/Delete Confirmation Dialog */}
                <DeleteConfirmationDialog
                    open={deleteConfirmation.isOpen}
                    onOpenChange={(open) => {
                        console.log('[Client Dialog] onOpenChange called:', open, 'action:', deleteConfirmation.action);
                        setDeleteConfirmation({ isOpen: open, clientId: deleteConfirmation.clientId, action: deleteConfirmation.action });
                    }}
                    onConfirm={() => {
                        console.log('[Client Dialog] onConfirm called, action:', deleteConfirmation.action);
                        if (deleteConfirmation.action === 'archive') {
                            confirmArchive();
                        } else {
                            confirmDelete();
                        }
                    }}
                    title={deleteConfirmation.action === 'archive' ? "Archive Client" : "Delete Client"}
                    description={
                        deleteConfirmation.action === 'archive' 
                            ? `This client has session notes or recordings. They will be archived instead of deleted. Archived clients can be restored later for audit purposes.`
                            : `Are you sure you want to delete this client? This will permanently remove all associated data. This action cannot be undone.`
                    }
                    itemName={editingClient?.name || clients.find(c => c.id === deleteConfirmation.clientId)?.name}
                    confirmButtonText={deleteConfirmation.action === 'archive' ? "Archive" : undefined}
                />

                {/* GDPR Deletion Dialog */}
                <GDPRDeleteDialog
                    open={gdprDeleteOpen}
                    onOpenChange={setGdprDeleteOpen}
                    onConfirm={confirmGDPRDelete}
                    clientName={editingClient?.name || clients.find(c => c.id === gdprDeleteClientId)?.name}
                />
            </div >

            {/* Comprehensive Search & Filter and Bulk Import/Export - Horizontal when collapsed */}
            {clients.length > 0 && (
                <div className={`mb-6 flex gap-4 transition-all ${
                    (!showSearch && (activeTab === 'archived' || !showBulkImport)) ? 'flex-row' : 'flex-col'
                }`}>
                    {/* Comprehensive Search & Filter */}
                    <Card className={`transition-all ${
                        (!showSearch && (activeTab === 'archived' || !showBulkImport)) 
                            ? 'w-auto min-w-[200px] max-w-[300px]' 
                            : 'w-full'
                    } ${!showSearch ? 'py-1' : ''}`}>
                        <CardHeader
                            className={`cursor-pointer hover:bg-muted/50 transition-colors ${!showSearch ? 'py-2 px-4' : ''}`}
                            onClick={() => setShowSearch(!showSearch)}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Filter className={`${!showSearch ? 'h-3 w-3' : 'h-5 w-5'} text-purple-500`} />
                                    <CardTitle className={!showSearch ? 'text-sm font-medium' : ''}>Search & Filter Clients</CardTitle>
                                </div>
                                <Button variant="ghost" size={!showSearch ? "sm" : "sm"} className={!showSearch ? 'h-7 px-2 text-xs' : ''}>
                                    {showSearch ? "Hide" : "Show"}
                                </Button>
                            </div>
                            {showSearch && (
                                <CardDescription>
                                    Search across all client fields including name, email, phone, notes, medical information, and date added
                                </CardDescription>
                            )}
                        </CardHeader>
                        {showSearch && (
                            <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Search Query */}
                            <div className="space-y-2">
                                <Label htmlFor="search">Search</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500" />
                                    <Input
                                        id="search"
                                        placeholder="Search clients..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>

                            {/* Search Field */}
                            <div className="space-y-2">
                                <Label htmlFor="search-field">Search In</Label>
                                <Select value={searchField} onValueChange={setSearchField}>
                                    <SelectTrigger id="search-field">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Fields</SelectItem>
                                        <SelectItem value="firstName">First Name</SelectItem>
                                        <SelectItem value="lastName">Last Name</SelectItem>
                                        <SelectItem value="name">Name</SelectItem>
                                        <SelectItem value="email">Email</SelectItem>
                                        <SelectItem value="phone">Phone</SelectItem>
                                        <SelectItem value="notes">Notes</SelectItem>
                                        <SelectItem value="dateOfBirth">Date of Birth</SelectItem>
                                        <SelectItem value="address">Address</SelectItem>
                                        <SelectItem value="medical">Medical Info</SelectItem>
                                        <SelectItem value="dateAdded">Date Added</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Date Added Filter - From */}
                            <div className="space-y-2">
                                <Label htmlFor="date-added-from">Date Added (From)</Label>
                                <Input
                                    id="date-added-from"
                                    type="date"
                                    value={dateAddedFilter.from || ''}
                                    onChange={(e) => setDateAddedFilter({ ...dateAddedFilter, from: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Date Added Filter - To */}
                            <div className="space-y-2">
                                <Label htmlFor="date-added-to">Date Added (To)</Label>
                                <Input
                                    id="date-added-to"
                                    type="date"
                                    value={dateAddedFilter.to || ''}
                                    onChange={(e) => setDateAddedFilter({ ...dateAddedFilter, to: e.target.value })}
                                />
                            </div>

                            {/* Clear Filters */}
                            <div className="space-y-2 flex items-end">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSearchQuery("");
                                        setSearchField("all");
                                        setDateAddedFilter({});
                                        setSortBy("name-asc");
                                    }}
                                    className="w-full"
                                >
                                    Clear Filters
                                </Button>
                            </div>

                            {/* Results Count */}
                            <div className="space-y-2 flex items-end">
                                <p className="text-sm text-muted-foreground">
                                    Showing {filteredClients.length} of {clients.length} {activeTab === 'archived' ? 'archived' : 'active'} clients
                                </p>
                            </div>
                        </div>
                            </CardContent>
                        )}
                    </Card>

                    {/* Bulk Import/Export - Collapsible - Only show for active clients */}
                    {activeTab === 'active' && (
                        <Card className={`transition-all ${
                            (!showSearch && !showBulkImport) 
                                ? 'w-auto min-w-[200px] max-w-[300px]' 
                                : 'w-full'
                        } ${!showBulkImport ? 'py-1' : ''}`} key="bulk-import-export">
                            <CardHeader
                                className={`cursor-pointer hover:bg-muted/50 transition-colors ${!showBulkImport ? 'py-2 px-4' : ''}`}
                                onClick={() => setShowBulkImport(!showBulkImport)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FileSpreadsheet className={`${!showBulkImport ? 'h-3 w-3' : 'h-5 w-5'} text-primary`} />
                                        <CardTitle className={!showBulkImport ? 'text-sm font-medium' : ''}>Bulk Client Import/Export</CardTitle>
                                    </div>
                                    <Button variant="ghost" size={!showBulkImport ? "sm" : "sm"} className={!showBulkImport ? 'h-7 px-2 text-xs' : ''}>
                                        {showBulkImport ? "Hide" : "Show"}
                                    </Button>
                                </div>
                                {showBulkImport && (
                                    <CardDescription>
                                        Import multiple clients from Excel or export existing clients
                                    </CardDescription>
                                )}
                            </CardHeader>
                            {showBulkImport && (
                                <CardContent>
                                    <ClientImportExport />
                                </CardContent>
                            )}
                        </Card>
                    )}
                </div>
            )}

            {/* Selection Toolbar - Show when in selection mode */}
            {isSelectionMode && filteredClients.length > 0 && (
                <Card className="mb-4">
                    <CardContent className="py-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        checked={isAllSelected}
                                        onCheckedChange={handleSelectAll}
                                        ref={(el) => {
                                            if (el) {
                                                (el as any).indeterminate = isSomeSelected;
                                            }
                                        }}
                                    />
                                    <Label className="text-sm font-medium cursor-pointer" onClick={handleSelectAll}>
                                        {isAllSelected ? 'Deselect All' : 'Select All'}
                                    </Label>
                                </div>
                                <span className="text-sm text-muted-foreground">
                                    {selectedClientIds.size} of {filteredClients.length} selected
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Sort - Always visible, positioned before client cards */}
            {clients.length > 0 && (
                <div className="mb-4 flex items-center gap-4">
                    <Label htmlFor="sort" className="text-sm font-medium whitespace-nowrap">Sort By:</Label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger id="sort" className="w-[250px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="name-asc">Full Name (A-Z)</SelectItem>
                            <SelectItem value="name-desc">Full Name (Z-A)</SelectItem>
                            <SelectItem value="firstName-asc">First Name (A-Z)</SelectItem>
                            <SelectItem value="firstName-desc">First Name (Z-A)</SelectItem>
                            <SelectItem value="lastName-asc">Last Name (A-Z)</SelectItem>
                            <SelectItem value="lastName-desc">Last Name (Z-A)</SelectItem>
                            <SelectItem value="dateAdded-desc">Date Added (Newest)</SelectItem>
                            <SelectItem value="dateAdded-asc">Date Added (Oldest)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Clients List */}
            {
                filteredClients.length === 0 && clients.length > 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-16">
                            <Search className="h-16 w-16 text-blue-500 mb-4 opacity-50" />
                            <h3 className="text-lg font-medium mb-2">No clients found</h3>
                            <p className="text-muted-foreground text-center max-w-md mb-6">
                                Try adjusting your search or filter criteria
                            </p>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSearchQuery("");
                                    setSearchField("all");
                                    setDateAddedFilter({});
                                }}
                            >
                                Clear Filters
                            </Button>
                        </CardContent>
                    </Card>
                ) : clients.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-16">
                            <User className="h-16 w-16 text-muted-foreground mb-4 opacity-20" />
                            {activeTab === 'archived' ? (
                                <h3 className="text-lg font-medium text-muted-foreground">No Archived Clients Yet</h3>
                            ) : (
                                <>
                                    <h3 className="text-xl font-semibold mb-2">No clients yet</h3>
                                    <p className="text-muted-foreground text-center max-w-md mb-6">
                                        Add your first client to start managing your practice
                                    </p>
                                    <Button onClick={() => setIsAddDialogOpen(true)} className="bg-green-500 hover:bg-green-600 text-white">
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Your First Client
                                    </Button>
                                </>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <TooltipProvider>
                        <div className={`grid gap-4 transition-all ${
                            !showSearch && (!showBulkImport || activeTab === 'archived') 
                                ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6' 
                                : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                        }`}>
                            {filteredClients.map((client, index) => (
                            <motion.div
                                key={client.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Card
                                    className={`hover:shadow-md transition-all hover:border-primary/50 group relative ${
                                        isSelectionMode ? '' : 'cursor-pointer'
                                    } ${selectedClientIds.has(client.id) ? 'border-primary border-2' : ''}`}
                                    onClick={() => {
                                        if (isSelectionMode) {
                                            toggleClientSelection(client.id);
                                        } else {
                                            handleEdit(client);
                                        }
                                    }}
                                >
                                    {/* Checkbox - Show in selection mode */}
                                    {isSelectionMode && (
                                        <div 
                                            className="absolute top-2 left-2 z-10"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Checkbox
                                                checked={selectedClientIds.has(client.id)}
                                                onCheckedChange={() => toggleClientSelection(client.id)}
                                            />
                                        </div>
                                    )}
                                    {/* Action buttons - Top right */}
                                    <div 
                                        className="absolute top-2 right-2 z-10 flex items-center gap-1"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {/* Warning Icon */}
                                        {!client.newClientFormSigned && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleEdit(client, 'profile', true);
                                                        }}
                                                        className="cursor-pointer hover:opacity-80 transition-opacity"
                                                    >
                                                        <AlertTriangle 
                                                            className="h-4 w-4 text-amber-500 dark:text-amber-400" 
                                                        />
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>New Client Form not signed - Click to open and sign</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                        {/* Delete Button - Always visible */}
                                        {!isSelectionMode && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                                        onClick={() => handleGDPRDeleteClick(client.id)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Delete client</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                    </div>
                                    <CardContent className={`px-3 py-1 ${isSelectionMode ? 'pl-10' : ''}`}>
                                        <div className="overflow-hidden min-w-0">
                                            <div className="flex items-baseline gap-1.5">
                                                <p className="font-medium truncate text-sm leading-none flex-1">
                                                    {client.firstName ? `${client.firstName} ${client.lastName}` : client.name}
                                                </p>
                                            </div>
                                            {client.preferredName && (
                                                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                                    Known as: "{client.preferredName}"
                                                </p>
                                            )}
                                            <div className="mt-0.5 space-y-0.5">
                                                {client.email && (
                                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                                                        <Mail className="h-2.5 w-2.5 shrink-0" />
                                                        {client.email}
                                                    </div>
                                                )}
                                                {client.phone && (
                                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                                                        <Phone className="h-2.5 w-2.5 shrink-0" />
                                                        {client.phone}
                                                    </div>
                                                )}
                                                {getLastAppointment(client.name) && (
                                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                                                        <Calendar className="h-2.5 w-2.5 shrink-0 text-green-500" />
                                                        <span>Last: {new Date(getLastAppointment(client.name)!.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                                    </div>
                                                )}
                                                {getNextAppointment(client.name) && (
                                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                                                        <Calendar className="h-2.5 w-2.5 shrink-0 text-green-500" />
                                                        <span>Next: {new Date(getNextAppointment(client.name)!.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                                    </div>
                                                )}
                                            </div>
                                            {/* Relationships */}
                                            {getClientRelationships(client).length > 0 && (
                                                <div className="mt-1.5 pt-1.5 border-t border-blue-200 dark:border-blue-800">
                                                    <div className="flex items-center gap-1 flex-wrap">
                                                        <Users className="h-2.5 w-2.5 shrink-0 text-blue-600 dark:text-blue-400" />
                                                        <span className="text-[9px] text-blue-600 dark:text-blue-400">Relationships:</span>
                                                        <div className="flex items-center gap-0.5 flex-wrap">
                                                            {getClientRelationships(client).map((rel, idx) => {
                                                                const initials = rel.relatedClientName.split(" ").map((n: string) => n[0] || "").join("").toUpperCase();
                                                                return (
                                                                    <span
                                                                        key={idx}
                                                                        className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-[9px] text-blue-700 dark:text-blue-300 whitespace-nowrap"
                                                                    >
                                                                        {rel.type}: {initials}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {/* Stats Row */}
                                            <div className="mt-2 pt-2 border-t flex items-center justify-between text-[10px] text-muted-foreground">
                                                {(() => {
                                                    const actualSessions = getClientAppointments(client.name).length;
                                                    return actualSessions > 0 ? (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <button
                                                                    className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleEdit(client, 'sessions');
                                                                    }}
                                                                >
                                                                    <Calendar className="h-3 w-3 text-green-500" />
                                                                    <span>{actualSessions}</span>
                                                                </button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>View Sessions</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    ) : (
                                                        <div
                                                            className="flex items-center gap-1 text-green-300/80 cursor-default"
                                                            title="No Sessions"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <Calendar className="h-3 w-3 text-green-300/80" />
                                                            <span>0</span>
                                                        </div>
                                                    );
                                                })()}
                                                {(getRecordingCount(client.name) > 0) ? (
                                                    <Link
                                                        href={`/recordings?client=${encodeURIComponent(client.name)}`}
                                                        className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                                                        title="View Recordings"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <Mic className="h-3 w-3 text-purple-500" />
                                                        <span>{getRecordingCount(client.name)}</span>
                                                    </Link>
                                                ) : (
                                                    <div
                                                        className="flex items-center gap-1 text-purple-300/80 cursor-default"
                                                        title="No Recordings"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <Mic className="h-3 w-3 text-purple-300/80" />
                                                        <span>0</span>
                                                    </div>
                                                )}
                                                {((client.documents || []).length > 0) ? (
                                                    <Link
                                                        href={`/documents?client=${encodeURIComponent(client.name)}`}
                                                        className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                                                        title="View Documents"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <FileText className="h-3 w-3 text-orange-500" />
                                                        <span>{(client.documents || []).length}</span>
                                                    </Link>
                                                ) : (
                                                    <div
                                                        className="flex items-center gap-1 text-orange-300/80 cursor-default"
                                                        title="No Documents"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <FileText className="h-3 w-3 text-orange-300/80" />
                                                        <span>0</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                        </div>
                    </TooltipProvider>
                )
            }
        </div >
    );
}

export default function ClientsPage({ autoOpenAddDialog = false }: ClientsPageProps) {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ClientsPageContent autoOpenAddDialog={autoOpenAddDialog} />
        </Suspense>
    );
}
