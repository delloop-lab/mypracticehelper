"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Archive, RotateCcw, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { GDPRDeleteDialog } from "@/components/ui/gdpr-delete-dialog";

interface Client {
    id: string;
    name: string;
    email: string;
    phone: string;
    archived: boolean;
    archivedAt?: string;
}

export default function ArchivedClientsPage() {
    const router = useRouter();
    const [archivedClients, setArchivedClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean, clientId: string | null }>({ isOpen: false, clientId: null });
    const [gdprDeleteOpen, setGdprDeleteOpen] = useState(false);
    const [gdprDeleteClientId, setGdprDeleteClientId] = useState<string | null>(null);
    const [restoringClientId, setRestoringClientId] = useState<string | null>(null);

    useEffect(() => {
        loadArchivedClients();
    }, []);

    const loadArchivedClients = async () => {
        try {
            const response = await fetch('/api/clients?archived=true');
            if (response.ok) {
                const data = await response.json();
                setArchivedClients(data);
            }
        } catch (error) {
            console.error('Error loading archived clients:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestore = async (id: string) => {
        setRestoringClientId(id);
        try {
            const response = await fetch('/api/clients/archive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, restore: true }),
            });

            if (response.ok) {
                await loadArchivedClients();
                // Navigate back to clients page
                router.push('/clients');
            } else {
                alert('Failed to restore client');
            }
        } catch (error) {
            console.error('Error restoring client:', error);
            alert('Error restoring client');
        } finally {
            setRestoringClientId(null);
        }
    };

    const handleDeleteClick = (id: string) => {
        setDeleteConfirmation({ isOpen: true, clientId: id });
    };

    const handleGDPRDeleteClick = (id: string) => {
        setGdprDeleteClientId(id);
        setGdprDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (deleteConfirmation.clientId) {
            try {
                const response = await fetch(`/api/clients/gdpr-delete?id=${deleteConfirmation.clientId}`, {
                    method: 'DELETE',
                });
                if (response.ok) {
                    await loadArchivedClients();
                    setDeleteConfirmation({ isOpen: false, clientId: null });
                } else {
                    alert('Failed to delete client');
                }
            } catch (error) {
                console.error('Error deleting client:', error);
                alert('Error deleting client');
            }
        }
    };

    const confirmGDPRDelete = async () => {
        if (gdprDeleteClientId) {
            try {
                const response = await fetch(`/api/clients/gdpr-delete?id=${gdprDeleteClientId}`, {
                    method: 'DELETE',
                });
                if (response.ok) {
                    await loadArchivedClients();
                    setGdprDeleteOpen(false);
                    setGdprDeleteClientId(null);
                } else {
                    alert('Failed to delete client');
                }
            } catch (error) {
                console.error('Error deleting client:', error);
                alert('Error deleting client');
            }
        }
    };

    const getClientName = (client: Client) => {
        return client.name || 'Unknown Client';
    };

    if (isLoading) {
        return (
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                <Card>
                    <CardContent className="py-16 text-center">
                        <p className="text-muted-foreground">Loading archived clients...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-7xl">
            <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">Archived Clients</h1>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        Clients with session notes are archived for audit purposes. You can restore them or permanently delete them.
                    </p>
                </div>
                <Button variant="outline" onClick={() => router.push('/clients')}>
                    Back to Clients
                </Button>
            </div>

            {archivedClients.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <User className="h-16 w-16 text-muted-foreground mb-4 opacity-20" />
                        <h3 className="text-lg font-medium text-muted-foreground">No Archived Clients Yet</h3>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {archivedClients.map((client, index) => (
                        <motion.div
                            key={client.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <Card className="opacity-75 border-orange-200 dark:border-orange-800">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                <h3 className="font-semibold text-sm">{getClientName(client)}</h3>
                                            </div>
                                            {client.email && (
                                                <p className="text-xs text-muted-foreground">{client.email}</p>
                                            )}
                                            {client.phone && (
                                                <p className="text-xs text-muted-foreground">{client.phone}</p>
                                            )}
                                            {client.archivedAt && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Archived: {new Date(client.archivedAt).toLocaleDateString()}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-4">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="flex-1"
                                            onClick={() => handleRestore(client.id)}
                                            disabled={restoringClientId === client.id}
                                        >
                                            <RotateCcw className="mr-2 h-3 w-3" />
                                            Restore
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            className="flex-1"
                                            onClick={() => handleDeleteClick(client.id)}
                                        >
                                            <Trash2 className="mr-2 h-3 w-3" />
                                            Delete
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            className="bg-red-700 hover:bg-red-800"
                                            onClick={() => handleGDPRDeleteClick(client.id)}
                                        >
                                            GDPR
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            <DeleteConfirmationDialog
                open={deleteConfirmation.isOpen}
                onOpenChange={(open) => setDeleteConfirmation({ isOpen: open, clientId: deleteConfirmation.clientId })}
                onConfirm={confirmDelete}
                title="Delete Archived Client"
                description="Are you sure you want to permanently delete this archived client? This action cannot be undone."
                itemName={archivedClients.find(c => c.id === deleteConfirmation.clientId)?.name}
            />

            {/* GDPR Deletion Dialog */}
            <GDPRDeleteDialog
                open={gdprDeleteOpen}
                onOpenChange={setGdprDeleteOpen}
                onConfirm={confirmGDPRDelete}
                clientName={archivedClients.find(c => c.id === gdprDeleteClientId)?.name}
            />
        </div>
    );
}

