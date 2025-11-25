"use client";

import { useState, useEffect } from "react";
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
import { Plus, User, Mail, Phone, Calendar, FileText, Mic, Hash, Edit, Trash2, Upload, File, ExternalLink, Users, FileSpreadsheet, ChevronDown, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientImportExport } from "@/components/client-import-export";

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
    // Extended personal/medical fields
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

export default function ClientsPage({ autoOpenAddDialog = false }: ClientsPageProps) {
    const [clients, setClients] = useState<Client[]>([]);
    const [recordings, setRecordings] = useState<any[]>([]);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(autoOpenAddDialog);
    const [isDocumentsExpanded, setIsDocumentsExpanded] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [formData, setFormData] = useState<Partial<Client>>({
        name: "",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        nextAppointment: "",
        notes: "",
        sessions: 0,
        sessionFee: 80, // Default €80
        currency: 'EUR', // Default to Euros
        documents: [],
        relationships: [],
        dateOfBirth: "",
        mailingAddress: "",
        preferredName: "",
        emergencyContact: { name: "", phone: "" },
        medicalConditions: "",
        currentMedications: "",
        doctorInfo: { name: "", phone: "" },
    });

    // Reciprocal Relationship State
    const [reciprocalQueue, setReciprocalQueue] = useState<{ sourceId: string, targetId: string, sourceName: string, targetName: string, initialType: string }[]>([]);
    const [currentReciprocal, setCurrentReciprocal] = useState<{ sourceId: string, targetId: string, sourceName: string, targetName: string, initialType: string } | null>(null);
    const [reciprocalType, setReciprocalType] = useState("");
    const [showBulkImport, setShowBulkImport] = useState(false);

    useEffect(() => {
        if (autoOpenAddDialog) {
            setIsAddDialogOpen(true);
        }
    }, [autoOpenAddDialog]);

    // Initial load of clients and recordings
    useEffect(() => {
        loadClients();
        loadRecordings();
    }, []);

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

    // Process Reciprocal Queue
    useEffect(() => {
        if (!currentReciprocal && reciprocalQueue.length > 0) {
            const next = reciprocalQueue[0];
            setCurrentReciprocal(next);
            setReciprocalQueue(prev => prev.slice(1));
            setReciprocalType(""); // Reset input
        }
    }, [currentReciprocal, reciprocalQueue]);

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
            }
        } catch (error) {
            console.error('Error loading recordings:', error);
        }
    };

    const getRecordingCount = (clientName: string) => {
        return recordings.filter(r => r.clientName === clientName).length;
    };

    const getClientName = (id: string) => {
        return clients.find(c => c.id === id)?.name || "Unknown Client";
    };

    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [activeSession, setActiveSession] = useState<Appointment | null>(null);
    const [sessionDialogTab, setSessionDialogTab] = useState<"notes" | "attachments">("notes");

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

    const handleOpenSession = (session: Appointment, tab: "notes" | "attachments") => {
        setActiveSession(session);
        setSessionDialogTab(tab);
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
        return appointments
            .filter(apt => apt.clientName === clientName)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        let savedClient: Client;
        let updatedClientsList: Client[];

        if (editingClient) {
            // Update existing client
            const combinedName = `${formData.firstName || ''} ${formData.lastName || ''}`.trim();
            savedClient = { ...editingClient, ...formData, name: combinedName } as Client;
            updatedClientsList = clients.map(c =>
                c.id === editingClient.id ? savedClient : c
            );
        } else {
            // Add new client
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
                documents: formData.documents || [],
                relationships: formData.relationships || [],
                dateOfBirth: formData.dateOfBirth || "",
                mailingAddress: formData.mailingAddress || "",
                preferredName: formData.preferredName || "",
                emergencyContact: formData.emergencyContact || { name: "", phone: "" },
                medicalConditions: formData.medicalConditions || "",
                currentMedications: formData.currentMedications || "",
                doctorInfo: formData.doctorInfo || { name: "", phone: "" },
            };
            updatedClientsList = [...clients, savedClient];
        }

        saveClients(updatedClientsList);
        setEditingClient(null);

        // Reset form
        setFormData({
            name: "",
            email: "",
            phone: "",
            nextAppointment: "",
            notes: "",
            sessions: 0,
            sessionFee: 80, // Default €80
            currency: 'EUR', // Default to Euros
            documents: [],
            relationships: [],
            dateOfBirth: "",
            mailingAddress: "",
            preferredName: "",
            emergencyContact: { name: "", phone: "" },
            medicalConditions: "",
            currentMedications: "",
            doctorInfo: { name: "", phone: "" },
        });
        setIsAddDialogOpen(false);

        // Check for missing reciprocal relationships
        const newQueue: typeof reciprocalQueue = [];

        if (savedClient.relationships) {
            savedClient.relationships.forEach(rel => {
                const targetClient = clients.find(c => c.id === rel.relatedClientId);
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

        if (newQueue.length > 0) {
            setReciprocalQueue(prev => [...prev, ...newQueue]);
        }
    };

    const handleEdit = (client: Client) => {
        setEditingClient(client);
        setFormData(client);
        setIsAddDialogOpen(true);
    };

    const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean, clientId: string | null }>({ isOpen: false, clientId: null });

    const handleDeleteClick = (id: string) => {
        setDeleteConfirmation({ isOpen: true, clientId: id });
    };

    const confirmDelete = () => {
        if (deleteConfirmation.clientId) {
            const updatedClients = clients.filter(c => c.id !== deleteConfirmation.clientId);
            saveClients(updatedClients);
            setDeleteConfirmation({ isOpen: false, clientId: null });
        }
    };

    const cancelDelete = () => {
        setDeleteConfirmation({ isOpen: false, clientId: null });
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
            sessionFee: 80, // Default €80
            currency: 'EUR', // Default to Euros
            documents: [],
            relationships: [],
            dateOfBirth: "",
            mailingAddress: "",
            preferredName: "",
            emergencyContact: { name: "", phone: "" },
            medicalConditions: "",
            currentMedications: "",
            doctorInfo: { name: "", phone: "" },
        });
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold mb-2">Clients</h1>
                    <p className="text-muted-foreground">
                        Manage your client information and appointments
                    </p>
                </div>

                <Dialog open={isAddDialogOpen} onOpenChange={(open: boolean) => {
                    if (open) {
                        setIsAddDialogOpen(true);
                    } else {
                        handleDialogClose();
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button size="lg">
                            <Plus className="mr-2 h-5 w-5" />
                            Add Client
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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

                        <Tabs defaultValue="profile" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="profile">Profile & Info</TabsTrigger>
                                <TabsTrigger value="sessions" disabled={!editingClient}>Sessions & Notes</TabsTrigger>
                            </TabsList>

                            <TabsContent value="profile">
                                <form onSubmit={handleSubmit}>
                                    <div className="space-y-4 py-4">
                                        {/* Name */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="firstName">
                                                    <User className="inline h-4 w-4 mr-1" />
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
                                                    <User className="inline h-4 w-4 mr-1" />
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
                                                <User className="inline h-4 w-4 mr-1" />
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
                                                    <Mail className="inline h-4 w-4 mr-1" />
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
                                                    <Phone className="inline h-4 w-4 mr-1" />
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

                                        {/* Next Appointment & Date of Birth */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="nextAppointment">
                                                    <Calendar className="inline h-4 w-4 mr-1" />
                                                    Next Appointment
                                                </Label>
                                                <Input
                                                    id="nextAppointment"
                                                    type="datetime-local"
                                                    value={formData.nextAppointment || ''}
                                                    onChange={(e) => setFormData({ ...formData, nextAppointment: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="dateOfBirth">
                                                    <Calendar className="inline h-4 w-4 mr-1" />
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
                                                    <Hash className="inline h-4 w-4 mr-1" />
                                                    Total Sessions
                                                </Label>
                                                <Input
                                                    id="sessions"
                                                    type="number"
                                                    min="0"
                                                    placeholder="0"
                                                    value={formData.sessions || 0}
                                                    onChange={(e) => setFormData({ ...formData, sessions: parseInt(e.target.value) || 0 })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="sessionFee">
                                                    <FileText className="inline h-4 w-4 mr-1" />
                                                    Session Fee
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
                                                            value={formData.sessionFee || 0}
                                                            onChange={(e) => setFormData({ ...formData, sessionFee: parseFloat(e.target.value) || 80 })}
                                                            className="pl-10"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Notes */}
                                        <div className="space-y-2">
                                            <Label htmlFor="notes">
                                                <FileText className="inline h-4 w-4 mr-1" />
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
                                                    <File className="h-4 w-4" />
                                                    Documents ({formData.documents?.length || 0})
                                                    {isDocumentsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
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
                                                            <Upload className="h-3 w-3" />
                                                            Upload Document
                                                        </Label>
                                                    </div>

                                                    {formData.documents && formData.documents.length > 0 ? (
                                                        <div className="space-y-2">
                                                            {formData.documents.map((doc, index) => (
                                                                <div key={index} className="flex items-center justify-between p-2 border rounded-md bg-muted/50 text-sm">
                                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                                        <File className="h-3 w-3 flex-shrink-0" />
                                                                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                                                                            {doc.name}
                                                                        </a>
                                                                    </div>
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-6 w-6 text-red-500 hover:text-red-600"
                                                                        onClick={() => removeDocument(index)}
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
                                                <Users className="inline h-4 w-4 mr-1" />
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
                                    <DialogFooter className="flex sm:justify-between gap-2">
                                        {editingClient && (
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                onClick={() => handleDeleteClick(editingClient.id)}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Delete Client
                                            </Button>
                                        )}
                                        <div className="flex gap-2 ml-auto">
                                            <Button type="button" variant="outline" onClick={handleDialogClose}>
                                                Cancel
                                            </Button>
                                            <Button type="submit">
                                                {editingClient ? "Update Client" : "Add Client"}
                                            </Button>
                                        </div>
                                    </DialogFooter>
                                </form>
                            </TabsContent>

                            <TabsContent value="sessions" className="space-y-4 py-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold">Session History</h3>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsLogSessionDialogOpen(true)}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Log Past Session
                                    </Button>
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
                                                            Clinical Notes
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
                                        onChange={(e) => setLogSessionData({ ...logSessionData, duration: parseInt(e.target.value) })}
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
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Session Details</DialogTitle>
                            <DialogDescription>
                                {activeSession && `${new Date(activeSession.date).toLocaleDateString()} - ${activeSession.type}`}
                            </DialogDescription>
                        </DialogHeader>

                        {activeSession && (
                            <Tabs defaultValue={sessionDialogTab} className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="notes">Clinical Notes</TabsTrigger>
                                    <TabsTrigger value="attachments">Attachments</TabsTrigger>
                                </TabsList>

                                <TabsContent value="notes" className="py-4 space-y-4">
                                    <Textarea
                                        placeholder="Enter detailed clinical notes here..."
                                        className="min-h-[300px]"
                                        value={activeSession.clinicalNotes || ''}
                                        onChange={(e) => setActiveSession({ ...activeSession, clinicalNotes: e.target.value })}
                                    />
                                    <Button onClick={saveActiveSession}>Save Notes</Button>
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
                                                            onClick={() => removeSessionDocument(index)}
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
            </div >

            {/* Bulk Import/Export - Collapsible */}
            < Card className="mb-6" >
                <CardHeader
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setShowBulkImport(!showBulkImport)}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileSpreadsheet className="h-5 w-5 text-primary" />
                            <CardTitle>Bulk Client Import/Export</CardTitle>
                        </div>
                        <Button variant="ghost" size="sm">
                            {showBulkImport ? "Hide" : "Show"}
                        </Button>
                    </div>
                    <CardDescription>
                        Import multiple clients from Excel or export existing clients
                    </CardDescription>
                </CardHeader>
                {
                    showBulkImport && (
                        <CardContent>
                            <ClientImportExport />
                        </CardContent>
                    )
                }
            </Card >

            {/* Clients List */}
            {
                clients.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-16">
                            <User className="h-16 w-16 text-muted-foreground mb-4" />
                            <h3 className="text-xl font-semibold mb-2">No clients yet</h3>
                            <p className="text-muted-foreground text-center max-w-md mb-6">
                                Add your first client to start managing your practice
                            </p>
                            <Button onClick={() => setIsAddDialogOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Your First Client
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {clients.map((client, index) => (
                            <motion.div
                                key={client.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Card
                                    className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50 group"
                                    onClick={() => handleEdit(client)}
                                >
                                    <CardContent className="px-3 py-1">
                                        <div className="overflow-hidden min-w-0">
                                            <div className="flex items-baseline gap-1.5">
                                                <p className="font-medium truncate text-sm leading-none">
                                                    {client.firstName ? `${client.firstName} ${client.lastName}` : client.name}
                                                </p>
                                                {client.preferredName && (
                                                    <p className="text-[10px] text-muted-foreground truncate shrink-0">
                                                        "{client.preferredName}"
                                                    </p>
                                                )}
                                            </div>
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
                                            </div>
                                            {/* Stats Row */}
                                            <div className="mt-2 pt-2 border-t flex items-center justify-between text-[10px] text-muted-foreground">
                                                <div className="flex items-center gap-1" title="Sessions">
                                                    <Calendar className="h-3 w-3" />
                                                    <span>{getClientAppointments(client.name).length}</span>
                                                </div>
                                                <div className="flex items-center gap-1" title="Recordings">
                                                    <Mic className="h-3 w-3" />
                                                    <span>{getRecordingCount(client.name)}</span>
                                                </div>
                                                <div className="flex items-center gap-1" title="Documents">
                                                    <FileText className="h-3 w-3" />
                                                    <span>{(client.documents || []).length}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                )
            }
        </div >
    );
}
