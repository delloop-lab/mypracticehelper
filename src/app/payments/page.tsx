"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Landmark, Calendar, TrendingUp, CheckCircle2, XCircle, Clock, RefreshCw, Banknote, CreditCard } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, startOfWeek, endOfWeek, startOfDay, endOfDay, subMonths, startOfISOWeek, endOfISOWeek, eachWeekOfInterval } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

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

type TimePeriod = "today" | "week" | "30days" | "month" | "year" | "all";

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
    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
    const [isLoadingRates, setIsLoadingRates] = useState(false);
    const [selectedWeekSessions, setSelectedWeekSessions] = useState<Appointment[]>([]);
    const [isWeekSessionsDialogOpen, setIsWeekSessionsDialogOpen] = useState(false);
    const [selectedWeekLabel, setSelectedWeekLabel] = useState<string>("");

    useEffect(() => {
        loadData();
        loadExchangeRates();
        
        // Reload data when page comes into focus (useful after deletions elsewhere)
        const handleFocus = () => {
            loadData();
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, []);

    const loadExchangeRates = async () => {
        setIsLoadingRates(true);
        try {
            // Using exchangerate-api.com - free API, no API key required
            // Alternative: exchangerate.host (but might have CORS issues)
            const response = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
            console.log('[Exchange Rates] Fetching from exchangerate-api.com...');
            
            if (response.ok) {
                const data = await response.json();
                console.log('[Exchange Rates] API Response:', data);
                
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
                    
                    console.log('[Exchange Rates] Converted rates:', rates);
                    console.log('[Exchange Rates] USD rate:', rates['USD']);
                    setExchangeRates(rates);
                } else {
                    console.error('[Exchange Rates] No rates in response:', data);
                }
            } else {
                console.error('[Exchange Rates] API response not OK:', response.status, response.statusText);
                // Try fallback API
                try {
                    const fallbackResponse = await fetch('https://api.exchangerate.host/latest?base=EUR');
                    if (fallbackResponse.ok) {
                        const fallbackData = await fallbackResponse.json();
                        console.log('[Exchange Rates] Fallback API Response:', fallbackData);
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
                            console.log('[Exchange Rates] Fallback converted rates:', rates);
                            setExchangeRates(rates);
                        }
                    }
                } catch (fallbackError) {
                    console.error('[Exchange Rates] Fallback API also failed:', fallbackError);
                }
            }
        } catch (error) {
            console.error('[Exchange Rates] Error loading exchange rates:', error);
            // If API fails, set EUR rate to 1 so at least EUR amounts show correctly
            setExchangeRates({ EUR: 1 });
        } finally {
            setIsLoadingRates(false);
        }
    };

    const loadData = async (showLoading = true) => {
        try {
            if (showLoading) {
                setIsLoading(true);
            }
            // Load appointments with cache-busting to ensure fresh data
            const appointmentsRes = await fetch(`/api/appointments?t=${Date.now()}`);
            if (appointmentsRes.ok) {
                const appointmentsData = await appointmentsRes.json();
                console.log(`[Revenue] Loaded ${appointmentsData.length} appointments`);
                // Log unpaid sessions for debugging
                const unpaidCount = appointmentsData.filter((apt: Appointment) => {
                    const fee = getAppointmentFee(apt);
                    return fee > 0 && apt.paymentStatus !== "paid";
                }).length;
                console.log(`[Revenue] Found ${unpaidCount} unpaid sessions`);
                setAppointments(appointmentsData);
            } else {
                console.error('[Revenue] Failed to load appointments:', appointmentsRes.status);
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
    // Priority: stored fee in database > settings default fee
    // This ensures that if a fee is explicitly set to 0 in the database, it stays 0
    const getAppointmentFee = (appointment: Appointment): number => {
        // First check if appointment has a fee stored in the database (including 0)
        // If fee is explicitly set (even to 0), use that value
        if (appointment.fee !== undefined && appointment.fee !== null) {
            return appointment.fee;
        }

        // Fallback: If no fee stored, look up fee from settings based on appointment type
        if (settings && settings.appointmentTypes) {
            const appointmentType = settings.appointmentTypes.find(
                t => t.name === appointment.type
            );
            
            if (appointmentType && appointmentType.fee !== undefined && appointmentType.fee !== null) {
                return appointmentType.fee;
            }
        }

        return 0;
    };

    // Get currency for an appointment
    const getAppointmentCurrency = (appointment: Appointment): string => {
        return appointment.currency || settings?.currency || "EUR";
    };

    // Helper function to check if session is cancelled or deleted
    // This ensures revenue calculations only include valid, active sessions
    const isSessionValid = (apt: Appointment): boolean => {
        // Exclude if no date
        if (!apt.date) return false;
        
        // Exclude cancelled sessions (check both spellings: cancelled/canceled)
        // Status can be in the status field or metadata.status
        const status = apt.status?.toLowerCase() || '';
        if (status === "cancelled" || status === "canceled") {
            return false;
        }
        
        // Exclude deleted sessions
        // If sessions are soft-deleted, they might have a deleted flag
        // For now, we rely on the status field. If your system uses a different
        // method (like a deleted_at timestamp or deleted flag), add that check here
        
        return true;
    };

    // Filter sessions: include all paid sessions (past and future) and all unpaid/pending past sessions
    // Exclude cancelled, deleted, or invalid sessions
    // Memoize to avoid recalculating on every render
    const allRelevantSessions = useMemo(() => {
        return appointments.filter(apt => {
            // First check if session is valid (not cancelled or deleted)
            if (!isSessionValid(apt)) return false;
            
            const appointmentDate = new Date(apt.date);
            const now = new Date();
            
            // Include all paid sessions (past and future) - but only if valid
            if (apt.paymentStatus === "paid") {
                return true;
            }
            
            // Include unpaid/pending sessions that have already occurred
            return appointmentDate < now;
        });
    }, [appointments]);

    // Filter by time period
    const getFilteredSessions = (): Appointment[] => {
        const now = new Date();
        let startDate: Date;
        let endDate: Date;

        switch (selectedPeriod) {
            case "today":
                startDate = startOfDay(now);
                endDate = endOfDay(now);
                break;
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
            case "all":
                return allRelevantSessions;
            default:
                return allRelevantSessions;
        }

        return allRelevantSessions.filter(apt => {
            const appointmentDate = new Date(apt.date);
            // Filter all sessions (paid and unpaid) by date range for the selected period
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
    
    // Total Revenue = based on selected period filter (not always past 12 months)
    // Memoize period-dependent calculations to prevent unnecessary recalculations
    const periodRevenueData = useMemo(() => {
        const now = new Date();
        let totalRevenueSessions = allRelevantSessions;
        
        console.log(`[Total Revenue] Selected period: ${selectedPeriod}, Total sessions before filter: ${allRelevantSessions.length}`);
        
        // Filter by selected period - include future paid appointments for all periods
        if (selectedPeriod === "today") {
        const today = startOfDay(now);
        const todayEnd = endOfDay(now);
        totalRevenueSessions = allRelevantSessions.filter(apt => {
            // Normalize appointment date to start of day for comparison
            const aptDateStr = apt.date.split('T')[0]; // Extract date part (YYYY-MM-DD)
            const [year, month, day] = aptDateStr.split('-').map(Number);
            const appointmentDate = startOfDay(new Date(year, month - 1, day));
            // For paid appointments, include if they're today (past or future)
            // For unpaid, only include if they're in the past
            if (apt.paymentStatus === "paid") {
                return appointmentDate >= today && appointmentDate <= todayEnd;
            }
            return appointmentDate >= today && appointmentDate <= todayEnd && appointmentDate <= now;
        });
    } else if (selectedPeriod === "week") {
        const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 }); // Sunday
        totalRevenueSessions = allRelevantSessions.filter(apt => {
            // Normalize appointment date to start of day for comparison
            const aptDateStr = apt.date.split('T')[0]; // Extract date part (YYYY-MM-DD)
            const [year, month, day] = aptDateStr.split('-').map(Number);
            const appointmentDate = startOfDay(new Date(year, month - 1, day));
            // For paid appointments, include if they're in this week (past or future)
            // For unpaid, only include if they're in the past
            if (apt.paymentStatus === "paid") {
                return appointmentDate >= weekStart && appointmentDate <= weekEnd;
            }
            return appointmentDate >= weekStart && appointmentDate <= weekEnd && appointmentDate <= now;
        });
    } else if (selectedPeriod === "30days") {
        const thirtyDaysAgo = startOfDay(subDays(now, 30));
        const thirtyDaysFromNow = endOfDay(subDays(now, -30)); // 30 days in the future
        totalRevenueSessions = allRelevantSessions.filter(apt => {
            // Normalize appointment date to start of day for comparison
            const aptDateStr = apt.date.split('T')[0]; // Extract date part (YYYY-MM-DD)
            const [year, month, day] = aptDateStr.split('-').map(Number);
            const appointmentDate = startOfDay(new Date(year, month - 1, day));
            // Include paid appointments from 30 days ago to 30 days in the future (past and future)
            // Include unpaid appointments from 30 days ago that are in the past
            if (apt.paymentStatus === "paid") {
                return appointmentDate >= thirtyDaysAgo && appointmentDate <= thirtyDaysFromNow;
            }
            return appointmentDate >= thirtyDaysAgo && appointmentDate <= now;
        });
    } else if (selectedPeriod === "month") {
        const monthStart = startOfDay(startOfMonth(now));
        const monthEnd = endOfDay(endOfMonth(now));
        totalRevenueSessions = allRelevantSessions.filter(apt => {
            // Normalize appointment date to start of day for comparison
            const aptDateStr = apt.date.split('T')[0]; // Extract date part (YYYY-MM-DD)
            const [year, month, day] = aptDateStr.split('-').map(Number);
            const appointmentDate = startOfDay(new Date(year, month - 1, day));
            // Include paid appointments from the start to the end of the month (past and future)
            // Include unpaid appointments from the start of the month that are in the past
            if (apt.paymentStatus === "paid") {
                return appointmentDate >= monthStart && appointmentDate <= monthEnd;
            }
            return appointmentDate >= monthStart && appointmentDate <= now;
        });
    } else if (selectedPeriod === "year") {
        const yearStart = startOfDay(startOfYear(now));
        const yearEnd = endOfDay(endOfYear(now));
        totalRevenueSessions = allRelevantSessions.filter(apt => {
            // Normalize appointment date to start of day for comparison
            const aptDateStr = apt.date.split('T')[0]; // Extract date part (YYYY-MM-DD)
            const [year, month, day] = aptDateStr.split('-').map(Number);
            const appointmentDate = startOfDay(new Date(year, month - 1, day));
            // Include paid appointments from the start to the end of the year (past and future)
            // Include unpaid appointments from the start of the year that are in the past
            if (apt.paymentStatus === "paid") {
                return appointmentDate >= yearStart && appointmentDate <= yearEnd;
            }
            return appointmentDate >= yearStart && appointmentDate <= now;
        });
    }
    // "all" period includes all sessions (no date filter)
    
    // Include all paid sessions (past and future) - remove the <= now check
    const sessionsWithFeesForPeriod = totalRevenueSessions.filter(apt => getAppointmentFee(apt) > 0);
    const paidSessionsForPeriod = sessionsWithFeesForPeriod.filter(apt => apt.paymentStatus === "paid");
    
    // Group revenue by currency for selected period
    const revenueByCurrency: Record<string, number> = {};
    paidSessionsForPeriod.forEach(apt => {
        const currency = getAppointmentCurrency(apt);
        const fee = getAppointmentFee(apt);
        revenueByCurrency[currency] = (revenueByCurrency[currency] || 0) + fee;
        console.log(`[Revenue by Currency] Appointment: ${apt.clientName}, Date: ${apt.date}, Currency: ${currency}, Fee: ${fee}, Running total for ${currency}: ${revenueByCurrency[currency]}`);
    });
    console.log('[Revenue by Currency] Final breakdown:', revenueByCurrency);
    
    // Calculate cumulative total in EUR
    const calculateTotalInEUR = (revenueByCurrency: Record<string, number>): number | null => {
        let totalEUR = 0;
        let hasMissingRates = false;
        
        console.log('[Calculate Total] Revenue by currency:', revenueByCurrency);
        console.log('[Calculate Total] Exchange rates:', exchangeRates);
        
        Object.entries(revenueByCurrency).forEach(([currency, amount]) => {
            const currencyUpper = currency.toUpperCase();
            if (currencyUpper === 'EUR') {
                totalEUR += amount;
                console.log(`[Calculate Total] Added EUR ${amount}, total now: ${totalEUR}`);
            } else {
                // Try both original and uppercase currency codes
                const rate = exchangeRates[currency] || exchangeRates[currencyUpper];
                console.log(`[Calculate Total] Currency: ${currency} (${currencyUpper}), Amount: ${amount}, Rate: ${rate}`);
                if (rate !== undefined && rate !== null && !isNaN(rate) && rate > 0) {
                    // Rate is already the conversion factor TO EUR (e.g., 0.909 for USD)
                    const convertedAmount = amount * rate;
                    totalEUR += convertedAmount;
                    console.log(`[Calculate Total] Converted ${currency} ${amount} to EUR ${convertedAmount.toFixed(2)}, total now: ${totalEUR}`);
                } else if (Object.keys(exchangeRates).length > 0 && exchangeRates.EUR !== undefined) {
                    // Rate not available but API has loaded (some rates exist)
                    // This means we have a currency that the API doesn't support
                    console.warn(`[Calculate Total] Missing rate for ${currency} (tried ${currency} and ${currencyUpper})`);
                    hasMissingRates = true;
                } else {
                    // Exchange rates haven't loaded yet
                    console.log(`[Calculate Total] Exchange rates not loaded yet for ${currency}`);
                    // Don't add the amount - we'll recalculate when rates load
                }
            }
        });
        
        console.log(`[Calculate Total] Final total: ${totalEUR}, hasMissingRates: ${hasMissingRates}`);
        
        // If exchange rates haven't loaded yet (empty object), return null to show loading
        // This ensures we don't show incorrect totals before rates are available
        if (Object.keys(exchangeRates).length === 0) {
            console.log('[Calculate Total] Exchange rates not loaded, returning null');
            return null; // Rates not loaded yet - show loading state
        }
        
        // Return null only if we have missing rates AND we know rates have loaded (hasMissingRates flag)
        return hasMissingRates ? null : totalEUR;
    };
    
        // Calculate revenue by payment method (only for paid sessions - based on selected period filter)
        // Use paidSessionsForPeriod to match the Total Revenue period filter
        const revenueByPaymentMethod: Record<string, number> = {
            "Cash": 0,
            "PayPal": 0,
            "Bank Deposit": 0,
            "Multibanco": 0
        };
        
        console.log(`[Revenue by Payment Method] Calculating for ${paidSessionsForPeriod.length} paid sessions in selected period`);
        
        paidSessionsForPeriod.forEach(apt => {
            const paymentMethod = apt.paymentMethod || "Cash"; // Default to Cash if not specified
            const fee = getAppointmentFee(apt);
            const currency = getAppointmentCurrency(apt);
            
            console.log(`[Revenue by Payment Method] Processing: ${apt.clientName}, Date: ${apt.date}, PaymentMethod: ${paymentMethod}, Fee: ${fee}, Currency: ${currency}, Raw paymentMethod field: ${apt.paymentMethod}`);
            
            // Convert to EUR for consistent totals
            let feeInEUR = fee;
            const currencyUpper = currency.toUpperCase();
            if (currencyUpper !== 'EUR') {
                const rate = exchangeRates[currency] || exchangeRates[currencyUpper];
                if (rate !== undefined && rate !== null && !isNaN(rate) && rate > 0) {
                    feeInEUR = fee * rate;
                }
            }
            
            // Normalize payment method to match the keys in revenueByPaymentMethod
            // Handle case-insensitive matching for all payment methods
            const paymentMethodLower = paymentMethod.toLowerCase().trim();
            let normalizedPaymentMethod: string;
            
            if (paymentMethodLower === "paypal") {
                normalizedPaymentMethod = "PayPal";
            } else if (paymentMethodLower === "cash") {
                normalizedPaymentMethod = "Cash";
            } else if (paymentMethodLower === "bank deposit" || paymentMethodLower === "bankdeposit") {
                normalizedPaymentMethod = "Bank Deposit";
            } else if (paymentMethodLower === "multibanco") {
                normalizedPaymentMethod = "Multibanco";
            } else {
                // If it doesn't match any known method, default to Cash
                normalizedPaymentMethod = "Cash";
                console.warn(`[Revenue by Payment Method] Unknown payment method "${paymentMethod}", defaulting to Cash for appointment:`, apt);
            }
            
            if (revenueByPaymentMethod.hasOwnProperty(normalizedPaymentMethod)) {
                revenueByPaymentMethod[normalizedPaymentMethod] = (revenueByPaymentMethod[normalizedPaymentMethod] || 0) + feeInEUR;
                console.log(`[Revenue by Payment Method] ${apt.clientName}: ${paymentMethod} -> ${normalizedPaymentMethod}, ${currency} ${fee} = EUR ${feeInEUR.toFixed(2)}, Total for ${normalizedPaymentMethod}: ${revenueByPaymentMethod[normalizedPaymentMethod].toFixed(2)}`);
            } else {
                console.warn(`[Revenue by Payment Method] Payment method "${paymentMethod}" (normalized: "${normalizedPaymentMethod}") not found in revenueByPaymentMethod. Available:`, Object.keys(revenueByPaymentMethod), `Appointment:`, apt);
            }
        });
        
        console.log('[Revenue by Payment Method] Final totals:', revenueByPaymentMethod);
    
        const totalRevenueInEUR = calculateTotalInEUR(revenueByCurrency);
    
        return {
            totalRevenueSessions,
            paidSessionsForPeriod,
            revenueByCurrency,
            totalRevenueInEUR,
            revenueByPaymentMethod
        };
    }, [selectedPeriod, allRelevantSessions, exchangeRates, settings]);

    // Destructure the memoized values
    const { totalRevenueSessions, paidSessionsForPeriod, revenueByCurrency, totalRevenueInEUR, revenueByPaymentMethod } = periodRevenueData;
    
    // Paid Revenue = based on selected period filter (use paidSessionsForPeriod from memoized data)
    const paidRevenue = paidSessionsForPeriod.reduce((sum, apt) => {
        return sum + getAppointmentFee(apt);
    }, 0);
    
    // Group by currency for Paid card (based on selected period filter)
    const paidRevenueByCurrency: Record<string, number> = {};
    paidSessionsForPeriod.forEach(apt => {
        const currency = getAppointmentCurrency(apt);
        const fee = getAppointmentFee(apt);
        paidRevenueByCurrency[currency] = (paidRevenueByCurrency[currency] || 0) + fee;
    });

    // Get all unpaid sessions (all time, not filtered by period, including future sessions)
    // Exclude cancelled and deleted sessions
    const allUnpaidSessions = appointments.filter(apt => {
        if (!isSessionValid(apt)) return false;
        const fee = getAppointmentFee(apt);
        // Only include sessions with fee > 0 and payment status is not "paid"
        const isUnpaid = fee > 0 && apt.paymentStatus !== "paid";
        if (isUnpaid) {
            console.log(`[Revenue] Unpaid session found:`, {
                id: apt.id,
                client: apt.clientName,
                date: apt.date,
                fee: fee,
                paymentStatus: apt.paymentStatus,
                status: apt.status
            });
        }
        return isUnpaid;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const totalUnpaidAmount = allUnpaidSessions.reduce((sum, apt) => sum + getAppointmentFee(apt), 0);
    
    // Log total unpaid for debugging
    if (totalUnpaidAmount > 0) {
        console.log(`[Revenue] Total unpaid amount: ${totalUnpaidAmount}, from ${allUnpaidSessions.length} sessions`);
    }
    
    // Outstanding revenue = total unpaid amount (all time, not filtered by period)
    // This ensures Outstanding always shows the real total, regardless of period filter
    const unpaidRevenue = totalUnpaidAmount;

    // Calculate weekly revenue for past 8 weeks
    const calculateWeeklyRevenue = () => {
        const now = new Date();
        const eightWeeksAgo = subDays(now, 56); // 8 weeks = 56 days
        const endOfCurrentWeek = endOfWeek(now, { weekStartsOn: 1 }); // End of current week (Sunday)
        
        // Get all paid sessions from the past 8 weeks (including future prepaid sessions in current week)
        const paidSessionsLast8Weeks = allRelevantSessions.filter(apt => {
            // Normalize appointment date
            const aptDateStr = apt.date.split('T')[0];
            const [year, month, day] = aptDateStr.split('-').map(Number);
            const appointmentDate = startOfDay(new Date(year, month - 1, day));
            
            // Include paid sessions from 8 weeks ago up to end of current week (for prepaid)
            return appointmentDate >= eightWeeksAgo && 
                   appointmentDate <= endOfCurrentWeek && 
                   apt.paymentStatus === "paid" &&
                   getAppointmentFee(apt) > 0;
        });
        
        // Group by week
        const weeklyData: Record<string, number> = {};
        const weekLabels: Record<string, string> = {};
        const weekSessions: Record<string, Appointment[]> = {};
        
        // Initialize all 8 weeks with 0
        for (let i = 7; i >= 0; i--) {
            const weekStart = startOfISOWeek(subDays(now, i * 7));
            const weekKey = format(weekStart, 'yyyy-MM-dd');
            weeklyData[weekKey] = 0;
            weekLabels[weekKey] = format(weekStart, 'MMM d');
            weekSessions[weekKey] = [];
        }
        
        // Calculate revenue for each week and store sessions
        // Convert all currencies to EUR for consistent totals
        paidSessionsLast8Weeks.forEach(apt => {
            // Normalize appointment date
            const aptDateStr = apt.date.split('T')[0];
            const [year, month, day] = aptDateStr.split('-').map(Number);
            const appointmentDate = new Date(year, month - 1, day);
            const weekStart = startOfISOWeek(appointmentDate);
            const weekKey = format(weekStart, 'yyyy-MM-dd');
            const fee = getAppointmentFee(apt);
            const currency = getAppointmentCurrency(apt);
            
            // Convert to EUR
            let feeInEUR = fee;
            const currencyUpper = currency.toUpperCase();
            if (currencyUpper !== 'EUR') {
                const rate = exchangeRates[currency] || exchangeRates[currencyUpper];
                if (rate !== undefined && rate !== null && !isNaN(rate) && rate > 0) {
                    feeInEUR = fee * rate;
                }
            }
            
            if (weeklyData.hasOwnProperty(weekKey)) {
                weeklyData[weekKey] += feeInEUR;
                weekSessions[weekKey].push(apt);
            }
        });
        
        // Convert to array format for chart
        return {
            data: Object.entries(weeklyData)
                .map(([weekKey, revenue]) => ({
                    week: weekLabels[weekKey],
                    weekKey: weekKey,
                    revenue: Math.round(revenue * 100) / 100 // Round to 2 decimal places
                }))
                .reverse(), // Show oldest week first
            sessions: weekSessions
        };
    };
    
    const weeklyRevenueResult = calculateWeeklyRevenue();
    const weeklyRevenueData = weeklyRevenueResult.data;
    const weeklySessionsMap = weeklyRevenueResult.sessions;

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
        if (!selectedAppointment) {
            console.error('[Update Payment Method] No appointment selected');
            return;
        }

        if (!paymentMethod) {
            console.error('[Update Payment Method] No payment method provided');
            return;
        }

        console.log(`[Update Payment Method] Updating payment method for appointment ${selectedAppointment.id} to ${paymentMethod}`);

        setUpdatingPaymentStatus(true);
        try {
            const fee = getAppointmentFee(selectedAppointment);
            const currency = getAppointmentCurrency(selectedAppointment);
            
            // Preserve existing fee if it exists, otherwise use calculated fee
            let feeToSend = fee;
            if (fee === 0 && selectedAppointment.fee !== undefined && selectedAppointment.fee !== null && selectedAppointment.fee > 0) {
                feeToSend = selectedAppointment.fee;
            }

            // Prepare the request body - always include paymentMethod and paymentStatus
            const requestBody: any = {
                id: selectedAppointment.id,
                paymentMethod: paymentMethod, // Always send the payment method
                paymentStatus: selectedAppointment.paymentStatus || "unpaid",
            };

            // Only include fee if it's > 0, to avoid overwriting with 0
            if (feeToSend > 0) {
                requestBody.fee = feeToSend;
            }

            // Always include currency if it exists
            if (currency) {
                requestBody.currency = currency;
            }

            console.log('[Update Payment Method] Request body:', requestBody);

            const response = await fetch('/api/appointments', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (response.ok) {
                const responseData = await response.json();
                console.log('[Update Payment Method] API response:', responseData);
                
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
                        console.log('[Update Payment Method] Updated appointment from API:', updatedApt);
                        console.log('[Update Payment Method] Payment method in updated appointment:', updatedApt.paymentMethod);
                        setSelectedAppointment(updatedApt);
                        setSelectedPaymentMethod(updatedApt.paymentMethod || "Cash");
                    } else {
                        console.warn('[Update Payment Method] Updated appointment not found in API response');
                    }
                } else {
                    console.error('[Update Payment Method] Failed to reload appointments:', appointmentsRes.status);
                }
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error', message: '' }));
                console.error('[Update Payment Method] Failed to update payment method:', response.status, errorData);
                alert(`Failed to update payment method: ${errorData.error || errorData.message || 'Unknown error'}`);
            }
        } catch (error: any) {
            console.error('[Update Payment Method] Error updating payment method:', error);
            alert(`Error updating payment method: ${error?.message || 'Unknown error'}`);
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
                <div className="mb-8">
                    <h1 className="text-4xl font-bold mb-2">Revenue</h1>
                    <p className="text-muted-foreground">Track revenue and outstanding accounts</p>
                </div>
                <Card>
                    <CardContent className="py-8">
                        <p className="text-muted-foreground text-center">Loading...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-6xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mb-6 sm:mb-8">
                <div className="mb-0 sm:mb-8">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">Revenue</h1>
                    <p className="text-sm sm:text-base text-muted-foreground">Track revenue and outstanding accounts</p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <Button 
                        variant="outline" 
                        onClick={() => loadData(false)}
                        className="flex items-center justify-center gap-2 text-xs sm:text-sm"
                        title="Refresh revenue data"
                        size="sm"
                    >
                        <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
                        Refresh
                    </Button>
                    <Button 
                        variant="outline" 
                        onClick={() => setIsUnpaidReportOpen(true)}
                        className="flex items-center justify-center gap-2 text-xs sm:text-sm"
                        size="sm"
                    >
                        <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline">Unpaid Sessions Report</span>
                        <span className="sm:hidden">Unpaid ({allUnpaidSessions.length})</span>
                        <span className="hidden sm:inline">({allUnpaidSessions.length})</span>
                    </Button>
                </div>
            </div>

            {/* Time Period Filter */}
            <div className="mb-6">
                <Select value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as TimePeriod)}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
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
                        <Landmark className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {isLoadingRates || (Object.keys(exchangeRates).length === 0 && Object.keys(revenueByCurrency).length > 0 && Object.keys(revenueByCurrency).some(c => c.toUpperCase() !== 'EUR')) ? (
                                <div>Loading...</div>
                            ) : totalRevenueInEUR !== null ? (
                                <div>€{totalRevenueInEUR.toFixed(2)}</div>
                            ) : Object.keys(revenueByCurrency).length > 0 ? (
                                // Fallback: show individual currencies if conversion failed
                                Object.entries(revenueByCurrency).map(([currency, amount]) => (
                                    <div key={currency}>
                                        {getCurrencySymbol(currency)}{amount.toFixed(2)}
                                    </div>
                                ))
                            ) : (
                                <div>€0.00</div>
                            )}
                        </div>
                        {Object.keys(revenueByCurrency).length > 0 && (
                            <div className="mt-2 pt-2 border-t">
                                {isLoadingRates ? (
                                    <div className="text-sm text-muted-foreground">
                                        Loading exchange rates...
                                    </div>
                                ) : totalRevenueInEUR !== null ? (
                                    <>
                                        {Object.keys(revenueByCurrency).length > 1 && (
                                            <>
                                                <div className="text-xs text-blue-600 dark:text-blue-400 font-normal mb-1">
                                                    (Exchange Rate Applied)
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {Object.entries(revenueByCurrency).map(([currency, amount], index) => (
                                                        <span key={currency}>
                                                            {index > 0 && ' + '}
                                                            {getCurrencySymbol(currency)}{amount.toFixed(2)} {currency}
                                                        </span>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-sm text-muted-foreground">
                                        Total in EUR: Exchange rates unavailable for some currencies
                                    </div>
                                )}
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                            {paidSessionsForPeriod.length} session{paidSessionsForPeriod.length !== 1 ? 's' : ''} ({selectedPeriod === "today" ? "today" : selectedPeriod === "week" ? "this week" : selectedPeriod === "30days" ? "past 30 days" : selectedPeriod === "month" ? "this month" : selectedPeriod === "year" ? "this year" : "all time"})
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Paid</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {Object.entries(paidRevenueByCurrency).map(([currency, amount]) => (
                                <div key={currency}>
                                    {getCurrencySymbol(currency)}{amount.toFixed(2)}
                                </div>
                            ))}
                            {Object.keys(paidRevenueByCurrency).length === 0 && (
                                <div>€0.00</div>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {paidSessionsForPeriod.length} session{paidSessionsForPeriod.length !== 1 ? 's' : ''} paid
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
                            {allUnpaidSessions.length} session{allUnpaidSessions.length !== 1 ? 's' : ''} unpaid (all time)
                        </p>
                        {unpaidRevenue === 0 && allUnpaidSessions.length === 0 && (
                            <p className="text-xs text-green-600 mt-1 font-semibold">
                                ✓ All sessions paid
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Weekly Revenue Chart */}
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle className="text-base sm:text-lg">Revenue Per Week (Past 8 Weeks)</CardTitle>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
                        <BarChart data={weeklyRevenueData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                                dataKey="week" 
                                tick={{ fontSize: 12 }}
                                angle={-45}
                                textAnchor="end"
                                height={80}
                            />
                            <YAxis 
                                tick={{ fontSize: 12 }}
                                tickFormatter={(value) => `${settings?.currency ? getCurrencySymbol(settings.currency) : '€'}${value.toFixed(0)}`}
                            />
                            <Tooltip 
                                formatter={(value: number) => [`${settings?.currency ? getCurrencySymbol(settings.currency) : '€'}${value.toFixed(2)}`, 'Revenue']}
                                labelStyle={{ color: '#000' }}
                            />
                            <Bar 
                                dataKey="revenue" 
                                fill="hsl(var(--primary))" 
                                radius={[4, 4, 0, 0]}
                                onClick={(data: any, index: number) => {
                                    if (data && weeklyRevenueData[index]) {
                                        const weekData = weeklyRevenueData[index];
                                        const sessions = weeklySessionsMap[weekData.weekKey] || [];
                                        setSelectedWeekSessions(sessions);
                                        setSelectedWeekLabel(weekData.week);
                                        setIsWeekSessionsDialogOpen(true);
                                    }
                                }}
                            >
                                {weeklyRevenueData.map((entry, index) => (
                                    <Cell 
                                        key={`cell-${index}`} 
                                        fill="hsl(var(--primary))"
                                        style={{ cursor: 'pointer' }}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                        Click on a bar to see the sessions that make up that week's revenue
                    </p>
                </CardContent>
            </Card>

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
                                <Banknote className={`h-4 w-4 ${filterByPaymentMethod === "Cash" ? "text-blue-600" : "text-muted-foreground"}`} />
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
                                <CreditCard className={`h-4 w-4 ${filterByPaymentMethod === "PayPal" ? "text-blue-600" : "text-muted-foreground"}`} />
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
                                <Landmark className={`h-4 w-4 ${filterByPaymentMethod === "Bank Deposit" ? "text-blue-600" : "text-muted-foreground"}`} />
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
                                <Landmark className={`h-4 w-4 ${filterByPaymentMethod === "Multibanco" ? "text-blue-600" : "text-muted-foreground"}`} />
                            </div>
                            <p className={`text-2xl font-bold ${filterByPaymentMethod === "Multibanco" ? "text-blue-700 dark:text-blue-300" : ""}`}>
                                {settings?.currency ? getCurrencySymbol(settings.currency) : '€'}
                                {revenueByPaymentMethod["Multibanco"].toFixed(2)}
                            </p>
                        </button>
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

            {/* Week Sessions Dialog */}
            <Dialog open={isWeekSessionsDialogOpen} onOpenChange={setIsWeekSessionsDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Sessions for Week of {selectedWeekLabel}</DialogTitle>
                        <DialogDescription>
                            {selectedWeekSessions.length > 0 ? (
                                (() => {
                                    // Calculate revenue by currency
                                    const weekRevenueByCurrency: Record<string, number> = {};
                                    selectedWeekSessions.forEach(apt => {
                                        const fee = getAppointmentFee(apt);
                                        const currency = getAppointmentCurrency(apt);
                                        weekRevenueByCurrency[currency] = (weekRevenueByCurrency[currency] || 0) + fee;
                                    });
                                    
                                    // Calculate total in EUR
                                    const totalEUR = selectedWeekSessions.reduce((sum, apt) => {
                                        const fee = getAppointmentFee(apt);
                                        const currency = getAppointmentCurrency(apt);
                                        const currencyUpper = currency.toUpperCase();
                                        if (currencyUpper === 'EUR') {
                                            return sum + fee;
                                        } else {
                                            const rate = exchangeRates[currency] || exchangeRates[currencyUpper];
                                            if (rate !== undefined && rate !== null && !isNaN(rate) && rate > 0) {
                                                return sum + (fee * rate);
                                            }
                                            return sum + fee;
                                        }
                                    }, 0);
                                    
                                    const hasMultipleCurrencies = Object.keys(weekRevenueByCurrency).length > 1;
                                    const currencyBreakdown = Object.entries(weekRevenueByCurrency)
                                        .map(([curr, amt]) => `${getCurrencySymbol(curr)}${amt.toFixed(2)}`)
                                        .join(' + ');
                                    
                                    return (
                                        <>
                                            Total Revenue: €{totalEUR.toFixed(2)}
                                            {hasMultipleCurrencies && (
                                                <span className="text-blue-600 ml-1">(Exchange Rate Applied)</span>
                                            )}
                                            {hasMultipleCurrencies && (
                                                <span className="block text-xs mt-1">{currencyBreakdown}</span>
                                            )}
                                            <span className="block">{selectedWeekSessions.length} session{selectedWeekSessions.length !== 1 ? 's' : ''}</span>
                                        </>
                                    );
                                })()
                            ) : (
                                'No sessions found for this week'
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {selectedWeekSessions.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">
                                No paid sessions found for this week.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {selectedWeekSessions
                                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                    .map((apt) => {
                                        const fee = getAppointmentFee(apt);
                                        const currency = getAppointmentCurrency(apt);
                                        // Check if this is a prepaid (future) session
                                        // Need to check both date AND time to determine if session hasn't happened yet
                                        const aptDateStr = apt.date.split('T')[0];
                                        const [year, month, day] = aptDateStr.split('-').map(Number);
                                        
                                        // Parse appointment time (handle 12-hour format like "03:00 pm")
                                        const aptTime = apt.time || '00:00';
                                        let aptHours = 0, aptMinutes = 0;
                                        const timeLower = aptTime.toLowerCase().trim();
                                        const isPM = timeLower.includes('pm');
                                        const isAM = timeLower.includes('am');
                                        const timeMatch = timeLower.match(/(\d{1,2}):(\d{2})/);
                                        if (timeMatch) {
                                            aptHours = parseInt(timeMatch[1], 10);
                                            aptMinutes = parseInt(timeMatch[2], 10);
                                            if (isPM && aptHours !== 12) aptHours += 12;
                                            else if (isAM && aptHours === 12) aptHours = 0;
                                        }
                                        
                                        const appointmentDateTime = new Date(year, month - 1, day, aptHours, aptMinutes, 0);
                                        const now = new Date();
                                        // Session is prepaid if it hasn't happened yet (appointment datetime > now) and is paid
                                        const isPrepaid = appointmentDateTime > now && apt.paymentStatus === "paid";
                                        
                                        return (
                                            <button
                                                key={apt.id}
                                                onClick={() => {
                                                    setSelectedAppointment(apt);
                                                    setSelectedPaymentMethod(apt.paymentMethod || "Cash");
                                                    setIsWeekSessionsDialogOpen(false);
                                                    setIsDialogOpen(true);
                                                }}
                                                className={`w-full flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors text-left ${
                                                    isPrepaid 
                                                        ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-700" 
                                                        : ""
                                                }`}
                                            >
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3">
                                                        <div>
                                                            <p className="font-semibold">
                                                                {apt.clientName}
                                                            </p>
                                                            <p className="text-sm text-muted-foreground">
                                                                {new Date(apt.date).toLocaleDateString()} at {apt.time}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                {apt.type} • {apt.duration} min • {apt.paymentMethod || "Cash"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`font-bold text-lg ${isPrepaid ? "text-blue-600 dark:text-blue-400" : ""}`}>
                                                        {getCurrencySymbol(currency)}{fee.toFixed(2)}
                                                    </p>
                                                    <div className="flex items-center gap-1 justify-end">
                                                        <CheckCircle2 className={`h-4 w-4 ${isPrepaid ? "text-blue-600" : "text-green-600"}`} />
                                                        <p className={`text-xs ${isPrepaid ? "text-blue-600" : "text-green-600"}`}>
                                                            {isPrepaid ? "Prepaid" : "Paid"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end pt-4 border-t">
                        <Button variant="outline" onClick={() => setIsWeekSessionsDialogOpen(false)}>
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
