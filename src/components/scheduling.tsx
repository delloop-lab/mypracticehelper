"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarIcon, Clock, Video, MapPin, User, Plus, List, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { DatePicker } from "@/components/ui/date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from "date-fns";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";

interface Appointment {
    id: string;
    clientName: string;
    date: string;
    time: string;
    duration: number;
    type: string;
    venue?: "The Practice" | "WhatsApp" | "Phone" | "Video" | "Call Out";
    status: "confirmed" | "pending" | "cancelled";
    notes: string;
    fee?: number;
    currency?: string;
    paymentMethod?: "Cash" | "PayPal" | "Multibanco" | "Bank Deposit";
    paymentStatus?: "paid" | "pending" | "unpaid";
}

interface Client {
    id: string;
    name: string;
    currency?: string;
    sessionFee?: number;
}

interface AppointmentType {
    name: string;
    duration: number;
    fee: number;
    enabled: boolean;
}

const DEFAULT_APPOINTMENT_TYPES: AppointmentType[] = [
    { name: "Initial Consultation", duration: 60, fee: 80, enabled: true },
    { name: "Therapy Session", duration: 60, fee: 80, enabled: true },
    { name: "Singles Therapy", duration: 60, fee: 80, enabled: true },
    { name: "Couples Therapy Session", duration: 60, fee: 100, enabled: true },
    { name: "Discovery Session", duration: 30, fee: 0, enabled: true },
];

interface SchedulingProps {
    preSelectedClient?: string;
    editAppointmentId?: string;
}

export function Scheduling({ preSelectedClient, editAppointmentId }: SchedulingProps = {}) {
    const router = useRouter();
    // State hooks
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>(DEFAULT_APPOINTMENT_TYPES);
    const [settings, setSettings] = useState<{ currency: string; defaultFee: number; blockedDays?: number[] }>({ currency: "EUR", defaultFee: 80, blockedDays: [] });
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [viewRange, setViewRange] = useState<'today' | '7days' | '30days' | 'all'>('all'); // Default to 'all' to show all appointments
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [singleDayView, setSingleDayView] = useState<string | null>(null);

    // Form data for new appointment, includes currency
    const [formData, setFormData] = useState({
        clientName: "",
        date: new Date().toISOString().split('T')[0],
        time: "10:00",
        duration: 60,
        type: "Therapy Session" as Appointment['type'],
        venue: "The Practice" as "The Practice" | "WhatsApp" | "Phone" | "Video" | "Call Out",
        notes: "",
        fee: 80,
        paymentMethod: "Cash" as "Cash" | "PayPal" | "Multibanco" | "Bank Deposit",
        paymentStatus: "unpaid" as "paid" | "pending" | "unpaid",
        currency: "EUR",
    });

    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [bookingError, setBookingError] = useState<string | null>(null);
    const [isEditingAppointment, setIsEditingAppointment] = useState(false);
    const [editedAppointment, setEditedAppointment] = useState<{ date: string; time: string; type: string; venue?: "The Practice" | "WhatsApp" | "Phone" | "Video" | "Call Out"; duration?: number; notes?: string; fee?: number; paymentMethod?: "Cash" | "PayPal" | "Multibanco" | "Bank Deposit" } | null>(null);
    
    // New client creation state
    const [isAddingNewClient, setIsAddingNewClient] = useState(false);
    const [newClientData, setNewClientData] = useState({ firstName: "", lastName: "", email: "" });
    
    // Past date warning state
    const [pastDateWarningShown, setPastDateWarningShown] = useState(false);
    // Blocked day warning state
    const [blockedDayWarningShown, setBlockedDayWarningShown] = useState(false);

    // Load data on mount
    useEffect(() => {
        loadAppointments();
        loadClients();
        loadAppointmentTypes();

        // Reload when window gains focus (user switches back to tab)
        const handleFocus = () => {
            console.log('[Scheduling] Window focused - reloading appointments');
            loadAppointments();
            loadAppointmentTypes(); // Also reload appointment types
        };

        // Reload when appointments are updated elsewhere (e.g., from clients page)
        const handleAppointmentsUpdated = () => {
            console.log('[Scheduling] Appointments updated event received - reloading');
            loadAppointments();
        };

        window.addEventListener('focus', handleFocus);
        window.addEventListener('appointments-updated', handleAppointmentsUpdated);

        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('appointments-updated', handleAppointmentsUpdated);
        };
    }, []);

    // Reload appointment types when dialog opens to ensure latest types are available
    useEffect(() => {
        if (isDialogOpen) {
            loadAppointmentTypes();
        }
    }, [isDialogOpen]);

    // Handle pre-selected client from query parameter
    useEffect(() => {
        if (preSelectedClient && clients.length > 0 && settings.defaultFee) {
            const client = clients.find(c => c.name === preSelectedClient);
            if (client) {
                // Pre-fill form data with client info
                const clientFee = (client.sessionFee && client.sessionFee > 0) ? client.sessionFee : settings.defaultFee ?? 80;
                setFormData(prev => ({
                    ...prev,
                    clientName: client.name,
                    fee: clientFee,
                    currency: client.currency ?? settings.currency ?? "EUR",
                }));
                // Open the dialog
                setIsDialogOpen(true);
            }
        }
    }, [preSelectedClient, clients.length, settings.defaultFee, settings.currency]);

    // Handle edit appointment ID from query parameter
    useEffect(() => {
        if (editAppointmentId && appointments.length > 0) {
            const appointment = appointments.find(apt => apt.id === editAppointmentId);
            if (appointment) {
                console.log('[Scheduling] Opening appointment for editing:', appointment.id);
                setSelectedAppointment(appointment);
                setIsDetailsOpen(true);
            }
        }
    }, [editAppointmentId, appointments.length, appointments]);


    const loadAppointments = async () => {
        try {
            console.log('[Scheduling] Loading appointments...');
            const response = await fetch('/api/appointments');
            console.log('[Scheduling] Response status:', response.status);
            if (response.ok) {
                const data = await response.json();
                console.log('[Scheduling] Raw appointments data:', data.length, data);
                
                // Log all appointments with their dates
                data.forEach((apt: Appointment) => {
                    console.log(`[Scheduling] Appointment: ${apt.clientName} on ${apt.date} (${apt.time})`);
                });
                
                // Deduplicate appointments by ID only (ID should be unique)
                const seenIds = new Set<string>();
                const uniqueAppointments = data.filter((apt: Appointment) => {
                    if (seenIds.has(apt.id)) {
                        console.warn(`Duplicate appointment ID found: ${apt.id}`, apt);
                        return false;
                    }
                    seenIds.add(apt.id);
                    return true;
                });
                
                // Log future appointments
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const futureAppointments = uniqueAppointments.filter((apt: Appointment) => {
                    if (!apt.date) return false;
                    const aptDate = new Date(apt.date);
                    aptDate.setHours(0, 0, 0, 0);
                    return aptDate >= today;
                });
                console.log(`[Scheduling] Found ${futureAppointments.length} future appointments:`, futureAppointments.map((a: any) => ({ client: a.clientName, date: a.date })));
                
                console.log(`[Load Appointments] Loaded ${data.length} appointments, ${uniqueAppointments.length} unique`);
                setAppointments(uniqueAppointments);
            } else {
                console.error('[Scheduling] Failed to load appointments:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('Error loading appointments:', error);
        }
    };

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

    const loadAppointmentTypes = async () => {
        try {
            const response = await fetch(`/api/settings?t=${Date.now()}`); // Add cache-busting
            if (response.ok) {
                const data = await response.json();
                const loadedTypes = data.appointmentTypes || [];
                console.log('[Scheduling] Loaded appointment types:', loadedTypes.map((t: any) => ({ name: t.name, enabled: t.enabled })));
                setAppointmentTypes(loadedTypes);
                
                // Validate current formData.type - if it doesn't exist or is disabled, reset to first enabled type
                const enabledTypes = loadedTypes.filter((t: any) => t.enabled);
                if (enabledTypes.length > 0) {
                    const currentTypeExists = enabledTypes.some((t: any) => t.name === formData.type);
                    if (!currentTypeExists) {
                        // Reset to first enabled type (Therapy Session if available, otherwise first)
                        const defaultType = enabledTypes.find((t: any) => t.name === "Therapy Session") || enabledTypes[0];
                        setFormData(prev => ({
                            ...prev,
                            type: defaultType.name,
                            duration: defaultType.duration || 60,
                            fee: defaultType.fee || (data.defaultFee || 80)
                        }));
                    }
                }
                
                // Load currency, defaultFee, and blockedDays from settings
                const defaultFee = data.defaultFee || 80;
                const currency = data.currency || "EUR";
                const blockedDays = data.blockedDays || [];
                setSettings({
                    currency: currency,
                    defaultFee: defaultFee,
                    blockedDays: blockedDays
                });
                // Always update formData with settings (especially important if dialog is open)
                setFormData(prev => ({
                    ...prev,
                    currency: currency,
                    // Update fee to defaultFee if no client is selected yet (new appointment)
                    // This ensures new appointments start with the correct default fee from settings
                    fee: (!prev.clientName && prev.fee === 80) ? defaultFee : (prev.fee === 80 || !prev.type ? defaultFee : prev.fee)
                }));
            }
        } catch (error) {
            console.error('Error loading appointment types:', error);
        }
    };

    const resetForm = () => {
        // Ensure we use the latest settings when resetting
        const currentDefaultFee = settings.defaultFee || 80;
        const currentCurrency = settings.currency || "EUR";
        setFormData({
            clientName: "",
            date: new Date().toISOString().split('T')[0],
            time: "10:00",
            duration: 60,
            type: "Therapy Session",
            venue: "The Practice",
            notes: "",
            fee: currentDefaultFee,
            paymentMethod: "Cash",
            paymentStatus: "unpaid",
            currency: currentCurrency,
        });
        // Reset new client state
        setIsAddingNewClient(false);
        setNewClientData({ firstName: "", lastName: "", email: "" });
        // Reset past date warning and blocked day warning
        setPastDateWarningShown(false);
        setBlockedDayWarningShown(false);
        setBookingError(null);
    };

    // Check for time conflicts
    const checkTimeConflict = (date: string, time: string, duration: number): { hasConflict: boolean; conflictingAppointment: Appointment | null } => {
        const newTimeStr = time.length === 5 ? `${time}:00` : time;
        const [newHour, newMinute] = newTimeStr.split(':').map(Number);
        const newStartMinutes = newHour * 60 + newMinute;
        const newEndMinutes = newStartMinutes + duration;

        // Check all existing appointments on the same date
        const sameDateAppointments = appointments.filter(apt => {
            if (!apt.date) return false;
            const aptDateStr = apt.date.split('T')[0];
            return aptDateStr === date;
        });

        for (const apt of sameDateAppointments) {
            const aptTimeStr = apt.time.length === 5 ? `${apt.time}:00` : apt.time;
            const [aptHour, aptMinute] = aptTimeStr.split(':').map(Number);
            const aptStartMinutes = aptHour * 60 + aptMinute;
            const aptEndMinutes = aptStartMinutes + apt.duration;

            // Check if time ranges overlap
            // Two time ranges overlap if: newStart < aptEnd AND newEnd > aptStart
            if (newStartMinutes < aptEndMinutes && newEndMinutes > aptStartMinutes) {
                return { hasConflict: true, conflictingAppointment: apt };
            }
        }

        return { hasConflict: false, conflictingAppointment: null };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBookingError(null);

        // Check if selected date is on a blocked day
        if (formData.date) {
            const selectedDate = new Date(formData.date);
            const dayOfWeek = selectedDate.getDay();
            const isBlocked = settings.blockedDays && settings.blockedDays.length > 0 && settings.blockedDays.includes(dayOfWeek);
            
            if (isBlocked && !blockedDayWarningShown) {
                setBookingError(
                    `⚠️ This appointment is scheduled on a non-working day. Click "Create Appointment" again to confirm.`
                );
                setBlockedDayWarningShown(true);
                return;
            }
        }

        // Determine the client name - either from existing client or new client
        let clientName = formData.clientName;
        
        // If adding a new client, create them first
        if (isAddingNewClient) {
            if (!newClientData.firstName.trim() || !newClientData.lastName.trim()) {
                setBookingError('Please enter both first and last name for the new client.');
                return;
            }
            
            clientName = `${newClientData.firstName.trim()} ${newClientData.lastName.trim()}`;
            
            // Check if client with same name already exists
            const existingClient = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
            if (existingClient) {
                setBookingError(`A client named "${clientName}" already exists. Please select them from the dropdown or use a different name.`);
                return;
            }
            
            // Create the new client
            try {
                // Fetch existing clients to add the new one
                const existingClientsResponse = await fetch('/api/clients');
                const existingClients = existingClientsResponse.ok ? await existingClientsResponse.json() : [];
                
                const newClient = {
                    id: Date.now().toString(),
                    firstName: newClientData.firstName.trim(),
                    lastName: newClientData.lastName.trim(),
                    name: clientName,
                    email: newClientData.email.trim(),
                    phone: "",
                    nextAppointment: "",
                    notes: "",
                    recordings: 0,
                    sessions: 0,
                    sessionFee: undefined,
                    currency: settings.currency || 'EUR',
                    documents: [],
                    relationships: [],
                };
                
                const updatedClients = [...existingClients, newClient];
                
                const saveClientResponse = await fetch('/api/clients', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedClients),
                });
                
                if (!saveClientResponse.ok) {
                    setBookingError('Failed to create new client. Please try again.');
                    return;
                }
                
                // Update local clients state
                setClients(updatedClients);
            } catch (error) {
                console.error('Error creating new client:', error);
                setBookingError('Failed to create new client. Please try again.');
                return;
            }
        }
        
        if (!clientName) {
            setBookingError('Please select a client or add a new one.');
            return;
        }

        // Combine date and time into a full ISO timestamp for the date field
        // Keep time separate for display purposes
        const timeStr = formData.time.length === 5 ? `${formData.time}:00` : formData.time;
        const dateWithTime = `${formData.date}T${timeStr}`;

        // Check if the appointment is in the past
        const appointmentDateTime = new Date(dateWithTime);
        const now = new Date();
        
        // Compare dates/times - show warning for past appointments but allow proceeding
        if (appointmentDateTime < now && !pastDateWarningShown) {
            setBookingError(
                `⚠️ This appointment is in the past. Click "Create Appointment" again to confirm.`
            );
            setPastDateWarningShown(true);
            return;
        }

        // Check for time conflicts
        const conflictCheck = checkTimeConflict(formData.date, formData.time, formData.duration);
        if (conflictCheck.hasConflict && conflictCheck.conflictingAppointment) {
            const conflict = conflictCheck.conflictingAppointment;
            setBookingError(
                `Time slot conflicts with existing appointment: ${conflict.clientName} at ${conflict.time} (${conflict.duration} min). Please choose a different time.`
            );
            return;
        }

        const newAppointment: Appointment = {
            id: `apt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // More unique ID
            clientName: clientName,
            date: dateWithTime, // Full ISO timestamp
            time: formData.time, // Keep time for display
            duration: formData.duration,
            type: formData.type,
            venue: formData.venue,
            status: "confirmed",
            notes: formData.notes,
            fee: formData.fee,
            currency: formData.currency || settings.currency || "EUR",
            paymentMethod: formData.paymentMethod,
            paymentStatus: formData.paymentStatus,
        };

        const updatedAppointments = [...appointments, newAppointment];

        try {
            const response = await fetch('/api/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedAppointments),
            });

            if (response.ok) {
                setAppointments(updatedAppointments);
                setIsDialogOpen(false);
                resetForm();
                setBookingError(null);
            }
        } catch (error) {
            console.error('Error saving appointment:', error);
            setBookingError('Failed to save appointment. Please try again.');
        }
    };

    const appointmentDates = appointments.map(apt => new Date(apt.date));

    const handleDateSelect = (date: Date | undefined) => {
        if (date) {
            // Format date as YYYY-MM-DD to ensure consistent format
            const dateStr = format(date, 'yyyy-MM-dd');
            setSelectedDate(dateStr);
            setViewRange("today");
        }
    };

    // Convert time string to minutes since midnight for proper sorting
    // Handles both 24-hour format (HH:MM) and 12-hour format (H:MM AM/PM)
    const timeToMinutes = (timeStr: string): number => {
        if (!timeStr) return 0;
        
        // Handle 24-hour format (HH:MM or HH:MM:SS)
        if (timeStr.includes(':') && !timeStr.match(/\s*(AM|PM)/i)) {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return (hours || 0) * 60 + (minutes || 0);
        }
        
        // Handle 12-hour format (H:MM AM/PM)
        const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (match) {
            let hours = parseInt(match[1], 10);
            const minutes = parseInt(match[2], 10);
            const period = match[3].toUpperCase();
            
            if (period === 'PM' && hours !== 12) {
                hours += 12;
            } else if (period === 'AM' && hours === 12) {
                hours = 0;
            }
            
            return hours * 60 + minutes;
        }
        
        return 0;
    };

    const getFilteredAppointments = () => {
        const now = new Date();
        // Use local date string to avoid timezone issues with toISOString()
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        todayDate.setHours(0, 0, 0, 0);


        const filtered = appointments.filter(apt => {
            if (!apt.date) {
                console.warn('[Scheduling] Appointment missing date:', apt);
                return false;
            }

            // Extract date part for comparison
            const aptDateStr = apt.date.split('T')[0]; // Get YYYY-MM-DD
            
            if (viewRange === "today") {
                // For "today" view, show ALL appointments for the selected date (both past and future)
                const selectedDateStr = selectedDate.split('T')[0];
                const matches = aptDateStr === selectedDateStr;
                console.log(`[Scheduling] Today filter: ${apt.clientName} on ${aptDateStr} matches ${selectedDateStr}: ${matches}`);
                return matches;
            }

            // Combine date and time to get the full datetime for accurate comparison
            // Handle both 24-hour format (14:00) and 12-hour format (02:00 pm)
            let aptHours = 0;
            let aptMinutes = 0;
            
            if (apt.time) {
                const timeLower = apt.time.toLowerCase().trim();
                const isPM = timeLower.includes('pm');
                const isAM = timeLower.includes('am');
                
                // Extract hours and minutes from time string
                const timeMatch = timeLower.match(/(\d{1,2}):(\d{2})/);
                if (timeMatch) {
                    aptHours = parseInt(timeMatch[1], 10);
                    aptMinutes = parseInt(timeMatch[2], 10);
                    
                    // Convert 12-hour to 24-hour format
                    if (isPM && aptHours !== 12) {
                        aptHours += 12;
                    } else if (isAM && aptHours === 12) {
                        aptHours = 0;
                    }
                }
            }
            
            const [aptYear, aptMonth, aptDay] = aptDateStr.split('-').map(Number);
            const aptDateTime = new Date(aptYear, aptMonth - 1, aptDay, aptHours, aptMinutes, 0);
            
            if (isNaN(aptDateTime.getTime())) {
                console.warn('[Scheduling] Invalid date/time format:', apt.date, apt.time);
                return false;
            }
            
            // Compare dates - if appointment date/time is before now, exclude it
            // This applies to both today's past appointments and any past appointments
            const appointmentTime = aptDateTime.getTime();
            const currentTime = now.getTime();
            const isPast = appointmentTime < currentTime;
            
            if (isPast) {
                // Appointment has passed, exclude it (including today's past appointments)
                return false;
            }
            
            // Include this appointment - it's in the future (including today's future appointments)

            // Extract date part for comparison (already extracted above, reuse it)
            // Create date in local timezone to avoid timezone conversion issues
            const [aptYear2, aptMonth2, aptDay2] = aptDateStr.split('-').map(Number);
            const aptDate = new Date(aptYear2, aptMonth2 - 1, aptDay2);
            aptDate.setHours(0, 0, 0, 0);
            const diffTime = aptDate.getTime() - todayDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (viewRange === "7days") {
                // Show appointments up to 7 days ahead (already filtered past appointments above)
                return diffDays <= 7;
            }
            if (viewRange === "30days") {
                // Show appointments up to 30 days ahead (already filtered past appointments above)
                return diffDays <= 30;
            }
            if (viewRange === "all") {
                // Show all future appointments (already filtered past appointments above)
                return true;
            }
            return false;
        }).sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            // Sort by time using minutes since midnight for proper AM/PM sorting
            const minutesA = timeToMinutes(a.time || '');
            const minutesB = timeToMinutes(b.time || '');
            return minutesA - minutesB;
        });

        return filtered;
    };

    const filteredAppointments = getFilteredAppointments();

    // NEW: Check if an appointment is past due
    const isPastDue = (appointment: Appointment): boolean => {
        if (!appointment.date || !appointment.time) return false;
        try {
            // Combine date and time to get full datetime
            const dateStr = appointment.date.split('T')[0]; // Get YYYY-MM-DD
            const timeStr = appointment.time.length === 5 ? `${appointment.time}:00` : appointment.time; // Ensure HH:MM:SS format
            const appointmentDateTime = new Date(`${dateStr}T${timeStr}`);
            const now = new Date();
            return appointmentDateTime < now;
        } catch {
            return false;
        }
    };

    // Get color classes for appointment type
    const getAppointmentTypeColor = (typeName: string): { bg: string; text: string; border: string; dot: string } => {
        const normalizedName = typeName.toLowerCase();
        
        // Map common appointment types to colors
        if (normalizedName.includes('discovery')) {
            return { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300', dot: 'bg-purple-500' };
        }
        if (normalizedName.includes('initial') || normalizedName.includes('consultation')) {
            return { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-300', dot: 'bg-cyan-500' };
        }
        if (normalizedName.includes('couples')) {
            return { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-300', dot: 'bg-pink-500' };
        }
        if (normalizedName.includes('family')) {
            return { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', dot: 'bg-orange-500' };
        }
        if (normalizedName.includes('reiki')) {
            return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', dot: 'bg-blue-500' };
        }
        if (normalizedName.includes('therapy') || normalizedName.includes('session')) {
            return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', dot: 'bg-green-500' };
        }
        
        // Default color for unknown types
        return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300', dot: 'bg-gray-500' };
    };

    const handleDeleteAppointment = async () => {
        if (!selectedAppointment) return;

        try {
            const response = await fetch(`/api/appointments?id=${selectedAppointment.id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                // Remove from local state
                const updatedAppointments = appointments.filter(apt => apt.id !== selectedAppointment.id);
                setAppointments(updatedAppointments);
                setIsDeleteConfirmOpen(false);
                setIsDetailsOpen(false);
                setSelectedAppointment(null);
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Failed to delete appointment' }));
                alert(`Error: ${errorData.error || 'Failed to delete appointment'}`);
            }
        } catch (error) {
            console.error('Error deleting appointment:', error);
            alert('Error deleting appointment. Please try again.');
        }
    };

    const handleViewAppointment = (appointment: Appointment) => {
        setSelectedAppointment(appointment);
        setIsDetailsOpen(true);
        setIsEditingAppointment(false);
        setEditedAppointment(null);
        setBookingError(null);
    };

    const handleEditAppointmentTime = () => {
        if (!selectedAppointment) return;
        const dateStr = selectedAppointment.date.split('T')[0];
        setEditedAppointment({
            date: dateStr,
            time: selectedAppointment.time,
            type: selectedAppointment.type,
            venue: selectedAppointment.venue || "The Practice",
            duration: selectedAppointment.duration,
            notes: selectedAppointment.notes || "",
            fee: selectedAppointment.fee,
            paymentMethod: selectedAppointment.paymentMethod || "Cash"
        });
        setIsEditingAppointment(true);
        setBookingError(null);
    };

    const handleSaveAppointmentTime = async () => {
        if (!selectedAppointment || !editedAppointment) {
            console.log('[Appointment Edit] Missing selectedAppointment or editedAppointment');
            return;
        }
        
        console.log('[Appointment Edit] Starting save process');
        console.log('[Appointment Edit] Selected appointment:', {
            id: selectedAppointment.id,
            clientName: selectedAppointment.clientName,
            currentDate: selectedAppointment.date,
            currentTime: selectedAppointment.time,
            currentType: selectedAppointment.type
        });
        console.log('[Appointment Edit] Edited values:', editedAppointment);
        
        setBookingError(null);

        // Check if selected date is on a blocked day
        if (editedAppointment.date) {
            const selectedDate = new Date(editedAppointment.date);
            const dayOfWeek = selectedDate.getDay();
            const isBlocked = settings.blockedDays && settings.blockedDays.length > 0 && settings.blockedDays.includes(dayOfWeek);
            
            if (isBlocked && !blockedDayWarningShown) {
                setBookingError(
                    `⚠️ This appointment is scheduled on a non-working day. Click "Save Changes" again to confirm.`
                );
                setBlockedDayWarningShown(true);
                return;
            }
        }

        // Combine date and time into a full ISO timestamp
        const timeStr = editedAppointment.time.length === 5 ? `${editedAppointment.time}:00` : editedAppointment.time;
        const dateWithTime = `${editedAppointment.date}T${timeStr}`;
        console.log('[Appointment Edit] Combined date/time:', dateWithTime);

        // Check if the edited appointment is in the past
        const appointmentDateTime = new Date(dateWithTime);
        const now = new Date();
        console.log('[Appointment Edit] Date check - Appointment:', appointmentDateTime, 'Now:', now);
        
        // Compare dates/times (ignore milliseconds)
        if (appointmentDateTime < now) {
            console.log('[Appointment Edit] ERROR: Cannot reschedule to past');
            setBookingError(
                `Cannot reschedule appointments to the past. Please select a future date and time.`
            );
            return;
        }

        // Check for time conflicts (excluding the current appointment)
        const durationToCheck = editedAppointment.duration !== undefined ? editedAppointment.duration : selectedAppointment.duration;
        const conflictCheck = checkTimeConflict(editedAppointment.date, editedAppointment.time, durationToCheck);
        if (conflictCheck.hasConflict && conflictCheck.conflictingAppointment) {
            // Allow if it's the same appointment (editing the same slot)
            if (conflictCheck.conflictingAppointment.id !== selectedAppointment.id) {
                const conflict = conflictCheck.conflictingAppointment;
                console.log('[Appointment Edit] ERROR: Time conflict detected:', conflict);
                setBookingError(
                    `Time slot conflicts with existing appointment: ${conflict.clientName} at ${conflict.time} (${conflict.duration} min). Please choose a different time.`
                );
                return;
            }
        }

        // Update the appointment with new date, time, type, fee, and paymentMethod
        const updated = appointments.map(apt => {
            if (apt.id === selectedAppointment.id) {
                // Extract time from dateWithTime for the time field
                const timeFromDate = new Date(dateWithTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const updatedApt = { 
                    ...apt, 
                    date: dateWithTime, // Full ISO timestamp
                    time: timeFromDate, // HH:MM format for display
                    type: editedAppointment.type,
                    venue: editedAppointment.venue || apt.venue || "The Practice",
                    duration: editedAppointment.duration !== undefined ? editedAppointment.duration : apt.duration,
                    notes: editedAppointment.notes !== undefined ? editedAppointment.notes : apt.notes,
                    fee: editedAppointment.fee !== undefined ? editedAppointment.fee : apt.fee,
                    paymentMethod: editedAppointment.paymentMethod || apt.paymentMethod || "Cash"
                };
                console.log('[Appointment Edit] Updated appointment:', updatedApt);
                return updatedApt;
            }
            return apt;
        });

        console.log('[Appointment Edit] Sending to API - Total appointments:', updated.length);
        console.log('[Appointment Edit] Updated appointment array:', updated);

        try {
            const response = await fetch('/api/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated),
            });

            console.log('[Appointment Edit] API Response status:', response.status);
            console.log('[Appointment Edit] API Response ok:', response.ok);

            if (response.ok) {
                const responseData = await response.json();
                console.log('[Appointment Edit] API Response data:', responseData);
                console.log('[Appointment Edit] Save successful, updating local state');
                
                setAppointments(updated);
                setSelectedAppointment({ 
                    ...selectedAppointment, 
                    date: dateWithTime, 
                    time: editedAppointment.time, 
                    type: editedAppointment.type,
                    venue: editedAppointment.venue || selectedAppointment.venue || "The Practice",
                    duration: editedAppointment.duration !== undefined ? editedAppointment.duration : selectedAppointment.duration,
                    notes: editedAppointment.notes !== undefined ? editedAppointment.notes : selectedAppointment.notes,
                    fee: editedAppointment.fee !== undefined ? editedAppointment.fee : selectedAppointment.fee,
                    paymentMethod: editedAppointment.paymentMethod || selectedAppointment.paymentMethod || "Cash"
                });
                setIsEditingAppointment(false);
                setEditedAppointment(null);
                
                console.log('[Appointment Edit] Reloading appointments from database...');
                // Reload appointments to ensure sync with database
                await loadAppointments();
                console.log('[Appointment Edit] Reload complete');
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Failed to update appointment' }));
                console.error('[Appointment Edit] API Error Response:', errorData);
                console.error('[Appointment Edit] Response status:', response.status);
                console.error('[Appointment Edit] Response statusText:', response.statusText);
                setBookingError(`Failed to update appointment: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('[Appointment Edit] Exception caught:', error);
            console.error('[Appointment Edit] Error type:', error instanceof Error ? error.constructor.name : typeof error);
            console.error('[Appointment Edit] Error message:', error instanceof Error ? error.message : String(error));
            console.error('[Appointment Edit] Error stack:', error instanceof Error ? error.stack : 'No stack');
            setBookingError(`Failed to update appointment: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleCancelEdit = () => {
        setIsEditingAppointment(false);
        setEditedAppointment(null);
        setBookingError(null);
        setBlockedDayWarningShown(false);
    };

    // Convert full name to initials (e.g., "Lilly Schillaci" -> "LS")
    const getInitials = (name: string): string => {
        if (!name) return '';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

    const getAppointmentDatesByType = (type: Appointment['type']) => {
        return appointments
            .filter(apt => apt.type === type)
            .map(apt => new Date(apt.date));
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Schedule</h2>
                    <p className="text-muted-foreground">Manage your appointments and availability</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="bg-muted p-1 rounded-lg flex items-center">
                        <Button
                            variant={viewMode === 'list' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('list')}
                            className={cn("h-8", viewMode === 'list' && "bg-blue-500 hover:bg-blue-600 text-white")}
                        >
                            <List className="h-4 w-4 mr-2" />
                            List
                        </Button>
                        <Button
                            variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('calendar')}
                            className={cn("h-8", viewMode === 'calendar' && "bg-blue-500 hover:bg-blue-600 text-white")}
                        >
                            <CalendarIcon className="h-4 w-4 mr-2" />
                            Calendar
                        </Button>

                    </div>
                    <Button className="gap-2 bg-green-500 hover:bg-green-600 text-white" onClick={async () => {
                        // Ensure settings are loaded before opening dialog
                        await loadAppointmentTypes();
                        // Set default fee and currency from settings when opening dialog
                        const currentDefaultFee = settings.defaultFee || 80;
                        const currentCurrency = settings.currency || "EUR";
                        setFormData({
                            ...formData,
                            fee: currentDefaultFee,
                            currency: currentCurrency,
                            type: "Therapy Session" // Reset to default type
                        });
                        setIsDialogOpen(true);
                    }}>
                        <Plus className="h-4 w-4" />
                        New Appointment
                    </Button>
                </div>
            </div>

            {/* Single Day Detail View */}
            {singleDayView && (
                <Card className="mb-4">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>{format(new Date(singleDayView), 'EEEE, MMMM d, yyyy')}</CardTitle>
                                <CardDescription>
                                    {(() => {
                                        const dayApps = appointments.filter(apt => {
                                            if (!apt.date) return false;
                                            const aptDateStr = apt.date.split('T')[0];
                                            return aptDateStr === singleDayView;
                                        });
                                        return `${dayApps.length} appointment${dayApps.length !== 1 ? 's' : ''}`;
                                    })()}
                                </CardDescription>
                            </div>
                            <Button variant="outline" onClick={() => setSingleDayView(null)}>
                                Close
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {(() => {
                            const dayApps = appointments
                                .filter(apt => {
                                    if (!apt.date) return false;
                                    const aptDateStr = apt.date.split('T')[0];
                                    return aptDateStr === singleDayView;
                                })
                                .sort((a, b) => {
                                    const timeA = a.time || '';
                                    const timeB = b.time || '';
                                    return timeA.localeCompare(timeB);
                                });
                            
                            if (dayApps.length === 0) {
                                return (
                                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                        <CalendarIcon className="h-12 w-12 mb-4 opacity-50" />
                                        <p className="text-sm text-center mb-4">No appointments scheduled for this day</p>
                                        <Button 
                                            className="bg-green-500 hover:bg-green-600 text-white"
                                            onClick={() => {
                                                setFormData({ 
                                                    ...formData, 
                                                    date: singleDayView || new Date().toISOString().split('T')[0],
                                                    fee: settings.defaultFee || 80,
                                                    currency: settings.currency || "EUR",
                                                    type: "Therapy Session" // Reset to default type
                                                });
                                                setIsDialogOpen(true);
                                                setSingleDayView(null);
                                            }}
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            Add Appointment
                                        </Button>
                                    </div>
                                );
                            }
                            
                            return (
                                <div className="space-y-1.5">
                                    {dayApps.map((appointment) => (
                                        <Card 
                                            key={appointment.id}
                                            className="border-l-4 border-l-primary hover:shadow-md transition-shadow cursor-pointer"
                                            onClick={() => handleViewAppointment(appointment)}
                                        >
                                            <CardContent className="p-2.5">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                                                            <span className="text-[10px] font-bold leading-tight">{appointment.time}</span>
                                                            <span className="text-[9px] text-muted-foreground leading-tight">{appointment.duration}m</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                <h4 className="font-semibold text-sm leading-tight">{appointment.clientName}</h4>
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium leading-tight whitespace-nowrap">
                                                                    {appointment.type}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            );
                        })()}
                    </CardContent>
                </Card>
            )}

            {viewMode === 'calendar' ? (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    <Card className="lg:col-span-3 h-[800px] flex flex-col overflow-hidden relative">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 flex-shrink-0">
                            <div className="flex items-center gap-4">
                                <h2 className="text-2xl font-bold">{format(currentMonth, 'MMMM yyyy')}</h2>
                                <div className="flex items-center gap-1">
                                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="px-4"
                                        onClick={() => setCurrentMonth(new Date())}
                                    >
                                        Today
                                    </Button>
                                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 p-0 overflow-hidden">
                        <div className="h-full flex flex-col overflow-hidden">
                            <div className="grid grid-cols-7 border-b flex-shrink-0 bg-background sticky top-0 z-10">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                                    <div key={day} className="p-4 text-center font-semibold text-sm text-muted-foreground">
                                        {day}
                                    </div>
                                ))}
                            </div>
                            <div className="flex-1 overflow-hidden">
                            {(() => {
                                const daysInView = eachDayOfInterval({
                                    start: startOfWeek(startOfMonth(currentMonth)),
                                    end: endOfWeek(endOfMonth(currentMonth))
                                });
                                const numberOfWeeks = Math.ceil(daysInView.length / 7);
                                return (
                                    <div className="grid grid-cols-7 h-full" style={{ gridTemplateRows: `repeat(${numberOfWeeks}, 1fr)` }}>
                                        {daysInView.map((day, dayIdx) => {
                                    const dayStr = format(day, 'yyyy-MM-dd');
                                    const dayAppointments = appointments.filter(apt => {
                                        // Normalize appointment date to YYYY-MM-DD format for comparison
                                        if (!apt.date) return false;
                                        const aptDateStr = apt.date.split('T')[0];
                                        return aptDateStr === dayStr;
                                    }).sort((a, b) => {
                                        // Sort by time to ensure consistent display order
                                        // Convert times to minutes since midnight for proper AM/PM sorting
                                        const minutesA = timeToMinutes(a.time || '');
                                        const minutesB = timeToMinutes(b.time || '');
                                        return minutesA - minutesB;
                                    });
                                    
                                    // Debug logging for Nov 25th
                                    if (dayStr === '2025-11-25') {
                                        console.log(`[Calendar Render] Day: ${dayStr}, Found ${dayAppointments.length} appointments:`, dayAppointments.map(a => ({ id: a.id, client: a.clientName, time: a.time, date: a.date })));
                                    }
                                    // Check if this day is blocked (day of week is in blockedDays)
                                    const dayOfWeek = day.getDay();
                                    const isBlockedDay = settings.blockedDays && settings.blockedDays.length > 0 && settings.blockedDays.includes(dayOfWeek);
                                    
                                    // Only apply heavy fading to blocked days WITHOUT appointments
                                    // Days with appointments should be clearly visible
                                    const hasAppointments = dayAppointments.length > 0;
                                    
                                    return (
                                        <div
                                            key={day.toString()}
                                            className={cn(
                                                "border-b border-r p-1.5 transition-colors relative group overflow-hidden flex flex-col",
                                                !isSameMonth(day, currentMonth) && "bg-muted/20 text-muted-foreground",
                                                isToday(day) && !isBlockedDay && "bg-primary/5",
                                                hasAppointments && !isBlockedDay && "bg-muted/30",
                                                // Blocked days WITHOUT appointments: heavy fade
                                                isBlockedDay && !hasAppointments && "opacity-30 bg-muted/20 grayscale",
                                                // Blocked days WITH appointments: light background but fully visible
                                                isBlockedDay && hasAppointments && "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
                                                !isBlockedDay && "hover:bg-muted/50 cursor-pointer",
                                                "cursor-pointer" // Always allow clicking to view/delete appointments
                                            )}
                                            onClick={() => {
                                                // Allow clicking on blocked days (they can still create appointments with warning)
                                                const dateStr = format(day, 'yyyy-MM-dd');
                                                setSelectedDate(dateStr);
                                                setViewRange("today"); // Ensure viewRange is set to show selected date
                                                setFormData({ ...formData, date: dateStr });
                                                // Always show single day view when clicking on any day
                                                setSingleDayView(dateStr);
                                            }}
                                        >
                                            <div className="flex justify-between items-start mb-1 flex-shrink-0">
                                                <span className={cn(
                                                    "text-sm font-medium h-7 w-7 flex items-center justify-center rounded-full",
                                                    isToday(day) && "bg-primary text-primary-foreground"
                                                )}>
                                                    {format(day, 'd')}
                                                </span>
                                            </div>
                                            <div className="space-y-0.5 overflow-y-auto flex-1 mt-1 min-h-0">
                                                {dayAppointments.length > 5 ? (
                                                    <div 
                                                        className="text-[10px] font-semibold text-center py-1 px-1 rounded bg-primary/20 text-primary border border-primary/30"
                                                        title={`${dayAppointments.length} appointments - Click day to view all`}
                                                    >
                                                        {dayAppointments.length} sessions
                                                    </div>
                                                ) : (
                                                    dayAppointments.map((apt, idx) => {
                                                        // Format time properly - handle both HH:MM and other formats
                                                        const displayTime = apt.time && apt.time.length > 0 
                                                            ? (apt.time.includes(':') ? apt.time.substring(0, 5) : apt.time)
                                                            : '--:--';
                                                        const initials = getInitials(apt.clientName);
                                                        return (
                                                            <div
                                                                key={`${apt.id}-${apt.clientName}-${apt.time}-${idx}`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleViewAppointment(apt);
                                                                }}
                                                                className={cn(
                                                                    "px-1 py-0.5 rounded text-[9px] font-medium border shadow-sm cursor-pointer hover:opacity-90 hover:shadow-md transition-all leading-tight",
                                                                    idx < dayAppointments.length - 1 && "mb-0.5",
                                                                    getAppointmentTypeColor(apt.type).bg,
                                                                    getAppointmentTypeColor(apt.type).text,
                                                                    getAppointmentTypeColor(apt.type).border
                                                                )}
                                                                title={`${displayTime} - ${apt.clientName} - ${apt.type}`}
                                                            >
                                                                <div className="font-bold text-[10px] leading-tight flex items-center gap-1">
                                                                    <span>{displayTime}</span>
                                                                    <span className="font-semibold">{initials}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                    </div>
                                );
                            })()}
                            </div>
                        </div>
                    </CardContent>
                    {/* Calendar Legend - moved outside scrollable area */}
                    <div className="px-6 pb-4 pt-4 border-t flex-shrink-0">
                        <h3 className="text-sm font-semibold mb-3">Appointment Types</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                            {appointmentTypes
                                .filter(type => type.enabled)
                                .map((type) => {
                                    const colors = getAppointmentTypeColor(type.name);
                                    return (
                                        <div key={type.name} className="flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded-full ${colors.dot}`}></div>
                                            <span>{type.name}</span>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                </Card>
                
                {/* Side panel showing appointments for selected date */}
                <Card className="lg:col-span-1 h-[800px] flex flex-col">
                    <CardHeader>
                        <CardTitle className="text-lg">
                            {format(new Date(selectedDate), 'EEEE, MMMM d')}
                        </CardTitle>
                        <CardDescription>
                            Appointments for selected date
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto">
                        {(() => {
                            const selectedDateAppointments = appointments.filter(apt => {
                                // Normalize appointment date to YYYY-MM-DD format for comparison
                                const aptDateStr = apt.date.split('T')[0];
                                return aptDateStr === selectedDate;
                            });
                            return selectedDateAppointments.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                    <CalendarIcon className="h-12 w-12 mb-4 opacity-50" />
                                    <p className="text-sm text-center">No appointments scheduled</p>
                                    <Button 
                                        size="sm" 
                                        className="mt-4 bg-green-500 hover:bg-green-600 text-white" 
                                        onClick={() => {
                                            setFormData({ 
                                                ...formData, 
                                                date: selectedDate,
                                                fee: settings.defaultFee || 80,
                                                currency: settings.currency || "EUR",
                                                type: "Therapy Session" // Reset to default type
                                            });
                                            setIsDialogOpen(true);
                                        }}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Appointment
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    {selectedDateAppointments.sort((a, b) => {
                                        const minutesA = timeToMinutes(a.time || '');
                                        const minutesB = timeToMinutes(b.time || '');
                                        return minutesA - minutesB;
                                    }).map((appointment) => (
                                        <Card 
                                            key={appointment.id}
                                            className="border-l-4 border-l-primary hover:shadow-md transition-shadow cursor-pointer"
                                            onClick={() => handleViewAppointment(appointment)}
                                        >
                                            <CardContent className="p-2">
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <h4 className="font-semibold text-sm leading-tight">{appointment.clientName}</h4>
                                                        <span className={cn(
                                                            "text-[10px] px-1.5 py-0.5 rounded leading-tight whitespace-nowrap",
                                                            getAppointmentTypeColor(appointment.type).bg,
                                                            getAppointmentTypeColor(appointment.type).text
                                                        )}>
                                                            {appointment.type}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground leading-tight">
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {appointment.time}
                                                        </span>
                                                        <span>{appointment.duration}m</span>
                                                        <span className="flex items-center gap-1">
                                                            <MapPin className="h-3 w-3" />
                                                            {appointment.venue || "The Practice"}
                                                        </span>
                                                    </div>
                                                    {appointment.fee && (
                                                        <div className="text-[10px] text-muted-foreground leading-tight">
                                                            {getCurrencySymbol(appointment.currency)}{appointment.fee} - {appointment.paymentStatus || "unpaid"}
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                    <Button 
                                        className="w-full mt-4 bg-green-500 hover:bg-green-600 text-white" 
                                        onClick={() => {
                                            setFormData({ 
                                                ...formData, 
                                                date: selectedDate,
                                                fee: settings.defaultFee || 80,
                                                currency: settings.currency || "EUR",
                                                type: "Therapy Session" // Reset to default type
                                            });
                                            setIsDialogOpen(true);
                                        }}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Another
                                    </Button>
                                </div>
                            );
                        })()}
                    </CardContent>
                </Card>
            </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-3">
                    <Card className="md:col-span-1 h-fit">
                        <CardHeader>
                            <CardTitle className="text-lg">View Options</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Date Range</Label>
                                <Select value={viewRange} onValueChange={(v: any) => setViewRange(v)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="today">Selected Date</SelectItem>
                                        <SelectItem value="7days">Next 7 Days</SelectItem>
                                        <SelectItem value="30days">Next 30 Days</SelectItem>
                                        <SelectItem value="all">All Upcoming</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col space-y-2">
                                <Label>Select Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !selectedDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {selectedDate ? format(new Date(selectedDate), "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={new Date(selectedDate)}
                                            onSelect={handleDateSelect}
                                            initialFocus
                                            modifiers={{
                                                consultation: getAppointmentDatesByType("Initial Consultation"),
                                                therapy: getAppointmentDatesByType("Therapy Session"),
                                                discovery: getAppointmentDatesByType("Discovery Session"),
                                                couples: getAppointmentDatesByType("Couples Therapy Session"),
                                            }}
                                            modifiersStyles={{
                                                consultation: { color: '#3b82f6', fontWeight: 'bold', textDecoration: 'underline' }, // Blue
                                                therapy: { color: '#22c55e', fontWeight: 'bold', textDecoration: 'underline' }, // Green
                                                discovery: { color: '#a855f7', fontWeight: 'bold', textDecoration: 'underline' }, // Purple
                                                couples: { color: '#ec4899', fontWeight: 'bold', textDecoration: 'underline' }, // Pink
                                            }}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <div className="space-y-2">
                                <Label>Calendar Legend</Label>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                        <span>Initial Consultation</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                        <span>Therapy Session</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                                        <span>Discovery Session</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-pink-500"></div>
                                        <span>Couples Therapy</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-lg">
                                {viewRange === "today" ? "Daily Schedule" : "Upcoming Appointments"}
                            </CardTitle>
                            <CardDescription>
                                {viewRange === "today"
                                    ? new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                                    : "Viewing upcoming sessions"}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {filteredAppointments.length === 0 ? (
                                <div className="flex items-center justify-center py-12 text-muted-foreground">
                                    <p className="text-sm">No appointments found for this period</p>
                                </div>
                            ) : (
                                filteredAppointments.map((appointment, index) => {
                                    const pastDue = isPastDue(appointment);
                                    return (
                                        <motion.div
                                            key={appointment.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                        >
                                            <Card className={`border-l-4 hover:shadow-md transition-shadow ${
                                                pastDue 
                                                    ? 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20' 
                                                    : 'border-l-primary'
                                            }`}>
                                                <CardContent className="p-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                                            <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-lg ${
                                                                pastDue 
                                                                    ? 'bg-red-500/10 text-red-600 dark:text-red-400' 
                                                                    : 'bg-primary/10 text-primary'
                                                            }`}>
                                                                <span className="text-xs font-bold uppercase">
                                                                    {new Date(appointment.date).toLocaleDateString('en-US', { month: 'short' })}
                                                                </span>
                                                                <span className="text-xl font-bold">
                                                                    {new Date(appointment.date).getDate()}
                                                                </span>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <h4 className={`font-semibold text-lg ${pastDue ? 'text-red-700 dark:text-red-300' : ''}`}>
                                                                        {appointment.clientName}
                                                                    </h4>
                                                                    {pastDue && (
                                                                        <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-500 text-white rounded-full">
                                                                            <AlertCircle className="h-3 w-3" />
                                                                            Past Due
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                                                                    <span className="flex items-center gap-1">
                                                                        <Clock className={`h-3 w-3 ${pastDue ? 'text-red-500' : ''}`} />
                                                                        {appointment.time}
                                                                    </span>
                                                                    <span>{appointment.duration}m</span>
                                                                    <span className={cn(
                                                                        "px-2 py-0.5 rounded text-xs font-medium",
                                                                        getAppointmentTypeColor(appointment.type).bg,
                                                                        getAppointmentTypeColor(appointment.type).text
                                                                    )}>
                                                                        {appointment.type}
                                                                    </span>
                                                                    <span className="flex items-center gap-1 text-xs">
                                                                        <MapPin className="h-3 w-3" />
                                                                        {appointment.venue || "The Practice"}
                                                                    </span>
                                                                </div>
                                                                {appointment.fee && (
                                                                    <div className={`text-xs mt-1 ${pastDue ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                                                                        {getCurrencySymbol(appointment.currency)}{appointment.fee} - {appointment.paymentStatus || "unpaid"}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleViewAppointment(appointment);
                                                            }}
                                                        >
                                                            View Details
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    );
                                })
                            )}
                        </CardContent>
                    </Card>
                </div>
            )
            }

            {/* New Appointment Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>New Appointment</DialogTitle>
                        <DialogDescription>
                            Schedule a new appointment manually. Calendly integration coming soon.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="space-y-3 py-3">
                            {/* Client Selection */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="client" className="text-sm">Client</Label>
                                    {!isAddingNewClient ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsAddingNewClient(true);
                                                setFormData({ ...formData, clientName: "" });
                                            }}
                                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                        >
                                            + Add new client
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsAddingNewClient(false);
                                                setNewClientData({ firstName: "", lastName: "", email: "" });
                                            }}
                                            className="text-xs text-gray-600 hover:text-gray-800 hover:underline"
                                        >
                                            Select existing client
                                        </button>
                                    )}
                                </div>
                                
                                {!isAddingNewClient ? (
                                    <Select
                                        value={formData.clientName}
                                        onValueChange={(value) => {
                                            const client = clients.find(c => c.name === value);
                                            const clientFee = (client?.sessionFee && client.sessionFee > 0) ? client.sessionFee : undefined;
                                            
                                            // Check if current appointment type has a fee of 0 (e.g., Discovery Session)
                                            const currentType = appointmentTypes.find(t => t.name === formData.type);
                                            let fee: number;
                                            if (currentType?.fee !== undefined && currentType.fee === 0) {
                                                // Keep free appointment types at 0, don't override with client fee
                                                fee = 0;
                                            } else {
                                                // For paid appointment types, use client fee or default
                                                fee = clientFee ?? settings.defaultFee ?? 80;
                                            }
                                            
                                            setFormData({
                                                ...formData,
                                                clientName: value,
                                                fee: fee,
                                                currency: client?.currency ?? settings.currency ?? "EUR",
                                            });
                                        }}
                                    >
                                        <SelectTrigger id="client">
                                            <SelectValue placeholder="Select a client..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[...clients]
                                                .sort((a, b) => a.name.localeCompare(b.name))
                                                .map((client) => (
                                                    <SelectItem key={client.id} value={client.name}>
                                                        {client.name}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            <Input
                                                id="firstName"
                                                placeholder="First name"
                                                value={newClientData.firstName}
                                                onChange={(e) => setNewClientData({ ...newClientData, firstName: e.target.value })}
                                                required={isAddingNewClient}
                                            />
                                            <Input
                                                id="lastName"
                                                placeholder="Last name"
                                                value={newClientData.lastName}
                                                onChange={(e) => setNewClientData({ ...newClientData, lastName: e.target.value })}
                                                required={isAddingNewClient}
                                            />
                                        </div>
                                        <Input
                                            id="newClientEmail"
                                            type="email"
                                            placeholder="Email (optional)"
                                            value={newClientData.email}
                                            onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Date & Time Row */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label htmlFor="date" className="text-sm">Date</Label>
                                    <DatePicker
                                        value={formData.date ? new Date(formData.date) : undefined}
                                        onChange={(date) => {
                                            if (date) {
                                                const dayOfWeek = date.getDay();
                                                const isBlocked: boolean = !!(settings.blockedDays && settings.blockedDays.length > 0 && settings.blockedDays.includes(dayOfWeek));
                                                setFormData({
                                                    ...formData,
                                                    date: date.toISOString().split("T")[0],
                                                });
                                                setBookingError(null);
                                                setPastDateWarningShown(false);
                                                setBlockedDayWarningShown(isBlocked);
                                            }
                                        }}
                                        blockedDays={settings.blockedDays}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="time" className="text-sm">Time</Label>
                                    <Input
                                        id="time"
                                        type="time"
                                        value={formData.time}
                                        onChange={(e) => {
                                            setFormData({ ...formData, time: e.target.value });
                                            setBookingError(null);
                                            setPastDateWarningShown(false);
                                        }}
                                        required
                                    />
                                </div>
                            </div>
                            {blockedDayWarningShown && formData.date && (
                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                    ⚠️ This date falls on a non-working day.
                                </p>
                            )}

                            {/* Appointment Type & Venue Row */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label htmlFor="type" className="text-sm">Type</Label>
                                    <Select
                                        value={formData.type}
                                        onValueChange={(value: string) => {
                                            const selectedType = appointmentTypes.find(t => t.name === value);
                                            const duration = selectedType?.duration || 60;
                                            const selectedClient = formData.clientName ? clients.find(c => c.name === formData.clientName) : null;
                                            const clientFee = (selectedClient?.sessionFee && selectedClient.sessionFee > 0) ? selectedClient.sessionFee : undefined;
                                            const clientCurrency = selectedClient?.currency;
                                            
                                            // If appointment type has a fee of 0 (e.g., Discovery Session), always use 0
                                            // This ensures free appointment types are never overridden by client custom fees
                                            let fee: number;
                                            if (selectedType?.fee !== undefined && selectedType.fee === 0) {
                                                fee = 0;
                                            } else {
                                                // For paid appointment types, use client fee if available, otherwise use appointment type fee or default
                                                fee = clientFee ?? (selectedType?.fee !== undefined ? selectedType.fee : (settings.defaultFee || 80));
                                            }
                                            
                                            const currency = clientCurrency ?? (settings.currency || formData.currency || "EUR");
                                            setFormData({ ...formData, type: value, duration, fee, currency });
                                        }}
                                    >
                                        <SelectTrigger id="type">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {appointmentTypes
                                                .filter(t => t.enabled && t.name)
                                                .sort((a, b) => {
                                                    if (a.name === "Discovery Session") return -1;
                                                    if (b.name === "Discovery Session") return 1;
                                                    return a.name.localeCompare(b.name);
                                                })
                                                .map(type => (
                                                    <SelectItem key={type.name} value={type.name}>
                                                        {type.name}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="venue" className="text-sm">Venue</Label>
                                    <Select
                                        value={formData.venue}
                                    onValueChange={(value: "The Practice" | "WhatsApp" | "Phone" | "Video" | "Call Out") => {
                                        setFormData({ ...formData, venue: value });
                                    }}
                                >
                                    <SelectTrigger id="venue">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="The Practice">The Practice</SelectItem>
                                        <SelectItem value="Call Out">Call Out</SelectItem>
                                        <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                                        <SelectItem value="Phone">Phone</SelectItem>
                                        <SelectItem value="Video">Video</SelectItem>
                                    </SelectContent>
                                </Select>
                                </div>
                            </div>

                            {/* Duration & Fee Row */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label htmlFor="duration" className="text-sm">Duration (min)</Label>
                                    <Input
                                        id="duration"
                                        type="number"
                                        min="15"
                                        step="1"
                                        value={formData.duration}
                                        onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                                        required
                                    />
                                </div>
                                {formData.type !== "Discovery Session" && (
                                    <div className="space-y-1">
                                        <Label htmlFor="fee" className="text-sm">Fee</Label>
                                        <div className="flex items-center gap-1">
                                            <span className="text-sm font-medium">{(() => {
                                                switch (formData.currency) {
                                                    case 'USD': return '$';
                                                    case 'EUR': return '€';
                                                    default: return formData.currency;
                                                }
                                            })()}</span>
                                            <Input
                                                id="fee"
                                                type="number"
                                                min="0"
                                                step="5"
                                                value={formData.fee}
                                                onChange={(e) => setFormData({ ...formData, fee: parseInt(e.target.value) || 0 })}
                                                required
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Payment Method & Status Row */}
                            {formData.type !== "Discovery Session" && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label htmlFor="paymentMethod" className="text-sm">Payment Method</Label>
                                        <Select
                                            value={formData.paymentMethod}
                                            onValueChange={(value: "Cash" | "PayPal" | "Multibanco" | "Bank Deposit") => setFormData({ ...formData, paymentMethod: value })}
                                        >
                                            <SelectTrigger id="paymentMethod">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Cash">Cash</SelectItem>
                                                <SelectItem value="PayPal">PayPal</SelectItem>
                                                <SelectItem value="Multibanco">Multibanco</SelectItem>
                                                <SelectItem value="Bank Deposit">Bank Deposit</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="paymentStatus" className="text-sm">Payment Status</Label>
                                        <Select
                                            value={formData.paymentStatus}
                                            onValueChange={(value: "paid" | "pending" | "unpaid") => setFormData({ ...formData, paymentStatus: value })}
                                        >
                                            <SelectTrigger id="paymentStatus">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="unpaid">Unpaid</SelectItem>
                                                <SelectItem value="pending">Pending</SelectItem>
                                                <SelectItem value="paid">Paid</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}

                            {/* Notes */}
                            <div className="space-y-1">
                                <Label htmlFor="notes" className="text-sm">Notes (Optional)</Label>
                                <Textarea
                                    id="notes"
                                    placeholder="Add any notes..."
                                    rows={2}
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                />
                            </div>
                        </div>
                        
                        {bookingError && (
                            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
                                {bookingError}
                            </div>
                        )}
                        
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => {
                                setIsDialogOpen(false);
                                setBookingError(null);
                                resetForm();
                            }}>
                                Cancel
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={!isAddingNewClient ? !formData.clientName : (!newClientData.firstName.trim() || !newClientData.lastName.trim())} 
                                className="bg-green-500 hover:bg-green-600 text-white"
                            >
                                {isAddingNewClient ? "Create Client & Appointment" : "Create Appointment"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* View Appointment Details Dialog */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Appointment Details</DialogTitle>
                        <DialogDescription>
                            View and manage the details of your selected appointment.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedAppointment && (
                        <div className="space-y-6 py-4">
                            <div className="flex items-center gap-4">
                                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                                    <User className="h-8 w-8 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">
                                        <Link 
                                            href={`/clients?client=${encodeURIComponent(selectedAppointment.clientName)}`}
                                            className="text-primary hover:underline"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsDetailsOpen(false);
                                            }}
                                        >
                                            {selectedAppointment.clientName}
                                        </Link>
                                    </h3>
                                    <p className="text-muted-foreground">{selectedAppointment.type}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground uppercase">Date</Label>
                                    {isEditingAppointment && editedAppointment ? (
                                        <div className="space-y-1">
                                            <DatePicker
                                                value={editedAppointment.date ? new Date(editedAppointment.date) : undefined}
                                                onChange={(date) => {
                                                    if (date) {
                                                        const dayOfWeek = date.getDay();
                                                        const isBlocked: boolean = !!(settings.blockedDays && settings.blockedDays.length > 0 && settings.blockedDays.includes(dayOfWeek));
                                                        
                                                        setEditedAppointment({
                                                            ...editedAppointment,
                                                            date: date.toISOString().split("T")[0]
                                                        });
                                                        setBookingError(null);
                                                        setBlockedDayWarningShown(isBlocked);
                                                    }
                                                }}
                                                minDate={new Date()}
                                                blockedDays={settings.blockedDays}
                                            />
                                            {blockedDayWarningShown && editedAppointment.date && !bookingError && (
                                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                                    ⚠️ This date falls on a non-working day. You can still save the appointment, but please note this is outside your usual working schedule.
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-medium">
                                                {new Date(selectedAppointment.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground uppercase">Time</Label>
                                    {isEditingAppointment && editedAppointment ? (
                                        <Input
                                            type="time"
                                            value={editedAppointment.time}
                                            onChange={(e) => {
                                                setEditedAppointment({
                                                    ...editedAppointment,
                                                    time: e.target.value
                                                });
                                                setBookingError(null);
                                            }}
                                            className="w-full"
                                        />
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-medium">
                                                {selectedAppointment.time}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {isEditingAppointment && editedAppointment ? (
                                    <div className="space-y-1 col-span-2">
                                        <Label className="text-xs text-muted-foreground uppercase">Duration (minutes)</Label>
                                        <Input
                                            type="number"
                                            min="15"
                                            step="15"
                                            value={editedAppointment.duration !== undefined ? editedAppointment.duration : selectedAppointment.duration}
                                            onChange={(e) => {
                                                setEditedAppointment({
                                                    ...editedAppointment,
                                                    duration: parseInt(e.target.value) || 60
                                                });
                                                setBookingError(null);
                                            }}
                                            className="w-full"
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-1 col-span-2">
                                        <Label className="text-xs text-muted-foreground uppercase">Duration</Label>
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-medium">{selectedAppointment.duration} minutes</span>
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground uppercase">Session Type</Label>
                                    {isEditingAppointment && editedAppointment ? (
                                        <Select
                                            value={editedAppointment.type}
                                            onValueChange={(value) => {
                                                setEditedAppointment({
                                                    ...editedAppointment,
                                                    type: value
                                                });
                                                setBookingError(null);
                                            }}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {appointmentTypes
                                                    .filter(type => type.enabled)
                                                    .sort((a, b) => {
                                                        // Move Discovery Session to the top
                                                        if (a.name === "Discovery Session") return -1;
                                                        if (b.name === "Discovery Session") return 1;
                                                        return 0;
                                                    })
                                                    .map((type) => (
                                                        <SelectItem key={type.name} value={type.name}>
                                                            {type.name}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{selectedAppointment.type}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground uppercase">Venue</Label>
                                    {isEditingAppointment && editedAppointment ? (
                                        <Select
                                            value={editedAppointment.venue || "The Practice"}
                                            onValueChange={(value: "The Practice" | "WhatsApp" | "Phone" | "Video" | "Call Out") => {
                                                setEditedAppointment({
                                                    ...editedAppointment,
                                                    venue: value
                                                });
                                            }}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="The Practice">The Practice</SelectItem>
                                                <SelectItem value="Call Out">Call Out</SelectItem>
                                                <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                                                <SelectItem value="Phone">Phone</SelectItem>
                                                <SelectItem value="Video">Video</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-medium">{selectedAppointment.venue || "The Practice"}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {isEditingAppointment && bookingError && (
                                <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
                                    {bookingError}
                                </div>
                            )}

                            {selectedAppointment.fee !== undefined && selectedAppointment.type !== "Discovery Session" && (
                                <div className="border-t pt-4 space-y-3">
                                    <Label className="text-xs text-muted-foreground uppercase">Payment Details</Label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label className="text-sm text-muted-foreground">Fee</Label>
                                            {isEditingAppointment && editedAppointment ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg font-bold">{getCurrencySymbol(selectedAppointment.currency)}</span>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="5"
                                                        value={editedAppointment.fee !== undefined ? editedAppointment.fee : selectedAppointment.fee}
                                                        onChange={(e) => {
                                                            setEditedAppointment({
                                                                ...editedAppointment,
                                                                fee: parseInt(e.target.value) || 0
                                                            });
                                                        }}
                                                        className="w-24"
                                                    />
                                                </div>
                                            ) : (
                                                <p className="text-lg font-bold">{getCurrencySymbol(selectedAppointment.currency)}{selectedAppointment.fee}</p>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-sm text-muted-foreground">Method</Label>
                                            {isEditingAppointment && editedAppointment ? (
                                                <Select
                                                    value={editedAppointment.paymentMethod || selectedAppointment.paymentMethod || "Cash"}
                                                    onValueChange={(value: "Cash" | "PayPal" | "Multibanco" | "Bank Deposit") => {
                                                        setEditedAppointment({
                                                            ...editedAppointment,
                                                            paymentMethod: value
                                                        });
                                                    }}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Cash">Cash</SelectItem>
                                                        <SelectItem value="PayPal">PayPal</SelectItem>
                                                        <SelectItem value="Multibanco">Multibanco</SelectItem>
                                                        <SelectItem value="Bank Deposit">Bank Deposit</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <p className="font-medium">{selectedAppointment.paymentMethod || "Cash"}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                        <div>
                                            <p className="text-sm font-medium">Payment Status</p>
                                            <p className={`text-xs ${selectedAppointment.paymentStatus === "paid" ? "text-green-600" :
                                                selectedAppointment.paymentStatus === "pending" ? "text-yellow-600" :
                                                    "text-red-600"
                                                }`}>
                                                {selectedAppointment.paymentStatus === "paid" ? "✓ Paid" :
                                                    selectedAppointment.paymentStatus === "pending" ? "⏳ Pending" :
                                                        "✗ Unpaid"}
                                            </p>
                                        </div>
                                        {selectedAppointment.paymentStatus !== "paid" && (
                                            <Button
                                                size="sm"
                                                onClick={async () => {
                                                    const updated = appointments.map(apt =>
                                                        apt.id === selectedAppointment.id
                                                            ? { ...apt, paymentStatus: "paid" as const }
                                                            : apt
                                                    );
                                                    try {
                                                        const response = await fetch('/api/appointments', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify(updated),
                                                        });
                                                        if (response.ok) {
                                                            setAppointments(updated);
                                                            setSelectedAppointment({ ...selectedAppointment, paymentStatus: "paid" });
                                                        }
                                                    } catch (error) {
                                                        console.error('Error updating payment status:', error);
                                                    }
                                                }}
                                            >
                                                Mark as Paid
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground uppercase">Notes</Label>
                                {isEditingAppointment && editedAppointment ? (
                                    <Textarea
                                        value={editedAppointment.notes || ""}
                                        onChange={(e) => {
                                            setEditedAppointment({
                                                ...editedAppointment,
                                                notes: e.target.value
                                            });
                                        }}
                                        placeholder="Add notes about this appointment..."
                                        rows={3}
                                        className="w-full"
                                    />
                                ) : (
                                    <div className="p-3 bg-muted/50 rounded-md text-sm min-h-[3rem]">
                                        {selectedAppointment.notes || <span className="text-muted-foreground italic">No notes</span>}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-between items-center pt-4 border-t">
                                {isEditingAppointment ? (
                                    <>
                                        <Button
                                            variant="outline"
                                            onClick={handleCancelEdit}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            className="bg-green-500 hover:bg-green-600 text-white"
                                            onClick={handleSaveAppointmentTime}
                                            disabled={!editedAppointment || !editedAppointment.date || !editedAppointment.time}
                                        >
                                            Save Changes
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button
                                            variant="destructive"
                                            onClick={() => setIsDeleteConfirmOpen(true)}
                                            className="flex items-center gap-2"
                                        >
                                            <span>🗑️</span>
                                            Delete Appointment
                                        </Button>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                onClick={handleEditAppointmentTime}
                                            >
                                                Edit
                                            </Button>
                                            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
                                                Close
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <DeleteConfirmationDialog
                open={isDeleteConfirmOpen}
                onOpenChange={setIsDeleteConfirmOpen}
                onConfirm={handleDeleteAppointment}
                title="Delete Appointment"
                description="Are you sure you want to delete this appointment? This action cannot be undone."
                itemName={selectedAppointment?.clientName ? `${selectedAppointment.clientName}'s appointment` : undefined}
            />
        </div >
    );

}

