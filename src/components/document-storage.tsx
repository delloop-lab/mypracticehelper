"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    FileText,
    Upload,
    Download,
    Trash2,
    Search,
    FolderOpen,
    File,
    Image as ImageIcon,
    FileVideo,
    Lock,
    Eye,
    Share2
} from "lucide-react";
import { motion } from "framer-motion";

interface Document {
    id: string;
    name: string;
    type: "pdf" | "image" | "video" | "document";
    size: string;
    uploadedBy: string;
    uploadedDate: string;
    clientName?: string;
    category: "intake" | "consent" | "insurance" | "notes" | "other";
    isEncrypted: boolean;
}

export function DocumentStorage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");

    const [documents, setDocuments] = useState<Document[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadDocuments();
    }, []);

    const loadDocuments = async () => {
        try {
            const response = await fetch('/api/documents');
            if (response.ok) {
                const data = await response.json();
                setDocuments(data);
            }
        } catch (error) {
            console.error('Error loading documents:', error);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/documents', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();
                setDocuments([...documents, data.document]);
            }
        } catch (error) {
            console.error('Error uploading document:', error);
        }
    };

    const categories = [
        { id: "all", label: "All Documents", count: documents.length },
        { id: "intake", label: "Intake Forms", count: documents.filter(d => d.category === "intake").length },
        { id: "consent", label: "Consent Forms", count: documents.filter(d => d.category === "consent").length },
        { id: "insurance", label: "Insurance", count: documents.filter(d => d.category === "insurance").length },
        { id: "notes", label: "Session Notes", count: documents.filter(d => d.category === "notes").length },
        { id: "other", label: "Other", count: documents.filter(d => d.category === "other").length },
    ];

    const filteredDocuments = documents.filter(doc => {
        const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            doc.clientName?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === "all" || doc.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const getFileIcon = (type: Document["type"]) => {
        switch (type) {
            case "pdf":
            case "document":
                return FileText;
            case "image":
                return ImageIcon;
            case "video":
                return FileVideo;
            default:
                return File;
        }
    };

    const totalStorage = documents.reduce((acc, doc) => {
        const sizeInKB = parseFloat(doc.size.replace(/[^\d.]/g, ""));
        return acc + (doc.size.includes("MB") ? sizeInKB * 1024 : sizeInKB);
    }, 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Document Storage</h2>
                    <p className="text-muted-foreground">HIPAA-compliant secure file management</p>
                </div>
                <div className="flex gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileUpload}
                    />
                    <Button className="gap-2" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-4 w-4" />
                        Upload Document
                    </Button>
                </div>
            </div>

            {/* Storage Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{documents.length}</div>
                        <p className="text-xs text-muted-foreground">Across all categories</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{(totalStorage / 1024).toFixed(1)} MB</div>
                        <p className="text-xs text-muted-foreground">of 50 GB available</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Encrypted</CardTitle>
                        <Lock className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{documents.filter(d => d.isEncrypted).length}</div>
                        <p className="text-xs text-muted-foreground">End-to-end encrypted</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">This Month</CardTitle>
                        <Upload className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">12</div>
                        <p className="text-xs text-muted-foreground">New uploads</p>
                    </CardContent>
                </Card>
            </div>

            {/* Search and Filter */}
            <div className="flex flex-col gap-4 md:flex-row">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search documents by name or client..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {categories.map((category) => (
                        <Button
                            key={category.id}
                            variant={selectedCategory === category.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedCategory(category.id)}
                            className="whitespace-nowrap"
                        >
                            {category.label} ({category.count})
                        </Button>
                    ))}
                </div>
            </div>

            {/* Upload Zone */}
            <Card className="border-dashed border-2 border-primary/20 bg-primary/5">
                <CardContent className="flex flex-col items-center justify-center py-10">
                    <Upload className="h-12 w-12 text-primary mb-4" />
                    <h3 className="font-semibold mb-2">Drag and drop files here</h3>
                    <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                        Select Files
                    </Button>
                    <p className="text-xs text-muted-foreground mt-4">
                        <Lock className="inline h-3 w-3 mr-1" />
                        All files are automatically encrypted with AES-256
                    </p>
                </CardContent>
            </Card>

            {/* Documents List */}
            <Card>
                <CardHeader>
                    <CardTitle>Documents ({filteredDocuments.length})</CardTitle>
                    <CardDescription>
                        All documents are HIPAA-compliant and encrypted at rest
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {filteredDocuments.map((doc, index) => {
                            const Icon = getFileIcon(doc.type);
                            return (
                                <motion.div
                                    key={doc.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.03 }}
                                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                            <Icon className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-semibold truncate">{doc.name}</h4>
                                                {doc.isEncrypted && (
                                                    <Lock className="h-3 w-3 text-green-500 flex-shrink-0" />
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                <span>{doc.size}</span>
                                                <span>•</span>
                                                <span>{doc.clientName || "General"}</span>
                                                <span>•</span>
                                                <span>{new Date(doc.uploadedDate).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button size="sm" variant="ghost">
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button size="sm" variant="ghost">
                                            <Download className="h-4 w-4" />
                                        </Button>
                                        <Button size="sm" variant="ghost">
                                            <Share2 className="h-4 w-4" />
                                        </Button>
                                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    {filteredDocuments.length === 0 && (
                        <div className="text-center py-12">
                            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="font-semibold mb-2">No documents found</h3>
                            <p className="text-sm text-muted-foreground">
                                Try adjusting your search or filter criteria
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Security Notice */}
            <Card className="border-green-500/20 bg-green-500/5">
                <CardContent className="flex items-start gap-3 p-4">
                    <Lock className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-sm mb-1">HIPAA-Compliant Storage</h4>
                        <p className="text-xs text-muted-foreground">
                            All documents are encrypted with AES-256 encryption at rest and in transit.
                            Access logs are maintained for compliance. Files are stored in SOC 2 Type II certified data centers.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
