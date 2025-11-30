"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
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
import { FileText, Calendar, Search, AlertCircle, Clock, Plus, ClipboardCheck, CheckCircle2, X, ChevronDown, DollarSign } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface Appointment {
    id: string;
    clientName: string;
    clientId?: string;
    date: string;
    time: string;
    type: string;
}

interface SessionNote {
    id: string;
    clientName: string;
    sessionDate: string;
    content: string;
}

interface Client {
    id: string;
    name: string;
    newClientFormSigned?: boolean;
}

interface AdminReminder {
    id: string;
    type: string;
    client_id?: string;
    session_id?: string;
    title: string;
    description?: string;
    is_active: boolean;
    clients?: { id: string; name: string };
    sessions?: { id: string; date: string; type: string };
}

type SortOption = 'date-desc' | 'date-asc' | 'client-asc' | 'client-desc';

export default function RemindersPage() {
    const router = useRouter();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [notes, setNotes] = useState<SessionNote[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [reminders, setReminders] = useState<Appointment[]>([]);
    const [unsignedFormClients, setUnsignedFormClients] = useState<Client[]>([]);
    const [unpaidSessions, setUnpaidSessions] = useState<Appointment[]>([]);
    const [adminReminders, setAdminReminders] = useState<AdminReminder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showFormsSection, setShowFormsSection] = useState(true);
    const formsSectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Load appointments
            const aptRes = await fetch('/api/appointments', { cache: 'no-store' });
            const appointmentsData = aptRes.ok ? await aptRes.json() : [];

            // Load session notes
            const notesRes = await fetch('/api/session-notes', { cache: 'no-store' });
            const notesData = notesRes.ok ? await notesRes.json() : [];

            // Load clients
            const clientRes = await fetch('/api/clients', { cache: 'no-store' });
            const clientsData = clientRes.ok ? await clientRes.json() : [];

            // Load admin reminders (custom reminders from templates)
            const adminRemindersRes = await fetch('/api/admin-reminders', { cache: 'no-store' });
            const adminRemindersData = adminRemindersRes.ok ? await adminRemindersRes.json() : [];

            setAppointments(appointmentsData);
            setNotes(notesData);
            setClients(clientsData);
            setAdminReminders(adminRemindersData);

            // Calculate reminders for sessions awaiting notes
            const now = new Date();
            const pastSessions = appointmentsData.filter((a: Appointment) => {
                const aptDate = new Date(`${a.date}T${a.time}`);
                return aptDate < now;
            });

            const missingNotes = pastSessions.filter((apt: Appointment) => {
                const hasNote = notesData.some((n: SessionNote) =>
                    n.clientName === apt.clientName &&
                    n.sessionDate &&
                    n.sessionDate.startsWith(apt.date)
                );
                return !hasNote;
            });

            // Add clientId to reminders
            const remindersWithClientId = missingNotes.map((apt: Appointment) => {
                const client = clientsData.find((c: Client) => c.name === apt.clientName);
                return {
                    ...apt,
                    clientId: client?.id
                };
            });

            setReminders(remindersWithClientId);

            // Calculate clients with unsigned forms
            const clientsWithoutSignedForms = clientsData.filter((c: Client) => 
                !c.newClientFormSigned
            );
            setUnsignedFormClients(clientsWithoutSignedForms);

            // Calculate unpaid past sessions (reusing 'now' from above)
            const pastUnpaidSessions = appointmentsData.filter((apt: Appointment) => {
                const aptDate = new Date(`${apt.date}T${apt.time}`);
                const isPast = aptDate < now;
                const isUnpaid = apt.paymentStatus !== 'paid';
                return isPast && isUnpaid;
            });
            setUnpaidSessions(pastUnpaidSessions);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Get unique client names for filter
    const clientNames = useMemo(() => {
        const names = reminders
            .map(r => r.clientName)
            .filter((name): name is string => !!name);
        return Array.from(new Set(names)).sort();
    }, [reminders]);

    // Get unique client names for form filter
    const formClientNames = useMemo(() => {
        return unsignedFormClients
            .map(c => c.name)
            .filter((name): name is string => !!name)
            .sort();
    }, [unsignedFormClients]);

    // Sort reminders (newest first)
    const sortedReminders = useMemo(() => {
        return [...reminders].sort((a, b) => {
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
    }, [reminders]);

    // Sort unsigned form clients (alphabetically)
    const sortedFormClients = useMemo(() => {
        return [...unsignedFormClients].sort((a, b) => {
            return (a.name || '').localeCompare(b.name || '');
        });
    }, [unsignedFormClients]);

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const getTimeAgo = (dateString: string, timeString: string): string => {
        const sessionDate = new Date(`${dateString}T${timeString}`);
        const now = new Date();
        const diffMs = now.getTime() - sessionDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return `${Math.floor(diffDays / 30)} months ago`;
    };

    const handleCreateNote = (reminder: Appointment) => {
        const params = new URLSearchParams({
            client: reminder.clientName,
            date: `${reminder.date}T${reminder.time}`,
            create: 'true'
        });

        if (reminder.clientId) {
            params.append('clientId', reminder.clientId);
        }

        router.push(`/session-notes?${params.toString()}`);
    };

    const handleViewClient = (client: Client) => {
        router.push(`/clients?client=${client.id}`);
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2">Reminders</h1>
                <p className="text-muted-foreground">
                    Keep track of reminders
                </p>
            </div>

            <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className={reminders.length === 0 
                        ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900"
                        : "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900"
                    }>
                        <CardHeader>
                            <CardTitle className={`flex items-center gap-2 ${
                                reminders.length === 0
                                    ? "text-green-800 dark:text-green-200"
                                    : "text-red-800 dark:text-red-200"
                            }`}>
                                <AlertCircle className="h-5 w-5" />
                                {reminders.length} Session{reminders.length !== 1 ? 's' : ''} Awaiting Notes
                            </CardTitle>
                            <CardDescription className={
                                reminders.length === 0
                                    ? "text-green-700 dark:text-green-300"
                                    : "text-red-700 dark:text-red-300"
                            }>
                                {reminders.length === 0
                                    ? "Great! All your past sessions have notes."
                                    : "These sessions need clinical documentation to maintain complete records."}
                            </CardDescription>
                        </CardHeader>
                    </Card>

                    <Card 
                        className={`${
                            unsignedFormClients.length === 0 
                                ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900"
                                : "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900"
                        } ${unsignedFormClients.length > 0 ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
                        onClick={() => {
                            if (unsignedFormClients.length > 0) {
                                // Show the section if it's hidden
                                if (!showFormsSection) {
                                    setShowFormsSection(true);
                                    // Wait for the section to render, then scroll
                                    setTimeout(() => {
                                        if (formsSectionRef.current) {
                                            formsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                            // Highlight the section briefly
                                            formsSectionRef.current.classList.add('ring-2', 'ring-red-500', 'ring-offset-2');
                                            setTimeout(() => {
                                                formsSectionRef.current?.classList.remove('ring-2', 'ring-red-500', 'ring-offset-2');
                                            }, 2000);
                                        }
                                    }, 100);
                                } else if (formsSectionRef.current) {
                                    // Section is already visible, just scroll to it
                                    formsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    // Highlight the section briefly
                                    formsSectionRef.current.classList.add('ring-2', 'ring-red-500', 'ring-offset-2');
                                    setTimeout(() => {
                                        formsSectionRef.current?.classList.remove('ring-2', 'ring-red-500', 'ring-offset-2');
                                    }, 2000);
                                }
                            }
                        }}
                    >
                        <CardHeader>
                            <CardTitle className={`flex items-center gap-2 ${
                                unsignedFormClients.length === 0
                                    ? "text-green-800 dark:text-green-200"
                                    : "text-red-800 dark:text-red-200"
                            }`}>
                                <ClipboardCheck className="h-5 w-5" />
                                {unsignedFormClients.length} Client{unsignedFormClients.length !== 1 ? 's' : ''} Awaiting Forms
                            </CardTitle>
                            <CardDescription className={
                                unsignedFormClients.length === 0
                                    ? "text-green-700 dark:text-green-300"
                                    : "text-red-700 dark:text-red-300"
                            }>
                                {unsignedFormClients.length === 0
                                    ? "Great! All clients have signed their forms."
                                    : unsignedFormClients.length === 1
                                        ? "Click to view the client that needs to complete and return their New Client Form."
                                        : "Click to view clients that need to complete and return their New Client Forms."}
                            </CardDescription>
                        </CardHeader>
                    </Card>

                    <Card className={unpaidSessions.length === 0 
                        ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900"
                        : "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900"
                    }>
                        <CardHeader>
                            <CardTitle className={`flex items-center gap-2 ${
                                unpaidSessions.length === 0
                                    ? "text-green-800 dark:text-green-200"
                                    : "text-red-800 dark:text-red-200"
                            }`}>
                                <DollarSign className="h-5 w-5" />
                                {unpaidSessions.length} Unpaid Session{unpaidSessions.length !== 1 ? 's' : ''}
                            </CardTitle>
                            <CardDescription className={
                                unpaidSessions.length === 0
                                    ? "text-green-700 dark:text-green-300"
                                    : "text-red-700 dark:text-red-300"
                            }>
                                {unpaidSessions.length === 0
                                    ? "Great! All sessions are paid."
                                    : "These past sessions have not been marked as paid."}
                            </CardDescription>
                        </CardHeader>
                    </Card>
                </div>


                {/* Reminders List */}
                {isLoading ? (
                    <Card>
                        <CardContent className="flex items-center justify-center py-16">
                            <p className="text-muted-foreground">Loading reminders...</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        <AnimatePresence>
                            {sortedReminders.map((reminder, index) => (
                                <motion.div
                                    key={reminder.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ delay: index * 0.05 }}
                                >
                                    <Card className="hover:shadow-md transition-shadow">
                                        <CardContent className="p-6">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <h3 className="text-lg font-semibold">
                                                            {reminder.clientId ? (
                                                                <Link
                                                                    href={`/clients`}
                                                                    className="hover:underline text-primary"
                                                                >
                                                                    {reminder.clientName}
                                                                </Link>
                                                            ) : (
                                                                reminder.clientName
                                                            )}
                                                        </h3>
                                                        <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                                                            {getTimeAgo(reminder.date, reminder.time)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="h-4 w-4" />
                                                            {formatDate(reminder.date)} at {reminder.time}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <FileText className="h-4 w-4" />
                                                            {reminder.type}
                                                        </span>
                                                    </div>
                                                </div>
                                                <Button
                                                    onClick={() => handleCreateNote(reminder)}
                                                    className="shrink-0"
                                                >
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    Create Note
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}

                {/* New Client Forms Section */}
                {showFormsSection ? (
                    <div ref={formsSectionRef} className="space-y-4 transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-semibold flex items-center gap-2">
                                <ClipboardCheck className="h-6 w-6 text-green-600" />
                                New Client Forms Awaiting Signature
                            </h2>
                            {unsignedFormClients.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowFormsSection(false)}
                                    className="h-8 w-8 p-0"
                                    title="Hide forms section"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>


                    {/* Forms List */}
                    {isLoading ? (
                        <Card>
                            <CardContent className="flex items-center justify-center py-16">
                                <p className="text-muted-foreground">Loading clients...</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            <AnimatePresence>
                                {sortedFormClients.map((client, index) => (
                                    <motion.div
                                        key={client.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        transition={{ delay: index * 0.05 }}
                                    >
                                        <Card 
                                            className="hover:shadow-md transition-shadow border-green-200 dark:border-green-900 cursor-pointer"
                                            onClick={() => handleViewClient(client)}
                                        >
                                            <CardContent className="p-6">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <h3 className="text-lg font-semibold text-primary">
                                                                {client.name}
                                                            </h3>
                                                            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                                                                Form Pending
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">
                                                            New Client Form has not been signed and returned.
                                                        </p>
                                                    </div>
                                                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                    </div>
                ) : null}

                {/* Unpaid Sessions Section */}
                {unpaidSessions.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold flex items-center gap-2">
                            <DollarSign className="h-6 w-6 text-red-600" />
                            Unpaid Sessions ({unpaidSessions.length})
                        </h2>
                        <div className="space-y-3">
                            {unpaidSessions.map((session) => (
                                <Card key={session.id} className="border-red-200 dark:border-red-900 cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push(`/payments`)}>
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-semibold text-primary">
                                                        {session.clientName}
                                                    </h3>
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200">
                                                        Unpaid
                                                    </span>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    {formatDate(session.date)} at {session.time} - {session.type}
                                                </p>
                                                {session.fee && (
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Amount: {session.currency || 'EUR'} {session.fee}
                                                    </p>
                                                )}
                                            </div>
                                            <DollarSign className="h-5 w-5 text-red-500 shrink-0" />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* Custom Admin Reminders Section */}
                {adminReminders.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold flex items-center gap-2">
                            <AlertCircle className="h-6 w-6 text-orange-600" />
                            Custom Reminders ({adminReminders.length})
                        </h2>
                        <div className="space-y-3">
                            {adminReminders.map((reminder) => (
                                <Card key={reminder.id} className="border-orange-200 dark:border-orange-900">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-semibold">{reminder.title}</h3>
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200">
                                                        {reminder.type}
                                                    </span>
                                                </div>
                                                {reminder.description && (
                                                    <p className="text-sm text-muted-foreground mb-2">
                                                        {reminder.description}
                                                    </p>
                                                )}
                                                {reminder.clients && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Client: {reminder.clients.name}
                                                    </p>
                                                )}
                                                {reminder.sessions && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Session: {new Date(reminder.sessions.date).toLocaleDateString()} - {reminder.sessions.type}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
