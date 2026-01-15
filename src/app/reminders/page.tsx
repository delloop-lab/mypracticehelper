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
import { FileText, Calendar, Search, AlertCircle, Clock, ClipboardCheck, CheckCircle2, X, ChevronDown, Landmark, Mic, Plus, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface Appointment {
    id: string;
    clientName: string;
    clientId?: string;
    date: string;
    time: string;
    type: string;
    paymentStatus?: "paid" | "pending" | "unpaid";
    fee?: number;
    currency?: string;
}

interface SessionNote {
    id: string;
    clientName: string;
    clientId?: string;
    sessionDate: string;
    content: string;
    transcript?: string;
    audioURL?: string | null;
    attachments?: { name: string; url: string }[];
    source?: 'session_note' | 'recording' | 'session';
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
    const [dismissingReminderId, setDismissingReminderId] = useState<string | null>(null);
    const [markingPaidSessionId, setMarkingPaidSessionId] = useState<string | null>(null);
    const formsSectionRef = useRef<HTMLDivElement>(null);
    const sessionNotesSectionRef = useRef<HTMLDivElement>(null);
    const unpaidSessionsSectionRef = useRef<HTMLDivElement>(null);

    const handleDismissReminder = async (reminderId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click
        setDismissingReminderId(reminderId);
        try {
            const response = await fetch('/api/admin-reminders', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: reminderId, is_active: false }),
            });

            if (!response.ok) {
                throw new Error('Failed to dismiss reminder');
            }

            // Remove from local state
            setAdminReminders(prev => prev.filter(r => r.id !== reminderId));
        } catch (error) {
            console.error('Error dismissing reminder:', error);
            alert('Failed to dismiss reminder. Please try again.');
        } finally {
            setDismissingReminderId(null);
        }
    };

    // Get currency symbol from currency code
    const getCurrencySymbol = (currencyCode?: string): string => {
        if (!currencyCode) return "€"; // Default to EUR
        switch (currencyCode.toUpperCase()) {
            case 'USD': return '$';
            case 'EUR': return '€';
            case 'GBP': return '£';
            case 'AUD': return 'A$';
            default: return currencyCode; // Return code if unknown
        }
    };

    const handleMarkAsPaid = async (session: Appointment, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click navigation
        setMarkingPaidSessionId(session.id);
        try {
            const response = await fetch('/api/appointments', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: session.id,
                    paymentStatus: 'paid',
                    fee: session.fee || undefined,
                    currency: session.currency || 'EUR',
                    paymentMethod: session.paymentMethod || 'Cash'
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update payment status');
            }

            // Small delay to ensure database update is complete
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Reload data to reflect the change
            await loadData();
        } catch (error) {
            console.error('Error marking session as paid:', error);
            alert(`Failed to mark session as paid: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setMarkingPaidSessionId(null);
        }
    };

    // Calculate days since last session for a client - by name
    const getDaysSinceLastSeen = (clientId: string | undefined, clientName?: string): number | null => {
        // Get the name to search for
        let nameToSearch = clientName?.trim().toLowerCase();
        if (!nameToSearch && clientId) {
            const client = clients.find(c => c.id === clientId);
            nameToSearch = client?.name?.trim().toLowerCase();
        }
        
        if (!nameToSearch) return null;
        
        // Find all past appointments for this client
        const now = new Date();
        const clientAppointments = appointments.filter((apt: Appointment) => {
            // Match by client name (case-insensitive, trimmed)
            const aptClientName = apt.clientName?.trim().toLowerCase();
            if (!aptClientName || aptClientName !== nameToSearch) return false;
            
            // Check if it's a past session
            const dateStr = apt.date.split('T')[0];
            const [year, month, day] = dateStr.split('-').map(Number);
            const aptDate = new Date(year, month - 1, day, 23, 59, 59); // End of day
            return aptDate < now;
        });

        if (clientAppointments.length === 0) return null;

        // Get the most recent past session
        const sortedAppointments = [...clientAppointments].sort((a, b) => {
            const dateA = new Date(a.date.split('T')[0]);
            const dateB = new Date(b.date.split('T')[0]);
            return dateB.getTime() - dateA.getTime();
        });

        const lastSession = sortedAppointments[0];
        const dateStr = lastSession.date.split('T')[0];
        const [year, month, day] = dateStr.split('-').map(Number);
        const lastSessionDate = new Date(year, month - 1, day);
        
        const diffTime = now.getTime() - lastSessionDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays >= 0 ? diffDays : null;
    };

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
            console.log('[Reminders Page] Now:', now.toLocaleString());
            console.log('[Reminders Page] Total appointments:', appointmentsData.length);
            console.log('[Reminders Page] Total notes:', notesData.length);
            
            const pastSessions = appointmentsData.filter((a: Appointment) => {
                // Extract date part (YYYY-MM-DD) from date string
                const dateStr = a.date.split('T')[0];
                const timeStr = a.time || '00:00';
                
                // Handle 12-hour format (e.g., "02:00 pm")
                let aptHours = 0;
                let aptMinutes = 0;
                const timeLower = timeStr.toLowerCase().trim();
                const isPM = timeLower.includes('pm');
                const isAM = timeLower.includes('am');
                const timeMatch = timeLower.match(/(\d{1,2}):(\d{2})/);
                if (timeMatch) {
                    aptHours = parseInt(timeMatch[1], 10);
                    aptMinutes = parseInt(timeMatch[2], 10);
                    if (isPM && aptHours !== 12) aptHours += 12;
                    else if (isAM && aptHours === 12) aptHours = 0;
                }
                
                const [year, month, day] = dateStr.split('-').map(Number);
                const aptDate = new Date(year, month - 1, day, aptHours, aptMinutes, 0);
                const isPast = aptDate < now;
                
                console.log(`[Reminders Page] Session: ${a.clientName} on ${dateStr} at ${a.time} (parsed: ${aptDate.toLocaleString()}) - isPast: ${isPast}`);
                
                return isPast;
            });
            
            console.log('[Reminders Page] Past sessions:', pastSessions.length);

            const missingNotes = pastSessions.filter((apt: Appointment) => {
                // Extract date part for comparison
                const aptDateStr = apt.date.split('T')[0];
                
                // Check if a note exists for this appointment
                // A note is considered to exist if it has:
                // 1. Matching client (by name or ID)
                // 2. Matching date
                // 3. Has actual content (content, transcript, audio, or attachments)
                const hasNote = notesData.some((n: SessionNote) => {
                    // Match by client name or client ID
                    const clientMatches = 
                        (n.clientName && apt.clientName && n.clientName.toLowerCase() === apt.clientName.toLowerCase()) ||
                        (n.clientId && apt.clientId && n.clientId === apt.clientId);
                    
                    if (!clientMatches) return false;
                    
                    // Match by date - handle both date-only and ISO timestamp formats
                    const noteDateStr = n.sessionDate ? n.sessionDate.split('T')[0] : '';
                    if (!noteDateStr || !noteDateStr.startsWith(aptDateStr)) return false;
                    
                    // Only Voice Notes recordings count as therapist session notes
                    const hasVoiceNotes = 
                        (n.audioURL && n.audioURL.trim().length > 0) ||
                        (n.transcript && n.transcript.trim().length > 0);
                    
                    console.log(`[Reminders] Checking note for ${apt.clientName} on ${aptDateStr}:`, {
                        noteClient: n.clientName,
                        noteDate: noteDateStr,
                        hasVoiceNotes,
                        audioURL: n.audioURL ? 'yes' : 'no',
                        transcript: n.transcript ? `${n.transcript.length} chars` : 'none'
                    });
                    
                    return hasVoiceNotes;
                });
                
                if (!hasNote) {
                    console.log(`[Reminders] Missing note for ${apt.clientName} on ${aptDateStr}`);
                }
                
                return !hasNote;
            });
            
            console.log(`[Reminders] Total past sessions: ${pastSessions.length}, Missing notes: ${missingNotes.length}`);

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
                // Extract date part (YYYY-MM-DD) from date string (handles both date-only and ISO timestamp formats)
                const dateStr = apt.date.split('T')[0];
                const timeStr = apt.time || '00:00';
                
                // Handle 12-hour format (e.g., "02:00 pm") - same logic as pastSessions filter
                let aptHours = 0;
                let aptMinutes = 0;
                const timeLower = timeStr.toLowerCase().trim();
                const isPM = timeLower.includes('pm');
                const isAM = timeLower.includes('am');
                const timeMatch = timeLower.match(/(\d{1,2}):(\d{2})/);
                if (timeMatch) {
                    aptHours = parseInt(timeMatch[1], 10);
                    aptMinutes = parseInt(timeMatch[2], 10);
                    if (isPM && aptHours !== 12) aptHours += 12;
                    else if (isAM && aptHours === 12) aptHours = 0;
                }
                
                const [year, month, day] = dateStr.split('-').map(Number);
                const aptDate = new Date(year, month - 1, day, aptHours, aptMinutes, 0);
                const isPast = aptDate < now;
                
                // Check payment status - handle null/undefined (defaults to unpaid)
                const paymentStatus = apt.paymentStatus || 'unpaid';
                const isUnpaid = paymentStatus !== 'paid';
                
                // Only include sessions with a fee > 0 (sessions with 0 fee shouldn't show as unpaid)
                const fee = apt.fee || 0;
                const hasFee = fee > 0;
                
                console.log(`[Reminders Page] Unpaid check: ${apt.clientName} on ${dateStr} at ${apt.time} (parsed: ${aptDate.toLocaleString()}) - isPast: ${isPast}, isUnpaid: ${isUnpaid}, hasFee: ${hasFee}, fee: ${fee}`);
                
                return isPast && isUnpaid && hasFee;
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
        // Parse date
        const datePart = dateString.split('T')[0];
        const [year, month, day] = datePart.split('-').map(Number);
        
        // Parse 12-hour time format (e.g., "10:00 am")
        let hours = 0;
        let minutes = 0;
        const timeLower = (timeString || '00:00').toLowerCase().trim();
        const isPM = timeLower.includes('pm');
        const isAM = timeLower.includes('am');
        const timeMatch = timeLower.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
            hours = parseInt(timeMatch[1], 10);
            minutes = parseInt(timeMatch[2], 10);
            if (isPM && hours !== 12) hours += 12;
            else if (isAM && hours === 12) hours = 0;
        }
        
        const sessionDate = new Date(year, month - 1, day, hours, minutes, 0);
        const now = new Date();
        const diffMs = now.getTime() - sessionDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return `${Math.floor(diffDays / 30)} months ago`;
    };

    const handleViewClient = (client: Client) => {
        router.push(`/clients?client=${client.id}`);
    };

    const handleMarkFormSigned = async (client: Client, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click
        if (!client.id) {
            alert('Client ID not found');
            return;
        }

        try {
            const response = await fetch('/api/clients/toggle-form-signed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: client.id, signed: true })
            });

            if (response.ok) {
                // Reload data to reflect the change
                await loadData();
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                alert(`Failed to update form status: ${errorData.error || 'Please try again'}`);
            }
        } catch (error) {
            console.error('Error marking form as signed:', error);
            alert('Error updating form status. Please try again.');
        }
    };

    return (
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-6xl">
            <div className="mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">Reminders</h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                    Keep track of reminders
                </p>
            </div>

            <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card 
                        className={`${
                            reminders.length === 0 
                                ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900"
                                : "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900"
                        } ${reminders.length > 0 ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
                        onClick={() => {
                            if (reminders.length > 0 && sessionNotesSectionRef.current) {
                                sessionNotesSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                // Highlight the section briefly
                                sessionNotesSectionRef.current.classList.add('ring-2', 'ring-red-500', 'ring-offset-2');
                                setTimeout(() => {
                                    sessionNotesSectionRef.current?.classList.remove('ring-2', 'ring-red-500', 'ring-offset-2');
                                }, 2000);
                            }
                        }}
                    >
                        <CardHeader>
                            <CardTitle className={`flex items-center gap-2 ${
                                reminders.length === 0
                                    ? "text-green-800 dark:text-green-200"
                                    : "text-red-800 dark:text-red-200"
                            }`}>
                                <AlertCircle className="h-5 w-5" />
                                {reminders.length} Session{reminders.length !== 1 ? 's' : ''} Awaiting Session Notes
                            </CardTitle>
                            <CardDescription className={
                                reminders.length === 0
                                    ? "text-green-700 dark:text-green-300"
                                    : "text-red-700 dark:text-red-300"
                            }>
                                {reminders.length === 0
                                    ? "Great! All your past sessions have therapist notes."
                                    : "These sessions need session notes to maintain complete records."}
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

                    <Card 
                        className={`${
                            unpaidSessions.length === 0 
                                ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900"
                                : "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900"
                        } ${unpaidSessions.length > 0 ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
                        onClick={() => {
                            if (unpaidSessions.length > 0 && unpaidSessionsSectionRef.current) {
                                unpaidSessionsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                // Highlight the section briefly
                                unpaidSessionsSectionRef.current.classList.add('ring-2', 'ring-red-500', 'ring-offset-2');
                                setTimeout(() => {
                                    unpaidSessionsSectionRef.current?.classList.remove('ring-2', 'ring-red-500', 'ring-offset-2');
                                }, 2000);
                            }
                        }}
                    >
                        <CardHeader>
                            <CardTitle className={`flex items-center gap-2 ${
                                unpaidSessions.length === 0
                                    ? "text-green-800 dark:text-green-200"
                                    : "text-red-800 dark:text-red-200"
                            }`}>
                                <Landmark className="h-5 w-5" />
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

                    {(() => {
                        // Count clients not seen recently reminders
                        const clientsNotSeenReminders = adminReminders.filter(reminder => {
                            const type = reminder.type || 'custom';
                            if (type === 'custom') {
                                return reminder.title?.includes('Not Seen') || reminder.title?.includes('not seen') || 
                                    reminder.description?.includes('hasn\'t had a session') || 
                                    reminder.description?.includes('not seen');
                            }
                            return type === 'clients_not_seen';
                        });
                        const count = clientsNotSeenReminders.length;

                        return (
                            <Card className={count === 0 
                                ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900"
                                : "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900"
                            }>
                                <CardHeader>
                                    <CardTitle className={`flex items-center gap-2 ${
                                        count === 0
                                            ? "text-green-800 dark:text-green-200"
                                            : "text-red-800 dark:text-red-200"
                                    }`}>
                                        <Calendar className="h-5 w-5" />
                                        {count} Client{count !== 1 ? 's' : ''} Not Seen Recently
                                    </CardTitle>
                                    <CardDescription className={
                                        count === 0
                                            ? "text-green-700 dark:text-green-300"
                                            : "text-red-700 dark:text-red-300"
                                    }>
                                        {count === 0
                                            ? "Great! All clients have been seen recently."
                                            : "These clients haven't had a session in the specified number of days."}
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        );
                    })()}
                </div>


                {/* Sessions Awaiting Session Notes Section */}
                {isLoading ? (
                    <Card>
                        <CardContent className="flex items-center justify-center py-16">
                            <p className="text-muted-foreground">Loading reminders...</p>
                        </CardContent>
                    </Card>
                ) : sortedReminders.length > 0 ? (
                    <div ref={sessionNotesSectionRef} className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold flex items-center gap-2">
                                <Mic className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600" />
                                <span className="hidden sm:inline">Sessions Awaiting Session Notes</span>
                                <span className="sm:hidden">Session Notes</span>
                            </h2>
                        </div>
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
                                        <CardContent className="p-4 sm:p-6">
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                                                <div className="flex-1 w-full sm:w-auto">
                                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                                                        <h3 className="text-base sm:text-lg font-semibold">
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
                                                        <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 w-fit">
                                                            {getTimeAgo(reminder.date, reminder.time)}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                                                            {formatDate(reminder.date)} at {reminder.time}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                                                            {reminder.type}
                                                        </span>
                                                    </div>
                                                </div>
                                                <Button
                                                    onClick={() => {
                                                        const params = new URLSearchParams({
                                                            client: reminder.clientName,
                                                            date: reminder.date.split('T')[0]
                                                        });
                                                        if (reminder.clientId) {
                                                            params.append('clientId', reminder.clientId);
                                                        }
                                                        router.push(`/voice-notes?${params.toString()}`);
                                                    }}
                                                    className="shrink-0 w-full sm:w-auto text-xs sm:text-sm"
                                                    size="sm"
                                                >
                                                    <Plus className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                                                    <Mic className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                                                    <span className="hidden sm:inline">Record Session Notes</span>
                                                    <span className="sm:hidden">Record Notes</span>
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                ) : null}

                {/* New Client Forms Section */}
                {showFormsSection ? (
                    <div ref={formsSectionRef} className="space-y-4 transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold flex items-center gap-2">
                                <ClipboardCheck className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                                <span className="hidden sm:inline">New Client Forms Awaiting Signature</span>
                                <span className="sm:hidden">Forms Pending</span>
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
                                            <CardContent className="p-4 sm:p-6">
                                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                                                    <div className="flex-1 w-full sm:w-auto">
                                                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                                                            <h3 className="text-base sm:text-lg font-semibold text-primary">
                                                                {client.name}
                                                            </h3>
                                                            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 w-fit">
                                                                Form Pending
                                                            </span>
                                                        </div>
                                                        <p className="text-xs sm:text-sm text-muted-foreground">
                                                            New Client Form has not been signed and returned.
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                                                        <Button
                                                            onClick={(e) => handleMarkFormSigned(client, e)}
                                                            className="shrink-0 bg-green-500 hover:bg-green-600 text-white w-full sm:w-auto text-xs sm:text-sm"
                                                            size="sm"
                                                        >
                                                            <CheckCircle2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                                                            <span className="hidden sm:inline">Mark Form Signed</span>
                                                            <span className="sm:hidden">Mark Signed</span>
                                                        </Button>
                                                    </div>
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
                    <div ref={unpaidSessionsSectionRef} className="space-y-4">
                        <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold flex items-center gap-2">
                            <Landmark className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                            Unpaid Sessions ({unpaidSessions.length})
                        </h2>
                        <div className="space-y-3">
                            {unpaidSessions.map((session) => (
                                <Card key={session.id} className="border-red-200 dark:border-red-900 hover:shadow-md transition-shadow">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between gap-3 sm:gap-4">
                                            <div className="flex-1">
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                                                    <h3 className="text-sm sm:text-base font-semibold text-primary">
                                                        {session.clientName}
                                                    </h3>
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200 w-fit">
                                                        Unpaid
                                                    </span>
                                                </div>
                                                <p className="text-xs sm:text-sm text-muted-foreground">
                                                    {formatDate(session.date)} at {session.time} - {session.type}
                                                </p>
                                                {session.fee && (
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Amount: {getCurrencySymbol(session.currency)}{session.fee.toFixed(2)}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <Button
                                                    onClick={(e) => handleMarkAsPaid(session, e)}
                                                    disabled={markingPaidSessionId === session.id}
                                                    className="shrink-0 bg-green-500 hover:bg-green-600 text-white text-xs sm:text-sm"
                                                    size="sm"
                                                >
                                                    {markingPaidSessionId === session.id ? (
                                                        <>
                                                            <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                                                            <span className="hidden sm:inline">Marking...</span>
                                                            <span className="sm:hidden">...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckCircle2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                                                            <span className="hidden sm:inline">Mark as Paid</span>
                                                            <span className="sm:hidden">Paid</span>
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* Custom Admin Reminders Section */}
                {(() => {
                    // Filter out reminders that are already shown in other sections
                    // (new_client_form and unpaid_session are already shown above)
                    const filteredReminders = adminReminders.filter(reminder => 
                        reminder.type !== 'new_client_form' && reminder.type !== 'unpaid_session'
                    );

                    if (filteredReminders.length === 0) return null;

                    // Group reminders by type
                    const grouped = filteredReminders.reduce((acc, reminder) => {
                        // For 'custom' type, try to detect the actual type from title/description
                        let type = reminder.type || 'custom';
                        if (type === 'custom') {
                            if (reminder.title?.includes('Not Seen') || reminder.title?.includes('not seen') || 
                                reminder.description?.includes('hasn\'t had a session') || 
                                reminder.description?.includes('Last session was') ||
                                reminder.description?.includes('not seen')) {
                                type = 'clients_not_seen';
                            }
                        }
                        if (!acc[type]) acc[type] = [];
                        acc[type].push(reminder);
                        return acc;
                    }, {} as Record<string, typeof filteredReminders>);

                    return Object.entries(grouped)
                        .filter(([type]) => type === 'clients_not_seen') // Only show known types that aren't already displayed
                        .map(([type, reminders]) => {
                            // Only handle clients_not_seen type
                            if (type === 'clients_not_seen') {
                                const config = {
                                    title: 'Clients Not Seen Recently',
                                    icon: Calendar,
                                    iconColor: 'text-purple-600',
                                    borderColor: 'border-purple-200 dark:border-purple-900',
                                    tagColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200',
                                    tagText: 'Not Seen',
                                    cardIcon: Calendar,
                                };

                                const Icon = config.icon;
                                const CardIcon = config.cardIcon;

                                return (
                                    <div key={type} className="space-y-4">
                                        <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold flex items-center gap-2">
                                            <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${config.iconColor}`} />
                                            {config.title}
                                        </h2>
                                        <div className="space-y-3">
                                            {reminders.map((reminder) => {
                                                const clientName = reminder.clients?.name || 'Unknown Client';
                                                const clientId = reminder.client_id;
                                                
                                                // Calculate days since last seen from appointments
                                                let daysSince = getDaysSinceLastSeen(clientId, clientName);
                                                
                                                // Fallback: extract from description if calculation returned null
                                                if (daysSince === null && reminder.description) {
                                                    const match = reminder.description.match(/(\d+)\s*days?\s*ago/i) ||
                                                                  reminder.description.match(/in\s*(\d+)\s*days?/i);
                                                    if (match && match[1]) {
                                                        daysSince = parseInt(match[1], 10);
                                                    }
                                                }
                                                
                                                return (
                                                    <Card 
                                                        key={reminder.id} 
                                                        className={`hover:shadow-md transition-shadow ${config.borderColor} cursor-pointer`}
                                                        onClick={() => {
                                                            if (reminder.client_id) {
                                                                router.push(`/clients?client=${reminder.client_id}`);
                                                            }
                                                        }}
                                                    >
                                                        <CardContent className="p-4 sm:p-6">
                                                            <div className="flex items-start justify-between gap-3 sm:gap-4">
                                                                <div className="flex-1">
                                                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                                                                        <h3 className="text-base sm:text-lg font-semibold text-primary">
                                                                            {clientName}
                                                                        </h3>
                                                                        {daysSince !== null && daysSince !== undefined ? (
                                                                            <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 w-fit">
                                                                                {daysSince} {daysSince === 1 ? 'day' : 'days'} since last seen
                                                                            </span>
                                                                        ) : (
                                                                            <span className={`text-xs px-2 py-1 rounded-full ${config.tagColor} w-fit`}>
                                                                                {config.tagText}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-xs sm:text-sm text-muted-foreground">
                                                                        {daysSince !== null && daysSince !== undefined 
                                                                            ? `Last session was ${daysSince} ${daysSince === 1 ? 'day' : 'days'} ago`
                                                                            : 'No recent sessions found'}
                                                                    </p>
                                                                    {reminder.sessions && (
                                                                        <p className="text-xs text-muted-foreground mt-1">
                                                                            Session: {new Date(reminder.sessions.date).toLocaleDateString()} - {reminder.sessions.type}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900/20"
                                                                        onClick={(e) => handleDismissReminder(reminder.id, e)}
                                                                        disabled={dismissingReminderId === reminder.id}
                                                                        title="Dismiss reminder"
                                                                    >
                                                                        {dismissingReminderId === reminder.id ? (
                                                                            <Clock className="h-4 w-4 animate-spin" />
                                                                        ) : (
                                                                            <X className="h-4 w-4 text-muted-foreground hover:text-red-600" />
                                                                        )}
                                                                    </Button>
                                                                    <CardIcon className="h-5 w-5 text-muted-foreground" />
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        });
                })()}
            </div>
        </div>
    );
}
