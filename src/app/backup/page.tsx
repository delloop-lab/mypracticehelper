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
    FileArchive
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
                const data = await response.json();
                setMessage({ type: 'success', text: 'Backup created successfully!' });
                loadBackups();

                // Download the backup file
                const blob = new Blob([JSON.stringify(data.backup, null, 2)], { type: 'application/json' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `therapist-backup-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            } else {
                setMessage({ type: 'error', text: 'Failed to create backup' });
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
