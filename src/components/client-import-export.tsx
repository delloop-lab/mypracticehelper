"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, FolderOpen, Loader2 } from "lucide-react";
import * as XLSX from 'xlsx';
import { parse, format, isValid } from 'date-fns';

// Helper function to parse date of birth from various formats
function parseDateOfBirth(dateString: string): string | null {
    if (!dateString || typeof dateString !== 'string') return null;
    
    const trimmed = dateString.trim();
    if (!trimmed) return null;
    
    // List of date formats to try
    const dateFormats = [
        'yyyy-MM-dd',           // 2024-01-15
        'MM/dd/yyyy',            // 01/15/2024 (US format)
        'dd/MM/yyyy',            // 15/01/2024 (European format)
        'dd-MM-yyyy',            // 15-01-2024
        'MM-dd-yyyy',            // 01-15-2024
        'yyyy/MM/dd',            // 2024/01/15
        'MMM dd, yyyy',          // Jan 15, 2024
        'MMMM dd, yyyy',         // January 15, 2024
        'dd MMM yyyy',           // 15 Jan 2024
        'dd MMMM yyyy',          // 15 January 2024
        'yyyy MMM dd',           // 2024 Jan 15
        'yyyy MMMM dd',          // 2024 January 15
        'MM.dd.yyyy',            // 01.15.2024
        'dd.MM.yyyy',            // 15.01.2024
        'yyyyMMdd',              // 20240115 (no separators)
    ];
    
    // Try each format
    for (const dateFormat of dateFormats) {
        try {
            const parsed = parse(trimmed, dateFormat, new Date());
            if (isValid(parsed)) {
                // Normalize to YYYY-MM-DD format
                return format(parsed, 'yyyy-MM-dd');
            }
        } catch (e) {
            // Continue to next format
        }
    }
    
    // Try JavaScript Date parsing as fallback
    try {
        const jsDate = new Date(trimmed);
        if (isValid(jsDate) && !isNaN(jsDate.getTime())) {
            // Check if the date makes sense (not too far in future/past)
            const year = jsDate.getFullYear();
            if (year >= 1900 && year <= 2100) {
                return format(jsDate, 'yyyy-MM-dd');
            }
        }
    } catch (e) {
        // Invalid date
    }
    
    return null;
}

interface ClientImportData {
    name: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
    preferredName?: string;
}

export function ClientImportExport() {
    const [importing, setImporting] = useState(false);
    const [importStatus, setImportStatus] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    const TEMPLATE_HEADERS = ['First Name', 'Last Name', 'Email', 'Phone', 'DOB', 'AKA'];
    const TEMPLATE_ROWS = [
        ['John', 'Doe', 'john@example.com', '+61 412 900 002', '1985-05-15', 'Johnny'],
        ['Jane', 'Smith', 'jane@example.com', '+61 412 900 003', '1990-08-22', 'Jane']
    ];

    const downloadFile = async (url: string, filename: string) => {
        try {
            const separator = url.includes("?") ? "&" : "?";
            const finalUrl = `${url}${separator}ts=${Date.now()}`;

            const response = await fetch(finalUrl, {
                credentials: 'include' // Include cookies for authentication
            });
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
        if (!file) {
            console.log('[Client Import] No file selected');
            return;
        }

        console.log('[Client Import] File selected:', file.name, file.size, 'bytes');
        setImporting(true);
        setImportStatus(null);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                console.log('[Client Import] File read, parsing Excel...');
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                console.log('[Client Import] Workbook sheets:', wb.SheetNames);
                
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[];
                console.log('[Client Import] Parsed rows:', data.length);
                console.log('[Client Import] First row sample:', data[0]);
                console.log('[Client Import] Available columns in first row:', data[0] ? Object.keys(data[0]) : 'No data');

                const newClients: ClientImportData[] = [];
                const errors: string[] = [];
                let successCount = 0;

                data.forEach((row, index) => {
                    console.log(`[Client Import] Processing row ${index + 2}:`, row);
                    console.log(`[Client Import] Row keys:`, Object.keys(row));
                    console.log(`[Client Import] Raw row values:`, JSON.stringify(row));
                    
                    // Helper function to check if a value looks like an email
                    const looksLikeEmail = (value: string) => {
                        if (!value || typeof value !== 'string') return false;
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        return emailRegex.test(value.trim());
                    };
                    
                    // Helper function to validate email format
                    const isValidEmail = (value: string) => {
                        if (!value) return true; // Empty is valid (optional field)
                        return looksLikeEmail(value);
                    };
                    
                    // Helper function to validate phone format (basic check - should not be an email)
                    const isValidPhone = (value: string) => {
                        if (!value) return true; // Empty is valid (optional field)
                        // Phone should not look like an email
                        if (looksLikeEmail(value)) return false;
                        // Basic phone validation - should contain digits and possibly +, -, spaces, parentheses
                        const phoneRegex = /^[\d\s\+\-\(\)]+$/;
                        return phoneRegex.test(value.trim());
                    };
                    
                    // Helper function to get column value by name variations
                    const getColumnValue = (variations: string[]) => {
                        for (const key of Object.keys(row)) {
                            const keyLower = key.toLowerCase().trim();
                            for (const variation of variations) {
                                if (keyLower === variation.toLowerCase()) {
                                    return String(row[key] || '').trim();
                                }
                            }
                        }
                        return '';
                    };
                    
                    // Get all possible column name variations and find the exact match
                    // First Name variations
                    let firstName = getColumnValue(['first name', 'firstname', 'first_name']);
                    
                    // Last Name variations
                    let lastName = getColumnValue(['last name', 'lastname', 'last_name']);
                    
                    // Email variations - must be exact match to avoid confusion
                    let email = getColumnValue(['email', 'e-mail', 'email address']);
                    
                    // Phone variations - must be exact match
                    let phone = getColumnValue(['phone', 'telephone', 'mobile', 'phone number']);
                    
                    // DOB variations
                    let dobRaw = getColumnValue(['dob', 'date of birth', 'birth date', 'dateofbirth']);
                    
                    // Parse and normalize date of birth from various formats
                    let dob = '';
                    if (dobRaw) {
                        const parsedDate = parseDateOfBirth(dobRaw);
                        if (parsedDate) {
                            dob = parsedDate;
                        } else {
                            const errorMsg = `Row ${index + 2}: Invalid date format "${dobRaw}" - expected formats: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, Month DD YYYY, etc.`;
                            console.log(`[Client Import] ${errorMsg}`);
                            errors.push(errorMsg);
                        }
                    }
                    
                    // AKA variations - only if explicitly provided, don't create dummy values
                    let aka = getColumnValue(['aka', 'also known as', 'preferred name', 'known as']);
                    
                    // Try Name field for backwards compatibility (old format)
                    let nameField = '';
                    if (!firstName && !lastName) {
                        nameField = getColumnValue(['name']);
                    }
                    
                    // Smart detection: If using old "Name" format, check if columns are misaligned
                    // Common issue: Email column has last name, Phone column has email
                    if (nameField && !firstName && !lastName) {
                        // Check if "Email" column actually contains a last name (no @ symbol)
                        const emailColumnValue = getColumnValue(['email', 'e-mail']);
                        const phoneColumnValue = getColumnValue(['phone', 'telephone', 'mobile']);
                        
                        // If Email column doesn't look like email but Phone does, they're swapped
                        if (emailColumnValue && !looksLikeEmail(emailColumnValue) && phoneColumnValue && looksLikeEmail(phoneColumnValue)) {
                            console.log(`[Client Import] Detected misaligned columns: Email column has "${emailColumnValue}", Phone column has "${phoneColumnValue}"`);
                            // Email column actually has last name
                            lastName = emailColumnValue;
                            // Phone column actually has email
                            email = phoneColumnValue;
                            // Clear phone since it actually contains email
                            phone = '';
                            // Name field has first name
                            firstName = nameField;
                            nameField = ''; // Clear it since we've extracted first name
                        } else if (emailColumnValue && looksLikeEmail(emailColumnValue)) {
                            // Email column is correct, use it
                            email = emailColumnValue;
                            firstName = nameField; // Name field is first name only
                            // Phone should be from phone column if it doesn't look like email
                            if (phoneColumnValue && !looksLikeEmail(phoneColumnValue)) {
                                phone = phoneColumnValue;
                            }
                        }
                    }
                    
                    let fullName = '';
                    
                    // If First Name and Last Name are provided, combine them
                    if (firstName || lastName) {
                        fullName = `${firstName} ${lastName}`.trim();
                    } else if (nameField) {
                        // Fallback to old format for backwards compatibility
                        fullName = nameField;
                    }
                    
                    // If name is still missing, try to generate one from available fields
                    if (!fullName) {
                        // Try email first
                        if (email) {
                            fullName = email.split('@')[0]; // Use part before @ as name
                        } else if (phone) {
                            fullName = `Client ${phone}`;
                        } else {
                            fullName = `Client ${index + 2}`; // Use row number as fallback
                        }
                        // Add a warning but don't block import
                        const warningMsg = `Row ${index + 2}: No name provided, using "${fullName}"`;
                        console.log(`[Client Import] ${warningMsg}`);
                        errors.push(warningMsg);
                    }
                    
                    // Validate email and phone
                    if (email && !isValidEmail(email)) {
                        const errorMsg = `Row ${index + 2}: Invalid email format "${email}"`;
                        console.log(`[Client Import] ${errorMsg}`);
                        errors.push(errorMsg);
                        email = ''; // Clear invalid email
                    }
                    
                    if (phone && !isValidPhone(phone)) {
                        const errorMsg = `Row ${index + 2}: Invalid phone format "${phone}" (appears to be an email or invalid format)`;
                        console.log(`[Client Import] ${errorMsg}`);
                        errors.push(errorMsg);
                        phone = ''; // Clear invalid phone
                    }
                    
                    const client = {
                        name: fullName,
                        firstName: firstName || fullName.split(' ')[0] || '',
                        lastName: lastName || fullName.split(' ').slice(1).join(' ') || '',
                        email: email,
                        phone: phone,
                        dateOfBirth: dob,
                        preferredName: aka // Only set if explicitly provided, no dummy values
                    };
                    console.log(`[Client Import] Valid client found:`, client);
                    newClients.push(client);
                    successCount++;
                });

                console.log('[Client Import] Total valid clients:', newClients.length);
                console.log('[Client Import] Total errors:', errors.length);

                if (newClients.length > 0) {
                    console.log('[Client Import] Fetching existing clients...');
                    // Fetch existing clients to merge
                    const existingResponse = await fetch('/api/clients', {
                        credentials: 'include'
                    });
                    console.log('[Client Import] Existing clients response status:', existingResponse.status);
                    const existingClients = existingResponse.ok ? await existingResponse.json() : [];
                    console.log('[Client Import] Existing clients count:', existingClients.length);

                    const mergedClients = [...existingClients];
                    let addedCount = 0;
                    let skippedCount = 0;

                    // Helper function to check if a client is a duplicate
                    const isDuplicate = (newClient: ClientImportData, existingClient: any): boolean => {
                        // Normalize names for comparison (case-insensitive, trim whitespace)
                        const normalizeName = (name: string) => name.toLowerCase().trim();
                        const newFirstName = normalizeName(newClient.firstName || '');
                        const newLastName = normalizeName(newClient.lastName || '');
                        const existingFirstName = normalizeName(existingClient.firstName || '');
                        const existingLastName = normalizeName(existingClient.lastName || '');
                        
                        // Check 1: Email match (if both have emails)
                        if (newClient.email && existingClient.email) {
                            if (newClient.email.toLowerCase().trim() === existingClient.email.toLowerCase().trim()) {
                                return true;
                            }
                        }
                        
                        // Check 2: Name + DOB match (if both have DOB)
                        if (newClient.dateOfBirth && existingClient.dateOfBirth) {
                            if (newFirstName === existingFirstName && 
                                newLastName === existingLastName && 
                                newClient.dateOfBirth === existingClient.dateOfBirth) {
                                return true;
                            }
                        }
                        
                        // Check 3: Full name match (first + last name) - case insensitive
                        if (newFirstName && newLastName && existingFirstName && existingLastName) {
                            if (newFirstName === existingFirstName && newLastName === existingLastName) {
                                // If names match exactly, consider it a duplicate
                                return true;
                            }
                        }
                        
                        return false;
                    };

                    newClients.forEach((newClient, clientIndex) => {
                        // Check for duplicates in existing clients
                        const duplicateInExisting = mergedClients.some((existingClient: any) => 
                            isDuplicate(newClient, existingClient)
                        );
                        
                        // Also check for duplicates within the new clients being imported (earlier in the list)
                        const duplicateInNew = newClients.slice(0, clientIndex).some((earlierClient) => 
                            isDuplicate(newClient, earlierClient)
                        );
                        
                        if (duplicateInExisting || duplicateInNew) {
                            let reason = '';
                            if (duplicateInExisting) {
                                reason = 'duplicate of existing client';
                            } else {
                                reason = 'duplicate within import file';
                            }
                            
                            // Determine which field matched for better error message
                            const matchingFields = [];
                            if (newClient.email) {
                                const newClientEmail = newClient.email.toLowerCase().trim();
                                const emailMatch = mergedClients.some((c: any) => 
                                    c.email && c.email.toLowerCase().trim() === newClientEmail
                                );
                                if (emailMatch) matchingFields.push('email');
                            }
                            
                            if (newClient.firstName && newClient.lastName) {
                                const nameMatch = mergedClients.some((c: any) => {
                                    const cFirstName = (c.firstName || '').toLowerCase().trim();
                                    const cLastName = (c.lastName || '').toLowerCase().trim();
                                    return cFirstName === (newClient.firstName || '').toLowerCase().trim() &&
                                           cLastName === (newClient.lastName || '').toLowerCase().trim();
                                });
                                if (nameMatch) matchingFields.push('name');
                            }
                            
                            if (newClient.dateOfBirth) {
                                const dobMatch = mergedClients.some((c: any) => 
                                    c.dateOfBirth && c.dateOfBirth === newClient.dateOfBirth
                                );
                                if (dobMatch) matchingFields.push('DOB');
                            }
                            
                            const duplicateMsg = `Row ${clientIndex + 2}: Skipping duplicate client "${newClient.name}" (${reason} - matched on: ${matchingFields.join(', ') || 'name/email/DOB'})`;
                            console.log(`[Client Import] ${duplicateMsg}`);
                            errors.push(duplicateMsg);
                            skippedCount++;
                        } else {
                            const clientToAdd = {
                                ...newClient,
                                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                                sessions: 0,
                                documents: [],
                                relationships: [],
                                dateOfBirth: newClient.dateOfBirth || '',
                                preferredName: newClient.preferredName || ''
                            };
                            console.log('[Client Import] Adding new client:', clientToAdd.name);
                            mergedClients.push(clientToAdd);
                            addedCount++;
                        }
                    });

                    console.log('[Client Import] Total clients after merge:', mergedClients.length);
                    console.log('[Client Import] Added:', addedCount, 'Skipped:', skippedCount);

                    console.log('[Client Import] Sending save request with', mergedClients.length, 'clients...');
                    console.log('[Client Import] Sample client to save:', mergedClients[0]);
                    
                    const saveResponse = await fetch('/api/clients', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(mergedClients),
                    });

                    console.log('[Client Import] Save response status:', saveResponse.status);
                    console.log('[Client Import] Save response ok:', saveResponse.ok);
                    console.log('[Client Import] Save response headers:', Object.fromEntries(saveResponse.headers.entries()));

                    if (!saveResponse.ok) {
                        const errorText = await saveResponse.text();
                        console.error('[Client Import] Save failed - response text:', errorText);
                        let errorData;
                        try {
                            errorData = JSON.parse(errorText);
                        } catch {
                            errorData = { error: errorText || `Failed to save clients: ${saveResponse.status} ${saveResponse.statusText}` };
                        }
                        console.error('[Client Import] Save failed - parsed error:', errorData);
                        throw new Error(errorData.error || `Failed to save clients: ${saveResponse.status} ${saveResponse.statusText}`);
                    }

                    const saveResult = await saveResponse.json().catch(() => ({}));
                    console.log('[Client Import] Save result:', saveResult);

                    // Verify the save was successful
                    if (!saveResult.success && saveResult.error) {
                        console.error('[Client Import] Save returned error:', saveResult.error);
                        throw new Error(saveResult.error);
                    }

                    console.log('[Client Import] Save confirmed successful. Verifying by fetching clients...');
                    
                    // Verify by fetching clients again
                    const verifyResponse = await fetch('/api/clients', {
                        credentials: 'include'
                    });
                    if (verifyResponse.ok) {
                        const verifiedClients = await verifyResponse.json();
                        console.log('[Client Import] Verified clients count after save:', verifiedClients.length);
                        console.log('[Client Import] New clients in verified list:', verifiedClients.filter((c: any) => 
                            newClients.some(nc => nc.name === c.name || (nc.email && nc.email === c.email))
                        ).length);
                    }

                    // Set success status before reloading
                    setImportStatus({
                        success: addedCount,
                        failed: errors.length + skippedCount,
                        errors: errors
                    });

                    console.log('[Client Import] Import complete. Reloading in 2 seconds...');
                    // Give more time for the save to complete on the server
                    setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                } else {
                    console.log('[Client Import] No valid clients to import');
                    setImportStatus({
                        success: 0,
                        failed: errors.length,
                        errors: errors.length > 0 ? errors : ['No valid clients found in file']
                    });
                }

            } catch (error: any) {
                console.error('[Client Import] Import failed with error:', error);
                console.error('[Client Import] Error stack:', error?.stack);
                const errorMessage = error?.message || 'Failed to parse file or save clients';
                console.error('[Client Import] Error message:', errorMessage);
                setImportStatus({
                    success: 0,
                    failed: 1,
                    errors: [errorMessage]
                });
            } finally {
                console.log('[Client Import] Import process finished');
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
                                        {importing ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Upload className="h-4 w-4" />
                                        )}
                                        {importing ? 'Importing...' : 'Import Client Spreadsheet (xlsx)'}
                                    </span>
                                </Button>
                            </label>
                        </div>
                        
                        {importing && (
                            <div className="mt-4 p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                                <div className="flex items-center gap-3">
                                    <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
                                    <div>
                                        <p className="font-semibold text-blue-900 dark:text-blue-100">Processing Import...</p>
                                        <p className="text-sm text-blue-700 dark:text-blue-300">
                                            Please wait while we import your clients. This may take a few moments.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
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
                            Export Client Spreadsheet (xlsx)
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
