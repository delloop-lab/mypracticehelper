"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Download,
    Upload,
    Database,
    Clock,
    CheckCircle2,
    AlertCircle,
    Trash2,
    FileArchive,
    RefreshCcw
} from "lucide-react";
import { motion } from "framer-motion";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface BackupMetadata {
    timestamp: string;
    size: number;
    clientsCount: number;
    appointmentsCount: number;
    notesCount: number;
    recordingsCount: number;
}

export default function BackupPage() {
    const [backups, setBackups] = useState<BackupMetadata[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [restoreConfirm, setRestoreConfirm] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        loadBackups();
    }, []);

    const loadBackups = async () => {
        try {
            const response = await fetch('/api/backup');
            if (response.ok) {
                const data = await response.json();
                setBackups(data.backups || []);
            }
        } catch (error) {
            console.error('Error loading backups:', error);
        }
    };

    const createBackup = async () => {
        setIsCreating(true);
        setMessage(null);
        try {
            const response = await fetch('/api/backup', {
                method: 'POST',
            });

            if (response.ok) {
                setMessage({ type: 'success', text: 'Backup created successfully!' });
                loadBackups();

                // Download the ZIP file
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `therapist-backup-${new Date().toISOString().split('T')[0]}.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Failed to create backup' }));
                setMessage({ type: 'error', text: errorData.error || 'Failed to create backup' });
            }
        } catch (error) {
            console.error('Error creating backup:', error);
            setMessage({ type: 'error', text: 'Error creating backup' });
        } finally {
            setIsCreating(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsRestoring(true);
        setMessage(null);

        try {
            const text = await file.text();
            const backupData = JSON.parse(text);

            const response = await fetch('/api/backup/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(backupData),
            });

            if (response.ok) {
                setMessage({ type: 'success', text: 'Backup restored successfully! Refreshing...' });
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                setMessage({ type: 'error', text: 'Failed to restore backup' });
            }
        } catch (error) {
            console.error('Error restoring backup:', error);
            setMessage({ type: 'error', text: 'Invalid backup file' });
        } finally {
            setIsRestoring(false);
            e.target.value = '';
        }
    };

    const deleteBackup = async (timestamp: string) => {
        try {
            const response = await fetch(`/api/backup?timestamp=${timestamp}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setMessage({ type: 'success', text: 'Backup deleted' });
                loadBackups();
            }
        } catch (error) {
            console.error('Error deleting backup:', error);
            setMessage({ type: 'error', text: 'Failed to delete backup' });
        }
    };

    const handleEmergencyFixAll = async () => {
        setIsRestoring(true);
        setMessage(null);
        try {
            const response = await fetch('/api/emergency-fix-all', {
                method: 'POST',
            });

            if (response.ok) {
                const data = await response.json();
                const results = data.results;
                let messageText = 'EMERGENCY FIX COMPLETED!\n\n';
                messageText += `Clients created: ${results.clients.created.join(', ') || 'none'}\n`;
                messageText += `Sessions fixed: ${results.sessions.fixed}\n`;
                messageText += `Session Notes fixed: ${results.sessionNotes.fixed}\n`;
                
                if (results.clients.errors.length > 0 || results.sessions.errors.length > 0 || results.sessionNotes.errors.length > 0) {
                    messageText += '\nErrors:\n';
                    if (results.clients.errors.length > 0) messageText += `Clients: ${results.clients.errors.join(', ')}\n`;
                    if (results.sessions.errors.length > 0) messageText += `Sessions: ${results.sessions.errors.join(', ')}\n`;
                    if (results.sessionNotes.errors.length > 0) messageText += `Notes: ${results.sessionNotes.errors.join(', ')}\n`;
                }
                
                setMessage({ type: 'success', text: messageText });
                setTimeout(() => {
                    window.location.href = '/clients';
                }, 3000);
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Failed to run emergency fix' }));
                setMessage({ type: 'error', text: errorData.error || 'Failed to run emergency fix' });
            }
        } catch (error) {
            console.error('Error running emergency fix:', error);
            setMessage({ type: 'error', text: 'Error running emergency fix' });
        } finally {
            setIsRestoring(false);
        }
    };

    const handleCleanupDuplicates = async () => {
        setIsRestoring(true);
        setMessage(null);
        try {
            const response = await fetch('/api/clients/cleanup-duplicates', {
                method: 'POST',
            });

            if (response.ok) {
                const data = await response.json();
                let messageText = 'DUPLICATE CLEANUP COMPLETED!\n\n';
                messageText += `Deleted ${data.deleted} duplicate clients\n`;
                messageText += `Reassigned ${data.sessionsReassigned} sessions\n`;
                messageText += `Reassigned ${data.notesReassigned} session notes\n\n`;
                
                if (data.duplicates && data.duplicates.length > 0) {
                    messageText += 'Duplicates cleaned:\n';
                    data.duplicates.forEach((d: any) => {
                        messageText += `- ${d.name}: Kept 1, deleted ${d.deleted}\n`;
                    });
                }
                
                setMessage({ type: 'success', text: messageText });
                setTimeout(() => {
                    window.location.href = '/clients';
                }, 3000);
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Failed to cleanup duplicates' }));
                setMessage({ type: 'error', text: errorData.error || 'Failed to cleanup duplicates' });
            }
        } catch (error) {
            console.error('Error cleaning up duplicates:', error);
            setMessage({ type: 'error', text: 'Error cleaning up duplicates' });
        } finally {
            setIsRestoring(false);
        }
    };

    const handleCreateClaire = async () => {
        setIsRestoring(true);
        setMessage(null);
        try {
            const response = await fetch('/api/clients/create-claire', {
                method: 'POST',
            });

            if (response.ok) {
                const data = await response.json();
                setMessage({ type: 'success', text: data.message || 'Claire Schillaci created successfully!' });
                setTimeout(() => {
                    window.location.href = '/clients';
                }, 2000);
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Failed to create Claire Schillaci' }));
                setMessage({ type: 'error', text: errorData.error || 'Failed to create Claire Schillaci' });
            }
        } catch (error) {
            console.error('Error creating Claire:', error);
            setMessage({ type: 'error', text: 'Error creating Claire Schillaci' });
        } finally {
            setIsRestoring(false);
        }
    };

    const handleFixRecordings = async () => {
        setIsRestoring(true);
        setMessage(null);
        try {
            const response = await fetch('/api/recordings/fix-assignments', {
                method: 'POST',
            });

            if (response.ok) {
                const data = await response.json();
                const results = data.results;
                let messageText = 'Recordings assignments fixed!\n';
                messageText += `Recordings fixed: ${results.fixed}\n`;
                messageText += `Errors: ${results.errors}\n`;
                messageText += `Skipped: ${results.skipped}\n`;
                
                if (results.details && results.details.fixed && results.details.fixed.length > 0) {
                    messageText += '\nFixed recordings:\n';
                    results.details.fixed.forEach((f: any) => {
                        messageText += `- ${f.id}: ${JSON.stringify(f.updates)}\n`;
                    });
                }
                
                if (results.details && results.details.errors && results.details.errors.length > 0) {
                    messageText += '\nErrors:\n';
                    results.details.errors.slice(0, 5).forEach((e: string) => {
                        messageText += `- ${e}\n`;
                    });
                }
                
                setMessage({ type: 'success', text: messageText });
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Failed to fix recordings' }));
                setMessage({ type: 'error', text: errorData.error || 'Failed to fix recordings' });
            }
        } catch (error) {
            console.error('Error fixing recordings:', error);
            setMessage({ type: 'error', text: 'Error fixing recordings' });
        } finally {
            setIsRestoring(false);
        }
    };

    const handleFixAssignments = async () => {
        setIsRestoring(true);
        setMessage(null);
        try {
            const response = await fetch('/api/fix-assignments', {
                method: 'POST',
            });

            if (response.ok) {
                const data = await response.json();
                const results = data.results;
                let messageText = 'Assignments fixed!\n';
                messageText += `Sessions fixed: ${results.sessionsFixed}\n`;
                messageText += `Session Notes fixed: ${results.notesFixed}\n`;
                
                if (results.sessionsErrors.length > 0 || results.notesErrors.length > 0) {
                    messageText += '\nErrors:\n';
                    if (results.sessionsErrors.length > 0) messageText += `Sessions: ${results.sessionsErrors.join(', ')}\n`;
                    if (results.notesErrors.length > 0) messageText += `Notes: ${results.notesErrors.join(', ')}\n`;
                }
                
                setMessage({ type: 'success', text: messageText });
                setTimeout(() => {
                    window.location.href = '/clients';
                }, 2000);
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Failed to fix assignments' }));
                setMessage({ type: 'error', text: errorData.error || 'Failed to fix assignments' });
            }
        } catch (error) {
            console.error('Error fixing assignments:', error);
            setMessage({ type: 'error', text: 'Error fixing assignments' });
        } finally {
            setIsRestoring(false);
        }
    };

    const handleRestoreAll = async () => {
        setIsRestoring(true);
        setMessage(null);
        try {
            const response = await fetch('/api/restore-all', {
                method: 'POST',
            });

            if (response.ok) {
                const data = await response.json();
                const results = data.results;
                let messageText = 'Restore completed!\n';
                messageText += `Clients: ${results.clients.restored.length} restored\n`;
                messageText += `Sessions: ${results.sessions.restored.length} restored\n`;
                messageText += `Session Notes: ${results.sessionNotes.restored.length} restored\n`;
                
                if (results.clients.errors.length > 0 || results.sessions.errors.length > 0 || results.sessionNotes.errors.length > 0) {
                    messageText += '\nErrors:\n';
                    if (results.clients.errors.length > 0) messageText += `Clients: ${results.clients.errors.join(', ')}\n`;
                    if (results.sessions.errors.length > 0) messageText += `Sessions: ${results.sessions.errors.join(', ')}\n`;
                    if (results.sessionNotes.errors.length > 0) messageText += `Notes: ${results.sessionNotes.errors.join(', ')}\n`;
                }
                
                setMessage({ type: 'success', text: messageText });
                setTimeout(() => {
                    window.location.reload();
                }, 3000);
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Failed to restore' }));
                setMessage({ type: 'error', text: errorData.error || 'Failed to restore data' });
            }
        } catch (error) {
            console.error('Error restoring data:', error);
            setMessage({ type: 'error', text: 'Error restoring data' });
        } finally {
            setIsRestoring(false);
        }
    };

    const formatDate = (timestamp: string) => {
        return new Date(timestamp).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2">Backup & Restore</h1>
                <p className="text-muted-foreground">
                    Protect your data by creating backups and restore when needed
                </p>
            </div>

            {/* Message Alert */}
            {message && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${message.type === 'success'
                            ? 'bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-900'
                            : 'bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-900'
                        }`}
                >
                    {message.type === 'success' ? (
                        <CheckCircle2 className="h-5 w-5" />
                    ) : (
                        <AlertCircle className="h-5 w-5" />
                    )}
                    <span>{message.text}</span>
                </motion.div>
            )}

            <div className="grid gap-6">
                {/* SUPER BACKUP - Data + Code */}
                <Card className="border-2 border-primary">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileArchive className="h-5 w-5 text-primary" />
                            SUPER BACKUP (Data + Code)
                        </CardTitle>
                        <CardDescription>
                            Complete backup including ALL data AND source code files. Use this for maximum protection!
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            onClick={async () => {
                                setIsCreating(true);
                                setMessage(null);
                                try {
                                    const response = await fetch('/api/backup/super', { method: 'POST' });
                                    if (response.ok) {
                                        const blob = await response.blob();
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `SUPER-BACKUP-${new Date().toISOString().split('T')[0]}.zip`;
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        window.URL.revokeObjectURL(url);
                                        setMessage({ type: 'success', text: 'SUPER BACKUP created successfully!' });
                                    } else {
                                        setMessage({ type: 'error', text: 'Failed to create SUPER BACKUP' });
                                    }
                                } catch (error) {
                                    console.error('Error creating SUPER BACKUP:', error);
                                    setMessage({ type: 'error', text: 'Error creating SUPER BACKUP' });
                                } finally {
                                    setIsCreating(false);
                                }
                            }}
                            disabled={isCreating}
                            size="lg"
                            className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                        >
                            <FileArchive className="mr-2 h-4 w-4" />
                            {isCreating ? 'Creating SUPER BACKUP...' : 'Create SUPER BACKUP (Data + Code)'}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2">
                            Includes: All data files + All source code (.tsx, .ts, .json, etc.)
                        </p>
                    </CardContent>
                </Card>

                {/* Create Backup */}
                <Card>
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
                            onClick={createBackup}
                            disabled={isCreating}
                            size="lg"
                            className="w-full sm:w-auto"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            {isCreating ? 'Creating Backup...' : 'Create & Download Data Backup'}
                        </Button>
                    </CardContent>
                </Card>

                {/* CLEANUP DUPLICATES */}
                <Card className="border-4 border-purple-600 bg-purple-100 dark:bg-purple-950/40">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-purple-800 dark:text-purple-300 text-xl">
                            <AlertCircle className="h-6 w-6" />
                            🧹 CLEANUP DUPLICATES 🧹
                        </CardTitle>
                        <CardDescription className="text-purple-700 dark:text-purple-400 text-base">
                            Remove duplicate clients (like multiple Claire Schillaci entries). Keeps the one with most data and reassigns sessions/notes.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            onClick={handleCleanupDuplicates}
                            disabled={isRestoring}
                            size="lg"
                            className="w-full bg-purple-700 hover:bg-purple-800 text-white text-lg py-6"
                        >
                            <AlertCircle className="mr-2 h-5 w-5" />
                            {isRestoring ? 'CLEANING UP...' : '🧹 CLEANUP DUPLICATE CLIENTS 🧹'}
                        </Button>
                        <p className="text-sm text-purple-700 dark:text-purple-400 mt-3 font-semibold">
                            This will:
                        </p>
                        <ul className="text-xs text-purple-600 dark:text-purple-300 mt-2 list-disc list-inside space-y-1">
                            <li>Find all duplicate clients (same name)</li>
                            <li>Keep the one with most complete data</li>
                            <li>Reassign all sessions to the kept client</li>
                            <li>Reassign all session notes to the kept client</li>
                            <li>Delete duplicate entries</li>
                        </ul>
                    </CardContent>
                </Card>

                {/* EMERGENCY FIX ALL - Comprehensive Recovery */}
                <Card className="border-4 border-red-600 bg-red-100 dark:bg-red-950/40">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-300 text-xl">
                            <AlertCircle className="h-6 w-6" />
                            🚨 EMERGENCY FIX ALL 🚨
                        </CardTitle>
                        <CardDescription className="text-red-700 dark:text-red-400 text-base">
                            COMPREHENSIVE FIX: Creates missing clients, restores all sessions, fixes all assignments, links everything properly
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            onClick={handleEmergencyFixAll}
                            disabled={isRestoring}
                            size="lg"
                            className="w-full bg-red-700 hover:bg-red-800 text-white text-lg py-6"
                        >
                            <AlertCircle className="mr-2 h-5 w-5" />
                            {isRestoring ? 'FIXING EVERYTHING...' : '🚨 RUN EMERGENCY FIX ALL 🚨'}
                        </Button>
                        <p className="text-sm text-red-700 dark:text-red-400 mt-3 font-semibold">
                            This will:
                        </p>
                        <ul className="text-xs text-red-600 dark:text-red-300 mt-2 list-disc list-inside space-y-1">
                            <li>Create Claire Schillaci if missing</li>
                            <li>Restore all sessions from backup</li>
                            <li>Fix all unassigned sessions</li>
                            <li>Fix all unassigned session notes</li>
                            <li>Link everything to correct clients</li>
                        </ul>
                    </CardContent>
                </Card>

                {/* CREATE CLAIRE SCHILLACI */}
                <Card className="border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                            <AlertCircle className="h-5 w-5" />
                            CREATE CLAIRE SCHILLACI
                        </CardTitle>
                        <CardDescription className="text-blue-600 dark:text-blue-300">
                            Claire Schillaci is missing from the clients list. Click to create her as a new client.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            onClick={handleCreateClaire}
                            disabled={isRestoring}
                            size="lg"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            <Clock className="mr-2 h-4 w-4" />
                            {isRestoring ? 'Creating...' : 'CREATE CLAIRE SCHILLACI'}
                        </Button>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                            This will create Claire Schillaci as a new client (email: claire@claireschillaci.com)
                        </p>
                    </CardContent>
                </Card>

                {/* FIX RECORDINGS - Link Recordings to Clients and Sessions */}
                <Card className="border-2 border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
                            <AlertCircle className="h-5 w-5" />
                            FIX RECORDINGS - Link Recordings to Clients & Sessions
                        </CardTitle>
                        <CardDescription className="text-indigo-600 dark:text-indigo-300">
                            Fix missing client_id and session_id for recordings. Matches by client name in transcript/title and date.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            onClick={handleFixRecordings}
                            disabled={isRestoring}
                            size="lg"
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            {isRestoring ? 'Fixing Recordings...' : 'FIX RECORDINGS ASSIGNMENTS'}
                        </Button>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2">
                            This will attempt to assign recordings to clients (by name matching) and sessions (by date matching).
                        </p>
                    </CardContent>
                </Card>

                {/* FIX ASSIGNMENTS - Link Sessions and Notes to Clients */}
                <Card className="border-2 border-orange-500 bg-orange-50 dark:bg-orange-950/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                            <AlertCircle className="h-5 w-5" />
                            FIX ASSIGNMENTS - Link Sessions & Notes to Clients
                        </CardTitle>
                        <CardDescription className="text-orange-600 dark:text-orange-300">
                            If sessions or session notes show as "Unassigned", click this button to link them to the correct clients
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            onClick={handleFixAssignments}
                            disabled={isRestoring}
                            size="lg"
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                        >
                            <Clock className="mr-2 h-4 w-4" />
                            {isRestoring ? 'Fixing Assignments...' : 'FIX SESSIONS & NOTES ASSIGNMENTS'}
                        </Button>
                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                            This will match sessions and notes to clients by name from backup files
                        </p>
                    </CardContent>
                </Card>

                {/* EMERGENCY RESTORE - Restore from Local Backup Files */}
                <Card className="border-2 border-red-500 bg-red-50 dark:bg-red-950/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                            <AlertCircle className="h-5 w-5" />
                            EMERGENCY RESTORE - Restore Deleted Data
                        </CardTitle>
                        <CardDescription className="text-red-600 dark:text-red-300">
                            Restore all deleted clients, sessions, and session notes from local backup files (data/clients.json, data/appointments.json, data/session-notes.json)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            onClick={handleRestoreAll}
                            disabled={isRestoring}
                            size="lg"
                            className="w-full bg-red-600 hover:bg-red-700 text-white"
                        >
                            <Clock className="mr-2 h-4 w-4" />
                            {isRestoring ? 'Restoring All Data...' : 'RESTORE ALL DELETED DATA'}
                        </Button>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                            This will restore: Clients (Gary Dog, Lilly Schillaci, Arni), Sessions, and Session Notes from backup files
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

                {/* Backup History */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-primary" />
                            Backup History
                        </CardTitle>
                        <CardDescription>
                            Recent backups created on this device
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {backups.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <FileArchive className="h-12 w-12 mx-auto mb-2 opacity-20" />
                                <p>No backups found</p>
                                <p className="text-sm">Create your first backup to get started</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {backups.map((backup, index) => (
                                    <motion.div
                                        key={backup.timestamp}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Database className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium">{formatDate(backup.timestamp)}</span>
                                            </div>
                                            <div className="text-sm text-muted-foreground flex flex-wrap gap-3">
                                                <span>{backup.clientsCount} clients</span>
                                                <span>•</span>
                                                <span>{backup.appointmentsCount} appointments</span>
                                                <span>•</span>
                                                <span>{backup.notesCount} notes</span>
                                                <span>•</span>
                                                <span>{formatSize(backup.size)}</span>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                            onClick={() => deleteBackup(backup.timestamp)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Restore Confirmation Dialog */}
            <Dialog open={!!restoreConfirm} onOpenChange={(open) => !open && setRestoreConfirm(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Restore</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to restore this backup? All current data will be replaced.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRestoreConfirm(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={() => {
                            // Handle restore
                            setRestoreConfirm(null);
                        }}>
                            Restore Backup
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
