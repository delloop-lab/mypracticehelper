"use client";

import { useState, useEffect, useMemo } from "react";
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
import { FileText, Calendar, Search, AlertCircle, Clock, Plus } from "lucide-react";
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
}

type SortOption = 'date-desc' | 'date-asc' | 'client-asc' | 'client-desc';

export default function RemindersPage() {
    const router = useRouter();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [notes, setNotes] = useState<SessionNote[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [reminders, setReminders] = useState<Appointment[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedClient, setSelectedClient] = useState<string>("all");
    const [sortBy, setSortBy] = useState<SortOption>('date-desc');
    const [isLoading, setIsLoading] = useState(true);

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

            setAppointments(appointmentsData);
            setNotes(notesData);
            setClients(clientsData);

            // Calculate reminders
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

    // Filter and sort reminders
    const filteredAndSortedReminders = useMemo(() => {
        let filtered = reminders;

        // Filter by search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(r =>
                r.clientName?.toLowerCase().includes(query) ||
                r.type?.toLowerCase().includes(query)
            );
        }

        // Filter by client
        if (selectedClient !== "all") {
            filtered = filtered.filter(r => r.clientName === selectedClient);
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
                default:
                    return 0;
            }
        });

        return sorted;
    }, [reminders, searchQuery, selectedClient, sortBy]);

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

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2">Session Note Reminders</h1>
                <p className="text-muted-foreground">
                    Past sessions that need documentation
                </p>
            </div>

            <div className="space-y-6">
                {/* Summary Card */}
                <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                            <AlertCircle className="h-5 w-5" />
                            {reminders.length} Session{reminders.length !== 1 ? 's' : ''} Awaiting Notes
                        </CardTitle>
                        <CardDescription className="text-amber-700 dark:text-amber-300">
                            {reminders.length === 0
                                ? "Great! All your past sessions have notes."
                                : "These sessions need clinical documentation to maintain complete records."}
                        </CardDescription>
                    </CardHeader>
                </Card>

                {/* Filters and Search */}
                {reminders.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Search className="h-5 w-5" />
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
                                            placeholder="Search by client or type..."
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
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Results count */}
                            <div className="text-sm text-muted-foreground">
                                Showing {filteredAndSortedReminders.length} of {reminders.length} reminders
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Reminders List */}
                {isLoading ? (
                    <Card>
                        <CardContent className="flex items-center justify-center py-16">
                            <p className="text-muted-foreground">Loading reminders...</p>
                        </CardContent>
                    </Card>
                ) : filteredAndSortedReminders.length === 0 && reminders.length > 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-16">
                            <Search className="h-16 w-16 text-muted-foreground mb-4" />
                            <h3 className="text-xl font-semibold mb-2">No matching reminders</h3>
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
                ) : filteredAndSortedReminders.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-16">
                            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                            <h3 className="text-xl font-semibold mb-2">All caught up!</h3>
                            <p className="text-muted-foreground text-center max-w-md mb-6">
                                You don't have any past sessions that need notes. Great work!
                            </p>
                            <Link href="/schedule">
                                <Button>
                                    <Calendar className="mr-2 h-4 w-4" />
                                    View Schedule
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        <AnimatePresence>
                            {filteredAndSortedReminders.map((reminder, index) => (
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
            </div>
        </div>
    );
}
