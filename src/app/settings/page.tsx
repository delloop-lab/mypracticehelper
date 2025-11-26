"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Calendar, DollarSign, Clock, Save, CheckCircle2, Database, Download, Upload, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

interface AppointmentTypeSettings {
    name: string;
    duration: number;
    fee: number;
    enabled: boolean;
}

interface SettingsData {
    calendlyUrl: string;
    appointmentTypes: AppointmentTypeSettings[];
    defaultDuration: number;
    defaultFee: number;
    currency: string;
    timezone?: string; // IANA timezone (e.g., "Europe/Lisbon", "America/New_York")
    blockedDays?: number[]; // Array of day numbers (0=Sunday, 1=Monday, ..., 6=Saturday)
}

const DEFAULT_APPOINTMENT_TYPES: AppointmentTypeSettings[] = [
    { name: "Initial Consultation", duration: 60, fee: 80, enabled: true },
    { name: "Follow-up Session", duration: 60, fee: 80, enabled: true },
    { name: "Therapy Session", duration: 60, fee: 80, enabled: true },
    { name: "Couples Therapy Session", duration: 60, fee: 100, enabled: true },
    { name: "Family Therapy", duration: 60, fee: 80, enabled: true },
    { name: "Discovery Session", duration: 30, fee: 0, enabled: true },
];

export default function SettingsPage() {
    const [settings, setSettings] = useState<SettingsData>({
        calendlyUrl: "",
        appointmentTypes: DEFAULT_APPOINTMENT_TYPES,
        defaultDuration: 60,
        defaultFee: 80,
        currency: "EUR",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", // Auto-detect user's timezone
        blockedDays: [],
    });
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
    const [newTypeName, setNewTypeName] = useState("");
    const [newTypeDuration, setNewTypeDuration] = useState(60);
    const [newTypeFee, setNewTypeFee] = useState(80);
    const [isCreatingBackup, setIsCreatingBackup] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [baseUrl, setBaseUrl] = useState<string>("");

    useEffect(() => {
        loadSettings();
        if (typeof window !== "undefined") {
            setBaseUrl(window.location.origin);
        }
    }, []);

    const loadSettings = async () => {
        try {
            const response = await fetch('/api/settings');
            if (response.ok) {
                const data = await response.json();
                setSettings(data);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    };

    const saveSettings = async () => {
        setSaveStatus("saving");
        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });

            if (response.ok) {
                setSaveStatus("saved");
                setTimeout(() => setSaveStatus("idle"), 2000);
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            setSaveStatus("idle");
        }
    };

    const updateAppointmentType = (index: number, field: keyof AppointmentTypeSettings, value: any) => {
        const updated = [...settings.appointmentTypes];
        updated[index] = { ...updated[index], [field]: value };
        setSettings({ ...settings, appointmentTypes: updated });
    };

    const addAppointmentType = () => {
        const name = newTypeName.trim();
        if (name) {
            setSettings({
                ...settings,
                appointmentTypes: [
                    ...settings.appointmentTypes,
                    { name, duration: newTypeDuration, fee: newTypeFee, enabled: true }
                ]
            });
            setNewTypeName("");
            setNewTypeDuration(60);
            setNewTypeFee(80);
        }
    };


    const createDataBackup = async () => {
        setIsCreatingBackup(true);
        setBackupMessage(null);
        try {
            const response = await fetch('/api/backup', { method: 'POST' });
            if (response.ok) {
                // Get the ZIP file as blob
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `therapist-backup-${new Date().toISOString().split('T')[0]}.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                setBackupMessage({ type: 'success', text: 'Data backup created successfully!' });
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Failed to create backup' }));
                setBackupMessage({ type: 'error', text: errorData.error || 'Failed to create backup' });
            }
        } catch (error) {
            console.error('Error creating backup:', error);
            setBackupMessage({ type: 'error', text: 'Error creating backup' });
        } finally {
            setIsCreatingBackup(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsRestoring(true);
        setBackupMessage(null);

        try {
            const text = await file.text();
            const backupData = JSON.parse(text);

            const response = await fetch('/api/backup/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(backupData),
            });

            if (response.ok) {
                setBackupMessage({ type: 'success', text: 'Backup restored successfully! Refreshing...' });
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                setBackupMessage({ type: 'error', text: 'Failed to restore backup' });
            }
        } catch (error) {
            console.error('Error restoring backup:', error);
            setBackupMessage({ type: 'error', text: 'Invalid backup file' });
        } finally {
            setIsRestoring(false);
            e.target.value = '';
        }
    };


    return (
        <div className="container mx-auto px-4 py-8 max-w-5xl">
            <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2 flex items-center gap-2">
                    <Settings className="h-8 w-8" />
                    Settings
                </h1>
                <p className="text-muted-foreground">
                    Configure your practice settings and preferences
                </p>
            </div>

            <Tabs defaultValue="general" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4 max-w-2xl">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="appointments">Appointments</TabsTrigger>
                    <TabsTrigger value="defaults">Defaults</TabsTrigger>
                    <TabsTrigger value="backup">Backup & Data</TabsTrigger>
                </TabsList>

                {/* General Settings Tab */}
                <TabsContent value="general" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                Calendly Integration
                            </CardTitle>
                            <CardDescription>
                                Connect your Calendly account for automated scheduling
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="calendlyUrl">Calendly URL</Label>
                                <Input
                                    id="calendlyUrl"
                                    type="url"
                                    placeholder="https://calendly.com/your-username"
                                    value={settings.calendlyUrl}
                                    onChange={(e) => setSettings({ ...settings, calendlyUrl: e.target.value })}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Enter your Calendly scheduling page URL. This will be used for client booking links.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                Google Calendar Feed
                            </CardTitle>
                            <CardDescription>
                                Use this URL to create a new calendar in Google Calendar (Settings &gt; Add calendar &gt; From URL).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="space-y-2">
                                <Label htmlFor="gcalFeedUrl">Calendar feed URL</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="gcalFeedUrl"
                                        readOnly
                                        value={baseUrl ? `${baseUrl}/api/calendar/sessions` : ""}
                                        className="flex-1"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={async () => {
                                            const url = baseUrl ? `${baseUrl}/api/calendar/sessions` : "";
                                            if (!url) return;
                                            try {
                                                await navigator.clipboard.writeText(url);
                                                alert("Calendar URL copied to clipboard");
                                            } catch {
                                                alert("Could not copy URL. Please copy it manually.");
                                            }
                                        }}
                                    >
                                        Copy
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Paste this URL into Google Calendar under <strong>Settings &gt; Add calendar &gt; From URL</strong> to subscribe to your session calendar.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="timezone">Timezone</Label>
                                <Select
                                    value={settings.timezone || "UTC"}
                                    onValueChange={(value) => setSettings({ ...settings, timezone: value })}
                                >
                                    <SelectTrigger id="timezone">
                                        <SelectValue placeholder="Select timezone" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="UTC">UTC</SelectItem>
                                        <SelectItem value="Europe/Lisbon">Europe/Lisbon (Portugal)</SelectItem>
                                        <SelectItem value="Europe/London">Europe/London (UK)</SelectItem>
                                        <SelectItem value="Europe/Paris">Europe/Paris (France)</SelectItem>
                                        <SelectItem value="Europe/Berlin">Europe/Berlin (Germany)</SelectItem>
                                        <SelectItem value="Europe/Madrid">Europe/Madrid (Spain)</SelectItem>
                                        <SelectItem value="Europe/Rome">Europe/Rome (Italy)</SelectItem>
                                        <SelectItem value="America/New_York">America/New_York (US Eastern)</SelectItem>
                                        <SelectItem value="America/Chicago">America/Chicago (US Central)</SelectItem>
                                        <SelectItem value="America/Denver">America/Denver (US Mountain)</SelectItem>
                                        <SelectItem value="America/Los_Angeles">America/Los_Angeles (US Pacific)</SelectItem>
                                        <SelectItem value="America/Toronto">America/Toronto (Canada Eastern)</SelectItem>
                                        <SelectItem value="America/Vancouver">America/Vancouver (Canada Pacific)</SelectItem>
                                        <SelectItem value="Australia/Sydney">Australia/Sydney</SelectItem>
                                        <SelectItem value="Australia/Melbourne">Australia/Melbourne</SelectItem>
                                        <SelectItem value="Asia/Tokyo">Asia/Tokyo (Japan)</SelectItem>
                                        <SelectItem value="Asia/Shanghai">Asia/Shanghai (China)</SelectItem>
                                        <SelectItem value="Asia/Dubai">Asia/Dubai (UAE)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Your timezone is used for calendar feeds and appointment times. This ensures appointments appear at the correct time in Google Calendar.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Appointment Types Tab */}
                <TabsContent value="appointments" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Appointment Types</CardTitle>
                            <CardDescription>
                                Configure duration and fees for each appointment type
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {settings.appointmentTypes
                                .map((type, originalIndex) => ({ type, originalIndex }))
                                .sort((a, b) => {
                                    // Move Discovery Session to the top
                                    if (a.type.name === "Discovery Session") return -1;
                                    if (b.type.name === "Discovery Session") return 1;
                                    return 0;
                                })
                                .map(({ type, originalIndex }, displayIndex) => (
                                <motion.div
                                    key={`${displayIndex}-${type.name}`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: displayIndex * 0.05 }}
                                    className="p-4 rounded-lg border bg-card"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-semibold">{type.name}</h4>
                                        <div className="flex items-center gap-3">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={type.enabled}
                                                    onChange={(e) => updateAppointmentType(originalIndex, 'enabled', e.target.checked)}
                                                    className="w-4 h-4 rounded"
                                                />
                                                <span className="text-sm text-muted-foreground">Enabled</span>
                                            </label>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    const updated = settings.appointmentTypes.filter((_, i) => i !== originalIndex);
                                                    setSettings({ ...settings, appointmentTypes: updated });
                                                }}
                                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                            >
                                                ×
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor={`duration-${displayIndex}`} className="text-xs">
                                                Duration (minutes)
                                            </Label>
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id={`duration-${displayIndex}`}
                                                    type="number"
                                                    min="15"
                                                    step="5"
                                                    value={type.duration}
                                                    onChange={(e) => updateAppointmentType(originalIndex, 'duration', parseInt(e.target.value) || 0)}
                                                    className="w-24"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`fee-${displayIndex}`} className="text-xs">
                                                Fee ({settings.currency})
                                            </Label>
                                            <div className="flex items-center gap-2">
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id={`fee-${displayIndex}`}
                                                    type="number"
                                                    min="0"
                                                    step="5"
                                                    value={type.fee}
                                                    onChange={(e) => updateAppointmentType(originalIndex, 'fee', parseInt(e.target.value) || 0)}
                                                    className="w-24"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}

                            {/* Add New Appointment Type */}
                            <div className="mt-6 p-4 rounded-lg border-2 border-dashed">
                                <h4 className="font-semibold mb-3">Add New Appointment Type</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="newTypeName" className="text-xs">Name</Label>
                                        <Input
                                            id="newTypeName"
                                            placeholder="e.g., Group Therapy"
                                            value={newTypeName}
                                            onChange={(e) => setNewTypeName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    addAppointmentType();
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="newTypeDuration" className="text-xs">Duration (min)</Label>
                                        <Input
                                            id="newTypeDuration"
                                            type="number"
                                            min="15"
                                            step="5"
                                            value={newTypeDuration}
                                            onChange={(e) => setNewTypeDuration(parseInt(e.target.value) || 60)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="newTypeFee" className="text-xs">Fee ({settings.currency})</Label>
                                        <Input
                                            id="newTypeFee"
                                            type="number"
                                            min="0"
                                            step="5"
                                            value={newTypeFee}
                                            onChange={(e) => setNewTypeFee(parseInt(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>
                                <Button
                                    className="mt-3"
                                    variant="outline"
                                    size="sm"
                                    onClick={addAppointmentType}
                                >
                                    Add Appointment Type
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Defaults Tab */}
                <TabsContent value="defaults" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Default Settings</CardTitle>
                            <CardDescription>
                                Set default values for new appointments
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label>Days of Week Not Available for Bookings</Label>
                                <div className="grid grid-cols-7 gap-2">
                                    {[
                                        { day: 0, label: 'Sun' },
                                        { day: 1, label: 'Mon' },
                                        { day: 2, label: 'Tue' },
                                        { day: 3, label: 'Wed' },
                                        { day: 4, label: 'Thu' },
                                        { day: 5, label: 'Fri' },
                                        { day: 6, label: 'Sat' },
                                    ].map(({ day, label }) => (
                                        <label
                                            key={day}
                                            className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                                                settings.blockedDays?.includes(day)
                                                    ? 'bg-muted/50 border-muted text-muted-foreground opacity-50'
                                                    : 'bg-background border-border hover:bg-muted'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={settings.blockedDays?.includes(day) || false}
                                                onChange={(e) => {
                                                    const currentBlocked = settings.blockedDays || [];
                                                    const updatedBlocked = e.target.checked
                                                        ? [...currentBlocked, day]
                                                        : currentBlocked.filter(d => d !== day);
                                                    setSettings({ ...settings, blockedDays: updatedBlocked });
                                                }}
                                                className="sr-only"
                                            />
                                            <span className="text-sm font-medium">{label}</span>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Select days when you do not accept bookings. These days will be disabled in the calendar.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="defaultDuration">Default Duration (minutes)</Label>
                                <div className="flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-muted-foreground" />
                                    <Input
                                        id="defaultDuration"
                                        type="number"
                                        min="15"
                                        step="5"
                                        value={settings.defaultDuration}
                                        onChange={(e) => setSettings({ ...settings, defaultDuration: parseInt(e.target.value) || 0 })}
                                        className="w-32"
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Default duration for new appointments
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="defaultFee">Default Fee</Label>
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-bold">€</span>
                                    <Input
                                        id="defaultFee"
                                        type="number"
                                        min="0"
                                        step="5"
                                        value={settings.defaultFee}
                                        onChange={(e) => setSettings({ ...settings, defaultFee: parseInt(e.target.value) || 0 })}
                                        className="w-32"
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Default fee for new appointments (except Discovery Sessions)
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="currency">Currency</Label>
                                <select
                                    id="currency"
                                    value={settings.currency}
                                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                >
                                    <option value="EUR">EUR (€)</option>
                                    <option value="USD">USD ($)</option>
                                    <option value="GBP">GBP (£)</option>
                                </select>
                                <p className="text-xs text-muted-foreground">
                                    Currency for all financial transactions
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Backup & Data Tab */}
                <TabsContent value="backup" className="space-y-4">
                    {/* Backup Message Alert */}
                    {backupMessage && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-4 rounded-lg flex items-center gap-2 ${backupMessage.type === 'success'
                                ? 'bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-900'
                                : 'bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-900'
                                }`}
                        >
                            {backupMessage.type === 'success' ? (
                                <CheckCircle2 className="h-5 w-5" />
                            ) : (
                                <AlertCircle className="h-5 w-5" />
                            )}
                            <span>{backupMessage.text}</span>
                        </motion.div>
                    )}

                    {/* Data Backup */}
                    <Card className="border-2 border-primary">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Database className="h-5 w-5 text-primary" />
                                Create Data Backup
                            </CardTitle>
                            <CardDescription>
                                Download a backup of your data only (clients, appointments, session notes, and recordings)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                onClick={createDataBackup}
                                disabled={isCreatingBackup}
                                size="lg"
                                className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                            >
                                <Download className="mr-2 h-4 w-4" />
                                {isCreatingBackup ? 'Creating Backup...' : 'Create & Download Data Backup'}
                            </Button>
                            <p className="text-xs text-muted-foreground mt-2">
                                Includes: All client data, appointments, session notes, and recordings
                            </p>
                        </CardContent>
                    </Card>

                    {/* Restore Backup */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Upload className="h-5 w-5 text-primary" />
                                Restore from Backup
                            </CardTitle>
                            <CardDescription>
                                Upload a backup file to restore your data. This will replace all current data.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="backup-upload"
                                        type="file"
                                        accept=".json"
                                        className="hidden"
                                        onChange={handleFileUpload}
                                        disabled={isRestoring}
                                    />
                                    <Label
                                        htmlFor="backup-upload"
                                        className={`flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-muted ${isRestoring ? 'opacity-50 cursor-not-allowed' : ''
                                            }`}
                                    >
                                        <Upload className="h-4 w-4" />
                                        {isRestoring ? 'Restoring...' : 'Upload Backup File'}
                                    </Label>
                                </div>
                                <div className="text-sm text-amber-600 dark:text-amber-400 flex items-start gap-2">
                                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                    <span>Warning: Restoring a backup will replace all current data. Make sure to create a backup first!</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                </TabsContent>
            </Tabs>

            {/* Save Button */}
            <div className="flex justify-end mt-6">
                <Button
                    onClick={saveSettings}
                    disabled={saveStatus === "saving"}
                    className="gap-2"
                    size="lg"
                >
                    {saveStatus === "saving" ? (
                        <>
                            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Saving...
                        </>
                    ) : saveStatus === "saved" ? (
                        <>
                            <CheckCircle2 className="h-5 w-5" />
                            Saved!
                        </>
                    ) : (
                        <>
                            <Save className="h-5 w-5" />
                            Save Settings
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
