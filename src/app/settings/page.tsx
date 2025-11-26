"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Calendar, DollarSign, Clock, Save, CheckCircle2, Database, Download, Upload, AlertCircle, User, Mail } from "lucide-react";
import { motion } from "framer-motion";

interface AppointmentTypeSettings {
    name: string;
    duration: number;
    fee: number;
    enabled: boolean;
}

interface EmailTemplate {
    subject: string;
    htmlBody: string;
    textBody: string;
}

interface SettingsData {
    calendlyUrl: string;
    appointmentTypes: AppointmentTypeSettings[];
    defaultDuration: number;
    defaultFee: number;
    currency: string;
    timezone?: string; // IANA timezone (e.g., "Europe/Lisbon", "America/New_York")
    blockedDays?: number[]; // Array of day numbers (0=Sunday, 1=Monday, ..., 6=Saturday)
    reminderEmailTemplate?: EmailTemplate;
    companyName?: string;
    companyLogo?: string; // Path or URL to company logo
    reminderHoursBefore?: number; // Hours before appointment to send reminder (default: 24)
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
        reminderHoursBefore: 24, // Default: send reminders 24 hours before
    });
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
    const [newTypeName, setNewTypeName] = useState("");
    const [newTypeDuration, setNewTypeDuration] = useState(60);
    const [newTypeFee, setNewTypeFee] = useState(80);
    const [isCreatingBackup, setIsCreatingBackup] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [baseUrl, setBaseUrl] = useState<string>("");
    const [userEmail, setUserEmail] = useState<string>("");
    const [firstName, setFirstName] = useState<string>("");
    const [lastName, setLastName] = useState<string>("");
    const [testEmailAddress, setTestEmailAddress] = useState<string>("");
    const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
    const [testEmailMessage, setTestEmailMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isUploadingLogo, setIsUploadingLogo] = useState<boolean>(false);

    useEffect(() => {
        loadSettings();
        if (typeof window !== "undefined") {
            setBaseUrl(window.location.origin);
            // Get user email from localStorage or cookie
            const email = localStorage.getItem("userEmail") || 
                         document.cookie.split('; ').find(row => row.startsWith('userEmail='))?.split('=')[1] || 
                         "";
            setUserEmail(email);
            
            // Extract name from email or use default
            if (email === "claire@claireschillaci.com") {
                setFirstName("Claire");
                setLastName("Schillaci");
            } else if (email) {
                // Extract name from email (e.g., "john.doe@example.com" -> "John" "Doe")
                const namePart = email.split('@')[0];
                const nameParts = namePart.split('.').map(part => 
                    part.charAt(0).toUpperCase() + part.slice(1)
                );
                if (nameParts.length >= 2) {
                    setFirstName(nameParts[0]);
                    setLastName(nameParts.slice(1).join(' '));
                } else if (nameParts.length === 1) {
                    setFirstName(nameParts[0]);
                    setLastName("");
                }
            }
        }
    }, []);

    const loadSettings = async () => {
        try {
            const response = await fetch('/api/settings');
            if (response.ok) {
                const data = await response.json();
                // Ensure reminderEmailTemplate has default values if missing
                if (!data.reminderEmailTemplate) {
                    data.reminderEmailTemplate = {
                        subject: "Reminder: Your appointment tomorrow - {{date}}",
                        htmlBody: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Logo centered at top -->
    <div style="text-align: center; margin-bottom: 30px;">
        <img src="{{logoUrl}}" alt="Algarve Therapy Centre" style="max-width: 150px; width: 150px; height: auto; display: block; margin: 0 auto;" />
    </div>
    
    <p>Hi {{clientName}},</p>
    
    <p>This is a quick reminder about your {{appointmentType}} scheduled for {{dateTime}}. The session will run for {{duration}}.</p>
    
    <p>If you need to reschedule, just let me know.</p>
    
    <p>See you then,</p>
    
    <p>Claire<br>
    <strong>Algarve Therapy Centre</strong><br>
    Tel: 937596665</p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="font-size: 11px; color: #999; margin: 0 0 10px 0;">
        This is an automated reminder. Please do not reply to this email.
    </p>
    <p style="font-size: 11px; color: #999; margin: 0;">
        <em>Add this email to your whitelist to ensure it arrives in your inbox safely next time.</em>
    </p>
</body>
</html>`,
                        textBody: `Appointment Reminder

Hi {{clientName}},

This is a quick reminder about your {{appointmentType}} scheduled for {{dateTime}}. The session will run for {{duration}}.

If you need to reschedule, just let me know.

See you then,

Claire
Algarve Therapy Centre
Tel: 937596665

---
This is an automated reminder. Please do not reply to this email.

Add this email to your whitelist to ensure it arrives in your inbox safely next time.`,
                    };
                }
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
                    <Settings className="h-8 w-8 text-blue-500" />
                    Settings
                </h1>
                <p className="text-muted-foreground">
                    Configure your practice settings and preferences
                </p>
            </div>

            <Tabs defaultValue="profile" className="space-y-6">
                <TabsList className="grid w-full grid-cols-6 max-w-4xl">
                    <TabsTrigger value="profile">Profile</TabsTrigger>
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="appointments">Appointments</TabsTrigger>
                    <TabsTrigger value="defaults">Defaults</TabsTrigger>
                    <TabsTrigger value="reminders">Reminders</TabsTrigger>
                    <TabsTrigger value="backup">Backup & Data</TabsTrigger>
                </TabsList>

                {/* Profile Tab */}
                <TabsContent value="profile" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5 text-blue-500" />
                                Profile Information
                            </CardTitle>
                            <CardDescription>
                                Your account information and preferences
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName">First Name</Label>
                                    <Input
                                        id="firstName"
                                        readOnly
                                        value={firstName}
                                        className="bg-muted"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName">Last Name</Label>
                                    <Input
                                        id="lastName"
                                        readOnly
                                        value={lastName}
                                        className="bg-muted"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Your name as displayed in the application
                            </p>
                            <div className="space-y-2">
                                <Label htmlFor="userEmail">Email</Label>
                                <Input
                                    id="userEmail"
                                    type="email"
                                    readOnly
                                    value={userEmail}
                                    className="bg-muted"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Your email address used for login
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

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="h-5 w-5 text-blue-500" />
                                Company Information
                            </CardTitle>
                            <CardDescription>
                                Company details used in emails and communications
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="companyName">Company Name</Label>
                                <Input
                                    id="companyName"
                                    type="text"
                                    placeholder="e.g., Algarve Therapy Centre"
                                    value={settings.companyName || ""}
                                    onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Your company name as it appears in emails and communications
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="companyLogo">Company Logo</Label>
                                <div className="flex items-center gap-4">
                                    {settings.companyLogo && (
                                        <div className="relative" key={`logo-container-${settings.companyLogo}`}>
                                            <img 
                                                src={settings.companyLogo}
                                                alt="Company Logo" 
                                                key={`logo-img-${settings.companyLogo}`}
                                                className="h-20 w-auto object-contain border rounded p-2 bg-muted"
                                                onError={(e) => {
                                                    console.error('Error loading logo:', settings.companyLogo);
                                                    // Fallback if image fails to load
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                                onLoad={() => {
                                                    console.log('Logo loaded successfully:', settings.companyLogo);
                                                }}
                                            />
                                        </div>
                                    )}
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Input
                                                id="companyLogo"
                                                type="file"
                                                accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                                                className="cursor-pointer"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;

                                                    setIsUploadingLogo(true);
                                                    try {
                                                        const formData = new FormData();
                                                        formData.append('file', file);

                                                        const response = await fetch('/api/settings/upload-logo', {
                                                            method: 'POST',
                                                            body: formData,
                                                        });

                                                        if (response.ok) {
                                                            const data = await response.json();
                                                            console.log('Logo upload response:', data);
                                                            const updatedSettings = { ...settings, companyLogo: data.logoPath };
                                                            console.log('Updating settings with logo:', data.logoPath);
                                                            setSettings(updatedSettings);
                                                            
                                                            // Dispatch event to notify sidebar to refresh logo
                                                            window.dispatchEvent(new CustomEvent('logo-updated'));
                                                            
                                                            // Auto-save settings after logo upload
                                                            try {
                                                                const saveResponse = await fetch('/api/settings', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify(updatedSettings),
                                                                });
                                                                
                                                                if (saveResponse.ok) {
                                                                    setSaveStatus('saved');
                                                                    setTimeout(() => setSaveStatus('idle'), 2000);
                                                                } else {
                                                                    console.error('Failed to save settings after logo upload');
                                                                }
                                                            } catch (saveError) {
                                                                console.error('Error saving settings after logo upload:', saveError);
                                                            }
                                                        } else {
                                                            const errorData = await response.json();
                                                            alert(`Failed to upload logo: ${errorData.error || 'Unknown error'}`);
                                                        }
                                                    } catch (error) {
                                                        console.error('Error uploading logo:', error);
                                                        alert('Error uploading logo. Please try again.');
                                                    } finally {
                                                        setIsUploadingLogo(false);
                                                        // Reset input to allow selecting a new file
                                                        if (e.target) {
                                                            (e.target as HTMLInputElement).value = '';
                                                        }
                                                    }
                                                }}
                                                disabled={isUploadingLogo}
                                                key={`logo-input-${Date.now()}`} // Force re-render with timestamp
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    const input = document.getElementById('companyLogo') as HTMLInputElement;
                                                    if (input) {
                                                        input.click();
                                                    }
                                                }}
                                                disabled={isUploadingLogo}
                                            >
                                                {isUploadingLogo ? 'Uploading...' : 'Choose File'}
                                            </Button>
                                        </div>
                                        {isUploadingLogo && (
                                            <p className="text-xs text-muted-foreground">Uploading...</p>
                                        )}
                                        <p className="text-xs text-muted-foreground">
                                            Select a new logo file (PNG, JPG, GIF, or WebP, max 5MB)
                                        </p>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Upload your company logo (PNG, JPG, or GIF). Recommended size: 200x200px. Logo will be used in email templates.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* General Settings Tab */}
                <TabsContent value="general" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-blue-500" />
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
                                <Calendar className="h-5 w-5 text-blue-500" />
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
                                                <Clock className="h-4 w-4 text-green-500" />
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
                                                <DollarSign className="h-4 w-4 text-pink-500" />
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
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="h-5 w-5 text-blue-500" />
                                Default Settings
                            </CardTitle>
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
                                    <Clock className="h-5 w-5 text-green-500" />
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
                                    <DollarSign className="h-5 w-5 text-pink-500" />
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

                {/* Reminders Tab */}
                <TabsContent value="reminders" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Mail className="h-5 w-5 text-pink-500" />
                                Reminder Settings
                            </CardTitle>
                            <CardDescription>
                                Configure when and how reminder emails are sent to clients
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="reminderHoursBefore">Send Reminder (Hours Before Appointment)</Label>
                                <div className="flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-muted-foreground" />
                                    <Input
                                        id="reminderHoursBefore"
                                        type="number"
                                        min="1"
                                        max="168"
                                        step="1"
                                        value={settings.reminderHoursBefore || 24}
                                        onChange={(e) => setSettings({ ...settings, reminderHoursBefore: parseInt(e.target.value) || 24 })}
                                        className="w-32"
                                    />
                                    <span className="text-sm text-muted-foreground">hours</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    How many hours before the appointment should reminder emails be sent? (Default: 24 hours)
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Mail className="h-5 w-5 text-pink-500" />
                                Email Reminder Template
                            </CardTitle>
                            <CardDescription>
                                Customize the email template sent to clients {settings.reminderHoursBefore || 24} hours before their appointments.
                                Use placeholders: {"{{clientName}}"}, {"{{dateTime}}"}, {"{{appointmentType}}"}, {"{{duration}}"}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="emailSubject">Email Subject</Label>
                                <Input
                                    id="emailSubject"
                                    value={settings.reminderEmailTemplate?.subject || ""}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        reminderEmailTemplate: {
                                            ...settings.reminderEmailTemplate,
                                            subject: e.target.value,
                                            htmlBody: settings.reminderEmailTemplate?.htmlBody || "",
                                            textBody: settings.reminderEmailTemplate?.textBody || "",
                                        }
                                    })}
                                    placeholder="Reminder: Your appointment tomorrow - {{date}}"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Available placeholders: {"{{date}}"}, {"{{clientName}}"}, {"{{appointmentType}}"}, {"{{duration}}"}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="emailHtmlBody">HTML Email Body</Label>
                                <Textarea
                                    id="emailHtmlBody"
                                    className="min-h-[300px] font-mono text-sm"
                                    value={settings.reminderEmailTemplate?.htmlBody || ""}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        reminderEmailTemplate: {
                                            ...settings.reminderEmailTemplate,
                                            subject: settings.reminderEmailTemplate?.subject || "",
                                            htmlBody: e.target.value,
                                            textBody: settings.reminderEmailTemplate?.textBody || "",
                                        }
                                    })}
                                    placeholder="HTML email template..."
                                />
                                <p className="text-xs text-muted-foreground">
                                    HTML version of the email. Use placeholders: {"{{clientName}}"}, {"{{dateTime}}"}, {"{{appointmentType}}"}, {"{{duration}}"}, {"{{date}}"}, {"{{logoUrl}}"} (logo will be automatically replaced with your app URL)
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="emailTextBody">Plain Text Email Body</Label>
                                <Textarea
                                    id="emailTextBody"
                                    className="min-h-[200px] font-mono text-sm"
                                    value={settings.reminderEmailTemplate?.textBody || ""}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        reminderEmailTemplate: {
                                            ...settings.reminderEmailTemplate,
                                            subject: settings.reminderEmailTemplate?.subject || "",
                                            htmlBody: settings.reminderEmailTemplate?.htmlBody || "",
                                            textBody: e.target.value,
                                        }
                                    })}
                                    placeholder="Plain text email template..."
                                />
                                <p className="text-xs text-muted-foreground">
                                    Plain text version (for email clients that don't support HTML). Use same placeholders.
                                </p>
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
                                <p className="text-sm font-semibold mb-2">Available Placeholders:</p>
                                <ul className="text-xs space-y-1 text-muted-foreground">
                                    <li><code>{"{{clientName}}"}</code> - Client's full name</li>
                                    <li><code>{"{{dateTime}}"}</code> - Formatted appointment date and time</li>
                                    <li><code>{"{{date}}"}</code> - Just the date portion</li>
                                    <li><code>{"{{appointmentType}}"}</code> - Type of appointment (e.g., "Therapy Session")</li>
                                    <li><code>{"{{duration}}"}</code> - Duration (e.g., "60 minutes")</li>
                                    <li><code>{"{{logoUrl}}"}</code> - Logo image URL (automatically replaced with your app's logo)</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Test Email */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Mail className="h-5 w-5 text-pink-500" />
                                Send Test Email
                            </CardTitle>
                            <CardDescription>
                                Send a test email to verify your template looks correct before it's used for reminders.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {testEmailMessage && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`p-4 rounded-lg flex items-center gap-2 ${
                                        testEmailMessage.type === 'success'
                                            ? 'bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-900'
                                            : 'bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-900'
                                    }`}
                                >
                                    {testEmailMessage.type === 'success' ? (
                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    ) : (
                                        <AlertCircle className="h-5 w-5 text-pink-500" />
                                    )}
                                    <span>{testEmailMessage.text}</span>
                                </motion.div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="testEmail">Test Email Address</Label>
                                <Input
                                    id="testEmail"
                                    type="email"
                                    placeholder="your-email@example.com"
                                    value={testEmailAddress}
                                    onChange={(e) => setTestEmailAddress(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Enter the email address where you want to receive the test email
                                </p>
                            </div>

                            <Button
                                onClick={async () => {
                                    if (!testEmailAddress) {
                                        setTestEmailMessage({
                                            type: 'error',
                                            text: 'Please enter an email address',
                                        });
                                        return;
                                    }

                                    setIsSendingTest(true);
                                    setTestEmailMessage(null);

                                    try {
                                        const response = await fetch('/api/reminders/test-email', {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                            },
                                            body: JSON.stringify({
                                                email: testEmailAddress,
                                                template: settings.reminderEmailTemplate,
                                            }),
                                        });

                                        const data = await response.json();

                                        if (response.ok) {
                                            setTestEmailMessage({
                                                type: 'success',
                                                text: `Test email sent successfully to ${testEmailAddress}! Check your inbox.`,
                                            });
                                            setTestEmailAddress('');
                                        } else {
                                            setTestEmailMessage({
                                                type: 'error',
                                                text: data.error || 'Failed to send test email',
                                            });
                                        }
                                    } catch (error: any) {
                                        setTestEmailMessage({
                                            type: 'error',
                                            text: `Error: ${error.message || 'Failed to send test email'}`,
                                        });
                                    } finally {
                                        setIsSendingTest(false);
                                    }
                                }}
                                disabled={isSendingTest || !testEmailAddress}
                                className="w-full"
                            >
                                {isSendingTest ? (
                                    <>
                                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                        Sending Test Email...
                                    </>
                                ) : (
                                    <>
                                        <Mail className="h-4 w-4 mr-2 text-pink-500" />
                                        Send Test Email
                                    </>
                                )}
                            </Button>
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
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : (
                                <AlertCircle className="h-5 w-5 text-pink-500" />
                            )}
                            <span>{backupMessage.text}</span>
                        </motion.div>
                    )}

                    {/* Data Backup */}
                    <Card className="border-2 border-primary">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Database className="h-5 w-5 text-purple-500" />
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
                                <Download className="mr-2 h-4 w-4 text-purple-500" />
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
                                <Upload className="h-5 w-5 text-purple-500" />
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
                                        <Upload className="h-4 w-4 text-purple-500" />
                                        {isRestoring ? 'Restoring...' : 'Upload Backup File'}
                                    </Label>
                                </div>
                                <div className="text-sm text-amber-600 dark:text-amber-400 flex items-start gap-2">
                                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-pink-500" />
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
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            Saved!
                        </>
                    ) : (
                        <>
                            <Save className="h-5 w-5 text-green-500" />
                            Save Settings
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
