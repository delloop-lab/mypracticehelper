"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Calendar, TrendingUp, CheckCircle2, XCircle, Clock } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, startOfWeek, endOfWeek } from "date-fns";

interface Appointment {
    id: string;
    clientName: string;
    date: string;
    time: string;
    duration: number;
    type: string;
    status: string;
    fee?: number;
    currency?: string;
    paymentStatus?: "paid" | "pending" | "unpaid";
    paymentMethod?: "Cash" | "PayPal" | "Multibanco" | "Bank Deposit";
}

interface AppointmentType {
    name: string;
    duration: number;
    fee: number;
    enabled: boolean;
}

interface SettingsData {
    appointmentTypes: AppointmentType[];
    currency: string;
}

type TimePeriod = "week" | "30days" | "month" | "year" | "all";

export default function PaymentsPage() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [settings, setSettings] = useState<SettingsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("week");
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [updatingPaymentStatus, setUpdatingPaymentStatus] = useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"Cash" | "PayPal" | "Multibanco" | "Bank Deposit" | null>(null);
    const [filterByPaymentMethod, setFilterByPaymentMethod] = useState<"Cash" | "PayPal" | "Multibanco" | "Bank Deposit" | null>(null);
    const [isUnpaidReportOpen, setIsUnpaidReportOpen] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            // Load appointments
            const appointmentsRes = await fetch('/api/appointments');
            if (appointmentsRes.ok) {
                const appointmentsData = await appointmentsRes.json();
                setAppointments(appointmentsData);
            }

            // Load settings to get appointment type fees
            const settingsRes = await fetch('/api/settings');
            if (settingsRes.ok) {
                const settingsData = await settingsRes.json();
                setSettings(settingsData);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Get fee for an appointment based on its type
    const getAppointmentFee = (appointment: Appointment): number => {
        // Always try to look up fee from settings first (most reliable)
        if (settings && settings.appointmentTypes) {
            const appointmentType = settings.appointmentTypes.find(
                t => t.name === appointment.type
            );
            
            if (appointmentType && appointmentType.fee !== undefined && appointmentType.fee !== null) {
                return appointmentType.fee;
            }
        }

        // Fallback: If appointment has a fee stored, use it
        if (appointment.fee !== undefined && appointment.fee !== null && appointment.fee > 0) {
            return appointment.fee;
        }

        return 0;
    };

    // Get currency for an appointment
    const getAppointmentCurrency = (appointment: Appointment): string => {
        return appointment.currency || settings?.currency || "EUR";
    };

    // Filter sessions: include all paid sessions (past and future) and all unpaid/pending past sessions
    const allRelevantSessions = appointments.filter(apt => {
        if (!apt.date || apt.status === "cancelled") return false;
        const appointmentDate = new Date(apt.date);
        const now = new Date();
        
        // Include all paid sessions (past and future)
        if (apt.paymentStatus === "paid") {
            return true;
        }
        
        // Include unpaid/pending sessions that have already occurred
        return appointmentDate < now;
    });

    // Filter by time period
    const getFilteredSessions = (): Appointment[] => {
        const now = new Date();
        let startDate: Date;
        let endDate: Date;

        switch (selectedPeriod) {
            case "week":
                startDate = startOfWeek(now, { weekStartsOn: 1 }); // Monday
                endDate = endOfWeek(now, { weekStartsOn: 1 }); // Sunday
                break;
            case "30days":
                startDate = subDays(now, 30);
                endDate = now;
                break;
            case "month":
                startDate = startOfMonth(now);
                endDate = now;
                break;
            case "year":
                startDate = startOfYear(now);
                endDate = now;
                break;
            default:
                return allRelevantSessions;
        }

        return allRelevantSessions.filter(apt => {
            const appointmentDate = new Date(apt.date);
            // Always include paid sessions regardless of date (they're already paid)
            if (apt.paymentStatus === "paid") {
                return true;
            }
            // For "all" period, show all relevant sessions
            if (selectedPeriod === "all") {
                return true;
            }
            // For other periods, filter unpaid/pending sessions by date range
            return appointmentDate >= startDate && appointmentDate <= endDate;
        });
    };

    const passedSessions = getFilteredSessions();
    
    // Helper function to get payment method (matches revenue calculation logic)
    const getPaymentMethod = (apt: Appointment): string => {
        return apt.paymentMethod || "Cash"; // Default to Cash if not specified
    };
    
    // Filter sessions by payment method if a filter is selected - only show paid sessions
    const filteredSessionsByPaymentMethod = filterByPaymentMethod
        ? passedSessions.filter(apt => {
            if (apt.paymentStatus !== "paid") return false;
            const aptPaymentMethod = getPaymentMethod(apt);
            return aptPaymentMethod === filterByPaymentMethod;
        })
        : passedSessions; // Show all sessions (paid, unpaid, pending) when no filter is active

    // Calculate totals - only include sessions with fee > 0 for revenue calculations
    const sessionsWithFees = passedSessions.filter(apt => getAppointmentFee(apt) > 0);
    
    // Total Revenue = only paid sessions (revenue actually received)
    const paidSessions = sessionsWithFees.filter(apt => apt.paymentStatus === "paid");
    const totalRevenue = paidSessions.reduce((sum, apt) => {
        return sum + getAppointmentFee(apt);
    }, 0);

    const paidRevenue = totalRevenue; // Same as total revenue since we only count paid

    const unpaidRevenue = sessionsWithFees
        .filter(apt => apt.paymentStatus !== "paid")
        .reduce((sum, apt) => sum + getAppointmentFee(apt), 0);

    // Get all unpaid sessions (all time, not filtered by period, including future sessions)
    const allUnpaidSessions = appointments.filter(apt => {
        if (!apt.date || apt.status === "cancelled") return false;
        const fee = getAppointmentFee(apt);
        return fee > 0 && apt.paymentStatus !== "paid";
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const totalUnpaidAmount = allUnpaidSessions.reduce((sum, apt) => sum + getAppointmentFee(apt), 0);

    // Group by currency - only count paid sessions for revenue
    const revenueByCurrency: Record<string, number> = {};
    paidSessions.forEach(apt => {
        const currency = getAppointmentCurrency(apt);
        const fee = getAppointmentFee(apt);
        revenueByCurrency[currency] = (revenueByCurrency[currency] || 0) + fee;
    });

    // Calculate revenue by payment method (only for paid sessions)
    const revenueByPaymentMethod: Record<string, number> = {
        "Cash": 0,
        "PayPal": 0,
        "Bank Deposit": 0,
        "Multibanco": 0
    };
    
    paidSessions.forEach(apt => {
        const paymentMethod = apt.paymentMethod || "Cash"; // Default to Cash if not specified
        const fee = getAppointmentFee(apt);
        if (revenueByPaymentMethod.hasOwnProperty(paymentMethod)) {
            revenueByPaymentMethod[paymentMethod] = (revenueByPaymentMethod[paymentMethod] || 0) + fee;
        }
    });

    // Format currency symbol
    const getCurrencySymbol = (currency: string): string => {
        switch (currency) {
            case 'USD': return '$';
            case 'EUR': return '€';
            case 'GBP': return '£';
            case 'AUD': return 'A$';
            default: return currency;
        }
    };

    const handleAppointmentClick = (appointment: Appointment) => {
        setSelectedAppointment(appointment);
        setSelectedPaymentMethod(appointment.paymentMethod || "Cash");
        setIsDialogOpen(true);
    };

    const handleUpdatePaymentMethod = async (paymentMethod: "Cash" | "PayPal" | "Multibanco" | "Bank Deposit") => {
        if (!selectedAppointment) return;

        setUpdatingPaymentStatus(true);
        try {
            const fee = getAppointmentFee(selectedAppointment);
            const currency = getAppointmentCurrency(selectedAppointment);
            
            // If fee is 0, try to preserve existing fee or get from settings
            if (fee === 0) {
                // Check if appointment already has a fee stored
                if (selectedAppointment.fee !== undefined && selectedAppointment.fee !== null && selectedAppointment.fee > 0) {
                    // Keep existing fee
                } else if (settings && settings.appointmentTypes) {
                    // Try settings lookup again
                    const appointmentType = settings.appointmentTypes.find(t => t.name === selectedAppointment.type);
                    if (appointmentType && appointmentType.fee > 0) {
                        // Will use calculated fee
                    }
                }
            }

            const response = await fetch('/api/appointments', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: selectedAppointment.id,
                    paymentMethod: paymentMethod,
                    paymentStatus: selectedAppointment.paymentStatus || "unpaid",
                    fee: fee > 0 ? fee : undefined,
                    currency: currency
                }),
            });

            if (response.ok) {
                // Small delay to ensure database update is complete
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Reload appointments from API
                const appointmentsRes = await fetch(`/api/appointments?t=${Date.now()}`);
                
                if (appointmentsRes.ok) {
                    const appointmentsData = await appointmentsRes.json();
                    
                    // Update state with fresh data
                    setAppointments(() => {
                        return [...appointmentsData];
                    });
                    
                    // Update selected appointment
                    const updatedApt = appointmentsData.find((apt: Appointment) => apt.id === selectedAppointment.id);
                    if (updatedApt) {
                        setSelectedAppointment(updatedApt);
                        setSelectedPaymentMethod(updatedApt.paymentMethod || "Cash");
                    }
                }
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error', message: '' }));
                console.error('Failed to update payment method:', errorData);
            }
        } catch (error: any) {
            console.error('Error updating payment method:', error);
        } finally {
            setUpdatingPaymentStatus(false);
        }
    };

    const handleUpdatePaymentStatus = async (newStatus: "paid" | "pending" | "unpaid") => {
        if (!selectedAppointment) {
            console.error('Error: No appointment selected');
            alert('Error: No appointment selected. Please try again.');
            return;
        }

        // Require payment method when marking as paid
        if (newStatus === "paid" && !selectedPaymentMethod) {
            alert('Please select a payment method before marking as paid.');
            return;
        }

        setUpdatingPaymentStatus(true);
        try {
            let fee = getAppointmentFee(selectedAppointment);
            const currency = getAppointmentCurrency(selectedAppointment);
            
            // If fee is 0, try to preserve existing fee or get from settings
            if (fee === 0) {
                // Check if appointment already has a fee stored
                if (selectedAppointment.fee !== undefined && selectedAppointment.fee !== null && selectedAppointment.fee > 0) {
                    fee = selectedAppointment.fee;
                } else if (settings && settings.appointmentTypes) {
                    // Try settings lookup again
                    const appointmentType = settings.appointmentTypes.find(t => t.name === selectedAppointment.type);
                    if (appointmentType && appointmentType.fee > 0) {
                        fee = appointmentType.fee;
                    }
                }
            }
            const response = await fetch('/api/appointments', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: selectedAppointment.id,
                    paymentStatus: newStatus,
                    // Only send fee if it's > 0, otherwise let API preserve existing
                    fee: fee > 0 ? fee : undefined,
                    currency: currency,
                    paymentMethod: selectedPaymentMethod || selectedAppointment.paymentMethod || "Cash"
                }),
            });

            if (response.ok) {
                // Small delay to ensure database update is complete
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Reload appointments from API with cache-busting to ensure we have the latest data
                const appointmentsRes = await fetch(`/api/appointments?t=${Date.now()}`);
                
                if (appointmentsRes.ok) {
                    const appointmentsData = await appointmentsRes.json();
                    
                    // Update state with fresh data
                    setAppointments(() => {
                        return [...appointmentsData]; // Create new array to ensure React detects change
                    });
                    
                    // Close dialog after state update
                    setIsDialogOpen(false);
                } else {
                    // Fallback: Update local state if API reload fails
                    setAppointments(prev => {
                        return prev.map(apt =>
                            apt.id === selectedAppointment.id
                                ? { 
                                    ...apt, 
                                    paymentStatus: newStatus,
                                    fee: getAppointmentFee(selectedAppointment),
                                    currency: getAppointmentCurrency(selectedAppointment)
                                }
                                : apt
                        );
                    });
                    setIsDialogOpen(false);
                }
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error', message: '' }));
                const errorMessage = errorData.error || 'Failed to update payment status';
                const errorDetails = errorData.message || errorMessage;
                console.error('Failed to update payment status:', errorMessage, errorDetails);
                
                if (errorData.error === 'METADATA_COLUMN_MISSING' || errorDetails.includes('metadata')) {
                    alert(`⚠️ Database Migration Required\n\n${errorDetails}\n\nAfter running the SQL, refresh this page and try again.`);
                } else {
                    alert(`Error: ${errorMessage}\n\n${errorDetails}`);
                }
            }
        } catch (error: any) {
            console.error('Error updating payment status:', error);
            alert(`Error updating payment status: ${error?.message || 'Unknown error'}`);
        } finally {
            setUpdatingPaymentStatus(false);
        }
    };

    if (isLoading) {
        return (
            <div className="container mx-auto px-4 py-8 max-w-6xl">
                <h1 className="text-4xl font-bold mb-8">Revenue</h1>
                <Card>
                    <CardContent className="py-8">
                        <p className="text-muted-foreground text-center">Loading...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-4xl font-bold">Revenue</h1>
                <Button 
                    variant="outline" 
                    onClick={() => setIsUnpaidReportOpen(true)}
                    className="flex items-center gap-2"
                >
                    <Calendar className="h-4 w-4" />
                    Unpaid Sessions Report ({allUnpaidSessions.length})
                </Button>
            </div>

            {/* Time Period Filter */}
            <div className="mb-6">
                <Select value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as TimePeriod)}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="week">This Week</SelectItem>
                        <SelectItem value="30days">Last 30 Days</SelectItem>
                        <SelectItem value="month">This Month</SelectItem>
                        <SelectItem value="year">This Year</SelectItem>
                        <SelectItem value="all">All Time</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {Object.entries(revenueByCurrency).map(([currency, amount]) => (
                                <div key={currency}>
                                    {getCurrencySymbol(currency)}{amount.toFixed(2)}
                                </div>
                            ))}
                            {Object.keys(revenueByCurrency).length === 0 && (
                                <div>€0.00</div>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {sessionsWithFees.length} session{sessionsWithFees.length !== 1 ? 's' : ''}
                        </p>
                        {passedSessions.length > sessionsWithFees.length && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                                ({passedSessions.length - sessionsWithFees.length} free session{passedSessions.length - sessionsWithFees.length !== 1 ? 's' : ''})
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Paid</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {settings?.currency ? getCurrencySymbol(settings.currency) : '€'}
                            {paidRevenue.toFixed(2)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {paidSessions.length} session{paidSessions.length !== 1 ? 's' : ''} paid
                        </p>
                    </CardContent>
                </Card>

                <Card 
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setIsUnpaidReportOpen(true)}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
                        <Calendar className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">
                            {settings?.currency ? getCurrencySymbol(settings.currency) : '€'}
                            {unpaidRevenue.toFixed(2)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {passedSessions.filter(apt => {
                                const fee = getAppointmentFee(apt);
                                return apt.paymentStatus !== "paid" && fee > 0;
                            }).length} session{passedSessions.filter(apt => {
                                const fee = getAppointmentFee(apt);
                                return apt.paymentStatus !== "paid" && fee > 0;
                            }).length !== 1 ? 's' : ''} unpaid
                        </p>
                        {unpaidRevenue !== (totalRevenue - paidRevenue) && (
                            <p className="text-xs text-muted-foreground mt-1 italic">
                                (Includes sessions with no fee)
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Revenue by Payment Method */}
            <Card className="mb-8">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Revenue by Payment Method</CardTitle>
                        {filterByPaymentMethod && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setFilterByPaymentMethod(null)}
                                className="text-xs"
                            >
                                Clear Filter
                            </Button>
                        )}
                    </div>
                    {filterByPaymentMethod && (
                        <p className="text-sm text-muted-foreground mt-2">
                            Showing sessions paid via <span className="font-semibold">{filterByPaymentMethod}</span>
                        </p>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button
                            onClick={() => setFilterByPaymentMethod(filterByPaymentMethod === "Cash" ? null : "Cash")}
                            className={`p-4 border rounded-lg text-left transition-all hover:shadow-md ${
                                filterByPaymentMethod === "Cash" 
                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950" 
                                    : "hover:border-gray-300"
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className={`text-sm font-medium ${filterByPaymentMethod === "Cash" ? "text-blue-700 dark:text-blue-300" : "text-muted-foreground"}`}>
                                    Cash
                                </span>
                                <DollarSign className={`h-4 w-4 ${filterByPaymentMethod === "Cash" ? "text-blue-600" : "text-muted-foreground"}`} />
                            </div>
                            <p className={`text-2xl font-bold ${filterByPaymentMethod === "Cash" ? "text-blue-700 dark:text-blue-300" : ""}`}>
                                {settings?.currency ? getCurrencySymbol(settings.currency) : '€'}
                                {revenueByPaymentMethod["Cash"].toFixed(2)}
                            </p>
                        </button>
                        <button
                            onClick={() => setFilterByPaymentMethod(filterByPaymentMethod === "PayPal" ? null : "PayPal")}
                            className={`p-4 border rounded-lg text-left transition-all hover:shadow-md ${
                                filterByPaymentMethod === "PayPal" 
                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950" 
                                    : "hover:border-gray-300"
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className={`text-sm font-medium ${filterByPaymentMethod === "PayPal" ? "text-blue-700 dark:text-blue-300" : "text-muted-foreground"}`}>
                                    PayPal
                                </span>
                                <DollarSign className={`h-4 w-4 ${filterByPaymentMethod === "PayPal" ? "text-blue-600" : "text-muted-foreground"}`} />
                            </div>
                            <p className={`text-2xl font-bold ${filterByPaymentMethod === "PayPal" ? "text-blue-700 dark:text-blue-300" : ""}`}>
                                {settings?.currency ? getCurrencySymbol(settings.currency) : '€'}
                                {revenueByPaymentMethod["PayPal"].toFixed(2)}
                            </p>
                        </button>
                        <button
                            onClick={() => setFilterByPaymentMethod(filterByPaymentMethod === "Bank Deposit" ? null : "Bank Deposit")}
                            className={`p-4 border rounded-lg text-left transition-all hover:shadow-md ${
                                filterByPaymentMethod === "Bank Deposit" 
                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950" 
                                    : "hover:border-gray-300"
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className={`text-sm font-medium ${filterByPaymentMethod === "Bank Deposit" ? "text-blue-700 dark:text-blue-300" : "text-muted-foreground"}`}>
                                    Bank Deposit
                                </span>
                                <DollarSign className={`h-4 w-4 ${filterByPaymentMethod === "Bank Deposit" ? "text-blue-600" : "text-muted-foreground"}`} />
                            </div>
                            <p className={`text-2xl font-bold ${filterByPaymentMethod === "Bank Deposit" ? "text-blue-700 dark:text-blue-300" : ""}`}>
                                {settings?.currency ? getCurrencySymbol(settings.currency) : '€'}
                                {revenueByPaymentMethod["Bank Deposit"].toFixed(2)}
                            </p>
                        </button>
                    </div>
                    {revenueByPaymentMethod["Multibanco"] > 0 && (
                        <button
                            onClick={() => setFilterByPaymentMethod(filterByPaymentMethod === "Multibanco" ? null : "Multibanco")}
                            className={`mt-4 p-4 border rounded-lg text-left w-full transition-all hover:shadow-md ${
                                filterByPaymentMethod === "Multibanco" 
                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950" 
                                    : "hover:border-gray-300"
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className={`text-sm font-medium ${filterByPaymentMethod === "Multibanco" ? "text-blue-700 dark:text-blue-300" : "text-muted-foreground"}`}>
                                    Multibanco
                                </span>
                                <DollarSign className={`h-4 w-4 ${filterByPaymentMethod === "Multibanco" ? "text-blue-600" : "text-muted-foreground"}`} />
                            </div>
                            <p className={`text-2xl font-bold ${filterByPaymentMethod === "Multibanco" ? "text-blue-700 dark:text-blue-300" : ""}`}>
                                {settings?.currency ? getCurrencySymbol(settings.currency) : '€'}
                                {revenueByPaymentMethod["Multibanco"].toFixed(2)}
                            </p>
                        </button>
                    )}
                </CardContent>
            </Card>

            {/* Sessions List */}
            <Card>
                <CardHeader>
                    <CardTitle>
                        Sessions
                        {filterByPaymentMethod && (
                            <span className="text-sm font-normal text-muted-foreground ml-2">
                                (Filtered by {filterByPaymentMethod})
                            </span>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {filteredSessionsByPaymentMethod.length === 0 ? (
                        <p className="text-muted-foreground">
                            {filterByPaymentMethod 
                                ? `No sessions found paid via ${filterByPaymentMethod} for the selected period.`
                                : "No sessions found for the selected period."}
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {filteredSessionsByPaymentMethod
                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                .map((apt) => {
                                    const fee = getAppointmentFee(apt);
                                    const currency = getAppointmentCurrency(apt);
                                    return (
                                        <button
                                            key={apt.id}
                                            onClick={() => handleAppointmentClick(apt)}
                                            className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors text-left"
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3">
                                                    <div>
                                                        <p className="font-semibold">{apt.clientName}</p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {new Date(apt.date).toLocaleDateString()} at {apt.time}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            {apt.type} • {apt.duration} min
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-lg">
                                                    {getCurrencySymbol(currency)}{fee.toFixed(2)}
                                                </p>
                                                {fee > 0 && (
                                                    <div className="flex flex-col items-end gap-1">
                                                        <div className="flex items-center gap-1 justify-end">
                                                            {apt.paymentStatus === "paid" ? (
                                                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                            ) : apt.paymentStatus === "pending" ? (
                                                                <Clock className="h-4 w-4 text-yellow-600" />
                                                            ) : (
                                                                <XCircle className="h-4 w-4 text-orange-600" />
                                                            )}
                                                            <p className={`text-xs ${
                                                                apt.paymentStatus === "paid" 
                                                                    ? "text-green-600" 
                                                                    : apt.paymentStatus === "pending"
                                                                    ? "text-yellow-600"
                                                                    : "text-orange-600"
                                                            }`}>
                                                                {apt.paymentStatus === "paid" 
                                                                    ? "Paid" 
                                                                    : apt.paymentStatus === "pending"
                                                                    ? "Pending"
                                                                    : "Unpaid"}
                                                            </p>
                                                        </div>
                                                        {apt.paymentStatus === "paid" && apt.paymentMethod && (
                                                            <p className="text-xs text-muted-foreground">
                                                                via {apt.paymentMethod}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Payment Status Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) {
                    // Reset payment method selection when dialog closes
                    setSelectedPaymentMethod(null);
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Update Payment Status</DialogTitle>
                        <DialogDescription>
                            {selectedAppointment && (
                                <>
                                    {selectedAppointment.clientName} - {new Date(selectedAppointment.date).toLocaleDateString()} at {selectedAppointment.time}
                                    {selectedAppointment.paymentMethod && getAppointmentFee(selectedAppointment) > 0 && (
                                        <span className="text-muted-foreground"> • {selectedAppointment.paymentMethod}</span>
                                    )}
                                    <br />
                                    <span className="font-semibold">
                                        {getCurrencySymbol(getAppointmentCurrency(selectedAppointment))}
                                        {getAppointmentFee(selectedAppointment).toFixed(2)}
                                    </span>
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {selectedAppointment && getAppointmentFee(selectedAppointment) > 0 && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Payment Method <span className="text-red-500">*</span></label>
                                <Select
                                    value={selectedPaymentMethod || selectedAppointment.paymentMethod || "Cash"}
                                    onValueChange={(value: "Cash" | "PayPal" | "Multibanco" | "Bank Deposit") => {
                                        setSelectedPaymentMethod(value);
                                        if (selectedAppointment) {
                                            handleUpdatePaymentMethod(value);
                                        }
                                    }}
                                    disabled={updatingPaymentStatus}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Cash">Cash</SelectItem>
                                        <SelectItem value="PayPal">PayPal</SelectItem>
                                        <SelectItem value="Multibanco">Multibanco</SelectItem>
                                        <SelectItem value="Bank Deposit">Bank Deposit</SelectItem>
                                    </SelectContent>
                                </Select>
                                {selectedAppointment.paymentStatus === "paid" && selectedPaymentMethod && (
                                    <p className="text-xs text-muted-foreground">Current payment method: {selectedPaymentMethod}</p>
                                )}
                            </div>
                        )}
                        {selectedAppointment && getAppointmentFee(selectedAppointment) > 0 && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Payment Status</label>
                                <div className="flex gap-2">
                                    <Button
                                        variant={selectedAppointment.paymentStatus === "paid" ? "default" : "outline"}
                                        onClick={() => handleUpdatePaymentStatus("paid")}
                                        disabled={updatingPaymentStatus || !selectedPaymentMethod}
                                        className="flex-1"
                                        title={!selectedPaymentMethod ? "Please select a payment method first" : ""}
                                    >
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Paid
                                    </Button>
                                    <Button
                                        variant={selectedAppointment.paymentStatus === "pending" ? "default" : "outline"}
                                        onClick={() => handleUpdatePaymentStatus("pending")}
                                        disabled={updatingPaymentStatus}
                                        className="flex-1"
                                    >
                                        <Clock className="h-4 w-4 mr-2" />
                                        Pending
                                    </Button>
                                    <Button
                                        variant={selectedAppointment.paymentStatus === "unpaid" ? "default" : "outline"}
                                        onClick={() => handleUpdatePaymentStatus("unpaid")}
                                        disabled={updatingPaymentStatus}
                                        className="flex-1"
                                    >
                                        <XCircle className="h-4 w-4 mr-2" />
                                        Unpaid
                                    </Button>
                                </div>
                            </div>
                        )}
                        {selectedAppointment && getAppointmentFee(selectedAppointment) === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                This session has no fee, so payment method and status are not applicable.
                            </p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Unpaid Sessions Report Modal */}
            <Dialog open={isUnpaidReportOpen} onOpenChange={setIsUnpaidReportOpen}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Unpaid Sessions Report</DialogTitle>
                        <DialogDescription>
                            All sessions that have not been paid for. Total outstanding: {getCurrencySymbol(settings?.currency || "EUR")}{totalUnpaidAmount.toFixed(2)}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {allUnpaidSessions.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">
                                No unpaid sessions found. All sessions have been paid!
                            </p>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    {allUnpaidSessions.map((apt) => {
                                        const fee = getAppointmentFee(apt);
                                        const currency = getAppointmentCurrency(apt);
                                        return (
                                            <button
                                                key={apt.id}
                                                onClick={() => {
                                                    setSelectedAppointment(apt);
                                                    setSelectedPaymentMethod(apt.paymentMethod || "Cash");
                                                    setIsUnpaidReportOpen(false);
                                                    setIsDialogOpen(true);
                                                }}
                                                className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors text-left"
                                            >
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3">
                                                        <div>
                                                            <p className="font-semibold">{apt.clientName}</p>
                                                            <p className="text-sm text-muted-foreground">
                                                                {new Date(apt.date).toLocaleDateString()} at {apt.time}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                {apt.type} • {apt.duration} min
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-lg">
                                                        {getCurrencySymbol(currency)}{fee.toFixed(2)}
                                                    </p>
                                                    <div className="flex items-center gap-1 justify-end">
                                                        {apt.paymentStatus === "pending" ? (
                                                            <Clock className="h-4 w-4 text-yellow-600" />
                                                        ) : (
                                                            <XCircle className="h-4 w-4 text-orange-600" />
                                                        )}
                                                        <p className={`text-xs ${
                                                            apt.paymentStatus === "pending"
                                                                ? "text-yellow-600"
                                                                : "text-orange-600"
                                                        }`}>
                                                            {apt.paymentStatus === "pending" ? "Pending" : "Unpaid"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="pt-4 border-t">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">Total Outstanding:</span>
                                        <span className="text-2xl font-bold text-orange-600">
                                            {getCurrencySymbol(settings?.currency || "EUR")}{totalUnpaidAmount.toFixed(2)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Click on any session to update its payment status
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="flex justify-end pt-4 border-t">
                        <Button variant="outline" onClick={() => setIsUnpaidReportOpen(false)}>
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
