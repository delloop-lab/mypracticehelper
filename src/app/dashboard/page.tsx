"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, DollarSign, Users, Mic, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { RemindersModal } from "@/components/reminders-modal";

type Tab = "overview" | "schedule" | "clients" | "billing" | "notes" | "documents";

export default function DashboardPage() {
    const router = useRouter();

    const handleNavigate = (tab: Tab, action?: string) => {
        if (tab === "schedule") router.push("/schedule");
        if (tab === "clients") router.push("/clients");
        if (tab === "billing") router.push("/payments");
        if (tab === "notes") router.push("/recordings");
        if (tab === "documents") router.push("/documents");
    };

    return (
        <div className="min-h-screen bg-background p-6 lg:p-10">
            <div className="max-w-7xl mx-auto">
                <RemindersModal />
                <DashboardOverview onNavigate={handleNavigate} />
            </div>
        </div>
    );
}

function DashboardOverview({ onNavigate }: { onNavigate: (tab: Tab, action?: string) => void }) {
    const router = useRouter();
    const [stats, setStats] = useState({
        todaySessions: 0,
        activeClients: 0,
        revenue: 0,
        recordings: 0
    });
    const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
    const [revenuePeriod, setRevenuePeriod] = useState<"today" | "week" | "month" | "all">("month");
    const [reminders, setReminders] = useState<any[]>([]);

    useEffect(() => {
        const loadData = async () => {
            try {
                console.log('Fetching dashboard data...');

                // Load appointments
                const aptRes = await fetch('/api/appointments', { cache: 'no-store' });
                const appointments = aptRes.ok ? await aptRes.json() : [];

                // Load clients
                const clientRes = await fetch('/api/clients', { cache: 'no-store' });
                const clients = clientRes.ok ? await clientRes.json() : [];

                // Load recordings
                const recRes = await fetch('/api/recordings', { cache: 'no-store' });
                const recordings = recRes.ok ? await recRes.json() : [];

                // Load session notes
                const notesRes = await fetch('/api/session-notes', { cache: 'no-store' });
                const notes = notesRes.ok ? await notesRes.json() : [];

                // Calculate stats
                const today = new Date().toISOString().split('T')[0];
                const now = new Date();

                const todayApts = appointments.filter((a: any) => a.date === today);

                // Filter upcoming sessions (today and future)
                const upcoming = appointments
                    .filter((a: any) => a.date >= today)
                    .sort((a: any, b: any) => {
                        if (a.date !== b.date) return a.date.localeCompare(b.date);
                        return a.time.localeCompare(b.time);
                    })
                    .slice(0, 3);

                // Identify past sessions without notes (Reminders)
                const pastSessions = appointments.filter((a: any) => {
                    const aptDate = new Date(`${a.date}T${a.time}`);
                    return aptDate < now;
                });

                const missingNotes = pastSessions.filter((apt: any) => {
                    // Check if a note exists for this client on this date
                    // Note: This is a simple check, might need more robust matching in production
                    const hasNote = notes.some((n: any) =>
                        n.clientName === apt.clientName &&
                        n.sessionDate &&
                        n.sessionDate.startsWith(apt.date)
                    );
                    return !hasNote;
                }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 3); // Show top 3 reminders

                setReminders(missingNotes);

                // Calculate revenue based on period
                const revenue = calculateRevenue(appointments, revenuePeriod);

                setStats({
                    todaySessions: todayApts.length,
                    activeClients: clients.length,
                    revenue,
                    recordings: recordings.length
                });
                setUpcomingSessions(upcoming);

            } catch (error) {
                console.error('Error loading dashboard data:', error);
            }
        };

        loadData();
    }, [revenuePeriod]);

    const calculateRevenue = (appointments: any[], period: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const filtered = appointments.filter((apt: any) => {
            if (!apt.fee || apt.paymentStatus !== "paid") return false;

            const aptDate = new Date(apt.date);
            aptDate.setHours(0, 0, 0, 0);

            if (period === "today") {
                return aptDate.getTime() === today.getTime();
            } else if (period === "week") {
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                return aptDate >= weekAgo && aptDate <= today;
            } else if (period === "month") {
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                return aptDate >= monthStart && aptDate <= today;
            } else {
                // all time
                return aptDate <= today;
            }
        });

        return filtered.reduce((sum: number, apt: any) => sum + (apt.fee || 0), 0);
    };

    const getRevenuePeriodLabel = () => {
        switch (revenuePeriod) {
            case "today": return "Today";
            case "week": return "This Week";
            case "month": return "This Month";
            case "all": return "All Time";
            default: return "This Month";
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Welcome back!</h2>
                <p className="text-muted-foreground">Here's what's happening with your practice today.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border bg-card p-6">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">Today's Sessions</p>
                        <Calendar className="h-4 w-4 text-blue-500" />
                    </div>
                    <p className="mt-2 text-3xl font-bold">{stats.todaySessions}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {stats.todaySessions === 0 ? "No sessions today" : `${stats.todaySessions} scheduled`}
                    </p>
                </div>

                <div className="rounded-lg border bg-card p-6">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">Active Clients</p>
                        <Users className="h-4 w-4 text-blue-500" />
                    </div>
                    <p className="mt-2 text-3xl font-bold">{stats.activeClients}</p>
                    <p className="text-xs text-muted-foreground mt-1">Total clients</p>
                </div>

                <div className="rounded-lg border bg-card p-6">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">Revenue ({getRevenuePeriodLabel()})</p>
                        <DollarSign className="h-4 w-4 text-pink-500" />
                    </div>
                    <p className="mt-2 text-3xl font-bold">€{stats.revenue.toLocaleString()}</p>
                    <div className="mt-2 flex gap-1">
                        <button
                            onClick={() => setRevenuePeriod("today")}
                            className={`text-xs px-2 py-1 rounded ${revenuePeriod === "today" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                        >
                            Today
                        </button>
                        <button
                            onClick={() => setRevenuePeriod("week")}
                            className={`text-xs px-2 py-1 rounded ${revenuePeriod === "week" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                        >
                            Week
                        </button>
                        <button
                            onClick={() => setRevenuePeriod("month")}
                            className={`text-xs px-2 py-1 rounded ${revenuePeriod === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                        >
                            Month
                        </button>
                        <button
                            onClick={() => setRevenuePeriod("all")}
                            className={`text-xs px-2 py-1 rounded ${revenuePeriod === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                        >
                            All
                        </button>
                    </div>
                </div>

                <div className="rounded-lg border bg-card p-6">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">Recordings</p>
                        <FileText className="h-4 w-4 text-green-500" />
                    </div>
                    <p className="mt-2 text-3xl font-bold">{stats.recordings}</p>
                    <p className="text-xs text-muted-foreground mt-1">Voice notes saved</p>
                </div>
            </div>

            {/* Super Reminder Banner */}
            {reminders.length > 0 && (
                <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                                <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-green-500" />
                                    Action Required: {reminders.length} Session{reminders.length !== 1 ? 's' : ''} Need{reminders.length === 1 ? 's' : ''} Notes
                                </h3>
                                <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
                                    You have {reminders.length} past session{reminders.length !== 1 ? 's' : ''} that need clinical documentation.
                                </p>
                                <Button
                                    onClick={() => router.push('/reminders')}
                                    variant="default"
                                    className="bg-amber-600 hover:bg-amber-700 text-white"
                                >
                                    View All Reminders
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-lg border bg-card p-6">
                    <h3 className="font-semibold mb-4">Quick Actions</h3>
                    <div className="space-y-2">
                        <Button
                            variant="outline"
                            className="w-full justify-start gap-2"
                            onClick={() => router.push('/reminders')}
                        >
                            <FileText className="h-4 w-4 text-green-500" />
                            View Reminders
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full justify-start gap-2"
                            onClick={() => onNavigate("schedule")}
                        >
                            <Calendar className="h-4 w-4 text-blue-500" />
                            Schedule New Appointment
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full justify-start gap-2"
                            onClick={() => onNavigate("notes")}
                        >
                            <Mic className="h-4 w-4 text-purple-500" />
                            Record Session Notes
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full justify-start gap-2"
                            onClick={() => onNavigate("clients", "add")}
                        >
                            <Users className="h-4 w-4 text-blue-500" />
                            Add New Client
                        </Button>
                    </div>
                </div>

                <div className="rounded-lg border bg-card p-6">
                    <h3 className="font-semibold mb-4">Upcoming Sessions</h3>
                    <div className="space-y-3">
                        {upcomingSessions.length === 0 ? (
                            <div className="flex items-center justify-center py-8 text-muted-foreground">
                                <p className="text-sm">No upcoming sessions scheduled</p>
                            </div>
                        ) : (
                            upcomingSessions.map((session, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                                    onClick={() => onNavigate("schedule")}
                                >
                                    <div>
                                        <p className="font-medium">{session.clientName}</p>
                                        <p className="text-sm text-muted-foreground">{session.type}</p>
                                        {session.fee && (
                                            <p className="text-xs text-muted-foreground">€{session.fee} - {session.paymentStatus || "unpaid"}</p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-medium">{new Date(session.date).toLocaleDateString()}</p>
                                        <p className="text-xs text-muted-foreground">{session.time}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
