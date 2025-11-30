"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Copy, ExternalLink, Edit, Check, Upload, File, Download } from "lucide-react";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";

interface Link {
    id: string;
    title: string;
    url: string;
    description: string;
    createdAt?: string;
    updatedAt?: string;
}

export default function LinksPage() {
    const [links, setLinks] = useState<Link[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingLink, setEditingLink] = useState<Link | null>(null);
    const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; linkId: string | null; linkTitle: string | null }>({ isOpen: false, linkId: null, linkTitle: null });
    const [formData, setFormData] = useState({
        title: "",
        url: "",
        description: "",
    });
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

    useEffect(() => {
        loadLinks();
    }, []);

    const loadLinks = async () => {
        try {
            const response = await fetch('/api/links');
            if (response.ok) {
                const data = await response.json();
                setLinks(data);
            }
        } catch (error) {
            console.error('Error loading links:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenDialog = (link?: Link) => {
        if (link) {
            setEditingLink(link);
            setFormData({
                title: link.title,
                url: link.url,
                description: link.description,
            });
        } else {
            setEditingLink(null);
            setFormData({
                title: "",
                url: "",
                description: "",
            });
        }
        setIsDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setEditingLink(null);
        setFormData({
            title: "",
            url: "",
            description: "",
        });
        setIsUploading(false);
        setUploadedFileName(null);
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadedFileName(null);

        const formDataToSend = new FormData();
        formDataToSend.append('file', file);

        try {
            const response = await fetch('/api/documents', {
                method: 'POST',
                body: formDataToSend,
            });

            if (response.ok) {
                const data = await response.json();
                
                // Use relative URL - works in both dev and production
                // data.url is already in format: /api/documents/filename
                const documentUrl = data.url;
                
                // Auto-populate form fields
                setFormData({
                    ...formData,
                    title: formData.title || file.name.replace(/\.[^/.]+$/, ""), // Use filename without extension if title is empty
                    url: documentUrl,
                });
                
                setUploadedFileName(file.name);
                console.log('Document uploaded successfully:', data);
            } else {
                const errorData = await response.json();
                alert(`Failed to upload document: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error uploading document:', error);
            alert('Error uploading document. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.title.trim() || !formData.url.trim()) {
            alert("Please fill in both title and URL");
            return;
        }

        // Handle URL format - store relative URLs as-is, only convert external URLs
        let url = formData.url.trim();
        
        // If it's a relative URL (starts with /), keep it as-is (don't convert to absolute)
        // This way it works in both dev and production
        if (url.startsWith('/')) {
            // Relative URL - validate it's a valid path
            if (url.length < 2) {
                alert("Please enter a valid URL path");
                return;
            }
            // Store as relative URL - will be converted dynamically when used
        }
        // If it doesn't start with http:// or https://, add https://
        else if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = `https://${url}`;
            // Validate external URL format
            try {
                new URL(url);
            } catch {
                alert("Please enter a valid URL (e.g., https://example.com or /api/documents/file.pdf)");
                return;
            }
        } else {
            // Already a full URL - validate it
            try {
                new URL(url);
            } catch {
                alert("Please enter a valid URL");
                return;
            }
        }

        try {
            const linkToSave: Link = editingLink
                ? {
                      ...editingLink,
                      title: formData.title.trim(),
                      url: url,
                      description: formData.description.trim(),
                  }
                : {
                      id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                      title: formData.title.trim(),
                      url: url,
                      description: formData.description.trim(),
                      createdAt: new Date().toISOString(),
                  };

            const updatedLinks = editingLink
                ? links.map(l => (l.id === editingLink.id ? linkToSave : l))
                : [...links, linkToSave];

            const response = await fetch('/api/links', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedLinks),
            });

            if (response.ok) {
                await loadLinks();
                handleCloseDialog();
            } else {
                const errorData = await response.json();
                console.error('Error saving link:', errorData);
                if (errorData.migration) {
                    alert(`Database table missing. Please run this SQL in Supabase:\n\n${errorData.migration}`);
                } else {
                    alert(`Failed to save link: ${errorData.error || 'Unknown error'}`);
                }
            }
        } catch (error) {
            console.error('Error saving link:', error);
            alert("Error saving link");
        }
    };

    const handleDeleteClick = (id: string, title: string) => {
        setDeleteConfirm({ isOpen: true, linkId: id, linkTitle: title });
    };

    const handleDelete = async () => {
        if (!deleteConfirm.linkId) return;

        try {
            const response = await fetch(`/api/links?id=${deleteConfirm.linkId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                await loadLinks();
                setDeleteConfirm({ isOpen: false, linkId: null, linkTitle: null });
            } else {
                alert("Failed to delete link");
            }
        } catch (error) {
            console.error('Error deleting link:', error);
            alert("Error deleting link");
        }
    };

    // Convert relative URLs to absolute URLs when needed
    const getAbsoluteUrl = (url: string): string => {
        if (url.startsWith('/')) {
            return `${window.location.origin}${url}`;
        }
        return url;
    };

    const handleCopyLink = async (url: string, linkId: string) => {
        try {
            const absoluteUrl = getAbsoluteUrl(url);
            await navigator.clipboard.writeText(absoluteUrl);
            setCopiedLinkId(linkId);
            setTimeout(() => setCopiedLinkId(null), 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = getAbsoluteUrl(url);
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                setCopiedLinkId(linkId);
                setTimeout(() => setCopiedLinkId(null), 2000);
            } catch (err) {
                alert('Failed to copy link. Please copy manually.');
            }
            document.body.removeChild(textArea);
        }
    };

    const handleOpenLink = (url: string) => {
        const absoluteUrl = getAbsoluteUrl(url);
        window.open(absoluteUrl, '_blank', 'noopener,noreferrer');
    };

    const handleDownloadLink = (url: string, title: string) => {
        const absoluteUrl = getAbsoluteUrl(url);
        // Create a temporary anchor element to trigger download
        const link = document.createElement('a');
        link.href = absoluteUrl;
        // Extract filename from URL if available, otherwise use title
        const urlParts = url.split('/');
        const filename = urlParts[urlParts.length - 1] || title || 'document';
        link.download = filename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Check if a URL is a document (starts with /api/documents/)
    const isDocumentLink = (url: string): boolean => {
        return url.startsWith('/api/documents/');
    };

    if (isLoading) {
        return (
            <div className="container mx-auto px-4 py-8 max-w-6xl">
                <h1 className="text-4xl font-bold mb-8">Links</h1>
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
                <div>
                    <h1 className="text-4xl font-bold mb-2">Links</h1>
                    <p className="text-muted-foreground">Manage frequently used links</p>
                </div>
                <Button onClick={() => handleOpenDialog()} className="bg-green-500 hover:bg-green-600 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Link
                </Button>
            </div>

            {links.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground mb-4">No links yet. Add your first link to get started.</p>
                        <Button onClick={() => handleOpenDialog()}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Link
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {links.map((link) => (
                        <Card key={link.id} className="flex flex-col">
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <CardTitle className="text-lg">{link.title}</CardTitle>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => handleOpenDialog(link)}
                                        >
                                            <Edit className="h-4 w-4 text-blue-500" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                            onClick={() => handleDeleteClick(link.id, link.title)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                {link.description && (
                                    <CardDescription className="mt-2">{link.description}</CardDescription>
                                )}
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col">
                                <div className="flex-1 mb-4">
                                    <a
                                        href={getAbsoluteUrl(link.url)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-blue-600 hover:underline break-all"
                                    >
                                        {link.url}
                                    </a>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="default"
                                        size="sm"
                                        className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                                        onClick={() => handleCopyLink(link.url, link.id)}
                                    >
                                        {copiedLinkId === link.id ? (
                                            <>
                                                <Check className="h-4 w-4 mr-2" />
                                                Copied!
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="h-4 w-4 mr-2" />
                                                Copy Link
                                            </>
                                        )}
                                    </Button>
                                    {isDocumentLink(link.url) ? (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1"
                                                onClick={() => handleOpenLink(link.url)}
                                            >
                                                <ExternalLink className="h-4 w-4 mr-2" />
                                                Open
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1"
                                                onClick={() => handleDownloadLink(link.url, link.title)}
                                            >
                                                <Download className="h-4 w-4 mr-2" />
                                                Download
                                            </Button>
                                        </>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => handleOpenLink(link.url)}
                                        >
                                            <ExternalLink className="h-4 w-4 mr-2" />
                                            Open
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Add/Edit Link Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingLink ? "Edit Link" : "Add New Link"}</DialogTitle>
                        <DialogDescription>
                            {editingLink ? "Update the link details" : "Add a new link with a description for quick access"}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="space-y-4 py-4">
                            {/* Document Upload Section */}
                            {!editingLink && (
                                <div className="space-y-2 border-b pb-4">
                                    <Label>Upload Document (Optional)</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="file-upload"
                                            type="file"
                                            onChange={handleFileUpload}
                                            disabled={isUploading}
                                            className="hidden"
                                            accept=".pdf,.doc,.docx,.txt,.odt,.rtf,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif"
                                        />
                                        <Label
                                            htmlFor="file-upload"
                                            className="flex-1 cursor-pointer"
                                        >
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="w-full"
                                                disabled={isUploading}
                                                onClick={() => document.getElementById('file-upload')?.click()}
                                            >
                                                {isUploading ? (
                                                    <>
                                                        <Upload className="h-4 w-4 mr-2 animate-spin" />
                                                        Uploading...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload className="h-4 w-4 mr-2" />
                                                        Upload Document to Supabase
                                                    </>
                                                )}
                                            </Button>
                                        </Label>
                                    </div>
                                    {uploadedFileName && (
                                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                                            <File className="h-4 w-4" />
                                            <span>Uploaded: {uploadedFileName}</span>
                                        </div>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                        Upload a document and the URL will be automatically filled in. You can also manually enter a URL.
                                    </p>
                                </div>
                            )}
                            
                            <div className="space-y-2">
                                <Label htmlFor="title">Title *</Label>
                                <Input
                                    id="title"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="e.g., Client Portal"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="url">URL *</Label>
                                <Input
                                    id="url"
                                    type="text"
                                    value={formData.url}
                                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                    placeholder="https://example.com or /api/documents/file.pdf"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Optional description of what this link is for"
                                    rows={3}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={handleCloseDialog}>
                                Cancel
                            </Button>
                            <Button type="submit" className={editingLink ? "" : "bg-green-500 hover:bg-green-600 text-white"}>
                                {editingLink ? "Update" : "Add"} Link
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <DeleteConfirmationDialog
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => setDeleteConfirm({ isOpen: open, linkId: deleteConfirm.linkId, linkTitle: deleteConfirm.linkTitle })}
                onConfirm={handleDelete}
                title="Delete Link"
                description="Are you sure you want to delete this link? This action cannot be undone."
                itemName={deleteConfirm.linkTitle || undefined}
            />
        </div>
    );
}

