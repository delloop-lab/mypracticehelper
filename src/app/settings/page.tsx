"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Calendar, DollarSign, Clock, Save, CheckCircle2, Database, Download, Upload, AlertCircle, User, Mail, Plus, Trash2, Edit, FileText, ClipboardCheck, Landmark, Loader2 } from "lucide-react";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { motion } from "framer-motion";
import Link from "next/link";
import { EmailTab } from "@/components/email-tab";

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
    companyName?: string;
    companyLogo?: string; // Path or URL to company logo
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
    const [userEmail, setUserEmail] = useState<string>("");
    const [editedEmail, setEditedEmail] = useState<string>("");
    const [emailSaveStatus, setEmailSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [firstName, setFirstName] = useState<string>("");
    const [lastName, setLastName] = useState<string>("");
    const [isUploadingLogo, setIsUploadingLogo] = useState<boolean>(false);
    const [customReminderTemplates, setCustomReminderTemplates] = useState<any[]>([]);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
    const [deleteAppointmentTypeConfirm, setDeleteAppointmentTypeConfirm] = useState<{ isOpen: boolean; index: number | null; name: string }>({ isOpen: false, index: null, name: "" });
    const [isTestingReminders, setIsTestingReminders] = useState(false);
    const [testRemindersMessage, setTestRemindersMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [newTemplateTitle, setNewTemplateTitle] = useState("");
    const [newTemplateDescription, setNewTemplateDescription] = useState("");
    const [newTemplateDays, setNewTemplateDays] = useState<number>(30);
    const [selectedTemplateType, setSelectedTemplateType] = useState<string>("");
    const [isAddingTemplate, setIsAddingTemplate] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<any>(null);
    const [editTemplateTitle, setEditTemplateTitle] = useState("");
    const [editTemplateDescription, setEditTemplateDescription] = useState("");
    const [editTemplateDays, setEditTemplateDays] = useState<number>(30);
    const [editingFrequencyTemplateId, setEditingFrequencyTemplateId] = useState<string | null>(null);

    useEffect(() => {
        loadSettings();
        // Load custom reminder templates
        const loadTemplates = async () => {
            setIsLoadingTemplates(true);
            try {
                const response = await fetch('/api/custom-reminder-templates');
                if (response.ok) {
                    const data = await response.json();
                    
                    // Check if default templates exist, if not create them
                    const hasNewClientForm = data.some((t: any) => 
                        t.condition_type === 'new_client_form' || 
                        t.title?.toLowerCase().includes('new client form')
                    );
                    const hasSessionNotes = data.some((t: any) => 
                        t.condition_type === 'session_notes' || 
                        t.title?.toLowerCase().includes('session') && t.title?.toLowerCase().includes('note')
                    );
                    
                    // Create default templates if they don't exist
                    const templatesToCreate = [];
                    if (!hasNewClientForm) {
                        templatesToCreate.push({
                            title: "New Client Form Required",
                            description: "Remind user to have New Client Forms ready for new clients to sign",
                            conditionType: 'new_client_form',
                            conditionConfig: { field: 'new_client_form_signed', value: false },
                            frequency: 'daily',
                            isEnabled: true
                        });
                    }
                    if (!hasSessionNotes) {
                        templatesToCreate.push({
                            title: "Session Awaiting Notes",
                            description: "Remind user about past sessions that need clinical documentation",
                            conditionType: 'session_notes',
                            conditionConfig: { checkPastSessions: true, requireNotes: true },
                            frequency: 'daily',
                            isEnabled: true
                        });
                    }
                    
                    // Create missing templates
                    for (const template of templatesToCreate) {
                        try {
                            const createResponse = await fetch('/api/custom-reminder-templates', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(template)
                            });
                            if (createResponse.ok) {
                                const newTemplate = await createResponse.json();
                                data.push(newTemplate);
                            }
                        } catch (error) {
                            console.error('Error creating default template:', error);
                        }
                    }
                    
                    setCustomReminderTemplates(data);
                }
            } catch (error) {
                console.error('Error loading templates:', error);
            } finally {
                setIsLoadingTemplates(false);
            }
        };
        loadTemplates();
        
        if (typeof window !== "undefined") {
            setBaseUrl(window.location.origin);
            // Get user email from localStorage or cookie
            const email = localStorage.getItem("userEmail") || 
                         document.cookie.split('; ').find(row => row.startsWith('userEmail='))?.split('=')[1] || 
                         "";
            setUserEmail(email);
            setEditedEmail(email);
            
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
            console.log('[Settings] loadSettings called - fetching from API');
            const response = await fetch(`/api/settings?t=${Date.now()}`); // Add cache-busting
            console.log('[Settings] loadSettings response status:', response.status);
            console.log('[Settings] loadSettings response ok:', response.ok);
            
            if (response.ok) {
                const data = await response.json();
                console.log('[Settings] loadSettings received data');
                console.log('[Settings] loadSettings appointment types count:', data.appointmentTypes?.length || 0);
                console.log('[Settings] loadSettings appointment types:', data.appointmentTypes);
                console.log('[Settings] loadSettings setting state with data');
                console.log('[Settings] loadSettings data.appointmentTypes:', data.appointmentTypes);
                setSettings(data);
                console.log('[Settings] loadSettings state updated');
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    };

    const saveSettings = async () => {
        console.log('[Settings] saveSettings called');
        console.log('[Settings] Current settings to save:', settings);
        console.log('[Settings] Appointment types to save:', settings.appointmentTypes);
        console.log('[Settings] Appointment types count:', settings.appointmentTypes.length);
        
        setSaveStatus("saving");
        try {
            const requestBody = JSON.stringify(settings);
            console.log('[Settings] Request body length:', requestBody.length);
            console.log('[Settings] Request body preview:', requestBody.substring(0, 500));
            
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: requestBody,
            });

            console.log('[Settings] API Response status:', response.status);
            console.log('[Settings] API Response ok:', response.ok);

            if (response.ok) {
                const responseData = await response.json().catch(() => ({}));
                console.log('[Settings] API Response data:', responseData);
                console.log('[Settings] Save successful!');
                setSaveStatus("saved");
                setTimeout(() => setSaveStatus("idle"), 2000);
            } else {
                // Handle error response
                const errorData = await response.json().catch(() => ({ error: 'Failed to save settings' }));
                console.error('[Settings] API Error Response:', errorData);
                console.error('[Settings] Response status:', response.status);
                console.error('[Settings] Response statusText:', response.statusText);
                alert(`Failed to save settings: ${errorData.error || 'Unknown error'}\n\n${errorData.requiresMigration ? 'Please run the database migration to create your user account.' : ''}`);
                setSaveStatus("idle");
            }
        } catch (error) {
            console.error('[Settings] Exception caught:', error);
            console.error('[Settings] Error type:', error instanceof Error ? error.constructor.name : typeof error);
            console.error('[Settings] Error message:', error instanceof Error ? error.message : String(error));
            console.error('[Settings] Error stack:', error instanceof Error ? error.stack : 'No stack');
            alert(`Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setSaveStatus("idle");
        }
    };

    const handleSaveEmail = async () => {
        if (!editedEmail || editedEmail === userEmail) return;
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(editedEmail)) {
            setEmailSaveStatus("error");
            setTimeout(() => setEmailSaveStatus("idle"), 3000);
            return;
        }

        setEmailSaveStatus("saving");
        try {
            // Update cookies
            const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
            document.cookie = `userEmail=${encodeURIComponent(editedEmail)}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;
            
            // Update localStorage
            localStorage.setItem("userEmail", editedEmail);
            
            // Store allowed emails list (for login validation)
            const allowedEmails = JSON.parse(localStorage.getItem("allowedEmails") || "[]");
            if (!allowedEmails.includes(editedEmail)) {
                allowedEmails.push(editedEmail);
                localStorage.setItem("allowedEmails", JSON.stringify(allowedEmails));
            }
            
            // Update state
            setUserEmail(editedEmail);
            setEmailSaveStatus("saved");
            setTimeout(() => setEmailSaveStatus("idle"), 3000);
        } catch (error) {
            console.error('Error saving email:', error);
            setEmailSaveStatus("error");
            setTimeout(() => setEmailSaveStatus("idle"), 3000);
        }
    };

    const updateAppointmentType = (index: number, field: keyof AppointmentTypeSettings, value: any) => {
        console.log('[Settings] updateAppointmentType called:', { index, field, value });
        console.log('[Settings] Current appointmentTypes:', settings.appointmentTypes);
        
        const updated = [...settings.appointmentTypes];
        const oldValue = updated[index][field];
        updated[index] = { ...updated[index], [field]: value };
        
        console.log('[Settings] Updated appointmentTypes:', updated);
        console.log('[Settings] Change:', { index, field, oldValue, newValue: value });
        
        setSettings({ ...settings, appointmentTypes: updated });
        console.log('[Settings] State updated. New settings.appointmentTypes:', settings.appointmentTypes);
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
                <TabsList className="grid w-full grid-cols-7 max-w-5xl">
                    <TabsTrigger value="profile">Profile</TabsTrigger>
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="appointments">Appointments</TabsTrigger>
                    <TabsTrigger value="defaults">Defaults</TabsTrigger>
                    <TabsTrigger value="reminders">Reminders</TabsTrigger>
                    <TabsTrigger value="email">Email</TabsTrigger>
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
                                <div className="flex gap-2">
                                    <Input
                                        id="userEmail"
                                        type="email"
                                        value={editedEmail}
                                        onChange={(e) => setEditedEmail(e.target.value)}
                                        placeholder="your@email.com"
                                        className="flex-1"
                                    />
                                    <Button
                                        type="button"
                                        onClick={handleSaveEmail}
                                        disabled={editedEmail === userEmail || emailSaveStatus === "saving" || !editedEmail}
                                        variant={editedEmail === userEmail ? "outline" : "default"}
                                    >
                                        {emailSaveStatus === "saving" ? "Saving..." : emailSaveStatus === "saved" ? "Saved!" : "Save"}
                                    </Button>
                                </div>
                                {emailSaveStatus === "saved" && (
                                    <p className="text-xs text-green-600 flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Email updated successfully. You can now log in with your new email address.
                                    </p>
                                )}
                                {emailSaveStatus === "error" && (
                                    <p className="text-xs text-red-600 flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        Failed to update email. Please try again.
                                    </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    Your email address used for login. You can change this and use the new email to log in.
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
                                    key={`appointment-type-${originalIndex}`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: displayIndex * 0.05 }}
                                    className="p-4 rounded-lg border bg-card"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex-1 mr-4">
                                            <Label htmlFor={`name-${displayIndex}`} className="text-xs mb-1 block">
                                                Name
                                            </Label>
                                            <Input
                                                id={`name-${displayIndex}`}
                                                value={type.name}
                                                onChange={(e) => updateAppointmentType(originalIndex, 'name', e.target.value)}
                                                className="font-semibold"
                                            />
                                        </div>
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
                                                    // Prevent deletion if only one appointment type remains
                                                    if (settings.appointmentTypes.length <= 1) {
                                                        alert('You must have at least one appointment type. Please add another before deleting this one.');
                                                        return;
                                                    }
                                                    setDeleteAppointmentTypeConfirm({ isOpen: true, index: originalIndex, name: type.name });
                                                }}
                                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
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
                                    <Landmark className="h-5 w-5 text-pink-500" />
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
                    {/* Test Reminders Button */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-blue-500" />
                                Test Reminders
                            </CardTitle>
                            <CardDescription>
                                Manually trigger the reminder system to check for clients matching your reminder templates.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {testRemindersMessage && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`p-4 rounded-lg flex items-center gap-2 ${
                                        testRemindersMessage.type === 'success'
                                            ? 'bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-900'
                                            : 'bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-900'
                                    }`}
                                >
                                    {testRemindersMessage.type === 'success' ? (
                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    ) : (
                                        <AlertCircle className="h-5 w-5 text-red-500" />
                                    )}
                                    <span>{testRemindersMessage.text}</span>
                                </motion.div>
                            )}
                            <Button
                                onClick={async () => {
                                    setIsTestingReminders(true);
                                    setTestRemindersMessage(null);

                                    try {
                                        const response = await fetch('/api/cron/admin-reminders', {
                                            method: 'GET',
                                            credentials: 'include',
                                        });

                                        const data = await response.json();

                                        if (response.ok) {
                                            setTestRemindersMessage({
                                                type: 'success',
                                                text: `Reminders processed successfully! Check the Reminders page to see results. Processed ${data.usersProcessed || 0} users.`,
                                            });
                                        } else {
                                            setTestRemindersMessage({
                                                type: 'error',
                                                text: data.error || 'Failed to test reminders',
                                            });
                                        }
                                    } catch (error: any) {
                                        setTestRemindersMessage({
                                            type: 'error',
                                            text: `Error: ${error.message || 'Failed to test reminders. Make sure your dev server is running.'}`,
                                        });
                                    } finally {
                                        setIsTestingReminders(false);
                                    }
                                }}
                                disabled={isTestingReminders}
                                className="w-full"
                            >
                                {isTestingReminders ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Testing Reminders...
                                    </>
                                ) : (
                                    <>
                                        <AlertCircle className="h-4 w-4 mr-2" />
                                        Test Reminders Now
                                    </>
                                )}
                            </Button>
                            <p className="text-xs text-muted-foreground">
                                This will check all your active reminder templates and create reminders for matching clients. Go to the Reminders page to see the results.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Custom Reminder Templates */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-orange-500" />
                                Custom Reminder Templates
                            </CardTitle>
                            <CardDescription>
                                Create custom reminders that check conditions daily and remind you until completed.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Existing Templates */}
                            {isLoadingTemplates ? (
                                <p className="text-sm text-muted-foreground">Loading templates...</p>
                            ) : customReminderTemplates.length > 0 ? (
                                <div className="space-y-3">
                                    <h4 className="font-medium text-sm">Your Active Reminders</h4>
                                    <div className="space-y-2">
                                        {customReminderTemplates.map((template) => (
                                            <div
                                                key={template.id}
                                                className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                                            >
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-medium">{template.title}</h4>
                                                        {template.is_enabled ? (
                                                            <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                                                                Active
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
                                                                Disabled
                                                            </span>
                                                        )}
                                                    </div>
                                                    {template.description && (
                                                        <p className="text-sm text-muted-foreground mt-1">
                                                            {template.description}
                                                        </p>
                                                    )}
                                                    {template.condition_config?.days && (
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            Days: {template.condition_config.days}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs text-muted-foreground">Frequency:</span>
                                                        {editingFrequencyTemplateId === template.id ? (
                                                            <Select
                                                                value={template.frequency || 'daily'}
                                                                onValueChange={async (value: 'daily' | 'weekly' | 'monthly') => {
                                                                    try {
                                                                        const response = await fetch('/api/custom-reminder-templates', {
                                                                            method: 'PUT',
                                                                            headers: { 'Content-Type': 'application/json' },
                                                                            body: JSON.stringify({
                                                                                id: template.id,
                                                                                frequency: value
                                                                            })
                                                                        });
                                                                        if (response.ok) {
                                                                            const updatedTemplate = await response.json();
                                                                            setCustomReminderTemplates(customReminderTemplates.map(t =>
                                                                                t.id === template.id ? updatedTemplate : t
                                                                            ));
                                                                            setEditingFrequencyTemplateId(null);
                                                                        }
                                                                    } catch (error) {
                                                                        console.error('Error updating frequency:', error);
                                                                    }
                                                                }}
                                                                onOpenChange={(open) => {
                                                                    if (!open) {
                                                                        setEditingFrequencyTemplateId(null);
                                                                    }
                                                                }}
                                                            >
                                                                <SelectTrigger className="h-7 w-24 text-xs">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="daily">Daily</SelectItem>
                                                                    <SelectItem value="weekly">Weekly</SelectItem>
                                                                    <SelectItem value="monthly">Monthly</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        ) : (
                                                            <span 
                                                                className="text-xs text-muted-foreground capitalize cursor-pointer hover:text-foreground"
                                                                onClick={() => setEditingFrequencyTemplateId(template.id)}
                                                            >
                                                                {template.frequency || 'daily'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setEditingTemplate(template);
                                                        setEditTemplateTitle(template.title);
                                                        setEditTemplateDescription(template.description || "");
                                                        setEditTemplateDays(template.condition_config?.days || 30);
                                                        setIsAddingTemplate(false);
                                                        setSelectedTemplateType("");
                                                    }}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={async () => {
                                                        const newStatus = !template.is_enabled;
                                                        try {
                                                            const response = await fetch('/api/custom-reminder-templates', {
                                                                method: 'PUT',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                    id: template.id,
                                                                    isEnabled: newStatus
                                                                })
                                                            });
                                                            if (response.ok) {
                                                                setCustomReminderTemplates(customReminderTemplates.map(t =>
                                                                    t.id === template.id ? { ...t, is_enabled: newStatus } : t
                                                                ));
                                                            }
                                                        } catch (error) {
                                                            console.error('Error updating template:', error);
                                                        }
                                                    }}
                                                >
                                                    {template.is_enabled ? 'Disable' : 'Enable'}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={async () => {
                                                        if (confirm('Are you sure you want to delete this reminder template?')) {
                                                            try {
                                                                const response = await fetch(`/api/custom-reminder-templates?id=${template.id}`, {
                                                                    method: 'DELETE'
                                                                });
                                                                if (response.ok) {
                                                                    setCustomReminderTemplates(customReminderTemplates.filter(t => t.id !== template.id));
                                                                }
                                                            } catch (error) {
                                                                console.error('Error deleting template:', error);
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : null}

                            {/* Edit Template Form */}
                            {editingTemplate && (
                                <div className="pt-4 border-t space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-medium">Edit Reminder</h4>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setEditingTemplate(null);
                                                setEditTemplateTitle("");
                                                setEditTemplateDescription("");
                                                setEditTemplateDays(30);
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <Label htmlFor="editTemplateTitle">Reminder Title</Label>
                                            <Input
                                                id="editTemplateTitle"
                                                value={editTemplateTitle}
                                                onChange={(e) => setEditTemplateTitle(e.target.value)}
                                                placeholder="Enter reminder title"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="editTemplateDescription">Description</Label>
                                            <Textarea
                                                id="editTemplateDescription"
                                                value={editTemplateDescription}
                                                onChange={(e) => setEditTemplateDescription(e.target.value)}
                                                placeholder="Describe what this reminder will do"
                                                rows={3}
                                            />
                                        </div>
                                        {editingTemplate?.condition_type === 'clients_not_seen' && (
                                            <div className="space-y-2">
                                                <Label htmlFor="editTemplateDays">Days Since Last Session</Label>
                                                <Input
                                                    id="editTemplateDays"
                                                    type="number"
                                                    min="1"
                                                    max="365"
                                                    value={editTemplateDays}
                                                    onChange={(e) => setEditTemplateDays(parseInt(e.target.value) || 30)}
                                                    placeholder="30"
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    Remind about clients who haven't had a session in this many days
                                                </p>
                                            </div>
                                        )}
                                        <Button
                                            onClick={async () => {
                                                if (!editTemplateTitle.trim()) {
                                                    alert('Please enter a title');
                                                    return;
                                                }
                                                try {
                                                    let conditionConfig = editingTemplate.condition_config || {};
                                                    if (editingTemplate.condition_type === 'clients_not_seen') {
                                                        conditionConfig = { ...conditionConfig, days: editTemplateDays };
                                                    }
                                                    
                                                    const response = await fetch('/api/custom-reminder-templates', {
                                                        method: 'PUT',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            id: editingTemplate.id,
                                                            title: editTemplateTitle,
                                                            description: editTemplateDescription,
                                                            conditionConfig: conditionConfig
                                                        })
                                                    });
                                                    if (response.ok) {
                                                        const updatedTemplate = await response.json();
                                                        setCustomReminderTemplates(customReminderTemplates.map(t =>
                                                            t.id === editingTemplate.id ? updatedTemplate : t
                                                        ));
                                                        setEditingTemplate(null);
                                                        setEditTemplateTitle("");
                                                        setEditTemplateDescription("");
                                                    } else {
                                                        const errorData = await response.json().catch(() => ({}));
                                                        alert(errorData.error || 'Failed to update template');
                                                    }
                                                } catch (error) {
                                                    console.error('Error updating template:', error);
                                                    alert('Error updating template');
                                                }
                                            }}
                                            disabled={!editTemplateTitle.trim()}
                                            className="w-full"
                                        >
                                            <Save className="h-4 w-4 mr-2" />
                                            Save Changes
                                        </Button>
                                    </div>
                                </div>
                            )}

                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Email Tab */}
                <TabsContent value="email" className="space-y-4">
                    <EmailTab />
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

            {/* Delete Appointment Type Confirmation Dialog */}
            <DeleteConfirmationDialog
                open={deleteAppointmentTypeConfirm.isOpen}
                onOpenChange={(open) => setDeleteAppointmentTypeConfirm({ isOpen: open, index: deleteAppointmentTypeConfirm.index, name: deleteAppointmentTypeConfirm.name })}
                onConfirm={async () => {
                    if (deleteAppointmentTypeConfirm.index === null) return;
                    
                    const updated = settings.appointmentTypes.filter((_, i) => i !== deleteAppointmentTypeConfirm.index);
                    setSettings({ ...settings, appointmentTypes: updated });
                    setDeleteAppointmentTypeConfirm({ isOpen: false, index: null, name: "" });
                    
                    // Auto-save after deletion
                    try {
                        const updatedSettings = { ...settings, appointmentTypes: updated };
                        const response = await fetch('/api/settings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(updatedSettings),
                        });

                        if (response.ok) {
                            setSaveStatus("saved");
                            setTimeout(() => setSaveStatus("idle"), 2000);
                        } else {
                            console.error('Failed to save settings after deletion');
                            alert('Appointment type deleted locally, but failed to save. Please click Save to persist changes.');
                        }
                    } catch (error) {
                        console.error('Error saving settings after deletion:', error);
                        alert('Appointment type deleted locally, but failed to save. Please click Save to persist changes.');
                    }
                }}
                title="Delete Appointment Type"
                description={`Are you sure you want to delete "${deleteAppointmentTypeConfirm.name}"? This will remove it from your appointment types. Existing appointments using this type will not be affected.`}
                itemName={deleteAppointmentTypeConfirm.name}
            />
        </div>
    );
}
