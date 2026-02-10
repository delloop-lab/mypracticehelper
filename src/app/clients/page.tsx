"use client";

import { useState, useEffect, useMemo, Suspense, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import mammoth from "mammoth";
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
import { Plus, User, Mail, Phone, Calendar, FileText, Mic, Hash, Edit, Trash2, Upload, File, ExternalLink, Users, FileSpreadsheet, ChevronDown, ChevronRight, RotateCcw, Search, Filter, SortAsc, SortDesc, CheckCircle2, AlertTriangle, Globe, Sparkles, Loader2, X, Play, Pause, Save, Clock, ArrowLeft } from "lucide-react";
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
    nationality?: string;
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
        nationality: "",
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
                        client.nationality || '',
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
    }, [activeTab]);

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

    // Load therapist name on mount (from logged-in user)
    useEffect(() => {
        const loadTherapist = async () => {
            try {
                const response = await fetch('/api/auth/me');
                if (response.ok) {
                    const userData = await response.json();
                    const nameParts: string[] = [];
                    if (userData.first_name && userData.first_name.trim()) {
                        nameParts.push(userData.first_name.trim());
                    }
                    if (userData.last_name && userData.last_name.trim()) {
                        nameParts.push(userData.last_name.trim());
                    }
                    if (nameParts.length > 0) {
                        setCurrentTherapist(nameParts.join(' '));
                    } else if (userData.email) {
                        const emailParts = userData.email.split('@')[0].split('.');
                        const name = emailParts.map((part: string) => 
                            part.charAt(0).toUpperCase() + part.slice(1)
                        ).join(' ');
                        setCurrentTherapist(name);
                    }
                }
            } catch (error) {
                console.error('[Clients] Error fetching therapist:', error);
            }
        };
        loadTherapist();
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
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const url = activeTab === 'archived' 
                ? `/api/clients?archived=true&t=${Date.now()}` 
                : `/api/clients?t=${Date.now()}`;
            
            const response = await fetch(url, {
                credentials: 'include',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            const data = response.ok ? await response.json() : [];
            setClients(data);
            loadAppointments();
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('[Clients Page] Error loading clients:', error);
            }
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
    const isHandlingBackRef = useRef(false);
    
    // Session note counts for displaying indicators on session cards
    const [sessionNoteCounts, setSessionNoteCounts] = useState<Record<string, { recordings: number; written: number; admin: number }>>({});

    // AI Clinical Assessment State
    const [currentTherapist, setCurrentTherapist] = useState<string>("");
    const [isProcessingAI, setIsProcessingAI] = useState(false);
    const [aiAssessmentResult, setAiAssessmentResult] = useState<string | null>(null);
    const [aiAssessmentDialogOpen, setAiAssessmentDialogOpen] = useState(false);
    const [currentNoteForAssessment, setCurrentNoteForAssessment] = useState<any>(null);

    // Document Preview State
    const [documentPreviewOpen, setDocumentPreviewOpen] = useState(false);
    const [documentPreviewContent, setDocumentPreviewContent] = useState<string>("");
    const [documentPreviewName, setDocumentPreviewName] = useState<string>("");
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [notificationModal, setNotificationModal] = useState<{ open: boolean; type: 'success' | 'error'; message: string }>({ open: false, type: 'success', message: '' });
    const [editingTranscriptId, setEditingTranscriptId] = useState<string | null>(null);
    const [deleteTranscriptConfirmation, setDeleteTranscriptConfirmation] = useState<{ open: boolean; note: any | null }>({ open: false, note: null });
    const [deleteNoteConfirmation, setDeleteNoteConfirmation] = useState<{ open: boolean; note: any | null }>({ open: false, note: null });
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
    const [isAdminNoteDialogOpen, setIsAdminNoteDialogOpen] = useState(false);
    const [adminNoteContent, setAdminNoteContent] = useState("");
    const [isSavingAdminNote, setIsSavingAdminNote] = useState(false);
    const [isWrittenNoteDialogOpen, setIsWrittenNoteDialogOpen] = useState(false);
    const [writtenNoteContent, setWrittenNoteContent] = useState("");
    const [isSavingWrittenNote, setIsSavingWrittenNote] = useState(false);
    const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
    const transcriptTextareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

    // Log Past Session State
    const [isLogSessionDialogOpen, setIsLogSessionDialogOpen] = useState(false);
    const [logSessionData, setLogSessionData] = useState({
        date: new Date().toISOString().split('T')[0],
        time: "12:00",
        duration: 50,
        type: "Therapy Session",
        notes: ""
    });

    // Get color classes for appointment type
    const getAppointmentTypeColor = (typeName: string): { bg: string; text: string } => {
        const normalizedName = typeName.toLowerCase();
        
        // Map common appointment types to colors
        if (normalizedName.includes('discovery')) {
            return { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-800 dark:text-purple-200' };
        }
        if (normalizedName.includes('initial') || normalizedName.includes('consultation')) {
            return { bg: 'bg-cyan-100 dark:bg-cyan-900', text: 'text-cyan-800 dark:text-cyan-200' };
        }
        if (normalizedName.includes('couples')) {
            return { bg: 'bg-pink-100 dark:bg-pink-900', text: 'text-pink-800 dark:text-pink-200' };
        }
        if (normalizedName.includes('family')) {
            return { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-800 dark:text-orange-200' };
        }
        if (normalizedName.includes('singles')) {
            return { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200' };
        }
        // Default color for therapy sessions and others
        return { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-200' };
    };

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

    // Handle highlight and session query parameters (from session-notes page)
    // SIMPLE: Process once when both params exist AND data is loaded
    const hasProcessedParamsRef = useRef<string>('');
    
    // Extract values from searchParams - these are primitives so they'll only trigger useEffect when they actually change
    const highlightClientId = searchParams.get('highlight') || '';
    const sessionId = searchParams.get('session') || '';

    const handleOpenSession = async (session: Appointment, tab: "notes" | "attachments") => {
        setActiveSession(session);
        setSessionDialogTab(tab);
        // Load session note counts to ensure recordings count is available for summary cards
        // Use editingClient if available, otherwise find client by session's clientName
        const clientForCounts = editingClient || clients.find(c => c.name === session.clientName);
        if (clientForCounts) {
            loadSessionNoteCounts(clientForCounts.name);
        }
        if (tab === "notes") {
            await loadSessionNotes(session.id);
        }
    };

    const handleBackToSessions = () => {
        if (isHandlingBackRef.current) return;
        
        const targetClient =
            editingClient ||
            (activeSession ? clients.find(c => c.name === activeSession.clientName) : null);

        if (!targetClient) {
            setActiveSession(null);
            return;
        }

        // Set flag FIRST to prevent dialog close handlers from interfering
        isHandlingBackRef.current = true;

        // Mark current paramKey as processed to prevent useEffect from reopening session
        if (highlightClientId && sessionId) {
            const currentParamKey = `${highlightClientId}-${sessionId}`;
            hasProcessedParamsRef.current = currentParamKey;
        }

        // Ensure client dialog stays open FIRST, before closing session dialog
        const actualSessions = getClientAppointments(targetClient.name).length;
        const nextApt = getNextAppointment(targetClient.name);
        setEditingClient(targetClient);
        setFormData({
            ...targetClient,
            sessions: actualSessions,
            nextAppointment: nextApt ? new Date(nextApt.date).toISOString().slice(0, 16) : ''
        });
        setIsAddDialogOpen(true);
        setClientDialogTab('sessions');
        
        // Now close session dialog
        setActiveSession(null);
        
        // Load session note counts
        loadSessionNoteCounts(targetClient.name);

        // Reset flag after a delay to allow state updates to complete
        // This prevents the useEffect from reopening the session dialog
        setTimeout(() => {
            isHandlingBackRef.current = false;
        }, 500);
    };
    
    useEffect(() => {
        const paramKey = highlightClientId ? `${highlightClientId}-${sessionId}` : '';
        
        // Reset when params cleared
        if (!highlightClientId) {
            hasProcessedParamsRef.current = '';
            return;
        }
        
        // Skip if already processed this exact param combo
        if (hasProcessedParamsRef.current === paramKey) {
            return;
        }
        
        // Skip if we're currently handling back navigation
        if (isHandlingBackRef.current) {
            return;
        }
        
        // Skip if data not loaded
        if (clients.length === 0) {
            return;
        }
        
        const client = clients.find(c => c.id === highlightClientId);
        if (!client) {
            hasProcessedParamsRef.current = paramKey; // Mark as processed even if not found
            return;
        }
        
        // Mark as processed IMMEDIATELY
        hasProcessedParamsRef.current = paramKey;
        console.log('[Clients] ✅ Processing URL params for:', client.name);
        
        // Update state
        setEditingClient(client);
        setFormData(client);
        setIsAddDialogOpen(true);
        setClientDialogTab('sessions');
        loadSessionNoteCounts(client.name);
        
        // Handle session - but skip if we're currently handling back navigation or if session dialog is closed
        if (sessionId && appointments.length > 0 && !isHandlingBackRef.current && !activeSession) {
            const session = appointments.find(apt => apt.id === sessionId);
            if (session) {
                setTimeout(() => handleOpenSession(session, "notes"), 500);
            }
        }
        
        // DON'T clear URL - prevents infinite loop
        // URL stays as /clients?highlight=...&session=... but that's fine
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [highlightClientId, sessionId, clients.length, appointments.length, activeSession]); // Use extracted values, not searchParams object

    useEffect(() => {
        if (isAddDialogOpen && editingClient && clientDialogTab === 'sessions') {
            loadSessionNoteCounts(editingClient.name);
        }
    }, [isAddDialogOpen, editingClient, clientDialogTab]);

    const loadSessionNotes = async (sessionId: string) => {
        setIsLoadingSessionNotes(true);
        try {
            console.log('[Clients Page] Loading session notes for:', sessionId);
            
            // Add timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                console.log('[Clients Page] Session notes fetch timeout after 15 seconds');
                controller.abort();
            }, 15000);
            
            const response = await fetch('/api/session-notes', {
                signal: controller.signal,
                credentials: 'include'
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const allNotes = await response.json();
                console.log('[Clients Page] Loaded', allNotes.length, 'total notes');
                
                // Get the active session to match by client and date
                const session = appointments.find(apt => apt.id === sessionId);
                if (!session) {
                    setSessionNotes([]);
                    return;
                }

                // Calculate session date outside filter so it's accessible everywhere
                const sessionClientId = editingClient?.id;
                const sessionDate = new Date(session.date).toISOString().split('T')[0];

                // Filter notes for this specific session
                const notesForSession = allNotes.filter((note: any) => {
                    // For session notes: match by session_id first
                    if (note.session_id === sessionId || note.sessionId === sessionId) {
                        return true;
                    }
                    
                    // Also match by client ID and date for session notes
                    const noteClientId = note.clientId || note.client_id;
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
                    
                    // For recordings: match by session_id first, then fallback to client ID and date
                    if (note.source === 'recording') {
                        // Primary: Show recording if it's explicitly linked to THIS session
                        if (note.sessionId === sessionId || note.session_id === sessionId) {
                            console.log('[Load Session Notes] Recording matched by session_id:', note.id);
                            return true;
                        }
                        
                        // Fallback: Match recordings by client ID and date if sessionId is not set
                        // This handles cases where recordings weren't properly linked to sessions
                        const recordingClientId = note.clientId || note.client_id;
                        const recordingClientName = note.clientName;
                        // Prefer sessionDate (how /api/session-notes groups recordings under a session),
                        // then fall back to raw creation dates
                        const recordingDate = note.sessionDate || note.date || note.created_at || note.createdDate;
                        
                        // Match by client ID and date
                        if (recordingClientId && sessionClientId && recordingClientId === sessionClientId) {
                            if (recordingDate) {
                                const recordingDateStr = new Date(recordingDate).toISOString().split('T')[0];
                                console.log('[Load Session Notes] Checking recording date match:', {
                                    recordingId: note.id,
                                    recordingDate: recordingDateStr,
                                    sessionDate: sessionDate,
                                    match: recordingDateStr === sessionDate
                                });
                                if (recordingDateStr === sessionDate) {
                                    console.log('[Load Session Notes] Recording matched by client ID and date (fallback):', note.id);
                                    return true;
                                }
                            } else {
                                console.log('[Load Session Notes] Recording has no date:', note.id);
                            }
                        } else {
                            console.log('[Load Session Notes] Recording client ID mismatch:', {
                                recordingId: note.id,
                                recordingClientId: recordingClientId,
                                sessionClientId: sessionClientId,
                                match: recordingClientId === sessionClientId
                            });
                        }
                        
                        // Fallback: Match by client name and date
                        if (recordingClientName && session.clientName && 
                            recordingClientName.toLowerCase() === session.clientName.toLowerCase()) {
                            if (recordingDate) {
                                const recordingDateStr = new Date(recordingDate).toISOString().split('T')[0];
                                if (recordingDateStr === sessionDate) {
                                    console.log('[Load Session Notes] Recording matched by client name and date (fallback):', note.id);
                                    return true;
                                }
                            }
                        } else {
                            console.log('[Load Session Notes] Recording client name mismatch:', {
                                recordingId: note.id,
                                recordingClientName: recordingClientName,
                                sessionClientName: session.clientName
                            });
                        }
                        
                        // Don't show recordings that don't match this session
                        return false;
                    }
                    
                    return false;
                });

                // Fallback: also include any recording notes that match this client + session date
                // but weren't caught by the above logic (e.g. slight metadata mismatches).
                const notesForSessionIds = new Set(notesForSession.map((n: any) => n.id));
                const extraRecordingNotes = allNotes.filter((note: any) => {
                    if (note.source !== 'recording') return false;
                    if (!note.id || notesForSessionIds.has(note.id)) return false;

                    const recordingClientId = note.clientId || note.client_id;
                    const recordingClientName = note.clientName;
                    const recordingSessionDate = note.sessionDate
                        ? new Date(note.sessionDate).toISOString().split('T')[0]
                        : null;

                    const matchesClient =
                        (recordingClientId && sessionClientId && recordingClientId === sessionClientId) ||
                        (recordingClientName && session.clientName &&
                         recordingClientName.toLowerCase() === session.clientName.toLowerCase());

                    return !!(matchesClient && recordingSessionDate === sessionDate);
                });

                const allNotesForSession = [
                    ...notesForSession,
                    ...extraRecordingNotes,
                ];
                
                console.log(`[Load Session Notes] Session ID: ${sessionId}, Client: ${session.clientName}, Client ID: ${editingClient?.id}, Date: ${sessionDate}`);
                console.log(`[Load Session Notes] Total notes available: ${allNotes.length}`);
                
                // Log all recordings for debugging
                const allRecordings = allNotes.filter((n: any) => n.source === 'recording');
                console.log(`[Load Session Notes] Total recordings available: ${allRecordings.length}`);
                allRecordings.forEach((rec: any) => {
                    console.log(`[Load Session Notes] Recording:`, {
                        id: rec.id,
                        sessionId: rec.sessionId || rec.session_id,
                        clientId: rec.clientId || rec.client_id,
                        clientName: rec.clientName,
                        date: rec.date || rec.created_at || rec.createdDate,
                        hasTranscript: !!(rec.transcript && rec.transcript.trim())
                    });
                });
                
                console.log(`[Load Session Notes] Notes for this client:`, allNotes.filter((n: any) => {
                    const noteClientId = n.clientId || n.client_id;
                    return noteClientId === editingClient?.id || n.clientName?.toLowerCase() === session.clientName?.toLowerCase();
                }));
                console.log(`[Load Session Notes] Found ${allNotesForSession.length} notes for session ${sessionId} (client: ${session.clientName})`);
                console.log(`[Load Session Notes] Matched notes:`, allNotesForSession.map((n: any) => ({
                    id: n.id,
                    source: n.source,
                    sessionId: n.sessionId || n.session_id,
                    hasTranscript: !!(n.transcript && n.transcript.trim()),
                    hasContent: !!(n.content && n.content.trim())
                })));
                
                // Deduplicate notes by content and timestamp to prevent showing the same voice note twice
                // This can happen if the same recording exists in both recordings and session_notes tables
                const seenContentKeys = new Set<string>();
                const deduplicatedNotes = allNotesForSession.filter((note: any) => {
                    // Filter out empty notes - MUST have content OR transcript OR audioURL to be displayable
                    // For recordings, audioURL is sufficient (transcript can be added later)
                    const hasContent = note.content && typeof note.content === 'string' && note.content.trim() !== '';
                    const hasTranscript = note.transcript && typeof note.transcript === 'string' && note.transcript.trim() !== '';
                    const hasAudio = note.audioURL && typeof note.audioURL === 'string' && note.audioURL.trim() !== '';
                    
                    // For recordings, allow them through if they have audioURL (even without transcript yet)
                    // For other notes, require content or transcript
                    if (note.source === 'recording') {
                        if (!hasContent && !hasTranscript && !hasAudio) {
                            console.log('[Load Session Notes] Filtering out recording with no content/transcript/audio:', note.id);
                            return false;
                        }
                    } else {
                        // Non-recording notes must have content or transcript
                        if (!hasContent && !hasTranscript) {
                            console.log('[Load Session Notes] Filtering out empty/deleted note:', note.id, note.source, { content: note.content, transcript: note.transcript });
                            return false;
                        }
                    }
                    
                    // For recordings, include the ID in the deduplication key to avoid false duplicates
                    // (Two different recordings might have similar transcripts)
                    // For other notes, use content + timestamp
                    const content = (note.content || note.transcript || '').trim().substring(0, 200);
                    const timestamp = note.createdDate || note.created_at || '';
                    const dateKey = timestamp ? new Date(timestamp).toISOString().substring(0, 16) : ''; // Round to minute
                    
                    // Include note ID for recordings to prevent false duplicates
                    const key = note.source === 'recording' && note.id 
                        ? `${note.source}-${note.id}-${content}-${dateKey}`
                        : `${content}-${dateKey}`;
                    
                    if (seenContentKeys.has(key)) {
                        console.log('[Load Session Notes] Removing duplicate note:', note.id, note.source);
                        return false;
                    }
                    seenContentKeys.add(key);
                    return true;
                });
                
                if (deduplicatedNotes.length !== allNotesForSession.length) {
                    console.log(`[Load Session Notes] Removed ${allNotesForSession.length - deduplicatedNotes.length} duplicate notes`);
                }
                
                setSessionNotes(deduplicatedNotes);
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.error('[Clients Page] Session notes fetch was aborted (timeout)');
            } else {
                console.error('[Clients Page] Error loading session notes:', error);
            }
        } finally {
            setIsLoadingSessionNotes(false);
        }
    };

    // Load note counts for all sessions of a client (for displaying indicators on session cards)
    const loadSessionNoteCounts = async (clientName: string) => {
        try {
            const [notesResponse, recordingsResponse] = await Promise.all([
                fetch('/api/session-notes'),
                fetch('/api/recordings'),
            ]);

            if (notesResponse.ok) {
                const allNotes = await notesResponse.json();

                // Filter notes for this client
                const clientNotes = allNotes.filter((note: any) =>
                    note.clientName?.toLowerCase() === clientName.toLowerCase()
                );

                // Group counts by session ID
                const counts: Record<string, { recordings: number; written: number; admin: number }> = {};
                const recordingIdsFromNotes = new Set<string>();

                clientNotes.forEach((note: any) => {
                    const sessionId = note.sessionId || note.session_id;
                    if (!sessionId) return;

                    // Skip soft-deleted notes (content, transcript, and audio_url are all null/empty)
                    const hasContent = note.content && note.content.trim().length > 0;
                    const hasTranscript = note.transcript && note.transcript.trim().length > 0;
                    const hasAudio = note.audioURL || note.audio_url;
                    
                    // Only count notes that have actual content
                    if (!hasContent && !hasTranscript && !hasAudio) {
                        return; // Skip empty/soft-deleted notes
                    }

                    if (!counts[sessionId]) {
                        counts[sessionId] = { recordings: 0, written: 0, admin: 0 };
                    }

                    // Check note type
                    if (note.source === 'recording') {
                        // Store both the note ID (recording-{id}) and the actual recording ID for deduplication
                        if (note.id) {
                            recordingIdsFromNotes.add(note.id);
                            // Also add the actual recording ID if available (for deduplication)
                            if (note.recordingId) {
                                recordingIdsFromNotes.add(note.recordingId);
                            } else if (note.id.startsWith('recording-')) {
                                // Extract numeric ID from "recording-{id}" format
                                const numericId = note.id.replace('recording-', '');
                                recordingIdsFromNotes.add(numericId);
                            }
                        }
                        counts[sessionId].recordings++;
                    } else if (note.source === 'written_session_note' || (note.id && note.id.startsWith('written-'))) {
                        counts[sessionId].written++;
                    } else if (note.source === 'admin' || (note.id && note.id.startsWith('admin-'))) {
                        counts[sessionId].admin++;
                    }
                });

                // Add recordings linked to sessions (if not already counted via session notes)
                if (recordingsResponse.ok) {
                    const allRecordings = await recordingsResponse.json();
                    const client = clients.find(c => c.name === clientName);
                    const normalizedClientName = clientName.trim().toLowerCase();

                    allRecordings.forEach((recording: any) => {
                        const sessionId = recording.sessionId || recording.session_id;
                        if (!sessionId) return;

                        const matchesClientId = client && (recording.client_id === client.id || recording.clientId === client.id);
                        const matchesClientName = recording.clientName?.trim().toLowerCase() === normalizedClientName;
                        if (!matchesClientId && !matchesClientName) return;

                        if (!counts[sessionId]) {
                            counts[sessionId] = { recordings: 0, written: 0, admin: 0 };
                        }

                        // Check if this recording was already counted via session notes
                        // Check both the recording ID and the "recording-{id}" format
                        const recordingId = recording.id?.toString() || '';
                        const recordingNoteId = `recording-${recordingId}`;
                        const alreadyCounted = recordingIdsFromNotes.has(recordingId) || recordingIdsFromNotes.has(recordingNoteId);
                        
                        if (!alreadyCounted) {
                            counts[sessionId].recordings++;
                        }
                    });
                }

                setSessionNoteCounts(counts);
            }
        } catch (error) {
            console.error('Error loading session note counts:', error);
        }
    };

    const handleViewAttachment = async (doc: ClientDocument) => {
        if (!doc.url) {
            alert('No URL available for this attachment');
            return;
        }

        // Get file extension to determine file type
        const fileExtension = doc.name.split('.').pop()?.toLowerCase() || '';
        const officeTypes = ['odt', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'ods', 'odp'];
        const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
        const pdfType = 'pdf';

        // Build full URL
        const fullUrl = doc.url.startsWith('http') ? doc.url : `${window.location.origin}${doc.url}`;

        // For .docx files, use mammoth.js to convert to HTML and display in preview dialog
        if (fileExtension === 'docx') {
            setIsLoadingPreview(true);
            setDocumentPreviewName(doc.name);
            setDocumentPreviewOpen(true);
            setDocumentPreviewContent(""); // Clear previous content
            
            try {
                // Fetch the document as an ArrayBuffer
                const response = await fetch(fullUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch document: ${response.statusText}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                
                // Convert docx to HTML using mammoth
                const result = await mammoth.convertToHtml({ arrayBuffer });
                
                // Set the HTML content for preview
                setDocumentPreviewContent(result.value || '<p>Document converted successfully but content is empty.</p>');
                
                // Log any warnings (like unsupported features)
                if (result.messages.length > 0) {
                    console.log('Document conversion warnings:', result.messages);
                }
            } catch (error: any) {
                console.error('Error converting document:', error);
                setDocumentPreviewContent(`<div class="p-4 text-red-600"><p><strong>Error loading document:</strong></p><p>${error?.message || 'Unknown error occurred'}</p><p class="mt-2 text-sm">Please try downloading the file instead.</p></div>`);
            } finally {
                setIsLoadingPreview(false);
            }
        } else if (fileExtension === pdfType) {
            // PDFs can be viewed directly
            window.open(fullUrl, '_blank', 'noopener,noreferrer');
        } else if (imageTypes.includes(fileExtension)) {
            // Images can be viewed directly
            window.open(fullUrl, '_blank', 'noopener,noreferrer');
        } else if (officeTypes.includes(fileExtension)) {
            // Other Office files - try to open directly or show message
            // For .doc, .xls, .ppt (older formats), we can't easily preview them
            window.open(fullUrl, '_blank', 'noopener,noreferrer');
        } else {
            // For other file types, try to open directly
            window.open(fullUrl, '_blank', 'noopener,noreferrer');
        }
    };

    const saveActiveSession = async () => {
        if (!activeSession) return;

        const updatedAppointments = appointments.map(apt =>
            apt.id === activeSession.id ? activeSession : apt
        );

        setAppointments(updatedAppointments);

        try {
            const response = await fetch('/api/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedAppointments),
            });
            
            if (response.ok) {
                // Reload appointments from server to ensure we have the latest data
                const data = await response.json();
                if (data && Array.isArray(data)) {
                    setAppointments(data);
                } else {
                    // Fallback: force reload appointments
                    await loadAppointments(true);
                }
                setActiveSession(null);
                setNotificationModal({ open: true, type: 'success', message: 'Attachments saved successfully' });
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                setNotificationModal({ open: true, type: 'error', message: `Failed to save attachments: ${errorData.error || 'Please try again'}` });
            }
        } catch (error) {
            console.error('Error saving session:', error);
            setNotificationModal({ open: true, type: 'error', message: 'Error saving attachments. Please try again.' });
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
            // Also update the appointments array immediately so the icon updates
            setAppointments(prev => prev.map(apt => 
                apt.id === activeSession?.id 
                    ? { ...apt, attachments: apt.attachments?.filter((_, i) => i !== deleteSessionDocConfirm.index) || [] }
                    : apt
            ));
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
        console.log('[Clients Page] useEffect: About to load appointments...');
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

    const loadAppointments = async (force = false) => {
        if (!force && appointments.length > 0) return;
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch('/api/appointments', {
                signal: controller.signal,
                credentials: 'include'
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                setAppointments(data);
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('[Clients Page] Error loading appointments:', error);
            }
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

    // Check if client hasn't had a session in more than 90 days
    const isClientInactive = (clientName: string): boolean => {
        const lastAppointment = getLastAppointment(clientName);
        const nextAppointment = getNextAppointment(clientName);
        
        // If client has an upcoming appointment, they are active
        if (nextAppointment) {
            return false;
        }
        
        // If no past appointments and no upcoming appointments - consider as inactive
        if (!lastAppointment) {
            return true;
        }
        
        // Check if last appointment was more than 90 days ago
        const lastDate = new Date(lastAppointment.date);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        
        return daysDiff > 90;
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
        
        // If editing an existing client, include clientId to save document immediately
        if (editingClient?.id) {
            uploadFormData.append('clientId', editingClient.id);
        }

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

                // Update local form state
                setFormData(prev => ({
                    ...prev,
                    documents: [...(prev.documents || []), newDoc]
                }));

                // If editing an existing client, also update the clients array immediately
                // (the API already saved it to the database)
                if (editingClient?.id) {
                    setClients(prevClients => prevClients.map(c => 
                        c.id === editingClient.id 
                            ? { ...c, documents: [...(c.documents || []), newDoc] }
                            : c
                    ));
                }
            }
        } catch (error) {
            console.error('Error uploading document:', error);
        }
    };

    const handleRemoveDocumentClick = (index: number) => {
        setDeleteDocumentConfirm({ isOpen: true, index });
    };

    const confirmRemoveDocument = async () => {
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
                
                // Save to database immediately (no need to click Update)
                try {
                    await fetch('/api/clients', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatedClients),
                    });
                } catch (error) {
                    console.error('Error saving client after document removal:', error);
                }
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
                nationality: formData.nationality || "",
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
        
        // Load session note counts when opening sessions tab
        if (tab === 'sessions') {
            loadSessionNoteCounts(client.name);
        }
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

    // Generate AI Clinical Assessment from transcript
    const handleGenerateAIAssessment = async (transcript: string, clientName: string, sessionDate?: string, duration?: number, note?: any) => {
        if (!transcript || transcript.trim() === '') {
            alert('No transcript available to analyze');
            return;
        }

        setIsProcessingAI(true);
        // Store the note for later saving
        setCurrentNoteForAssessment(note || null);
        try {
            const response = await fetch('/api/ai/process-transcript', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transcript,
                    clientName,
                    therapistName: currentTherapist || undefined,
                    sessionDate,
                    duration
                })
            });

            if (response.ok) {
                const data = await response.json();
                setAiAssessmentResult(data.structured || 'No assessment generated');
                setAiAssessmentDialogOpen(true);
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                setNotificationModal({ open: true, type: 'error', message: `Failed to generate AI assessment: ${errorData.error || 'Please try again'}` });
            }
        } catch (error) {
            console.error('Error generating AI assessment:', error);
            setNotificationModal({ open: true, type: 'error', message: 'Error generating AI assessment. Please try again.' });
        } finally {
            setIsProcessingAI(false);
        }
    };

    // Save AI Assessment to session note
    const handleSaveAIAssessmentToNote = async () => {
        if (!aiAssessmentResult || !currentNoteForAssessment) {
            setNotificationModal({ open: true, type: 'error', message: 'No assessment or note available to save' });
            return;
        }

        try {
            // Update the note with the AI assessment as content
            // IMPORTANT: Preserve all original note properties (spread operator) and explicitly preserve
            // audioURL and other recording-related fields that might be needed for playback icons
            const updatedNote = {
                ...currentNoteForAssessment,
                content: aiAssessmentResult,
                // Keep the transcript separate
                transcript: currentNoteForAssessment.transcript || null,
                // Explicitly preserve audioURL to ensure playback icons remain visible
                audioURL: currentNoteForAssessment.audioURL || null,
                // Preserve the note ID and source to maintain proper identification
                id: currentNoteForAssessment.id || null,
                source: currentNoteForAssessment.source || null
            };

            // Save via session notes API
            const response = await fetch('/api/session-notes', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([updatedNote])
            });

            if (response.ok) {
                // Reload session notes to show the updated content
                if (activeSession) {
                    await loadSessionNotes(activeSession.id);
                }
                setAiAssessmentDialogOpen(false);
                setAiAssessmentResult(null);
                setCurrentNoteForAssessment(null);
                setNotificationModal({ open: true, type: 'success', message: 'AI Assessment saved to session note successfully' });
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                setNotificationModal({ open: true, type: 'error', message: `Failed to save assessment: ${errorData.error || 'Please try again'}` });
            }
        } catch (error) {
            console.error('Error saving AI assessment:', error);
            setNotificationModal({ open: true, type: 'error', message: 'Error saving AI assessment. Please try again.' });
        }
    };

    // Handle transcript editing
    const handleEditTranscript = useCallback((note: any) => {
        setEditingTranscriptId(note.id);
        // Focus the textarea after a brief delay to ensure it's rendered
        setTimeout(() => {
            const textarea = transcriptTextareaRefs.current.get(note.id);
            if (textarea) {
                textarea.focus();
                // Move cursor to end
                textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            }
        }, 0);
    }, []);

    const handleSaveTranscript = async (note: any) => {
        // Get value directly from the textarea ref (uncontrolled)
        const textarea = transcriptTextareaRefs.current.get(note.id);
        const transcriptValue = textarea?.value || '';
        if (!transcriptValue.trim()) {
            setNotificationModal({ open: true, type: 'error', message: 'Transcript cannot be empty' });
            return;
        }

        try {
            const updatedNote = {
                ...note,
                transcript: transcriptValue.trim()
            };

            const response = await fetch('/api/session-notes', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([updatedNote])
            });

            if (response.ok) {
                if (activeSession) {
                    await loadSessionNotes(activeSession.id);
                }
                transcriptTextareaRefs.current.delete(note.id);
                setEditingTranscriptId(null);
                setNotificationModal({ open: true, type: 'success', message: 'Transcript updated successfully' });
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                setNotificationModal({ open: true, type: 'error', message: `Failed to update transcript: ${errorData.error || 'Please try again'}` });
            }
        } catch (error) {
            console.error('Error saving transcript:', error);
            setNotificationModal({ open: true, type: 'error', message: 'Error saving transcript. Please try again.' });
        }
    };

    const handleCancelEditTranscript = () => {
        setEditingTranscriptId(null);
    };

    const handleDeleteTranscript = (note: any) => {
        setDeleteTranscriptConfirmation({ open: true, note });
    };

    const confirmDeleteTranscript = async () => {
        const note = deleteTranscriptConfirmation.note;
        if (!note) return;

        try {
            // Delete both transcript and AI assessment (content) if it exists
            const updatedNote = {
                ...note,
                transcript: null,
                content: null // Also delete AI assessment
            };

            const response = await fetch('/api/session-notes', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([updatedNote])
            });

            if (response.ok) {
                if (activeSession) {
                    await loadSessionNotes(activeSession.id);
                }
                setNotificationModal({ open: true, type: 'success', message: 'Transcript and AI assessment deleted successfully' });
                setDeleteTranscriptConfirmation({ open: false, note: null });
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                setNotificationModal({ open: true, type: 'error', message: `Failed to delete transcript: ${errorData.error || 'Please try again'}` });
            }
        } catch (error) {
            console.error('Error deleting transcript:', error);
            setNotificationModal({ open: true, type: 'error', message: 'Error deleting transcript. Please try again.' });
        }
    };

    // Handle deleting admin or written session note
    const handleDeleteNote = (note: any) => {
        setDeleteNoteConfirmation({ open: true, note });
    };

    const confirmDeleteNote = async () => {
        const note = deleteNoteConfirmation.note;
        if (!note) return;

        try {
            // Set content to null to soft-delete the note
            const updatedNote = {
                ...note,
                content: null,
                transcript: null
            };

            const response = await fetch('/api/session-notes', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([updatedNote])
            });

            if (response.ok) {
                if (activeSession) {
                    await loadSessionNotes(activeSession.id);
                }
                // Refresh session note counts to update icons
                if (editingClient) {
                    await loadSessionNoteCounts(editingClient.name);
                }
                const isAdminNote = note.source === 'admin' || (note.id && note.id.startsWith('admin-'));
                const noteType = isAdminNote ? 'Admin note' : 'Session note';
                setNotificationModal({ open: true, type: 'success', message: `${noteType} deleted successfully` });
                setDeleteNoteConfirmation({ open: false, note: null });
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                setNotificationModal({ open: true, type: 'error', message: `Failed to delete note: ${errorData.error || 'Please try again'}` });
            }
        } catch (error) {
            console.error('Error deleting note:', error);
            setNotificationModal({ open: true, type: 'error', message: 'Error deleting note. Please try again.' });
        }
    };

    // Handle saving admin note
    const handleSaveAdminNote = async () => {
        if (!activeSession || !adminNoteContent.trim()) {
            return;
        }

        setIsSavingAdminNote(true);
        try {
            const noteId = `admin-${Date.now()}`;
            const note = {
                id: noteId,
                clientName: activeSession.clientName,
                clientId: editingClient?.id,
                sessionId: activeSession.id,
                sessionDate: activeSession.date,
                content: adminNoteContent.trim(),
                transcript: null,
                audioURL: null,
                source: 'admin',
                createdDate: new Date().toISOString()
            };

            const response = await fetch('/api/session-notes', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([note])
            });

            if (response.ok) {
                // Reload session notes
                if (activeSession) {
                    await loadSessionNotes(activeSession.id);
                }
                // Close dialog and reset
                setIsAdminNoteDialogOpen(false);
                setAdminNoteContent("");
                setNotificationModal({ open: true, type: 'success', message: 'Admin note saved successfully' });
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                setNotificationModal({ open: true, type: 'error', message: `Failed to save note: ${errorData.error || 'Please try again'}` });
            }
        } catch (error) {
            console.error('Error saving admin note:', error);
            setNotificationModal({ open: true, type: 'error', message: 'Error saving note. Please try again.' });
        } finally {
            setIsSavingAdminNote(false);
        }
    };

    // Handle saving written session note
    const handleSaveWrittenNote = async () => {
        if (!activeSession || !writtenNoteContent.trim()) {
            return;
        }

        setIsSavingWrittenNote(true);
        try {
            const noteId = `written-${Date.now()}`;
            const note = {
                id: noteId,
                clientName: activeSession.clientName,
                clientId: editingClient?.id,
                sessionId: activeSession.id,
                sessionDate: activeSession.date,
                content: writtenNoteContent.trim(),
                transcript: null,
                audioURL: null,
                source: 'written_session_note',
                createdDate: new Date().toISOString()
            };

            const response = await fetch('/api/session-notes', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([note])
            });

            if (response.ok) {
                // Reload session notes
                if (activeSession) {
                    await loadSessionNotes(activeSession.id);
                }
                // Close dialog and reset
                setIsWrittenNoteDialogOpen(false);
                setWrittenNoteContent("");
                setNotificationModal({ open: true, type: 'success', message: 'Session note saved successfully' });
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                setNotificationModal({ open: true, type: 'error', message: `Failed to save note: ${errorData.error || 'Please try again'}` });
            }
        } catch (error) {
            console.error('Error saving session note:', error);
            setNotificationModal({ open: true, type: 'error', message: 'Error saving note. Please try again.' });
        } finally {
            setIsSavingWrittenNote(false);
        }
    };

    // Handle audio playback
    const handlePlayAudio = (note: any) => {
        if (!note.audioURL) return;

        // Stop any currently playing audio
        if (audioElement) {
            audioElement.pause();
            audioElement.currentTime = 0;
        }

        if (playingAudioId === note.id) {
            // If clicking the same note, stop playback
            setPlayingAudioId(null);
            setAudioElement(null);
        } else {
            // Play new audio
            const audio = new Audio(note.audioURL);
            audio.play();
            setPlayingAudioId(note.id);
            setAudioElement(audio);

            audio.onended = () => {
                setPlayingAudioId(null);
                setAudioElement(null);
            };

            audio.onerror = () => {
                setNotificationModal({ open: true, type: 'error', message: 'Error playing audio. Please check the audio file.' });
                setPlayingAudioId(null);
                setAudioElement(null);
            };
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

    // Bulk restore function for archived clients
    const handleBulkRestore = async () => {
        if (selectedClientIds.size === 0) return;

        const selectedCount = selectedClientIds.size;
        const confirmMessage = `Are you sure you want to restore ${selectedCount} client${selectedCount > 1 ? 's' : ''} to active status?`;

        if (!confirm(confirmMessage)) {
            return;
        }

        const idsToRestore = Array.from(selectedClientIds);
        let successCount = 0;
        let failCount = 0;

        // Restore clients one by one
        for (const id of idsToRestore) {
            try {
                const response = await fetch('/api/clients/archive', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, restore: true }),
                });
                if (response.ok) {
                    successCount++;
                } else {
                    failCount++;
                    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                    console.error(`Failed to restore client ${id}:`, errorData.error);
                }
            } catch (error) {
                failCount++;
                console.error(`Error restoring client ${id}:`, error);
            }
        }

        // Clear selection and reload clients
        setSelectedClientIds(new Set());
        setIsSelectionMode(false);
        await loadClients();

        // Show result message
        if (failCount === 0) {
            alert(`Successfully restored ${successCount} client${successCount > 1 ? 's' : ''}.`);
        } else {
            alert(`Restored ${successCount} client${successCount > 1 ? 's' : ''}. Failed to restore ${failCount} client${failCount > 1 ? 's' : ''}.`);
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
                            {activeTab === 'archived' ? (
                                <Button
                                    variant="default"
                                    onClick={handleBulkRestore}
                                    size="lg"
                                    disabled={selectedClientIds.size === 0}
                                    className="bg-green-500 hover:bg-green-600 text-white"
                                >
                                    <RotateCcw className="mr-2 h-5 w-5" />
                                    Restore Selected ({selectedClientIds.size})
                                </Button>
                            ) : (
                                <Button
                                    variant="destructive"
                                    onClick={handleBulkDelete}
                                    size="lg"
                                    disabled={selectedClientIds.size === 0}
                                >
                                    <Trash2 className="mr-2 h-5 w-5" />
                                    Delete Selected ({selectedClientIds.size})
                                </Button>
                            )}
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
                        <Button 
                            size="lg" 
                            className="bg-green-500 hover:bg-green-600 text-white"
                            onClick={() => setIsAddDialogOpen(true)}
                        >
                            <Plus className="mr-2 h-5 w-5" />
                            Add Client
                        </Button>
                    )}
                </div>

                <Dialog open={isAddDialogOpen} onOpenChange={(open: boolean) => {
                    if (open) {
                        setIsAddDialogOpen(true);
                    } else {
                        // Don't close if we're currently handling back navigation from session dialog
                        if (isHandlingBackRef.current) {
                            return;
                        }
                        handleDialogClose();
                    }
                }}>
                    <DialogTrigger asChild>
                        <div style={{ display: 'none' }}></div>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl w-[calc(100vw-1rem)] sm:w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden">
                        <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-3 sm:pb-4 border-b">
                            <DialogHeader>
                                <DialogTitle className="text-lg sm:text-xl">
                                    {editingClient ? "Client Details" : "Add New Client"}
                                </DialogTitle>
                                <DialogDescription className="text-sm sm:text-base mt-1">
                                    {editingClient ? (
                                        <>
                                            Manage information and sessions for{' '}
                                            <span className="font-bold text-lg sm:text-xl text-primary">
                                                {editingClient.firstName ? `${editingClient.firstName} ${editingClient.lastName}` : editingClient.name}
                                            </span>
                                        </>
                                    ) : (
                                        "Enter client information to add them to your practice"
                                    )}
                                </DialogDescription>
                            </DialogHeader>
                        </div>

                        <Tabs value={clientDialogTab} onValueChange={(value) => {
                            setClientDialogTab(value as 'profile' | 'sessions');
                            // Load session note counts when switching to sessions tab
                            if (value === 'sessions' && editingClient?.name) {
                                loadSessionNoteCounts(editingClient.name);
                            }
                        }} className="w-full flex flex-col flex-1 min-h-0 overflow-hidden">
                            <div className="px-4 sm:px-6 pt-3 flex-shrink-0">
                                <TabsList className="grid w-full grid-cols-2 h-10 sm:h-11">
                                    <TabsTrigger value="profile" className="text-sm sm:text-base">Profile & Info</TabsTrigger>
                                    <TabsTrigger value="sessions" disabled={!editingClient} className="text-sm sm:text-base">Sessions & Notes</TabsTrigger>
                                </TabsList>
                            </div>

                            <TabsContent value="profile" className="flex flex-col flex-1 min-h-0 mt-0 px-4 sm:px-6 overflow-hidden">
                                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                                    <div className="space-y-4 sm:space-y-4 py-4 flex-1 overflow-y-auto pr-2 sm:pr-2">
                                        {/* Name */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                                        {/* Known As & Nationality */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                            <div className="space-y-2">
                                                <Label htmlFor="nationality">
                                                    <Globe className="inline h-4 w-4 mr-1 text-blue-500" />
                                                    Nationality
                                                </Label>
                                                <Input
                                                    id="nationality"
                                                    placeholder="e.g., British, Irish"
                                                    value={formData.nationality || ''}
                                                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        {/* Email & Phone */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                                        {/* Emergency Contact */}
                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold flex items-center gap-1">
                                                <AlertTriangle className="inline h-4 w-4 text-red-500" />
                                                Emergency Contact
                                            </Label>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="emergencyContactName">
                                                        Name
                                                    </Label>
                                                    <Input
                                                        id="emergencyContactName"
                                                        type="text"
                                                        placeholder="Emergency contact name"
                                                        value={formData.emergencyContact?.name || ''}
                                                        onChange={(e) => setFormData({ 
                                                            ...formData, 
                                                            emergencyContact: { 
                                                                name: e.target.value,
                                                                phone: formData.emergencyContact?.phone || ''
                                                            }
                                                        })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="emergencyContactPhone">
                                                        Phone
                                                    </Label>
                                                    <Input
                                                        id="emergencyContactPhone"
                                                        type="tel"
                                                        placeholder="(555) 123-4567"
                                                        value={formData.emergencyContact?.phone || ''}
                                                        onChange={(e) => setFormData({ 
                                                            ...formData, 
                                                            emergencyContact: { 
                                                                name: formData.emergencyContact?.name || '',
                                                                phone: e.target.value
                                                            }
                                                        })}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Next Appointment & Last Appointment */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                                Client Notes
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
                                                            accept=".doc,.docx,.txt,.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
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
                                                                    <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                                                                        <File className="h-3 w-3 flex-shrink-0 text-blue-500" />
                                                                        <span className="truncate flex-1">{doc.name}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-6 w-6"
                                                                            onClick={() => window.open(doc.url, '_blank', 'noopener,noreferrer')}
                                                                            title="Open document"
                                                                        >
                                                                            <ExternalLink className="h-3 w-3" />
                                                                        </Button>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-6 w-6 text-red-500 hover:text-red-600"
                                                                            onClick={() => handleRemoveDocumentClick(index)}
                                                                            title="Delete document"
                                                                        >
                                                                            <Trash2 className="h-3 w-3" />
                                                                        </Button>
                                                                    </div>
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
                                                            placeholder="I am their... (e.g. Dad, Wife)"
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
                                    <div className="space-y-2 pt-4 border-t flex-shrink-0 bg-muted/30 p-3 sm:p-4 rounded-lg" ref={formCheckboxRef}>
                                        <div className="flex items-start gap-3">
                                            <Checkbox
                                                id="newClientFormSigned"
                                                checked={formData.newClientFormSigned || false}
                                                onCheckedChange={(checked) => setFormData({ ...formData, newClientFormSigned: checked === true })}
                                                className="h-5 w-5 mt-0.5"
                                            />
                                            <div className="flex-1 space-y-1">
                                                <Label htmlFor="newClientFormSigned" className="cursor-pointer flex items-center gap-2 text-sm sm:text-base font-medium">
                                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                                    <span>New Client Form Signed</span>
                                                </Label>
                                                <p className="hidden sm:block text-xs sm:text-sm text-muted-foreground leading-relaxed">
                                                    Check this box when the new client form has been completed and signed. This will stop daily reminders.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <DialogFooter className="flex flex-col gap-2 mt-3 flex-shrink-0 pb-3 sm:pb-6 px-4 sm:px-6 border-t pt-3">
                                        {/* Primary action buttons - side by side on mobile */}
                                        <div className="flex gap-2 w-full">
                                            <Button type="button" variant="outline" onClick={handleDialogClose} className="flex-1 h-9 text-sm">
                                                Cancel
                                            </Button>
                                            <Button type="submit" className={`flex-1 h-9 text-sm ${editingClient ? "" : "bg-green-500 hover:bg-green-600 text-white"}`}>
                                                {editingClient ? "Update" : "Add"}
                                            </Button>
                                        </div>
                                        
                                        {/* Destructive action buttons - side by side on mobile */}
                                        {editingClient && (
                                            <div className="flex gap-2 w-full">
                                                {editingClient.archived ? (
                                                    <>
                                                        <Button
                                                            type="button"
                                                            variant="default"
                                                            className="bg-green-500 hover:bg-green-600 text-white flex-1 h-9 text-xs"
                                                            onClick={() => handleRestore(editingClient.id)}
                                                        >
                                                            <RotateCcw className="mr-1 h-3 w-3" />
                                                            Restore
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            className="flex-1 h-9 text-xs"
                                                            onClick={() => handleDeleteClick(editingClient.id)}
                                                        >
                                                            <Trash2 className="mr-1 h-3 w-3" />
                                                            Delete
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <Button
                                                        type="button"
                                                        variant="destructive"
                                                        className="flex-1 h-9 text-xs"
                                                        onClick={() => handleDeleteClick(editingClient.id)}
                                                    >
                                                        <Trash2 className="mr-1 h-3 w-3" />
                                                        Archive
                                                    </Button>
                                                )}
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    className="bg-red-700 hover:bg-red-800 flex-1 h-9 text-xs"
                                                    onClick={() => handleGDPRDeleteClick(editingClient.id)}
                                                >
                                                    GDPR
                                                </Button>
                                            </div>
                                        )}
                                    </DialogFooter>
                                </form>
                            </TabsContent>

                            <TabsContent value="sessions" className="flex flex-col flex-1 min-h-0 mt-0 px-4 sm:px-6 overflow-hidden">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 py-4 flex-shrink-0">
                                    <h3 className="text-base sm:text-lg font-semibold">Session History</h3>
                                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
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

                                <div className="flex-1 overflow-y-auto overflow-x-hidden px-1 sm:px-0 pb-4">
                                    {editingClient && getClientAppointments(editingClient.name).length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-20" />
                                            <p>No sessions found for this client.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {editingClient && getClientAppointments(editingClient.name).map((apt) => (
                                                <Card key={apt.id} className="border-l-4 border-l-primary overflow-hidden">
                                                    <CardHeader className="p-4 pb-2">
                                                        <div className="flex items-center justify-between">
                                                            <CardTitle className="text-base">
                                                                {new Date(apt.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                            </CardTitle>
                                                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${getAppointmentTypeColor(apt.type).bg} ${getAppointmentTypeColor(apt.type).text}`}>
                                                                {apt.type}
                                                            </span>
                                                        </div>
                                                        <CardDescription>
                                                            {apt.time} ({apt.duration} mins)
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardContent className="p-4 pt-2 overflow-hidden">
                                                        {apt.notes && (
                                                            <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded mb-2 break-words">
                                                                {apt.notes}
                                                            </div>
                                                        )}
                                                        
                                                        {/* Session content indicators */}
                                                        {(() => {
                                                            const counts = sessionNoteCounts[apt.id];
                                                            const hasRecordings = counts?.recordings > 0;
                                                            const hasWritten = counts?.written > 0;
                                                            const hasAdmin = counts?.admin > 0;
                                                            const hasAttachments = apt.attachments && apt.attachments.length > 0;
                                                            const hasAnyContent = hasRecordings || hasWritten || hasAdmin || hasAttachments;
                                                            
                                                            if (!hasAnyContent) return null;
                                                            
                                                            return (
                                                                <div className="flex flex-wrap gap-1.5 mb-3">
                                                                    {hasRecordings && (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                                                            <Mic className="h-3 w-3" />
                                                                            {counts.recordings}
                                                                        </span>
                                                                    )}
                                                                    {hasWritten && (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
                                                                            <FileText className="h-3 w-3" />
                                                                            {counts.written}
                                                                        </span>
                                                                    )}
                                                                    {hasAdmin && (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                                            <User className="h-3 w-3" />
                                                                            {counts.admin}
                                                                        </span>
                                                                    )}
                                                                    {hasAttachments && (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                                            <File className="h-3 w-3" />
                                                                            {apt.attachments!.length}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                        
                                                        <div className="flex flex-col sm:flex-row gap-2 mt-2 w-full">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="flex-1 min-w-0"
                                                                onClick={() => handleOpenSession(apt, "notes")}
                                                            >
                                                                <FileText className="mr-2 h-3 w-3 shrink-0" />
                                                                <span className="truncate">Notes</span>
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="flex-1 min-w-0"
                                                                onClick={() => handleOpenSession(apt, "attachments")}
                                                            >
                                                                <Upload className="mr-2 h-3 w-3 shrink-0" />
                                                                <span className="truncate">Attachments</span>
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="flex-1 min-w-0"
                                                                onClick={() => {
                                                                    // Navigate to schedule page with session ID to open for editing
                                                                    router.push(`/schedule?edit=${apt.id}`);
                                                                    handleDialogClose();
                                                                }}
                                                            >
                                                                <Edit className="mr-2 h-3 w-3 shrink-0" />
                                                                <span className="truncate">Edit</span>
                                                            </Button>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </DialogContent>
                </Dialog>

                {/* Log Past Session Dialog */}
                <Dialog open={isLogSessionDialogOpen} onOpenChange={setIsLogSessionDialogOpen}>
                    <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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

                {/* Document Preview Dialog */}
                <Dialog open={documentPreviewOpen} onOpenChange={setDocumentPreviewOpen}>
                    <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <File className="h-5 w-5 text-blue-500" />
                                {documentPreviewName}
                            </DialogTitle>
                            <DialogDescription>
                                Document preview
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex-1 overflow-y-auto py-4 min-h-0">
                            {isLoadingPreview ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                    <span className="ml-2 text-muted-foreground">Loading document...</span>
                                </div>
                            ) : (
                                <div 
                                    className="p-4 bg-card rounded-lg border text-sm [&_p]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:mb-3 [&_li]:mb-1 [&_table]:border-collapse [&_table]:w-full [&_table]:mb-3 [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2 [&_th]:font-bold [&_strong]:font-bold [&_em]:italic"
                                    dangerouslySetInnerHTML={{ __html: documentPreviewContent }}
                                />
                            )}
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setDocumentPreviewOpen(false);
                                    setDocumentPreviewContent("");
                                    setDocumentPreviewName("");
                                }}
                            >
                                Close
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Session Details Dialog */}
                <Dialog open={!!activeSession} onOpenChange={(open) => {
                    if (!open && !isHandlingBackRef.current) {
                        handleBackToSessions();
                    }
                }}>
                <DialogContent className="left-0 top-0 translate-x-0 translate-y-0 w-screen h-[100dvh] max-w-none max-h-none rounded-none overflow-y-auto sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:w-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh] sm:rounded-lg flex flex-col p-0 m-0 sm:m-0">
                        <div className="sticky top-0 z-10 bg-background border-b">
                            <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                                <DialogHeader>
                                    <DialogTitle className="text-base sm:text-lg">Session Details</DialogTitle>
                                    <DialogDescription className="text-xs sm:text-sm">
                                        {activeSession && `${new Date(activeSession.date).toLocaleDateString()} - ${activeSession.type}`}
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="flex items-center justify-between mt-3">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleBackToSessions}
                                        className="h-8 px-3 text-xs font-medium"
                                    >
                                        <ArrowLeft className="h-4 w-4 mr-1" />
                                        Back to Sessions
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleBackToSessions}
                                        className="h-8 w-8"
                                        aria-label="Close session details"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {activeSession && (
                            <Tabs defaultValue={sessionDialogTab} className="w-full flex flex-col flex-1 min-h-0" onValueChange={async (value) => {
                                setSessionDialogTab(value as "notes" | "attachments");
                                if (value === "notes") {
                                    await loadSessionNotes(activeSession.id);
                                }
                            }}>
                                <div className="px-4 sm:px-6">
                                    <TabsList className="grid w-full grid-cols-2 h-9 sm:h-10">
                                        <TabsTrigger value="notes" className="text-xs sm:text-sm">Notes</TabsTrigger>
                                        <TabsTrigger value="attachments" className="text-xs sm:text-sm">Attachments</TabsTrigger>
                                    </TabsList>
                                </div>

                                <TabsContent value="notes" className="flex flex-col flex-1 min-h-0 mt-0 px-4 sm:px-6">
                                    <div className="py-4 pb-2 border-b border-border flex flex-wrap gap-2">
                                        <Button 
                                            variant="outline" 
                                            size="sm"
                                            className="text-xs sm:text-sm flex-1 sm:flex-initial whitespace-nowrap"
                                            onClick={() => {
                                                setAdminNoteContent("");
                                                setIsAdminNoteDialogOpen(true);
                                            }}
                                        >
                                            <Plus className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                                            <span className="truncate">Admin Note</span>
                                        </Button>
                                        <Button 
                                            variant="outline" 
                                            size="sm"
                                            className="text-xs sm:text-sm flex-1 sm:flex-initial whitespace-nowrap"
                                            onClick={() => {
                                                setWrittenNoteContent("");
                                                setIsWrittenNoteDialogOpen(true);
                                            }}
                                        >
                                            <Plus className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                                            <span className="truncate sm:hidden">Write Note</span>
                                            <span className="hidden sm:inline">Write Session Note</span>
                                        </Button>
                                        <Button 
                                            variant="outline" 
                                            size="sm"
                                            className="text-xs sm:text-sm flex-1 sm:flex-initial whitespace-nowrap"
                                            onClick={() => {
                                                if (activeSession && editingClient) {
                                                    const params = new URLSearchParams({
                                                        client: activeSession.clientName,
                                                        clientId: editingClient.id,
                                                        sessionId: activeSession.id
                                                    });
                                                    router.push(`/voice-notes?${params.toString()}`);
                                                    setActiveSession(null);
                                                }
                                            }}
                                        >
                                            <Plus className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                                            <span className="truncate sm:hidden">Record Note</span>
                                            <span className="hidden sm:inline">Record Session Note</span>
                                        </Button>
                                    </div>
                                    <div className="py-4 space-y-4 flex-1 min-h-0 flex flex-col pr-1 sm:pr-2">
                                    {/* Session Content Summary Cards */}
                                    {!isLoadingSessionNotes && (() => {
                                        const adminNotes = sessionNotes.filter((n: any) => n.source === 'admin' || (n.id && n.id.startsWith('admin-')));
                                        const writtenNotes = sessionNotes.filter((n: any) => n.source === 'written_session_note' || (n.id && n.id.startsWith('written-')));
                                        // Use sessionNoteCounts for recordings count (more reliable than filtering sessionNotes)
                                        // This matches what's shown on the session card
                                        const recordingsCount = activeSession?.id ? (sessionNoteCounts[activeSession.id]?.recordings || 0) : 0;
                                        const recordedNotes = sessionNotes.filter((n: any) => n.source === 'recording');
                                        const hasAttachments = activeSession?.attachments && activeSession.attachments.length > 0;
                                        
                                        return (
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                                                {/* Recorded Notes - Use count from sessionNoteCounts if available, otherwise use filtered count */}
                                                {(recordingsCount > 0 || recordedNotes.length > 0) && (
                                                    <div className="border-2 border-purple-300 dark:border-purple-700 rounded-lg p-3 bg-purple-50 dark:bg-purple-950/30">
                                                        <div className="flex items-center gap-2">
                                                            <Mic className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                                            <div>
                                                                <p className="text-xs font-semibold text-purple-800 dark:text-purple-200">
                                                                    {recordingsCount > 0 ? recordingsCount : recordedNotes.length} Recording{(recordingsCount > 0 ? recordingsCount : recordedNotes.length) !== 1 ? 's' : ''}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Written Session Notes */}
                                                {writtenNotes.length > 0 && (
                                                    <div className="border-2 border-green-300 dark:border-green-700 rounded-lg p-3 bg-green-50 dark:bg-green-950/30">
                                                        <div className="flex items-center gap-2">
                                                            <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                                                            <div>
                                                                <p className="text-xs font-semibold text-green-800 dark:text-green-200">
                                                                    {writtenNotes.length} Written Note{writtenNotes.length !== 1 ? 's' : ''}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Admin Notes */}
                                                {adminNotes.length > 0 && (
                                                    <div className="border-2 border-amber-300 dark:border-amber-700 rounded-lg p-3 bg-amber-50 dark:bg-amber-950/30">
                                                        <div className="flex items-center gap-2">
                                                            <User className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                                            <div>
                                                                <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                                                                    {adminNotes.length} Admin Note{adminNotes.length !== 1 ? 's' : ''}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Attachments */}
                                                {hasAttachments && (
                                                    <div 
                                                        className="border-2 border-blue-300 dark:border-blue-700 rounded-lg p-3 bg-blue-50 dark:bg-blue-950/30 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                                        onClick={() => setSessionDialogTab("attachments")}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <File className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                                            <div>
                                                                <p className="text-xs font-semibold text-blue-800 dark:text-blue-200">
                                                                    {activeSession!.attachments!.length} Attachment{activeSession!.attachments!.length !== 1 ? 's' : ''}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                    
                                    {/* Attachments Only Card (when no notes but has attachments) */}
                                    {!isLoadingSessionNotes && sessionNotes.length === 0 && activeSession?.attachments && activeSession.attachments.length > 0 && (
                                        <div 
                                            className="border-2 border-blue-300 dark:border-blue-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-950/30 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                            onClick={() => setSessionDialogTab("attachments")}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                                                    <File className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-semibold text-blue-800 dark:text-blue-200">
                                                        {activeSession.attachments.length} Attachment{activeSession.attachments.length !== 1 ? 's' : ''}
                                                    </p>
                                                    <p className="text-sm text-blue-600 dark:text-blue-400">
                                                        {activeSession.attachments.map(a => a.name).join(', ')}
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                                                >
                                                    View
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {isLoadingSessionNotes ? (
                                        <p className="text-muted-foreground text-center py-8">Loading session notes...</p>
                                    ) : sessionNotes.length > 0 ? (
                                        <div className="space-y-6 flex flex-col flex-1 min-h-0 sm:block sm:flex-none sm:min-h-0 relative">
                                            <TooltipProvider>
                                            {sessionNotes.filter((note: any) => {
                                                // Filter out notes that have been deleted or are empty
                                                // Note: We MUST have transcript or content to display - audio alone is not enough
                                                // because the audio player is inside the transcript block
                                                const hasContent = note.content && typeof note.content === 'string' && note.content.trim() !== '';
                                                const hasTranscript = note.transcript && typeof note.transcript === 'string' && note.transcript.trim() !== '';
                                                
                                                // Must have either actual content OR actual transcript to be shown
                                                // Audio-only notes cannot be displayed (player is in transcript section)
                                                const shouldShow = hasContent || hasTranscript;
                                                return shouldShow;
                                            }).map((note, index) => {
                                                // Final check - determine what content this note actually has to display
                                                const displayContent = note.content && typeof note.content === 'string' && note.content.trim() !== '';
                                                const displayTranscript = note.transcript && typeof note.transcript === 'string' && note.transcript.trim() !== '';
                                                
                                                // Don't render card if there's nothing to display
                                                if (!displayContent && !displayTranscript) {
                                                    return null;
                                                }
                                                
                                                // Determine if this is an uploaded recording with AI Clinical Assessment
                                                const hasAIClinicalAssessment = displayContent && 
                                                                                displayTranscript && 
                                                                                note.content !== note.transcript;
                                                
                                                return (
                                                <div
                                                    key={note.id || index}
                                                    className={`relative z-10 border-2 border-border rounded-lg p-5 bg-card shadow-sm hover:shadow-md transition-shadow space-y-4 flex flex-col ${
                                                        hasAIClinicalAssessment ? "" : "sm:flex-1 sm:min-h-0"
                                                    } sm:block sm:flex-none sm:min-h-0`}
                                                >
                                                    <div className="flex items-center justify-between pb-2 border-b border-border">
                                                        <div className="text-sm font-medium text-foreground">
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
                                                        <div className="flex items-center gap-2">
                                                            {/* Admin Note: check both source field AND ID prefix for backwards compatibility */}
                                                            {(note.source === 'admin' || (note.id && note.id.startsWith('admin-'))) && (
                                                                <>
                                                                    <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-medium">
                                                                        Admin Note
                                                                    </span>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleDeleteNote(note);
                                                                                }}
                                                                                className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p>Delete Admin Note</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </>
                                                            )}
                                                            {/* Written Session Note: check both source field AND ID prefix for backwards compatibility */}
                                                            {(note.source === 'written_session_note' || (note.id && note.id.startsWith('written-'))) && (
                                                                <>
                                                                    <span className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 font-medium">
                                                                        Session Note
                                                                    </span>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleDeleteNote(note);
                                                                                }}
                                                                                className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p>Delete Session Note</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </>
                                                            )}
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
                                                    </div>
                                                    
                                                    {/* Show transcript FIRST - for live recordings this is the only content, for uploaded it's the original */}
                                                    {note.transcript && (
                                                        <div
                                                            className={`flex flex-col ${
                                                                hasAIClinicalAssessment ? "" : "sm:flex-1 sm:min-h-0"
                                                            } sm:block sm:flex-none sm:min-h-0`}
                                                        >
                                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                                                                <p className="text-sm font-semibold text-foreground flex items-center gap-2 flex-shrink-0">
                                                                    <span className="text-base">📝</span>
                                                                    {/* Only show "Client's Words" for uploaded recordings (source === 'recording' with AI content) */}
                                                                    {/* Manual AI assessments of therapist's words should still show "Therapist's Words" */}
                                                                    {note.source === 'recording' && note.content && note.content !== note.transcript
                                                                        ? "Original Transcript (Client's Words):" 
                                                                        : "Original Transcript (Therapist's Words):"}
                                                                </p>
                                                                <div className="flex items-center gap-2.5 sm:gap-2 flex-wrap min-w-0 overflow-visible">
                                                                    {/* Play button for audio recordings */}
                                                                    {note.audioURL && (
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handlePlayAudio(note);
                                                                                    }}
                                                                                    className="h-8 w-8 sm:h-7 sm:w-7 p-0 flex-shrink-0"
                                                                                >
                                                                                    {playingAudioId === note.id ? (
                                                                                        <Pause className="h-4 w-4 text-primary" />
                                                                                    ) : (
                                                                                        <Play className="h-4 w-4 text-primary" />
                                                                                    )}
                                                                                </Button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>
                                                                                <p>{playingAudioId === note.id ? 'Pause' : 'Play'} Recording</p>
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    )}
                                                                    {/* Edit button */}
                                                                    {editingTranscriptId !== note.id && (
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleEditTranscript(note);
                                                                                    }}
                                                                                    className="h-8 w-8 sm:h-7 sm:w-7 p-0 flex-shrink-0"
                                                                                >
                                                                                    <Edit className="h-4 w-4 text-primary" />
                                                                                </Button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>
                                                                                <p>Edit Transcript</p>
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    )}
                                                                    {/* Delete button */}
                                                                    {editingTranscriptId !== note.id && (
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleDeleteTranscript(note);
                                                                                    }}
                                                                                    className="h-8 w-8 sm:h-7 sm:w-7 p-0 text-red-500 hover:text-red-700 flex-shrink-0"
                                                                                >
                                                                                    <Trash2 className="h-4 w-4" />
                                                                                </Button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>
                                                                                <p>Delete Transcript</p>
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    )}
                                                                    {/* Save/Cancel buttons when editing */}
                                                                    {editingTranscriptId === note.id && (
                                                                        <>
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="sm"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            handleSaveTranscript(note);
                                                                                        }}
                                                                                        className="h-8 w-8 sm:h-7 sm:w-7 p-0 text-green-500 hover:text-green-700 flex-shrink-0"
                                                                                    >
                                                                                        <Save className="h-4 w-4" />
                                                                                    </Button>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent>
                                                                                    <p>Save Changes</p>
                                                                                </TooltipContent>
                                                                            </Tooltip>
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="sm"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            handleCancelEditTranscript();
                                                                                        }}
                                                                                        className="h-8 w-8 sm:h-7 sm:w-7 p-0 flex-shrink-0"
                                                                                    >
                                                                                        <X className="h-4 w-4" />
                                                                                    </Button>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent>
                                                                                    <p>Cancel</p>
                                                                                </TooltipContent>
                                                                            </Tooltip>
                                                                        </>
                                                                    )}
                                                                    {/* Show AI Assessment button only for Therapist's Words (no existing AI content) */}
                                                                    {!(note.content && note.content !== note.transcript) && editingTranscriptId !== note.id && (
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            disabled={isProcessingAI}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleGenerateAIAssessment(
                                                                                    note.transcript,
                                                                                    activeSession?.clientName || editingClient?.name || 'Unknown',
                                                                                    activeSession?.date,
                                                                                    activeSession?.duration,
                                                                                    note
                                                                                );
                                                                            }}
                                                                            className="text-xs h-8 sm:h-7 px-2 sm:px-2 flex-shrink-0"
                                                                        >
                                                                            {isProcessingAI ? (
                                                                                <>
                                                                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                                                                    Processing...
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <Sparkles className="h-3 w-3 mr-1" />
                                                                                    AI Assessment
                                                                                </>
                                                                            )}
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {editingTranscriptId === note.id ? (
                                                                <Textarea
                                                                    key={`transcript-${note.id}`}
                                                                    ref={(el) => {
                                                                        if (el) {
                                                                            transcriptTextareaRefs.current.set(note.id, el);
                                                                        } else {
                                                                            transcriptTextareaRefs.current.delete(note.id);
                                                                        }
                                                                    }}
                                                                    defaultValue={note.transcript || ''}
                                                                    className={`h-full sm:min-h-[200px] font-mono text-xs ${
                                                                        hasAIClinicalAssessment ? "" : "flex-1 min-h-0"
                                                                    }`}
                                                                    placeholder="Edit transcript..."
                                                                    autoFocus
                                                                />
                                                            ) : (
                                                                <div
                                                                    className={`whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-md border border-border text-foreground leading-relaxed font-mono text-xs ${
                                                                        hasAIClinicalAssessment ? "" : "flex-1 min-h-0"
                                                                    }`}
                                                                >
                                                                    {note.transcript}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Show AI Clinical Assessment AFTER transcript - for uploaded recordings or manually added assessments */}
                                                    {note.content && 
                                                     note.content.trim() !== '' && 
                                                     note.transcript && 
                                                     note.content !== note.transcript && (
                                                        <div className="border-t border-border pt-4 mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
                                                            <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                                                                <span className="text-lg">🤖</span>
                                                                AI Clinical Assessment:
                                                            </p>
                                                            <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                                                                {note.content}
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Show content with AI heading ONLY for recordings without transcript */}
                                                    {note.content && note.content.trim() !== '' && !note.transcript && note.source === 'recording' && (
                                                        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
                                                            <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                                                                <span className="text-lg">🤖</span>
                                                                AI Clinical Assessment:
                                                            </p>
                                                            <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                                                                {note.content}
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Show regular content (session info) without AI heading */}
                                                    {note.content && note.content.trim() !== '' && !note.transcript && note.source !== 'recording' && (
                                                        <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed p-3 bg-muted/20 rounded-md">
                                                            {note.content}
                                                        </div>
                                                    )}
                                                    
                                                </div>
                                                );
                                            })}
                                            </TooltipProvider>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <p className="text-muted-foreground text-center py-4">No notes found for this session.</p>
                                            <div className="flex gap-2">
                                                <Button 
                                                    variant="outline"
                                                    onClick={saveActiveSession}
                                                >
                                                    Save Notes
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
                                    </div>
                                </TabsContent>

                                <TabsContent value="attachments" className="flex flex-col flex-1 min-h-0 mt-0 px-4 sm:px-6">
                                    <div className="py-4 space-y-4 flex-1 overflow-y-auto pr-1 sm:pr-2">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Input
                                                id="session-file-upload"
                                                type="file"
                                                className="hidden"
                                                onChange={handleSessionFileUpload}
                                                accept=".doc,.docx,.txt,.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
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
                                                        <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                                                            <File className="h-4 w-4 flex-shrink-0" />
                                                            <button
                                                                type="button"
                                                                onClick={() => handleViewAttachment(doc)}
                                                                className="text-sm hover:underline truncate text-left"
                                                                title="Click to view attachment"
                                                            >
                                                                {doc.name}
                                                            </button>
                                                        </div>
                                                        <div className="flex items-center gap-1 flex-shrink-0">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-7 px-2 text-xs"
                                                                onClick={() => handleViewAttachment(doc)}
                                                                title="View attachment"
                                                            >
                                                                <ExternalLink className="h-3 w-3 mr-1" />
                                                                View
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-red-500"
                                                                onClick={() => handleRemoveSessionDocumentClick(index)}
                                                                title="Delete attachment"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <Button onClick={saveActiveSession}>Save Attachments</Button>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Admin Note Dialog */}
                <Dialog open={isAdminNoteDialogOpen} onOpenChange={setIsAdminNoteDialogOpen}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto z-[100]">
                        <DialogHeader>
                            <DialogTitle>Admin Note</DialogTitle>
                            <DialogDescription>
                                Add an admin note for this session
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="admin-note-content">Note Content</Label>
                                <Textarea
                                    id="admin-note-content"
                                    placeholder="Enter your admin note here..."
                                    value={adminNoteContent}
                                    onChange={(e) => setAdminNoteContent(e.target.value)}
                                    className="min-h-[200px]"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button 
                                variant="outline" 
                                onClick={() => {
                                    setIsAdminNoteDialogOpen(false);
                                    setAdminNoteContent("");
                                }}
                                disabled={isSavingAdminNote}
                            >
                                Cancel
                            </Button>
                            <Button 
                                onClick={handleSaveAdminNote}
                                disabled={!adminNoteContent.trim() || isSavingAdminNote}
                            >
                                {isSavingAdminNote ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    'Save Note'
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Written Session Note Dialog */}
                <Dialog open={isWrittenNoteDialogOpen} onOpenChange={setIsWrittenNoteDialogOpen}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto z-[100]">
                        <DialogHeader>
                            <DialogTitle>Write Session Note</DialogTitle>
                            <DialogDescription>
                                Write a session note for this appointment
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="written-note-content">Note Content</Label>
                                <Textarea
                                    id="written-note-content"
                                    placeholder="Enter your session note here..."
                                    value={writtenNoteContent}
                                    onChange={(e) => setWrittenNoteContent(e.target.value)}
                                    className="min-h-[200px]"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button 
                                variant="outline" 
                                onClick={() => {
                                    setIsWrittenNoteDialogOpen(false);
                                    setWrittenNoteContent("");
                                }}
                                disabled={isSavingWrittenNote}
                            >
                                Cancel
                            </Button>
                            <Button 
                                onClick={handleSaveWrittenNote}
                                disabled={!writtenNoteContent.trim() || isSavingWrittenNote}
                            >
                                {isSavingWrittenNote ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    'Save Note'
                                )}
                            </Button>
                        </DialogFooter>
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

                {/* Delete Transcript Confirmation Dialog */}
                <DeleteConfirmationDialog
                    open={deleteTranscriptConfirmation.open}
                    onOpenChange={(open) => setDeleteTranscriptConfirmation({ open, note: open ? deleteTranscriptConfirmation.note : null })}
                    onConfirm={confirmDeleteTranscript}
                    title="Delete Transcript and AI Assessment"
                    description="Are you sure you want to delete this transcript and its AI assessment? This will permanently remove both the transcript text and any associated AI clinical assessment. This action cannot be undone."
                    requireConfirmation={true}
                    checkboxText="I understand this will delete both the transcript and AI assessment permanently"
                    confirmButtonText="Delete"
                />

                {/* Delete Note Confirmation Dialog */}
                <DeleteConfirmationDialog
                    open={deleteNoteConfirmation.open}
                    onOpenChange={(open) => setDeleteNoteConfirmation({ open, note: open ? deleteNoteConfirmation.note : null })}
                    onConfirm={confirmDeleteNote}
                    title={(deleteNoteConfirmation.note?.source === 'admin' || deleteNoteConfirmation.note?.id?.startsWith('admin-')) ? 'Delete Admin Note' : 'Delete Session Note'}
                    description={`Are you sure you want to delete this ${(deleteNoteConfirmation.note?.source === 'admin' || deleteNoteConfirmation.note?.id?.startsWith('admin-')) ? 'admin' : 'session'} note? This action cannot be undone.`}
                    requireConfirmation={false}
                    confirmButtonText="Delete"
                />

                {/* Delete Document Confirmation Dialog */}
                <DeleteConfirmationDialog
                    open={deleteDocumentConfirm.isOpen}
                    onOpenChange={(open) => setDeleteDocumentConfirm({ isOpen: open, index: open ? deleteDocumentConfirm.index : null })}
                    onConfirm={confirmRemoveDocument}
                    title="Delete Document"
                    description="Are you sure you want to remove this document from the client record? This action cannot be undone."
                    requireConfirmation={false}
                    confirmButtonText="Delete"
                />

                {/* Delete Session Attachment Confirmation Dialog */}
                <DeleteConfirmationDialog
                    open={deleteSessionDocConfirm.isOpen}
                    onOpenChange={(open) => setDeleteSessionDocConfirm({ isOpen: open, index: open ? deleteSessionDocConfirm.index : null })}
                    onConfirm={confirmRemoveSessionDocument}
                    title="Delete Attachment"
                    description={`Are you sure you want to delete this attachment from the session? This will remove it from the session but you'll need to click "Save Attachments" to save the change.`}
                    requireConfirmation={false}
                    confirmButtonText="Delete"
                />

                {/* AI Clinical Assessment Dialog */}
                <Dialog open={aiAssessmentDialogOpen} onOpenChange={setAiAssessmentDialogOpen}>
                    <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-purple-500" />
                                AI Clinical Assessment
                            </DialogTitle>
                            <DialogDescription>
                                AI-generated clinical assessment based on the session transcript
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            {aiAssessmentResult && (
                                <div className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg border">
                                    {aiAssessmentResult}
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    if (aiAssessmentResult) {
                                        navigator.clipboard.writeText(aiAssessmentResult);
                                        setNotificationModal({ open: true, type: 'success', message: 'Assessment copied to clipboard' });
                                    }
                                }}
                            >
                                Copy to Clipboard
                            </Button>
                            {currentNoteForAssessment && (
                                <Button
                                    variant="default"
                                    className="bg-green-500 hover:bg-green-600 text-white"
                                    onClick={handleSaveAIAssessmentToNote}
                                >
                                    Add Assessment to Session Notes
                                </Button>
                            )}
                            <Button onClick={() => {
                                setAiAssessmentDialogOpen(false);
                                setAiAssessmentResult(null);
                                setCurrentNoteForAssessment(null);
                            }}>
                                Close
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Notification Modal */}
                <Dialog open={notificationModal.open} onOpenChange={(open) => setNotificationModal({ ...notificationModal, open })}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                {notificationModal.type === 'success' ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                ) : (
                                    <AlertTriangle className="h-5 w-5 text-red-500" />
                                )}
                                {notificationModal.type === 'success' ? 'Success' : 'Error'}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="py-4">
                            <p className="text-sm text-foreground">{notificationModal.message}</p>
                        </div>
                        <DialogFooter>
                            <Button onClick={() => setNotificationModal({ ...notificationModal, open: false })}>
                                OK
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
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
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.15 }}
                            >
                                <Card
                                    className={`hover:shadow-md transition-all hover:border-primary/50 group relative ${
                                        isSelectionMode ? 'cursor-pointer' : ''
                                    } ${selectedClientIds.has(client.id) ? 'border-primary border-2' : ''} ${
                                        isClientInactive(client.name) && activeTab !== 'archived' ? 'opacity-50' : ''
                                    }`}
                                    onClick={() => {
                                        if (isSelectionMode) {
                                            toggleClientSelection(client.id);
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
                                        {/* Inactive indicator - Show for clients with no session in 90+ days */}
                                        {isClientInactive(client.name) && activeTab !== 'archived' && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="cursor-default">
                                                        <Clock 
                                                            className="h-4 w-4 text-gray-400 dark:text-gray-500" 
                                                        />
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>No session in 90+ days</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                        {/* Warning Icon - Hide for archived clients */}
                                        {!client.newClientFormSigned && activeTab !== 'archived' && (
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
                                    </div>
                                    <CardContent className={`px-3 py-1 ${isSelectionMode ? 'pl-10' : ''}`}>
                                        <div className="overflow-hidden min-w-0">
                                            <div className="flex items-baseline gap-1.5">
                                                {isSelectionMode ? (
                                                    <p className="font-medium truncate text-sm leading-none flex-1">
                                                        {client.firstName ? `${client.firstName} ${client.lastName}` : client.name}
                                                    </p>
                                                ) : (
                                                    <Link
                                                        href={`/clients?highlight=${client.id}`}
                                                        className="font-medium truncate text-sm leading-none flex-1 hover:underline text-primary transition-colors"
                                                        onClick={(e) => e.stopPropagation()}
                                                        aria-label={`View ${client.firstName ? `${client.firstName} ${client.lastName}` : client.name} details`}
                                                    >
                                                        {client.firstName ? `${client.firstName} ${client.lastName}` : client.name}
                                                    </Link>
                                                )}
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
                                                                const relatedClient = clients.find(c => c.id === rel.relatedClientId);
                                                                return (
                                                                    <Tooltip key={idx}>
                                                                        <TooltipTrigger asChild>
                                                                            <span
                                                                                className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-[9px] text-blue-700 dark:text-blue-300 whitespace-nowrap cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    if (relatedClient) {
                                                                                        handleEdit(relatedClient);
                                                                                    }
                                                                                }}
                                                                            >
                                                                                {rel.type}: {initials}
                                                                            </span>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p>{rel.relatedClientName}</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
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
    console.log('[Clients Page] 🎯 Default export function called');
    return (
        <Suspense fallback={<div>Loading clients page...</div>}>
            <ClientsPageContent autoOpenAddDialog={autoOpenAddDialog} />
        </Suspense>
    );
}
