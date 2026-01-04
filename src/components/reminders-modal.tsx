"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Clock, ClipboardCheck, DollarSign, Plus, X, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
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

interface Client {
    id: string;
    name: string;
    newClientFormSigned?: boolean;
    archived?: boolean;
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

export function RemindersModal() {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [reminders, setReminders] = useState<Appointment[]>([]);
    const [unsignedFormClients, setUnsignedFormClients] = useState<Client[]>([]);
    const [unpaidSessions, setUnpaidSessions] = useState<Appointment[]>([]);
    const [adminReminders, setAdminReminders] = useState<AdminReminder[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check if user has dismissed the reminders modal
        const dismissed = localStorage.getItem('remindersModalDismissed');
        if (!dismissed) {
            setIsOpen(true);
            loadData();
        }
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Load appointments
            const aptRes = await fetch('/api/appointments', { cache: 'no-store' });
            const appointmentsData = aptRes.ok ? await aptRes.json() : [];

            // Load clients
            const clientRes = await fetch('/api/clients', { cache: 'no-store' });
            const clientsData = clientRes.ok ? await clientRes.json() : [];

            // Load admin reminders
            const adminRemindersRes = await fetch('/api/admin-reminders', { cache: 'no-store' });
            const adminRemindersData = adminRemindersRes.ok ? await adminRemindersRes.json() : [];

            setAppointments(appointmentsData);
            setClients(clientsData);
            setAdminReminders(adminRemindersData);

            // Calculate reminders
            const now = new Date();
            const remindersList: Appointment[] = [];
            const unpaidList: Appointment[] = [];

            appointmentsData.forEach((apt: Appointment) => {
                const aptDate = new Date(`${apt.date}T${apt.time}`);
                if (aptDate < now) {
                    // Check if session has notes
                    const hasNotes = false; // You might want to check notes API
                    if (!hasNotes) {
                        remindersList.push(apt);
                    }
                }
                if (apt.paymentStatus === 'unpaid' || apt.paymentStatus === 'pending') {
                    unpaidList.push(apt);
                }
            });

            // Get clients without signed forms
            const unsignedClients = clientsData.filter((c: Client) => !c.newClientFormSigned && !c.archived);

            setReminders(remindersList);
            setUnsignedFormClients(unsignedClients);
            setUnpaidSessions(unpaidList);
        } catch (error) {
            console.error('Error loading reminders:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDismiss = () => {
        setIsOpen(false);
        localStorage.setItem('remindersModalDismissed', 'true');
    };

    const handleViewReminders = () => {
        handleDismiss();
        router.push('/reminders');
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const getTimeAgo = (dateString: string, timeString: string) => {
        const date = new Date(`${dateString}T${timeString}`);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return `${Math.floor(diffDays / 30)} months ago`;
    };

    const totalReminders = reminders.length + unsignedFormClients.length + unpaidSessions.length + adminReminders.length;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) {
                handleDismiss();
            }
        }}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">Reminders</DialogTitle>
                    <DialogDescription>
                        {totalReminders > 0 
                            ? `You have ${totalReminders} reminder${totalReminders > 1 ? 's' : ''} that need your attention`
                            : "All caught up! No reminders at this time."}
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <p className="text-muted-foreground">Loading reminders...</p>
                    </div>
                ) : (
                    <div className="space-y-4 mt-4">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className={reminders.length === 0 
                                ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900"
                                : "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900"
                            }>
                                <CardHeader>
                                    <CardTitle className={`flex items-center gap-2 text-sm ${
                                        reminders.length === 0
                                            ? "text-green-800 dark:text-green-200"
                                            : "text-red-800 dark:text-red-200"
                                    }`}>
                                        <AlertCircle className="h-4 w-4" />
                                        {reminders.length} Session{reminders.length !== 1 ? 's' : ''} Awaiting Notes
                                    </CardTitle>
                                </CardHeader>
                            </Card>

                            <Card className={unsignedFormClients.length === 0 
                                ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900"
                                : "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900"
                            }>
                                <CardHeader>
                                    <CardTitle className={`flex items-center gap-2 text-sm ${
                                        unsignedFormClients.length === 0
                                            ? "text-green-800 dark:text-green-200"
                                            : "text-red-800 dark:text-red-200"
                                    }`}>
                                        <ClipboardCheck className="h-4 w-4" />
                                        {unsignedFormClients.length} Client{unsignedFormClients.length !== 1 ? 's' : ''} Awaiting Forms
                                    </CardTitle>
                                </CardHeader>
                            </Card>

                            <Card className={unpaidSessions.length === 0 
                                ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900"
                                : "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900"
                            }>
                                <CardHeader>
                                    <CardTitle className={`flex items-center gap-2 text-sm ${
                                        unpaidSessions.length === 0
                                            ? "text-green-800 dark:text-green-200"
                                            : "text-red-800 dark:text-red-200"
                                    }`}>
                                        <DollarSign className="h-4 w-4" />
                                        {unpaidSessions.length} Unpaid Session{unpaidSessions.length !== 1 ? 's' : ''}
                                    </CardTitle>
                                </CardHeader>
                            </Card>
                        </div>

                        {/* Reminders List */}
                        {totalReminders > 0 && (
                            <div className="space-y-2">
                                {reminders.slice(0, 5).map((reminder) => (
                                    <Card key={reminder.id} className="hover:shadow-md transition-shadow">
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="font-semibold">{reminder.clientName}</h3>
                                                        <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                                                            {getTimeAgo(reminder.date, reminder.time)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                        <span>{formatDate(reminder.date)} at {reminder.time}</span>
                                                        <span>{reminder.type}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                {reminders.length > 5 && (
                                    <p className="text-sm text-muted-foreground text-center py-2">
                                        + {reminders.length - 5} more session{reminders.length - 5 > 1 ? 's' : ''} awaiting notes
                                    </p>
                                )}
                            </div>
                        )}

                        {totalReminders === 0 && (
                            <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
                                <CardContent className="p-6 text-center">
                                    <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
                                        All Caught Up!
                                    </h3>
                                    <p className="text-green-700 dark:text-green-300">
                                        You have no pending reminders at this time.
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                    <Button variant="outline" onClick={handleDismiss}>
                        Dismiss
                    </Button>
                    {totalReminders > 0 && (
                        <Button onClick={handleViewReminders}>
                            View All Reminders
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}




