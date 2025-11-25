"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { Calendar as CalendarIcon, Clock, Video, MapPin, User, Plus, List, ChevronLeft, ChevronRight } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { DatePicker } from "@/components/ui/date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from "date-fns";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Appointment {
    id: string;
    clientName: string;
    date: string;
    time: string;
    duration: number;
    type: string;
    status: "confirmed" | "pending" | "cancelled";
    notes: string;
    fee?: number;
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
    { name: "Follow-up Session", duration: 60, fee: 80, enabled: true },
    { name: "Therapy Session", duration: 60, fee: 80, enabled: true },
    { name: "Couples Therapy Session", duration: 60, fee: 100, enabled: true },
    { name: "Family Therapy", duration: 60, fee: 80, enabled: true },
    { name: "Discovery Session", duration: 30, fee: 0, enabled: true },
];

export function Scheduling() {
    const router = useRouter();
    // State hooks
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>(DEFAULT_APPOINTMENT_TYPES);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [viewRange, setViewRange] = useState<'today' | '7days' | '30days' | 'all'>('today');
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Form data for new appointment, includes currency
    const [formData, setFormData] = useState({
        clientName: "",
        date: new Date().toISOString().split('T')[0],
        time: "09:00",
        duration: 60,
        type: "Therapy Session" as Appointment['type'],
        notes: "",
        fee: 80,
        paymentMethod: "Cash" as "Cash" | "PayPal" | "Multibanco" | "Bank Deposit",
        paymentStatus: "unpaid" as "paid" | "pending" | "unpaid",
        currency: "EUR",
    });

    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    // Load data on mount
    useEffect(() => {
        loadAppointments();
        loadClients();
        loadAppointmentTypes();
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
            const response = await fetch('/api/settings');
            if (response.ok) {
                const data = await response.json();
                setAppointmentTypes(data.appointmentTypes || []);
            }
        } catch (error) {
            console.error('Error loading appointment types:', error);
        }
    };

    const resetForm = () => {
        setFormData({
            clientName: "",
            date: new Date().toISOString().split('T')[0],
            time: "09:00",
            duration: 60,
            type: "Therapy Session",
            notes: "",
            fee: 80,
            paymentMethod: "Cash",
            paymentStatus: "unpaid",
            currency: "EUR",
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const newAppointment: Appointment = {
            id: `apt-${Date.now()}`,
            clientName: formData.clientName,
            date: formData.date,
            time: formData.time,
            duration: formData.duration,
            type: formData.type,
            status: "confirmed",
            notes: formData.notes,
            fee: formData.fee,
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
            }
        } catch (error) {
            console.error('Error saving appointment:', error);
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

    const getFilteredAppointments = () => {
        const today = new Date().toISOString().split('T')[0];
        const todayDate = new Date(today);

        return appointments.filter(apt => {
            if (viewRange === "today") {
                // Normalize both dates to YYYY-MM-DD format for comparison
                const aptDateStr = apt.date.split('T')[0];
                const selectedDateStr = selectedDate.split('T')[0];
                return aptDateStr === selectedDateStr;
            }

            const aptDate = new Date(apt.date);
            const diffTime = aptDate.getTime() - todayDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (viewRange === "7days") {
                return diffDays >= 0 && diffDays <= 7;
            }
            if (viewRange === "30days") {
                return diffDays >= 0 && diffDays <= 30;
            }
            if (viewRange === "all") {
                return diffDays >= 0;
            }
            return false;
        }).sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.time.localeCompare(b.time);
        });
    };

    const filteredAppointments = getFilteredAppointments();

    const handleDeleteAppointment = async () => {
        if (!selectedAppointment) return;

        const updatedAppointments = appointments.filter(apt => apt.id !== selectedAppointment.id);

        try {
            const response = await fetch('/api/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedAppointments),
            });

            if (response.ok) {
                setAppointments(updatedAppointments);
                setIsDeleteConfirmOpen(false);
                setIsDetailsOpen(false);
                setSelectedAppointment(null);
            }
        } catch (error) {
            console.error('Error deleting appointment:', error);
        }
    };

    const handleViewAppointment = (appointment: Appointment) => {
        setSelectedAppointment(appointment);
        setIsDetailsOpen(true);
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
                            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('list')}
                            className="h-8"
                        >
                            <List className="h-4 w-4 mr-2" />
                            List
                        </Button>
                        <Button
                            variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('calendar')}
                            className="h-8"
                        >
                            <CalendarIcon className="h-4 w-4 mr-2" />
                            Calendar
                        </Button>

                    </div>
                    <Button className="gap-2" onClick={() => setIsDialogOpen(true)}>
                        <Plus className="h-4 w-4" />
                        New Appointment
                    </Button>
                </div>
            </div>

            {viewMode === 'calendar' ? (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    <Card className="lg:col-span-3 h-[800px] flex flex-col">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
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
                        <CardContent className="flex-1 p-0">
                        <div className="h-full flex flex-col">
                            <div className="grid grid-cols-7 border-b">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                                    <div key={day} className="p-4 text-center font-semibold text-sm text-muted-foreground">
                                        {day}
                                    </div>
                                ))}
                            </div>
                            <div className="flex-1 grid grid-cols-7 grid-rows-5">
                                {eachDayOfInterval({
                                    start: startOfWeek(startOfMonth(currentMonth)),
                                    end: endOfWeek(endOfMonth(currentMonth))
                                }).map((day, dayIdx) => {
                                    const dayStr = format(day, 'yyyy-MM-dd');
                                    const dayAppointments = appointments.filter(apt => {
                                        // Normalize appointment date to YYYY-MM-DD format for comparison
                                        const aptDateStr = apt.date.split('T')[0];
                                        return aptDateStr === dayStr;
                                    });
                                    return (
                                        <div
                                            key={day.toString()}
                                            className={cn(
                                                "border-b border-r p-1.5 min-h-[120px] transition-colors hover:bg-muted/50 cursor-pointer relative group",
                                                !isSameMonth(day, currentMonth) && "bg-muted/20 text-muted-foreground",
                                                isToday(day) && "bg-primary/5",
                                                dayAppointments.length > 0 && "bg-muted/30"
                                            )}
                                            onClick={() => {
                                                const dateStr = format(day, 'yyyy-MM-dd');
                                                setSelectedDate(dateStr);
                                                setViewRange("today"); // Ensure viewRange is set to show selected date
                                                setFormData({ ...formData, date: dateStr });
                                                // If there are appointments, switch to list view to show them; otherwise open dialog to create new
                                                if (dayAppointments.length > 0) {
                                                    setViewMode('list');
                                                } else {
                                                    setIsDialogOpen(true);
                                                }
                                            }}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <span className={cn(
                                                    "text-sm font-medium h-7 w-7 flex items-center justify-center rounded-full",
                                                    isToday(day) && "bg-primary text-primary-foreground"
                                                )}>
                                                    {format(day, 'd')}
                                                </span>
                                            </div>
                                            <div className="space-y-0.5 overflow-y-auto max-h-[90px] mt-1">
                                                {dayAppointments.length > 2 ? (
                                                    <div className="text-[10px] font-semibold text-center py-1 px-1 rounded bg-primary/20 text-primary border border-primary/30">
                                                        {dayAppointments.length} sessions
                                                    </div>
                                                ) : (
                                                    dayAppointments.slice(0, 3).map(apt => {
                                                        // Format time properly - handle both HH:MM and other formats
                                                        const displayTime = apt.time && apt.time.length > 0 
                                                            ? (apt.time.includes(':') ? apt.time.substring(0, 5) : apt.time)
                                                            : '--:--';
                                                        return (
                                                            <div
                                                                key={apt.id}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleViewAppointment(apt);
                                                                }}
                                                                className={cn(
                                                                    "px-1 py-0.5 rounded text-[10px] font-medium border shadow-sm cursor-pointer hover:opacity-90 hover:shadow-md transition-all leading-tight",
                                                                    apt.type === "Initial Consultation" && "bg-blue-100 text-blue-800 border-blue-300",
                                                                    apt.type === "Therapy Session" && "bg-green-100 text-green-800 border-green-300",
                                                                    apt.type === "Discovery Session" && "bg-purple-100 text-purple-800 border-purple-300",
                                                                    apt.type === "Couples Therapy Session" && "bg-pink-100 text-pink-800 border-pink-300",
                                                                    apt.type === "Family Therapy" && "bg-orange-100 text-orange-800 border-orange-300",
                                                                    apt.type === "Follow-up Session" && "bg-yellow-100 text-yellow-800 border-yellow-300"
                                                                )}
                                                                title={`${displayTime} - ${apt.clientName} - ${apt.type}`}
                                                            >
                                                                <div className="font-bold text-[11px] leading-tight">{displayTime}</div>
                                                                <div className="truncate text-[9px] leading-tight">{apt.clientName}</div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Calendar Legend */}
                        <div className="mt-6 pt-4 border-t">
                            <h3 className="text-sm font-semibold mb-3">Appointment Types</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
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
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                                    <span>Family Therapy</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                    <span>Follow-up Session</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
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
                                        className="mt-4" 
                                        onClick={() => {
                                            setFormData({ ...formData, date: selectedDate });
                                            setIsDialogOpen(true);
                                        }}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Appointment
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {selectedDateAppointments.sort((a, b) => a.time.localeCompare(b.time)).map((appointment) => (
                                        <Card 
                                            key={appointment.id}
                                            className="border-l-4 border-l-primary hover:shadow-md transition-shadow cursor-pointer"
                                            onClick={() => {
                                                router.push(`/clients?client=${encodeURIComponent(appointment.clientName)}`);
                                            }}
                                        >
                                            <CardContent className="p-4">
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="font-semibold">{appointment.clientName}</h4>
                                                        <span className={cn(
                                                            "text-xs px-2 py-1 rounded",
                                                            appointment.type === "Initial Consultation" && "bg-blue-100 text-blue-700",
                                                            appointment.type === "Therapy Session" && "bg-green-100 text-green-700",
                                                            appointment.type === "Discovery Session" && "bg-purple-100 text-purple-700",
                                                            appointment.type === "Couples Therapy Session" && "bg-pink-100 text-pink-700",
                                                            appointment.type === "Family Therapy" && "bg-orange-100 text-orange-700",
                                                            appointment.type === "Follow-up Session" && "bg-yellow-100 text-yellow-700"
                                                        )}>
                                                            {appointment.type}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {appointment.time}
                                                        </span>
                                                        <span>{appointment.duration}m</span>
                                                    </div>
                                                    {appointment.fee && (
                                                        <div className="text-xs text-muted-foreground">
                                                            €{appointment.fee} - {appointment.paymentStatus || "unpaid"}
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                    <Button 
                                        variant="outline" 
                                        className="w-full mt-4" 
                                        onClick={() => {
                                            setFormData({ ...formData, date: selectedDate });
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
                                                family: getAppointmentDatesByType("Family Therapy"),
                                                followup: getAppointmentDatesByType("Follow-up Session"),
                                            }}
                                            modifiersStyles={{
                                                consultation: { color: '#3b82f6', fontWeight: 'bold', textDecoration: 'underline' }, // Blue
                                                therapy: { color: '#22c55e', fontWeight: 'bold', textDecoration: 'underline' }, // Green
                                                discovery: { color: '#a855f7', fontWeight: 'bold', textDecoration: 'underline' }, // Purple
                                                couples: { color: '#ec4899', fontWeight: 'bold', textDecoration: 'underline' }, // Pink
                                                family: { color: '#f97316', fontWeight: 'bold', textDecoration: 'underline' }, // Orange
                                                followup: { color: '#eab308', fontWeight: 'bold', textDecoration: 'underline' }, // Yellow
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
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                                        <span>Family Therapy</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                        <span>Follow-up Session</span>
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
                                filteredAppointments.map((appointment, index) => (
                                    <motion.div
                                        key={appointment.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                    >
                                        <Card className="border-l-4 border-l-primary hover:shadow-md transition-shadow">
                                            <CardContent className="p-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-primary/10 text-primary">
                                                            <span className="text-xs font-bold uppercase">
                                                                {new Date(appointment.date).toLocaleDateString('en-US', { month: 'short' })}
                                                            </span>
                                                            <span className="text-xl font-bold">
                                                                {new Date(appointment.date).getDate()}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold text-lg">{appointment.clientName}</h4>
                                                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                                <span className="flex items-center gap-1">
                                                                    <Clock className="h-3 w-3" />
                                                                    {appointment.time}
                                                                </span>
                                                                <span>{appointment.duration}m</span>
                                                                <span>{appointment.type}</span>
                                                            </div>
                                                            {appointment.fee && (
                                                                <div className="text-xs text-muted-foreground mt-1">
                                                                    €{appointment.fee} - {appointment.paymentStatus || "unpaid"}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => {
                                                            router.push(`/clients?client=${encodeURIComponent(appointment.clientName)}`);
                                                        }}
                                                    >
                                                        View
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                ))
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
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="client">Client</Label>
                                <Select
                                    value={formData.clientName}
                                    onValueChange={(value) => {
                                        const client = clients.find(c => c.name === value);
                                        setFormData({
                                            ...formData,
                                            clientName: value,
                                            fee: client?.sessionFee ?? 0,
                                            currency: client?.currency ?? "EUR",
                                        });
                                    }}
                                >
                                    <SelectTrigger id="client">
                                        <SelectValue placeholder="Select a client..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {clients.map((client) => (
                                            <SelectItem key={client.id} value={client.name}>
                                                {client.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="date">Date</Label>
                                <DatePicker
                                    value={formData.date ? new Date(formData.date) : undefined}
                                    onChange={(date) => {
                                        if (date) {
                                            setFormData({
                                                ...formData,
                                                date: date.toISOString().split("T")[0],
                                            })
                                        }
                                    }}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="time">Time</Label>
                                <Input
                                    id="time"
                                    type="time"
                                    value={formData.time}
                                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="duration">Duration (minutes)</Label>
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

                            <div className="space-y-2">
                                <Label htmlFor="type">Appointment Type</Label>
                                <Select
                                    value={formData.type}
                                    onValueChange={(value: string) => {
                                        // Find the selected appointment type to get its default duration and fee
                                        const selectedType = appointmentTypes.find(t => t.name === value);
                                        const duration = selectedType?.duration || 60;
                                        const fee = selectedType?.fee || 80;

                                        setFormData({
                                            ...formData,
                                            type: value,
                                            duration,
                                            fee
                                        });
                                    }}
                                >
                                    <SelectTrigger id="type">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {appointmentTypes.filter(t => t.enabled).map(type => (
                                            <SelectItem key={type.name} value={type.name}>
                                                {type.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="notes">Notes (Optional)</Label>
                                <Textarea
                                    id="notes"
                                    placeholder="Add any notes about this appointment..."
                                    rows={3}
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                />
                            </div>

                            {formData.type !== "Discovery Session" && (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="fee">Session Fee</Label>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-bold">{(() => {
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
                                                className="w-24"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="paymentMethod">Payment Method</Label>
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

                                    <div className="space-y-2">
                                        <Label htmlFor="paymentStatus">Payment Status</Label>
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
                                </>
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={!formData.clientName}>
                                Create Appointment
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* View Appointment Details Dialog */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-md">
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
                                    <h3 className="text-xl font-bold">{selectedAppointment.clientName}</h3>
                                    <p className="text-muted-foreground">{selectedAppointment.type}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground uppercase">Date</Label>
                                    <div className="flex items-center gap-2">
                                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">
                                            {new Date(selectedAppointment.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground uppercase">Time</Label>
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">
                                            {selectedAppointment.time} ({selectedAppointment.duration}m)
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {selectedAppointment.fee !== undefined && selectedAppointment.type !== "Discovery Session" && (
                                <div className="border-t pt-4 space-y-3">
                                    <Label className="text-xs text-muted-foreground uppercase">Payment Details</Label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <p className="text-sm text-muted-foreground">Fee</p>
                                            <p className="text-lg font-bold">€{selectedAppointment.fee}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm text-muted-foreground">Method</p>
                                            <p className="font-medium">{selectedAppointment.paymentMethod || "Cash"}</p>
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

                            {selectedAppointment.notes && (
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground uppercase">Notes</Label>
                                    <div className="p-3 bg-muted/50 rounded-md text-sm">
                                        {selectedAppointment.notes}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between items-center pt-4">
                                {selectedAppointment.date >= new Date().toISOString().split('T')[0] ? (
                                    <Button
                                        variant="destructive"
                                        onClick={() => setIsDeleteConfirmOpen(true)}
                                    >
                                        Delete Appointment
                                    </Button>
                                ) : <div />}
                                <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
                                    Close
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Confirm Deletion</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this appointment? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDeleteAppointment}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );

}
