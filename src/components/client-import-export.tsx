"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, FolderOpen } from "lucide-react";
import * as XLSX from 'xlsx';

interface ClientImportData {
    name: string;
    email?: string;
    phone?: string;
    sessionFee?: number;
    currency?: string;
    notes?: string;
}

export function ClientImportExport() {
    const [importing, setImporting] = useState(false);
    const [importStatus, setImportStatus] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    const TEMPLATE_HEADERS = ['Name', 'Email', 'Phone', 'Session Fee', 'Currency', 'Notes'];
    const TEMPLATE_ROWS = [
        ['John Doe', 'john@example.com', '555-0123', 80, 'EUR', 'Example client notes'],
        ['Jane Smith', 'jane@example.com', '555-0124', 100, 'USD', 'Another example']
    ];

    const downloadFile = async (url: string, filename: string) => {
        try {
            const separator = url.includes("?") ? "&" : "?";
            const finalUrl = `${url}${separator}ts=${Date.now()}`;

            const response = await fetch(finalUrl);
            if (!response.ok) {
                throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
            }

            const contentDisposition = response.headers.get("content-disposition");
            const contentType = response.headers.get("content-type");
            console.log("Download response headers:", {
                status: response.status,
                contentDisposition,
                contentType,
                finalUrl: response.url,
            });

            const blob = await response.blob();
            const objectUrl = window.URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = objectUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            window.URL.revokeObjectURL(objectUrl);
        } catch (error) {
            console.error("Download failed:", error);
        }
    };

    const downloadTemplate = async () => {
        await downloadFile("/api/download/template", "client_import_template.xlsx");
        setShowPreview(true);
    };

    const exportClients = async () => {
        const date = new Date().toISOString().split("T")[0];
        await downloadFile("/api/download/export", `clients_export_${date}.xlsx`);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setImportStatus(null);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws) as any[];

                const newClients: ClientImportData[] = [];
                const errors: string[] = [];
                let successCount = 0;

                data.forEach((row, index) => {
                    if (!row.Name) {
                        errors.push(`Row ${index + 2}: Missing Name`);
                        return;
                    }
                    newClients.push({
                        name: row.Name,
                        email: row.Email,
                        phone: row.Phone,
                        sessionFee: row['Session Fee'],
                        currency: row.Currency,
                        notes: row.Notes
                    });
                    successCount++;
                });

                if (newClients.length > 0) {
                    // Fetch existing clients to merge
                    const existingResponse = await fetch('/api/clients');
                    const existingClients = existingResponse.ok ? await existingResponse.json() : [];

                    const mergedClients = [...existingClients];

                    newClients.forEach(newClient => {
                        // Simple de-duplication by email if present
                        if (newClient.email) {
                            const exists = mergedClients.some((c: any) => c.email === newClient.email);
                            if (!exists) {
                                mergedClients.push({
                                    ...newClient,
                                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                                    sessions: 0,
                                    documents: [],
                                    relationships: []
                                });
                            }
                        } else {
                            mergedClients.push({
                                ...newClient,
                                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                                sessions: 0,
                                documents: [],
                                relationships: []
                            });
                        }
                    });

                    await fetch('/api/clients', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(mergedClients),
                    });

                    // Trigger update in parent component if possible, or just reload
                    window.location.reload();
                }

                setImportStatus({
                    success: successCount,
                    failed: errors.length,
                    errors: errors
                });

            } catch (error) {
                console.error('Import failed:', error);
                setImportStatus({
                    success: 0,
                    failed: 1,
                    errors: ['Failed to parse file or save clients']
                });
            } finally {
                setImporting(false);
                // Reset file input
                e.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5" />
                        Bulk Client Import/Export
                    </CardTitle>
                    <CardDescription>
                        Import multiple clients from an Excel spreadsheet or export existing clients.
                        Files will be saved to your Downloads folder.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <h4 className="font-semibold">Step 1: Download Template</h4>
                        <p className="text-sm text-muted-foreground">
                            Download the Excel template, fill in your client information, and upload it back.
                        </p>
                        <Button onClick={downloadTemplate} variant="outline" className="gap-2">
                            <Download className="h-4 w-4" />
                            Download Excel Template
                        </Button>

                        {showPreview && (
                            <div className="mt-4 border rounded-md overflow-hidden">
                                <div className="bg-muted px-4 py-2 border-b">
                                    <h5 className="text-xs font-semibold uppercase text-muted-foreground">Template Preview</h5>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-muted/50 text-muted-foreground">
                                            <tr>
                                                {TEMPLATE_HEADERS.map((header, i) => (
                                                    <th key={i} className="px-4 py-2 font-medium border-b">{header}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {TEMPLATE_ROWS.map((row, i) => (
                                                <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                                                    {row.map((cell, j) => (
                                                        <td key={j} className="px-4 py-2 border-r last:border-0">{cell}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
                                    * Fill in your data following this format
                                </div>
                            </div>
                        )}

                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
                            <FolderOpen className="h-3 w-3" />
                            File will be saved as: <code className="bg-muted px-1 rounded">client_import_template.xlsx</code>
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h4 className="font-semibold">Step 2: Upload Completed Spreadsheet</h4>
                        <p className="text-sm text-muted-foreground">
                            Upload your completed Excel file to import clients into the system.
                        </p>
                        <div className="flex items-center gap-2">
                            <input
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileUpload}
                                disabled={importing}
                                className="hidden"
                                id="client-upload"
                            />
                            <label htmlFor="client-upload">
                                <Button asChild variant="default" className="gap-2" disabled={importing}>
                                    <span>
                                        <Upload className="h-4 w-4" />
                                        {importing ? 'Importing...' : 'Upload Excel File'}
                                    </span>
                                </Button>
                            </label>
                        </div>
                    </div>

                    {importStatus && (
                        <div className="p-4 rounded-lg border bg-muted/50">
                            <div className="flex items-start gap-2 mb-2">
                                {importStatus.failed === 0 ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                                ) : (
                                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                                )}
                                <div>
                                    <p className="font-semibold">Import Complete</p>
                                    <p className="text-sm text-muted-foreground">
                                        Successfully imported: {importStatus.success} clients
                                        {importStatus.failed > 0 && ` | Failed: ${importStatus.failed}`}
                                    </p>
                                </div>
                            </div>
                            {importStatus.errors.length > 0 && (
                                <div className="mt-3 space-y-1">
                                    <p className="text-sm font-semibold text-destructive">Errors:</p>
                                    <ul className="text-sm text-muted-foreground space-y-1">
                                        {importStatus.errors.map((error, index) => (
                                            <li key={index} className="pl-4">• {error}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="pt-4 border-t space-y-2">
                        <h4 className="font-semibold">Export Existing Clients</h4>
                        <p className="text-sm text-muted-foreground">
                            Download all existing clients as an Excel spreadsheet.
                        </p>
                        <Button onClick={exportClients} variant="outline" className="gap-2">
                            <Download className="h-4 w-4" />
                            Export Clients to Excel
                        </Button>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <FolderOpen className="h-3 w-3" />
                            File will be saved as: <code className="bg-muted px-1 rounded">clients_export_YYYY-MM-DD.xlsx</code>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
