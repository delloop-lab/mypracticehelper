"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Users, Mic, FileText, Landmark } from "lucide-react";
import { useRouter } from "next/navigation";
import { RemindersModal } from "@/components/reminders-modal";
import { startOfYear, endOfYear, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth } from "date-fns";

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
    const [revenuePeriod, setRevenuePeriod] = useState<"today" | "week" | "month" | "year" | "custom">("week");
    const [customDateFrom, setCustomDateFrom] = useState<string>("");
    const [customDateTo, setCustomDateTo] = useState<string>("");
    const [reminders, setReminders] = useState<any[]>([]);
    const [remindersTotalCount, setRemindersTotalCount] = useState<number>(0);
    const [unsignedFormClients, setUnsignedFormClients] = useState<any[]>([]);
    const [unpaidSessions, setUnpaidSessions] = useState<any[]>([]);
    const [adminReminders, setAdminReminders] = useState<any[]>([]);
    const [reminderCounts, setReminderCounts] = useState({
        clinicalNotes: 0,
        unsignedForms: 0,
        unpaidSessions: 0,
        customReminders: 0
    });
    const [userFirstName, setUserFirstName] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isRevenueLoading, setIsRevenueLoading] = useState<boolean>(true);
    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});

    useEffect(() => {
        const loadData = async (skipFullLoad = false) => {
            if (!skipFullLoad) {
                setIsLoading(true);
            }
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

                // Load admin reminders (custom reminders from templates)
                const adminRemindersRes = await fetch('/api/admin-reminders', { cache: 'no-store' });
                const adminRemindersData = adminRemindersRes.ok ? await adminRemindersRes.json() : [];
                setAdminReminders(adminRemindersData);

                // Calculate stats
                const now = new Date();
                const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                
                console.log('[Dashboard] Today is:', today);
                console.log('[Dashboard] All appointments:', appointments.map((a: any) => ({ client: a.clientName, date: a.date, dateStr: a.date.split('T')[0] })));

                // Filter today's appointments - compare date parts only
                const todayApts = appointments.filter((a: any) => {
                    const aptDateStr = a.date.split('T')[0];
                    const isToday = aptDateStr === today;
                    console.log(`[Dashboard] Checking ${a.clientName}: ${aptDateStr} === ${today} ? ${isToday}`);
                    return isToday;
                });
                
                console.log('[Dashboard] Today appointments:', todayApts.length);

                // Filter upcoming sessions - exclude past appointments (including today's past ones)
                const upcoming = appointments
                    .filter((a: any) => {
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
                        
                        // Only include appointments that haven't passed yet
                        return aptDate >= now;
                    })
                    .sort((a: any, b: any) => {
                        if (a.date !== b.date) return a.date.localeCompare(b.date);
                        return a.time.localeCompare(b.time);
                    })
                    .slice(0, 3);

                // Identify past sessions without notes (Reminders)
                const pastSessions = appointments.filter((a: any) => {
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
                    return aptDate < now;
                });

                const allMissingNotes = pastSessions.filter((apt: any) => {
                    // Extract date part for comparison
                    const aptDateStr = apt.date.split('T')[0];
                    
                    // Check if a note exists for this appointment
                    // A note is considered to exist if it has:
                    // 1. Matching client (by name or ID)
                    // 2. Matching date
                    // 3. Has actual content (content, transcript, audio, or attachments)
                    const hasNote = notes.some((n: any) => {
                        // Match by client name or client ID
                        const clientMatches = 
                            (n.clientName && apt.clientName && n.clientName.toLowerCase() === apt.clientName.toLowerCase()) ||
                            (n.clientId && apt.clientId && n.clientId === apt.clientId);
                        
                        if (!clientMatches) return false;
                        
                        // Match by date - handle both date-only and ISO timestamp formats
                        const noteDateStr = n.sessionDate ? n.sessionDate.split('T')[0] : '';
                        if (!noteDateStr || !noteDateStr.startsWith(aptDateStr)) return false;
                        
                        // Only Voice Notes recordings count as Clinical Notes
                        const hasVoiceNotes = 
                            (n.audioURL && n.audioURL.trim().length > 0) ||
                            (n.transcript && n.transcript.trim().length > 0);
                        
                        return hasVoiceNotes;
                    });
                    
                    return !hasNote;
                }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

                // Store total count and show top 3 for display
                const missingNotes = allMissingNotes.slice(0, 3);
                setReminders(missingNotes);

                // Calculate clients with unsigned forms
                const clientsWithoutSignedForms = clients.filter((c: any) => 
                    !c.newClientFormSigned
                );
                setUnsignedFormClients(clientsWithoutSignedForms);

                // Calculate unpaid past sessions (with proper time parsing and fee check)
                console.log(`[Dashboard] Checking ${appointments.length} appointments for unpaid sessions...`);
                const pastUnpaidSessions = appointments.filter((apt: any) => {
                    const dateStr = apt.date.split('T')[0];
                    const timeStr = apt.time || '00:00';
                    
                    // Handle 12-hour format (e.g., "02:00 pm") - same logic as reminders page
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
                    
                    const shouldInclude = isPast && isUnpaid && hasFee;
                    
                    // Debug logging for all past sessions
                    if (isPast) {
                        console.log(`[Dashboard] Unpaid check: ${apt.clientName} on ${dateStr} at ${apt.time} (parsed: ${aptDate.toLocaleString()}) - isPast: ${isPast}, isUnpaid: ${isUnpaid}, hasFee: ${hasFee}, fee: ${fee}, paymentStatus: ${paymentStatus}, shouldInclude: ${shouldInclude}`);
                    }
                    
                    return shouldInclude;
                });
                
                console.log(`[Dashboard] Found ${pastUnpaidSessions.length} unpaid sessions:`, pastUnpaidSessions.map((s: any) => ({ client: s.clientName, date: s.date, time: s.time, fee: s.fee, paymentStatus: s.paymentStatus })));
                setUnpaidSessions(pastUnpaidSessions);

                // Store individual reminder counts
                // Filter admin reminders to only count "clients_not_seen" types
                const clientsNotSeenReminders = adminRemindersData.filter((reminder: { type?: string; title?: string; description?: string }) => {
                    const type = reminder.type || 'custom';
                    if (type === 'clients_not_seen') return true;
                    // Also check for legacy custom reminders that might be about clients not seen
                    if (type === 'custom') {
                        return reminder.title?.includes('Not Seen') || reminder.title?.includes('not seen') || 
                            reminder.description?.includes('hasn\'t had a session') || 
                            reminder.description?.includes('not seen');
                    }
                    return false;
                });

                // Calculate total reminders count (all types)
                const totalRemindersCount = 
                    allMissingNotes.length + 
                    clientsWithoutSignedForms.length + 
                    pastUnpaidSessions.length + 
                    clientsNotSeenReminders.length;
                setRemindersTotalCount(totalRemindersCount);
                
                const counts = {
                    clinicalNotes: allMissingNotes.length,
                    unsignedForms: clientsWithoutSignedForms.length,
                    unpaidSessions: pastUnpaidSessions.length,
                    customReminders: clientsNotSeenReminders.length
                };
                
                console.log(`[Dashboard] Setting reminder counts:`, counts);
                console.log(`[Dashboard] Unpaid sessions count: ${counts.unpaidSessions}, actual sessions:`, pastUnpaidSessions.map((s: any) => s.clientName));
                
                setReminderCounts(counts);

                // Calculate revenue based on period
                const revenue = calculateRevenue(appointments, revenuePeriod);

                setStats({
                    todaySessions: todayApts.length,
                    activeClients: clients.length,
                    revenue,
                    recordings: recordings.length
                });
                setUpcomingSessions(upcoming);
                setIsRevenueLoading(false);

            } catch (error) {
                console.error('Error loading dashboard data:', error);
                setIsRevenueLoading(false);
            } finally {
                setIsLoading(false);
            }
        };

        // Initial load - load all data
        loadData();
    }, []); // Only run on mount

    // Load exchange rates
    useEffect(() => {
        const loadExchangeRates = async () => {
            try {
                const response = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
                if (response.ok) {
                    const data = await response.json();
                    if (data.rates) {
                        // Store rates for conversion TO EUR
                        // API returns rates FROM EUR, e.g., USD: 1.10 means 1 EUR = 1.10 USD
                        // To convert TO EUR, we divide: 1 USD = 1/1.10 EUR = 0.909 EUR
                        const rates: Record<string, number> = { EUR: 1 };
                        Object.keys(data.rates).forEach(currency => {
                            if (currency !== 'EUR' && data.rates[currency]) {
                                const currencyUpper = currency.toUpperCase();
                                const rate = 1 / data.rates[currency];
                                rates[currencyUpper] = rate;
                                rates[currency] = rate;
                            }
                        });
                        setExchangeRates(rates);
                    }
                } else {
                    // Try fallback API
                    try {
                        const fallbackResponse = await fetch('https://api.exchangerate.host/latest?base=EUR');
                        if (fallbackResponse.ok) {
                            const fallbackData = await fallbackResponse.json();
                            if (fallbackData.rates) {
                                const rates: Record<string, number> = { EUR: 1 };
                                Object.keys(fallbackData.rates).forEach(currency => {
                                    if (currency !== 'EUR' && fallbackData.rates[currency]) {
                                        const currencyUpper = currency.toUpperCase();
                                        const rate = 1 / fallbackData.rates[currency];
                                        rates[currencyUpper] = rate;
                                        rates[currency] = rate;
                                    }
                                });
                                setExchangeRates(rates);
                            }
                        }
                    } catch (fallbackError) {
                        console.error('[Dashboard] Fallback exchange rate API failed:', fallbackError);
                    }
                }
            } catch (error) {
                console.error('[Dashboard] Error loading exchange rates:', error);
                // If API fails, set EUR rate to 1 so at least EUR amounts show correctly
                setExchangeRates({ EUR: 1 });
            }
        };
        loadExchangeRates();
    }, []);

    // Load user's first name
    useEffect(() => {
        const loadUserData = async () => {
            try {
                const response = await fetch('/api/auth/me');
                if (response.ok) {
                    const userData = await response.json();
                    if (userData.first_name && userData.first_name.trim()) {
                        setUserFirstName(userData.first_name.trim());
                    }
                }
            } catch (error) {
                console.error('[Dashboard] Error fetching user data:', error);
            }
        };
        loadUserData();
    }, []);

    // Separate effect for revenue period changes - only update revenue without reloading all data
    useEffect(() => {
        // Skip on initial mount (handled by the effect above)
        // Only recalculate if we already have data loaded
        if (!isLoading) {
            const recalculateRevenue = async () => {
                setIsRevenueLoading(true);
                try {
                    const aptRes = await fetch('/api/appointments', { cache: 'no-store' });
                    const appointments = aptRes.ok ? await aptRes.json() : [];
                    const revenue = calculateRevenue(appointments, revenuePeriod);
                    setStats(prev => ({ ...prev, revenue }));
                } catch (error) {
                    console.error('Error recalculating revenue:', error);
                } finally {
                    setIsRevenueLoading(false);
                }
            };
            recalculateRevenue();
        }
    }, [revenuePeriod, customDateFrom, customDateTo, isLoading, exchangeRates]);

    // Load user's first name
    useEffect(() => {
        const loadUserData = async () => {
            try {
                const response = await fetch('/api/auth/me');
                if (response.ok) {
                    const userData = await response.json();
                    if (userData.first_name && userData.first_name.trim()) {
                        setUserFirstName(userData.first_name.trim());
                    }
                }
            } catch (error) {
                console.error('[Dashboard] Error fetching user data:', error);
            }
        };
        loadUserData();
    }, []);

    const calculateRevenue = (appointments: any[], period: string) => {
        const now = new Date();
        const today = startOfDay(now);

        const filtered = appointments.filter((apt: any) => {
            if (!apt.fee || apt.paymentStatus !== "paid") return false;

            // Extract date part only (handle ISO strings with time)
            const aptDateStr = apt.date.split('T')[0];
            const [year, month, day] = aptDateStr.split('-').map(Number);
            const aptDate = startOfDay(new Date(year, month - 1, day));

            if (period === "today") {
                return aptDate.getTime() === today.getTime();
            } else if (period === "week") {
                const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
                const weekEnd = endOfWeek(now, { weekStartsOn: 1 }); // Sunday
                return aptDate >= weekStart && aptDate <= weekEnd;
            } else if (period === "month") {
                const monthStart = startOfMonth(now);
                return aptDate >= monthStart && aptDate <= today;
            } else if (period === "year") {
                const yearStart = startOfYear(now);
                return aptDate >= yearStart && aptDate <= today; // This year so far, not full year
            } else if (period === "custom") {
                if (!customDateFrom || !customDateTo) return false;
                const fromDate = startOfDay(new Date(customDateFrom));
                const toDate = endOfDay(new Date(customDateTo));
                return aptDate >= fromDate && aptDate <= toDate;
            } else {
                return false;
            }
        });

        // Group revenue by currency
        const revenueByCurrency: Record<string, number> = {};
        filtered.forEach(apt => {
            const currency = apt.currency || 'EUR';
            const fee = apt.fee || 0;
            revenueByCurrency[currency] = (revenueByCurrency[currency] || 0) + fee;
        });

        // Convert all currencies to EUR
        let totalEUR = 0;
        Object.entries(revenueByCurrency).forEach(([currency, amount]) => {
            const currencyUpper = currency.toUpperCase();
            if (currencyUpper === 'EUR') {
                totalEUR += amount;
            } else {
                // Try both original and uppercase currency codes
                const rate = exchangeRates[currency] || exchangeRates[currencyUpper];
                if (rate !== undefined && rate !== null && !isNaN(rate) && rate > 0) {
                    // Rate is already the conversion factor TO EUR (e.g., 0.909 for USD)
                    const convertedAmount = amount * rate;
                    totalEUR += convertedAmount;
                } else if (Object.keys(exchangeRates).length > 0) {
                    // Exchange rates have loaded but this currency is missing
                    // Just add the amount as-is (better than nothing, but not ideal)
                    console.warn(`[Dashboard Revenue] Missing exchange rate for ${currency}, using amount as-is`);
                    totalEUR += amount;
                } else {
                    // Exchange rates haven't loaded yet - just add the amount
                    totalEUR += amount;
                }
            }
        });

        return totalEUR;
    };

    const getRevenuePeriodLabel = () => {
        switch (revenuePeriod) {
            case "today": return "Today";
            case "week": return "This Week";
            case "month": return "This Month";
            case "year": return "This Year";
            case "custom": 
                if (customDateFrom && customDateTo) {
                    const from = new Date(customDateFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const to = new Date(customDateTo).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    return `${from} - ${to}`;
                }
                return "Custom Range";
            default: return "This Month";
        }
    };

    return (
        <div className="space-y-6 relative min-h-[400px]">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">
                    Welcome back{userFirstName ? ` ${userFirstName}` : ''}!
                </h2>
                <p className="text-muted-foreground">Here's what's happening with your practice today!</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border bg-card p-6">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">Today's Sessions</p>
                        <Calendar className="h-4 w-4 text-blue-500" />
                    </div>
                    {isLoading ? (
                        <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
                    ) : (
                        <>
                            <p className="mt-2 text-3xl font-bold">{stats.todaySessions}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {stats.todaySessions === 0 ? "No sessions today" : `${stats.todaySessions} scheduled`}
                            </p>
                        </>
                    )}
                </div>

                <div className="rounded-lg border bg-card p-6">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">Active Clients</p>
                        <Users className="h-4 w-4 text-blue-500" />
                    </div>
                    {isLoading ? (
                        <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
                    ) : (
                        <>
                            <p className="mt-2 text-3xl font-bold">{stats.activeClients}</p>
                            <p className="text-xs text-muted-foreground mt-1">Total clients</p>
                        </>
                    )}
                </div>

                <div className="rounded-lg border bg-card p-6">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">Revenue ({getRevenuePeriodLabel()})</p>
                        <Landmark className="h-4 w-4 text-pink-500" />
                    </div>
                    {isRevenueLoading ? (
                        <div className="mt-2 min-h-[2.5rem] flex items-center">
                            <p className="text-sm text-muted-foreground">Loading...</p>
                        </div>
                    ) : stats.revenue > 0 ? (
                        <p className="mt-2 text-3xl font-bold">€{stats.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    ) : (
                        <p className="mt-2 text-3xl font-bold">&nbsp;</p>
                    )}
                    <div className="mt-2 space-y-2">
                        <div className="flex flex-wrap gap-1">
                            <button
                                onClick={() => {
                                    setIsRevenueLoading(true);
                                    setRevenuePeriod("today");
                                    setCustomDateFrom("");
                                    setCustomDateTo("");
                                }}
                                className={`text-xs px-2 py-1 rounded ${revenuePeriod === "today" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                            >
                                Today
                            </button>
                            <button
                                onClick={() => {
                                    setIsRevenueLoading(true);
                                    setRevenuePeriod("week");
                                    setCustomDateFrom("");
                                    setCustomDateTo("");
                                }}
                                className={`text-xs px-2 py-1 rounded ${revenuePeriod === "week" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                            >
                                Week
                            </button>
                            <button
                                onClick={() => {
                                    setIsRevenueLoading(true);
                                    setRevenuePeriod("month");
                                    setCustomDateFrom("");
                                    setCustomDateTo("");
                                }}
                                className={`text-xs px-2 py-1 rounded ${revenuePeriod === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                            >
                                Month
                            </button>
                            <button
                                onClick={() => {
                                    setIsRevenueLoading(true);
                                    setRevenuePeriod("year");
                                    setCustomDateFrom("");
                                    setCustomDateTo("");
                                }}
                                className={`text-xs px-2 py-1 rounded ${revenuePeriod === "year" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                            >
                                Year
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    setIsRevenueLoading(true);
                                    setRevenuePeriod("custom");
                                }}
                                className={`text-xs px-2 py-1 rounded ${revenuePeriod === "custom" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                            >
                                Custom
                            </button>
                            {revenuePeriod === "custom" && (
                                <>
                                    <Label htmlFor="date-from" className="text-xs">From:</Label>
                                    <Input
                                        id="date-from"
                                        type="date"
                                        value={customDateFrom}
                                        onChange={(e) => {
                                            setCustomDateFrom(e.target.value);
                                            setIsRevenueLoading(true);
                                        }}
                                        className="h-7 text-xs"
                                    />
                                    <Label htmlFor="date-to" className="text-xs">To:</Label>
                                    <Input
                                        id="date-to"
                                        type="date"
                                        value={customDateTo}
                                        onChange={(e) => {
                                            setCustomDateTo(e.target.value);
                                            setIsRevenueLoading(true);
                                        }}
                                        className="h-7 text-xs"
                                    />
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border bg-card p-6">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">Recordings</p>
                        <FileText className="h-4 w-4 text-green-500" />
                    </div>
                    {isLoading ? (
                        <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
                    ) : (
                        <>
                            <p className="mt-2 text-3xl font-bold">{stats.recordings}</p>
                            <p className="text-xs text-muted-foreground mt-1">Recordings saved</p>
                        </>
                    )}
                </div>
            </div>

            {/* Super Reminder Banner */}
            {(() => {
                // Calculate total from the individual counts to ensure consistency (include unpaid sessions)
                const displayTotal = reminderCounts.clinicalNotes + reminderCounts.unsignedForms + reminderCounts.unpaidSessions + reminderCounts.customReminders;
                console.log(`[Dashboard] Action Required calculation:`, {
                    clinicalNotes: reminderCounts.clinicalNotes,
                    unsignedForms: reminderCounts.unsignedForms,
                    unpaidSessions: reminderCounts.unpaidSessions,
                    customReminders: reminderCounts.customReminders,
                    displayTotal
                });
                return displayTotal > 0 && (
                <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                                <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-green-500" />
                                    Action Required: {displayTotal} Reminder{displayTotal !== 1 ? 's' : ''}
                                </h3>
                                <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
                                    You have {displayTotal} outstanding reminder{displayTotal !== 1 ? 's' : ''}: {(() => {
                                        const parts = [
                                            reminderCounts.clinicalNotes > 0 && `${reminderCounts.clinicalNotes} Session Note${reminderCounts.clinicalNotes !== 1 ? 's' : ''}`,
                                            reminderCounts.unsignedForms > 0 && `${reminderCounts.unsignedForms} Unsigned Form${reminderCounts.unsignedForms !== 1 ? 's' : ''}`,
                                            reminderCounts.unpaidSessions > 0 && `${reminderCounts.unpaidSessions} Unpaid Session${reminderCounts.unpaidSessions !== 1 ? 's' : ''}`,
                                            reminderCounts.customReminders > 0 && `${reminderCounts.customReminders} Client${reminderCounts.customReminders !== 1 ? 's' : ''} Not Seen Recently`
                                        ].filter(Boolean);
                                        if (parts.length === 0) return '';
                                        if (parts.length === 1) return parts[0];
                                        if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
                                        return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
                                    })()}.
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
            );
            })()}

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
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8 text-muted-foreground">
                                <p className="text-sm">Loading...</p>
                            </div>
                        ) : upcomingSessions.length === 0 ? (
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
