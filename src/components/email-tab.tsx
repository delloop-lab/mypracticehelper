"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Mail, Send, History, FileText, Plus, Trash2, Edit, Loader2, CheckCircle2, AlertCircle, Eye, User, Download } from "lucide-react";
import * as XLSX from 'xlsx';
import { motion } from "framer-motion";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';

interface Client {
    id: string;
    name: string;
    firstName?: string;
    lastName?: string;
    email: string;
}

interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    html_body: string;
    text_body: string;
    category: string;
    created_at: string;
    updated_at: string;
}

interface EmailHistoryEntry {
    id: string;
    client_id: string;
    client_email: string;
    client_name: string;
    subject: string;
    html_body: string;
    text_body: string;
    template_id: string;
    status: string;
    sent_at: string;
    created_at: string;
}

interface Appointment {
    id: string;
    clientId: string;
    clientName: string;
    date: string;
    time: string;
    duration: number;
    appointmentType: string;
    status: string;
    isUpcoming?: boolean;
}

// Available template variables
const TEMPLATE_VARIABLES = [
    { key: '{{clientName}}', description: 'Client\'s full name' },
    { key: '{{firstName}}', description: 'Client\'s first name' },
    { key: '{{appointmentDate}}', description: 'Appointment date/time' },
    { key: '{{appointmentType}}', description: 'Type of appointment' },
    { key: '{{duration}}', description: 'Session duration' },
    { key: '{{userIcon}}', description: 'User/company icon (displays at bottom of email)' },
];

// Convert HTML to plain text while preserving line breaks
const htmlToPlainText = (html: string): string => {
    if (!html) return '';
    
    let text = html;
    
    // Replace block-level elements with newlines
    text = text.replace(/<\/p>/gi, '\n');
    text = text.replace(/<p[^>]*>/gi, '');
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/div>/gi, '\n');
    text = text.replace(/<div[^>]*>/gi, '');
    text = text.replace(/<\/li>/gi, '\n');
    text = text.replace(/<li[^>]*>/gi, '• ');
    text = text.replace(/<\/ul>/gi, '\n');
    text = text.replace(/<\/ol>/gi, '\n');
    text = text.replace(/<ul[^>]*>/gi, '');
    text = text.replace(/<ol[^>]*>/gi, '');
    
    // Strip remaining HTML tags
    text = text.replace(/<[^>]*>/g, '');
    
    // Decode HTML entities
    text = text.replace(/&nbsp;/gi, ' ');
    text = text.replace(/&amp;/gi, '&');
    text = text.replace(/&lt;/gi, '<');
    text = text.replace(/&gt;/gi, '>');
    text = text.replace(/&quot;/gi, '"');
    text = text.replace(/&#39;/gi, "'");
    
    // Clean up multiple consecutive newlines (max 2)
    text = text.replace(/\n{3,}/g, '\n\n');
    
    // Trim whitespace from each line
    text = text.split('\n').map(line => line.trim()).join('\n');
    
    // Trim leading/trailing whitespace
    text = text.trim();
    
    return text;
};

// Clean up HTML for email - ensures consistent spacing
const cleanHtmlForEmail = (html: string): string => {
    if (!html) return '';
    
    let cleaned = html;
    
    // Remove empty paragraphs
    cleaned = cleaned.replace(/<p><\/p>/gi, '');
    cleaned = cleaned.replace(/<p>\s*<\/p>/gi, '');
    cleaned = cleaned.replace(/<p><br\s*\/?><\/p>/gi, '<br>');
    
    // Normalize paragraph styling for email clients - remove margins
    cleaned = cleaned.replace(/<p>/gi, '<p style="margin: 0 0 10px 0;">');
    
    // Wrap in a container with consistent font
    cleaned = `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333333;">${cleaned}</div>`;
    
    return cleaned;
};

// Rich Text Editor Component for Compose
function ComposeEditor({ content, onChange, editorRef, placeholder }: {
    content: string;
    onChange: (content: string) => void;
    editorRef: React.MutableRefObject<any>;
    placeholder: string;
}) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                bulletList: { keepMarks: true, keepAttributes: false },
                orderedList: { keepMarks: true, keepAttributes: false },
            }),
            Underline,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: { class: 'text-blue-500 underline cursor-pointer' },
            }),
            Placeholder.configure({ placeholder }),
        ],
        content: content || '',
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4',
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        immediatelyRender: false,
    });

    // Store editor reference
    useEffect(() => {
        if (editor) {
            editorRef.current = editor;
        }
    }, [editor, editorRef]);

    // Update editor content when content prop changes externally
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content || '');
        }
    }, [content, editor]);

    if (!editor) {
        return <div className="border rounded-lg p-4 bg-muted/50 min-h-[200px]">Loading editor...</div>;
    }

    return (
        <div className="border rounded-lg overflow-hidden">
            <EditorToolbar editor={editor} />
            <div 
                className="p-4 bg-background cursor-text min-h-[200px]"
                onClick={() => editor.chain().focus().run()}
            >
                <EditorContent editor={editor} />
            </div>
        </div>
    );
}

// Rich Text Editor Component for Templates
function TemplateEditor({ content, onChange, editorRef, placeholder }: {
    content: string;
    onChange: (content: string) => void;
    editorRef: React.MutableRefObject<any>;
    placeholder: string;
}) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                bulletList: { keepMarks: true, keepAttributes: false },
                orderedList: { keepMarks: true, keepAttributes: false },
            }),
            Underline,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: { class: 'text-blue-500 underline cursor-pointer' },
            }),
            Placeholder.configure({ placeholder }),
        ],
        content: content || '',
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none min-h-[150px] prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4',
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        immediatelyRender: false,
    });

    // Store editor reference
    useEffect(() => {
        if (editor) {
            editorRef.current = editor;
        }
    }, [editor, editorRef]);

    // Update editor content when content prop changes externally
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content || '');
        }
    }, [content, editor]);

    if (!editor) {
        return <div className="border rounded-lg p-4 bg-muted/50 min-h-[150px]">Loading editor...</div>;
    }

    return (
        <div className="border rounded-lg overflow-hidden">
            <EditorToolbar editor={editor} />
            <div 
                className="p-4 bg-background cursor-text min-h-[150px]"
                onClick={() => editor.chain().focus().run()}
            >
                <EditorContent editor={editor} />
            </div>
        </div>
    );
}

// Shared toolbar component
import { EditorContent } from '@tiptap/react';
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered, Link as LinkIcon, Undo, Redo } from 'lucide-react';
import { cn } from '@/lib/utils';

function EditorToolbar({ editor }: { editor: any }) {
    const addLink = () => {
        const url = window.prompt('Enter URL:');
        if (url) {
            editor.chain().focus().setLink({ href: url }).run();
        }
    };

    return (
        <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/30">
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", editor.isActive('bold') && "bg-muted")}
                onClick={() => editor.chain().focus().toggleBold().run()}
                title="Bold (Ctrl+B)"
            >
                <Bold className="h-4 w-4" />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", editor.isActive('italic') && "bg-muted")}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                title="Italic (Ctrl+I)"
            >
                <Italic className="h-4 w-4" />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", editor.isActive('underline') && "bg-muted")}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                title="Underline (Ctrl+U)"
            >
                <UnderlineIcon className="h-4 w-4" />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", editor.isActive('strike') && "bg-muted")}
                onClick={() => editor.chain().focus().toggleStrike().run()}
                title="Strikethrough"
            >
                <Strikethrough className="h-4 w-4" />
            </Button>
            
            <div className="w-px h-6 bg-border mx-1 self-center" />
            
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", editor.isActive('bulletList') && "bg-muted")}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                title="Bullet List"
            >
                <List className="h-4 w-4" />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", editor.isActive('orderedList') && "bg-muted")}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                title="Numbered List"
            >
                <ListOrdered className="h-4 w-4" />
            </Button>
            
            <div className="w-px h-6 bg-border mx-1 self-center" />
            
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", editor.isActive('link') && "bg-muted")}
                onClick={addLink}
                title="Add Link"
            >
                <LinkIcon className="h-4 w-4" />
            </Button>
            
            <div className="w-px h-6 bg-border mx-1 self-center" />
            
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                title="Undo (Ctrl+Z)"
            >
                <Undo className="h-4 w-4" />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                title="Redo (Ctrl+Y)"
            >
                <Redo className="h-4 w-4" />
            </Button>
        </div>
    );
}

export function EmailTab() {
    const [activeSubTab, setActiveSubTab] = useState<'compose' | 'templates' | 'history'>('compose');
    
    // Compose state
    const [clients, setClients] = useState<Client[]>([]);
    const [allClients, setAllClients] = useState<Client[]>([]);
    const [showClientsWithoutEmails, setShowClientsWithoutEmails] = useState(false);
    const [clientEmailEdits, setClientEmailEdits] = useState<Record<string, string>>({});
    const [savingClientId, setSavingClientId] = useState<string | null>(null);
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [emailHistory, setEmailHistory] = useState<EmailHistoryEntry[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>('');
    const [clientAppointments, setClientAppointments] = useState<Appointment[]>([]);
    const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
    const [emailSubject, setEmailSubject] = useState<string>('');
    const [emailBody, setEmailBody] = useState<string>('');
    const [isSending, setIsSending] = useState(false);
    const [sendStatus, setSendStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    
    // Template management state
    const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateSubject, setNewTemplateSubject] = useState('');
    const [newTemplateBody, setNewTemplateBody] = useState('');
    const [newTemplateCategory, setNewTemplateCategory] = useState('general');
    const [isSavingTemplate, setIsSavingTemplate] = useState(false);
    
    // History view state
    const [viewingEmail, setViewingEmail] = useState<EmailHistoryEntry | null>(null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    
    // Confirmation dialog state
    const [deleteTemplateDialog, setDeleteTemplateDialog] = useState<{ open: boolean; templateId: string | null }>({ open: false, templateId: null });
    const [deleteEmailRecordDialog, setDeleteEmailRecordDialog] = useState<{ open: boolean; entryId: string | null }>({ open: false, entryId: null });
    
    // Loading states
    const [isLoading, setIsLoading] = useState(true);
    const [companyLogo, setCompanyLogo] = useState<string | undefined>(undefined);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            await Promise.all([
                loadClients(),
                loadTemplates(),
                loadHistory(),
                loadSettings()
            ]);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadSettings = async () => {
        try {
            const response = await fetch('/api/settings', { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                setCompanyLogo(data.companyLogo || undefined);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    };

    const loadClients = async () => {
        try {
            const response = await fetch('/api/clients', { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                setAllClients(data);
                // Filter to only clients with email addresses
                setClients(data.filter((c: Client) => c.email && c.email.trim() !== ''));
            }
        } catch (error) {
            console.error('Error loading clients:', error);
        }
    };

    const handleSaveClientEmail = async (clientId: string, email: string) => {
        if (!email.trim()) {
            alert('Please enter a valid email address');
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            alert('Please enter a valid email address');
            return;
        }

        setSavingClientId(clientId);
        try {
            const client = allClients.find(c => c.id === clientId);
            if (!client) {
                throw new Error('Client not found');
            }

            // Update the client with the new email
            const updatedClient = { ...client, email: email.trim() };
            const updatedClientsList = allClients.map(c =>
                c.id === clientId ? updatedClient : c
            );

            // Save via API
            const response = await fetch('/api/clients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updatedClientsList),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save client email');
            }

            // Update local state
            setAllClients(updatedClientsList);
            setClients(updatedClientsList.filter((c: Client) => c.email && c.email.trim() !== ''));

            // Clear the edit state for this client
            setClientEmailEdits(prev => {
                const next = { ...prev };
                delete next[clientId];
                return next;
            });
        } catch (error: any) {
            console.error('Error saving client email:', error);
            alert(error.message || 'Failed to save email address. Please try again.');
        } finally {
            setSavingClientId(null);
        }
    };

    const loadTemplates = async () => {
        try {
            const response = await fetch('/api/email-templates', { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                setTemplates(data);
            }
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    };

    const loadHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const response = await fetch('/api/emails/history?limit=100', { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                setEmailHistory(data);
            }
        } catch (error) {
            console.error('Error loading email history:', error);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleTemplateSelect = (templateId: string) => {
        setSelectedTemplateId(templateId);
        const template = templates.find(t => t.id === templateId);
        if (template) {
            setEmailSubject(template.subject);
            setEmailBody(template.html_body || template.text_body || '');
        }
    };

    const loadClientAppointments = async (clientId: string) => {
        setIsLoadingAppointments(true);
        setClientAppointments([]);
        setSelectedAppointmentId('');
        
        try {
            // Get the client name to match appointments
            const selectedClient = clients.find(c => c.id === clientId);
            if (!selectedClient) {
                console.log('[EmailTab] Client not found:', clientId);
                setIsLoadingAppointments(false);
                return;
            }
            
            console.log('[EmailTab] Loading appointments for client:', selectedClient.name);
            
            const response = await fetch('/api/appointments', { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                console.log('[EmailTab] Total appointments fetched:', data?.length || 0);
                
                // Filter appointments for this client (match by name since API returns clientName)
                const clientAppointmentsData = (data || []).filter((apt: any) => {
                    const matches = apt.clientName === selectedClient.name;
                    return matches;
                });
                
                console.log('[EmailTab] Appointments for this client:', clientAppointmentsData.length);
                
                const now = new Date();
                const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                
                // Helper to parse appointment date
                const parseAptDate = (apt: any): Date => {
                    // If date already includes time (ISO format), parse directly
                    if (apt.date && apt.date.includes('T')) {
                        return new Date(apt.date);
                    }
                    // Otherwise combine date and time
                    const dateStr = apt.date || '';
                    const timeStr = apt.time || '00:00';
                    return new Date(`${dateStr}T${timeStr}`);
                };
                
                // Log sample appointments for debugging
                if (clientAppointmentsData.length > 0) {
                    console.log('[EmailTab] Sample appointment:', {
                        date: clientAppointmentsData[0].date,
                        time: clientAppointmentsData[0].time,
                        type: clientAppointmentsData[0].type,
                        parsed: parseAptDate(clientAppointmentsData[0]).toISOString()
                    });
                }
                
                // Get upcoming appointments (next 10)
                const upcomingAppointments = clientAppointmentsData
                    .filter((apt: any) => {
                        const aptDate = parseAptDate(apt);
                        return aptDate >= now;
                    })
                    .sort((a: any, b: any) => {
                        const dateA = parseAptDate(a);
                        const dateB = parseAptDate(b);
                        return dateA.getTime() - dateB.getTime();
                    })
                    .slice(0, 10)
                    .map((apt: any) => ({ 
                        ...apt, 
                        appointmentType: apt.type || apt.appointmentType || 'Session',
                        isUpcoming: true 
                    }));
                
                console.log('[EmailTab] Upcoming appointments:', upcomingAppointments.length);
                
                // Get recent past sessions (last 30 days, up to 10)
                const recentSessions = clientAppointmentsData
                    .filter((apt: any) => {
                        const aptDate = parseAptDate(apt);
                        return aptDate < now && aptDate >= thirtyDaysAgo;
                    })
                    .sort((a: any, b: any) => {
                        const dateA = parseAptDate(a);
                        const dateB = parseAptDate(b);
                        return dateB.getTime() - dateA.getTime(); // Most recent first
                    })
                    .slice(0, 10)
                    .map((apt: any) => ({ 
                        ...apt, 
                        appointmentType: apt.type || apt.appointmentType || 'Session',
                        isUpcoming: false 
                    }));
                
                console.log('[EmailTab] Recent sessions:', recentSessions.length);
                
                // Combine: upcoming first, then recent
                setClientAppointments([...upcomingAppointments, ...recentSessions]);
            } else {
                console.error('[EmailTab] Failed to fetch appointments:', response.status);
            }
        } catch (error) {
            console.error('Error loading appointments:', error);
        } finally {
            setIsLoadingAppointments(false);
        }
    };

    const handleClientSelect = (clientId: string) => {
        setSelectedClientId(clientId);
        setSelectedAppointmentId(''); // Reset appointment selection
        
        // Load appointments for this client
        if (clientId) {
            loadClientAppointments(clientId);
        } else {
            setClientAppointments([]);
        }
        
        const client = clients.find(c => c.id === clientId);
        if (client) {
            // Replace placeholders with client data
            let subject = emailSubject;
            let body = emailBody;
            
            subject = subject.replace(/\{\{clientName\}\}/g, client.name);
            subject = subject.replace(/\{\{firstName\}\}/g, client.firstName || client.name.split(' ')[0] || '');
            
            body = body.replace(/\{\{clientName\}\}/g, client.name);
            body = body.replace(/\{\{firstName\}\}/g, client.firstName || client.name.split(' ')[0] || '');
            
            setEmailSubject(subject);
            setEmailBody(body);
        }
    };

    // Function to replace template variables with actual values
    const replaceTemplateVariables = (text: string, client: Client, appointment?: Appointment) => {
        if (!text) return text;
        
        let result = text;
        const firstName = client.firstName || client.name?.split(' ')[0] || '';
        const lastName = client.lastName || client.name?.split(' ').slice(1).join(' ') || '';
        
        // Replace client variables
        result = result.replace(/\{\{clientName\}\}/gi, client.name || '');
        result = result.replace(/\{\{firstName\}\}/gi, firstName);
        result = result.replace(/\{\{lastName\}\}/gi, lastName);
        
        // Replace user icon - use company logo if available, otherwise use a default SVG user icon
        const userIconHtml = companyLogo 
            ? `<img src="${companyLogo}" alt="User Icon" style="max-width: 100px; height: auto; margin-top: 20px;" />`
            : `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-top: 20px;"><path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="#666666"/><path d="M12.0002 14.5C6.99016 14.5 2.91016 17.86 2.91016 22C2.91016 22.28 3.13016 22.5 3.41016 22.5H20.5902C20.8702 22.5 21.0902 22.28 21.0902 22C21.0902 17.86 17.0102 14.5 12.0002 14.5Z" fill="#666666"/></svg>`;
        result = result.replace(/\{\{userIcon\}\}/gi, userIconHtml);
        
        // Replace appointment variables
        if (appointment) {
            // Format date nicely - parse date correctly
            let aptDate: Date;
            if (appointment.date && appointment.date.includes('T')) {
                // Already an ISO string with time
                aptDate = new Date(appointment.date);
            } else {
                // Date only, combine with time
                const timeStr = appointment.time || '00:00';
                aptDate = new Date(`${appointment.date}T${timeStr}`);
            }
            
            // Check if date is valid
            if (isNaN(aptDate.getTime())) {
                console.error('[EmailTab] Invalid date in replaceTemplateVariables:', appointment);
                result = result.replace(/\{\{appointmentDate\}\}/gi, '[Invalid Date]');
            } else {
                const formattedDate = aptDate.toLocaleDateString('en-GB', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
                const formattedTime = aptDate.toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                const formattedDateTime = `${formattedDate} at ${formattedTime}`;
                result = result.replace(/\{\{appointmentDate\}\}/gi, formattedDateTime);
            }
            
            result = result.replace(/\{\{appointmentType\}\}/gi, appointment.appointmentType || 'Session');
            result = result.replace(/\{\{duration\}\}/gi, `${appointment.duration || 60} minutes`);
        } else {
            // No appointment selected - leave as placeholders or remove
            result = result.replace(/\{\{appointmentDate\}\}/gi, '[No appointment selected]');
            result = result.replace(/\{\{appointmentType\}\}/gi, '[No appointment selected]');
            result = result.replace(/\{\{duration\}\}/gi, '[No appointment selected]');
        }
        
        return result;
    };

    const handleSendEmail = async () => {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client || !emailSubject.trim()) {
            setSendStatus({ type: 'error', message: 'Please select a client and enter a subject' });
            return;
        }

        setIsSending(true);
        setSendStatus(null);

        // Get selected appointment if any
        const selectedAppointment = clientAppointments.find(apt => apt.id === selectedAppointmentId);

        // Replace template variables with actual values
        const processedSubject = replaceTemplateVariables(emailSubject, client, selectedAppointment);
        const processedBody = replaceTemplateVariables(emailBody, client, selectedAppointment);

        try {
            const response = await fetch('/api/emails/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    clientId: client.id,
                    clientEmail: client.email,
                    clientName: client.name,
                    subject: processedSubject,
                    htmlBody: cleanHtmlForEmail(processedBody),
                    textBody: htmlToPlainText(processedBody),
                    templateId: selectedTemplateId || null
                })
            });

            if (response.ok) {
                setSendStatus({ type: 'success', message: `Email sent successfully to ${client.email}` });
                // Clear form
                setSelectedClientId('');
                setSelectedTemplateId('');
                setSelectedAppointmentId('');
                setClientAppointments([]);
                setEmailSubject('');
                setEmailBody('');
                // Reload history
                await loadHistory();
            } else {
                const error = await response.json();
                setSendStatus({ type: 'error', message: error.error || 'Failed to send email' });
            }
        } catch (error: any) {
            setSendStatus({ type: 'error', message: error.message || 'Failed to send email' });
        } finally {
            setIsSending(false);
        }
    };

    const handleSaveTemplate = async () => {
        if (!newTemplateName.trim() || !newTemplateSubject.trim()) {
            return;
        }

        setIsSavingTemplate(true);

        try {
            const method = editingTemplate ? 'PUT' : 'POST';
            const payload = {
                id: editingTemplate?.id,
                name: newTemplateName,
                subject: newTemplateSubject,
                htmlBody: newTemplateBody,
                textBody: htmlToPlainText(newTemplateBody),
                category: newTemplateCategory
            };
            
            console.log('[EmailTab] Saving template:', method, payload);
            
            const response = await fetch('/api/email-templates', {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            console.log('[EmailTab] Save template response:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('[EmailTab] Template saved successfully:', data);
                await loadTemplates();
                setIsCreatingTemplate(false);
                setEditingTemplate(null);
                setNewTemplateName('');
                setNewTemplateSubject('');
                setNewTemplateBody('');
                setNewTemplateCategory('general');
            } else {
                const errorData = await response.json();
                console.error('[EmailTab] Error saving template:', errorData);
                alert('Failed to save template: ' + (errorData.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error saving template:', error);
            alert('Failed to save template: ' + (error as Error).message);
        } finally {
            setIsSavingTemplate(false);
        }
    };

    const handleDeleteTemplate = (templateId: string) => {
        setDeleteTemplateDialog({ open: true, templateId });
    };

    const confirmDeleteTemplate = async () => {
        if (!deleteTemplateDialog.templateId) return;

        try {
            const response = await fetch(`/api/email-templates?id=${deleteTemplateDialog.templateId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                await loadTemplates();
            }
        } catch (error) {
            console.error('Error deleting template:', error);
        } finally {
            setDeleteTemplateDialog({ open: false, templateId: null });
        }
    };

    const handleEditTemplate = (template: EmailTemplate) => {
        setEditingTemplate(template);
        setNewTemplateName(template.name);
        setNewTemplateSubject(template.subject);
        setNewTemplateBody(template.html_body || template.text_body || '');
        setNewTemplateCategory(template.category || 'general');
        setIsCreatingTemplate(true);
    };

    const handleDeleteHistoryEntry = (entryId: string) => {
        setDeleteEmailRecordDialog({ open: true, entryId });
    };

    const confirmDeleteEmailRecord = async () => {
        if (!deleteEmailRecordDialog.entryId) return;

        try {
            const response = await fetch(`/api/emails/history?id=${deleteEmailRecordDialog.entryId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                await loadHistory();
            }
        } catch (error) {
            console.error('Error deleting history entry:', error);
        } finally {
            setDeleteEmailRecordDialog({ open: false, entryId: null });
        }
    };

    // Reference to editors for inserting variables
    const composeEditorRef = useRef<any>(null);
    const templateEditorRef = useRef<any>(null);

    const insertVariable = (variable: string, editorRef: React.RefObject<any>) => {
        if (editorRef.current) {
            editorRef.current.chain().focus().insertContent(variable).run();
        }
    };

    const insertComposeVariable = (variable: string) => {
        if (composeEditorRef.current) {
            composeEditorRef.current.chain().focus().insertContent(variable).run();
        } else {
            // Fallback: append to state
            setEmailBody(prev => prev + variable);
        }
    };

    const insertTemplateVariable = (variable: string) => {
        if (templateEditorRef.current) {
            templateEditorRef.current.chain().focus().insertContent(variable).run();
        } else {
            // Fallback: append to state
            setNewTemplateBody(prev => prev + variable);
        }
    };

    const downloadClientEmailsCSV = () => {
        // Filter clients with emails and parse names
        const clientsWithEmails = clients
            .filter(c => c.email && c.email.trim() !== '')
            .map(c => {
                // Parse name into firstName and lastName
                const nameParts = (c.name || '').trim().split(' ');
                const firstName = c.firstName || nameParts[0] || '';
                const lastName = c.lastName || nameParts.slice(1).join(' ') || '';
                
                return {
                    FirstName: firstName,
                    LastName: lastName,
                    Email: c.email
                };
            });

        // Create CSV content
        const headers = ['FirstName', 'LastName', 'Email'];
        const csvRows = [
            headers.join(','),
            ...clientsWithEmails.map(row => 
                [row.FirstName, row.LastName, row.Email].map(field => 
                    `"${String(field).replace(/"/g, '""')}"`
                ).join(',')
            )
        ];
        const csvContent = csvRows.join('\n');

        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `client-emails-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const downloadClientEmailsXLSX = () => {
        // Filter clients with emails and parse names
        const clientsWithEmails = clients
            .filter(c => c.email && c.email.trim() !== '')
            .map(c => {
                // Parse name into firstName and lastName
                const nameParts = (c.name || '').trim().split(' ');
                const firstName = c.firstName || nameParts[0] || '';
                const lastName = c.lastName || nameParts.slice(1).join(' ') || '';
                
                return {
                    FirstName: firstName,
                    LastName: lastName,
                    Email: c.email
                };
            });

        // Create workbook and worksheet
        const worksheet = XLSX.utils.json_to_sheet(clientsWithEmails);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Client Emails');

        // Generate file and download
        XLSX.writeFile(workbook, `client-emails-${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Loading email settings...</span>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Email Marketing Export */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Download className="h-5 w-5" />
                        Email Marketing Export
                    </CardTitle>
                    <CardDescription>
                        Download client email list for use in email marketing platforms (CSV and XLSX formats)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-3">
                        <Button
                            onClick={downloadClientEmailsCSV}
                            variant="outline"
                            className="flex items-center gap-2"
                            disabled={clients.filter(c => c.email && c.email.trim() !== '').length === 0}
                        >
                            <Download className="h-4 w-4" />
                            Download CSV
                        </Button>
                        <Button
                            onClick={downloadClientEmailsXLSX}
                            variant="outline"
                            className="flex items-center gap-2"
                            disabled={clients.filter(c => c.email && c.email.trim() !== '').length === 0}
                        >
                            <Download className="h-4 w-4" />
                            Download XLSX
                        </Button>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>({clients.filter(c => c.email && c.email.trim() !== '').length} clients with emails)</span>
                            {(() => {
                                const clientsWithoutEmails = allClients.filter(c => !c.email || c.email.trim() === '');
                                if (clientsWithoutEmails.length > 0) {
                                    return (
                                        <span>
                                            •{' '}
                                            <button
                                                onClick={() => setShowClientsWithoutEmails(true)}
                                                className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                            >
                                                {clientsWithoutEmails.length} without email
                                            </button>
                                        </span>
                                    );
                                }
                                return null;
                            })()}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Dialog for clients without emails */}
            <Dialog open={showClientsWithoutEmails} onOpenChange={(open) => {
                setShowClientsWithoutEmails(open);
                if (!open) {
                    // Clear email edits when dialog closes
                    setClientEmailEdits({});
                }
            }}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Clients Without Email Addresses</DialogTitle>
                        <DialogDescription>
                            The following {allClients.filter(c => !c.email || c.email.trim() === '').length} clients do not have email addresses configured.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 mt-4">
                        {allClients
                            .filter(c => !c.email || c.email.trim() === '')
                            .map((client) => (
                                <div
                                    key={client.id}
                                    className="flex items-center justify-between gap-4 p-3 border rounded-lg hover:bg-muted/50"
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <User className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium">{client.name || 'Unnamed Client'}</div>
                                            {client.firstName && client.lastName && (
                                                <div className="text-sm text-muted-foreground">
                                                    {client.firstName} {client.lastName}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <Input
                                            type="email"
                                            placeholder="Enter email address"
                                            value={clientEmailEdits[client.id] || ''}
                                            onChange={(e) => setClientEmailEdits(prev => ({
                                                ...prev,
                                                [client.id]: e.target.value
                                            }))}
                                            className="w-64"
                                            disabled={savingClientId === client.id}
                                        />
                                        <Button
                                            onClick={() => handleSaveClientEmail(client.id, clientEmailEdits[client.id] || '')}
                                            disabled={savingClientId === client.id || !clientEmailEdits[client.id]?.trim()}
                                            size="sm"
                                        >
                                            {savingClientId === client.id ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                    Saving...
                                                </>
                                            ) : (
                                                'Save'
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setShowClientsWithoutEmails(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Email Management
                    </CardTitle>
                    <CardDescription>
                        Send emails to clients, manage templates, and view email history
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as any)}>
                        <TabsList className="grid w-full grid-cols-3 mb-6">
                            <TabsTrigger value="compose" className="flex items-center gap-2">
                                <Send className="h-4 w-4" />
                                Compose
                            </TabsTrigger>
                            <TabsTrigger value="templates" className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Templates
                            </TabsTrigger>
                            <TabsTrigger value="history" className="flex items-center gap-2">
                                <History className="h-4 w-4" />
                                History ({emailHistory.length})
                            </TabsTrigger>
                        </TabsList>

                        {/* Compose Tab */}
                        <TabsContent value="compose" className="space-y-4">
                            {sendStatus && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`p-4 rounded-lg flex items-center gap-2 ${
                                        sendStatus.type === 'success'
                                            ? 'bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-900'
                                            : 'bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-900'
                                    }`}
                                >
                                    {sendStatus.type === 'success' ? (
                                        <CheckCircle2 className="h-5 w-5" />
                                    ) : (
                                        <AlertCircle className="h-5 w-5" />
                                    )}
                                    <span>{sendStatus.message}</span>
                                </motion.div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Select Client</Label>
                                    <Select value={selectedClientId} onValueChange={handleClientSelect}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose a client..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {clients.length === 0 ? (
                                                <SelectItem value="no-clients" disabled>No clients with email addresses</SelectItem>
                                            ) : (
                                                clients
                                                    .sort((a, b) => (a.firstName || a.name).localeCompare(b.firstName || b.name))
                                                    .map(client => (
                                                        <SelectItem key={client.id} value={client.id}>
                                                            {client.name} ({client.email})
                                                        </SelectItem>
                                                    ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Use Template (Optional)</Label>
                                    <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a template..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {templates.map(template => (
                                                <SelectItem key={template.id} value={template.id}>
                                                    {template.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Appointment Selector - Only show when client is selected */}
                            {selectedClientId && (
                                <div className="space-y-2">
                                    <Label>Link to Session (Optional)</Label>
                                    <Select 
                                        value={selectedAppointmentId} 
                                        onValueChange={setSelectedAppointmentId}
                                        disabled={isLoadingAppointments}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={
                                                isLoadingAppointments 
                                                    ? "Loading sessions..." 
                                                    : clientAppointments.length === 0 
                                                        ? "No sessions found" 
                                                        : "Select a session..."
                                            } />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {clientAppointments.length === 0 ? (
                                                <SelectItem value="no-appointments" disabled>
                                                    No sessions found
                                                </SelectItem>
                                            ) : (
                                                <>
                                                    {/* Upcoming sessions */}
                                                    {clientAppointments.some(apt => apt.isUpcoming) && (
                                                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                                                            📅 Upcoming Sessions
                                                        </div>
                                                    )}
                                                    {clientAppointments.filter(apt => apt.isUpcoming).map(apt => {
                                                        // Parse date correctly - apt.date is already an ISO string
                                                        let aptDate: Date;
                                                        if (apt.date && apt.date.includes('T')) {
                                                            // Already an ISO string with time
                                                            aptDate = new Date(apt.date);
                                                        } else {
                                                            // Date only, combine with time
                                                            const timeStr = apt.time || '00:00';
                                                            aptDate = new Date(`${apt.date}T${timeStr}`);
                                                        }
                                                        
                                                        // Check if date is valid
                                                        if (isNaN(aptDate.getTime())) {
                                                            console.error('[EmailTab] Invalid date for appointment:', apt);
                                                            return (
                                                                <SelectItem key={apt.id} value={apt.id}>
                                                                    Invalid Date - {apt.appointmentType} ({apt.duration}min)
                                                                </SelectItem>
                                                            );
                                                        }
                                                        
                                                        const formattedDate = aptDate.toLocaleDateString('en-GB', {
                                                            weekday: 'short',
                                                            day: 'numeric',
                                                            month: 'short'
                                                        });
                                                        const formattedTime = aptDate.toLocaleTimeString('en-GB', {
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        });
                                                        return (
                                                            <SelectItem key={apt.id} value={apt.id}>
                                                                {formattedDate} {formattedTime} - {apt.appointmentType} ({apt.duration}min)
                                                            </SelectItem>
                                                        );
                                                    })}
                                                    
                                                    {/* Recent sessions */}
                                                    {clientAppointments.some(apt => !apt.isUpcoming) && (
                                                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 mt-1">
                                                            🕐 Recent Sessions (Last 30 days)
                                                        </div>
                                                    )}
                                                    {clientAppointments.filter(apt => !apt.isUpcoming).map(apt => {
                                                        // Parse date correctly - apt.date is already an ISO string
                                                        let aptDate: Date;
                                                        if (apt.date && apt.date.includes('T')) {
                                                            // Already an ISO string with time
                                                            aptDate = new Date(apt.date);
                                                        } else {
                                                            // Date only, combine with time
                                                            const timeStr = apt.time || '00:00';
                                                            aptDate = new Date(`${apt.date}T${timeStr}`);
                                                        }
                                                        
                                                        // Check if date is valid
                                                        if (isNaN(aptDate.getTime())) {
                                                            console.error('[EmailTab] Invalid date for appointment:', apt);
                                                            return (
                                                                <SelectItem key={apt.id} value={apt.id}>
                                                                    Invalid Date - {apt.appointmentType} ({apt.duration}min)
                                                                </SelectItem>
                                                            );
                                                        }
                                                        
                                                        const formattedDate = aptDate.toLocaleDateString('en-GB', {
                                                            weekday: 'short',
                                                            day: 'numeric',
                                                            month: 'short'
                                                        });
                                                        const formattedTime = aptDate.toLocaleTimeString('en-GB', {
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        });
                                                        return (
                                                            <SelectItem key={apt.id} value={apt.id}>
                                                                {formattedDate} {formattedTime} - {apt.appointmentType} ({apt.duration}min)
                                                            </SelectItem>
                                                        );
                                                    })}
                                                </>
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Select an upcoming or recent session to use {`{{appointmentDate}}`}, {`{{appointmentType}}`}, and {`{{duration}}`} variables
                                    </p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Subject</Label>
                                <Input
                                    value={emailSubject}
                                    onChange={(e) => setEmailSubject(e.target.value)}
                                    placeholder="Enter email subject..."
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Email Body</Label>
                                    <div className="flex gap-1 flex-wrap">
                                        {TEMPLATE_VARIABLES.map(v => (
                                            <Button
                                                key={v.key}
                                                variant="outline"
                                                size="sm"
                                                onClick={() => insertComposeVariable(v.key)}
                                                title={v.description}
                                                className="text-xs h-7"
                                            >
                                                {v.key.replace(/\{\{|\}\}/g, '')}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                                <ComposeEditor 
                                    content={emailBody}
                                    onChange={setEmailBody}
                                    editorRef={composeEditorRef}
                                    placeholder="Write your email content here..."
                                />
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button
                                    onClick={handleSendEmail}
                                    disabled={isSending || !selectedClientId || !emailSubject.trim()}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    {isSending ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="mr-2 h-4 w-4" />
                                            Send Email
                                        </>
                                    )}
                                </Button>
                            </div>
                        </TabsContent>

                        {/* Templates Tab */}
                        <TabsContent value="templates" className="space-y-4">
                            <div className="flex justify-between items-center">
                                <p className="text-sm text-muted-foreground">
                                    Create and manage email templates for quick communication
                                </p>
                                <Button onClick={() => {
                                    setEditingTemplate(null);
                                    setNewTemplateName('');
                                    setNewTemplateSubject('');
                                    setNewTemplateBody('');
                                    setNewTemplateCategory('general');
                                    setIsCreatingTemplate(true);
                                }}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    New Template
                                </Button>
                            </div>

                            <div className="grid gap-4">
                                {templates.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                        <p>No email templates yet</p>
                                        <p className="text-sm">Create your first template to get started</p>
                                    </div>
                                ) : (
                                    templates.map(template => (
                                        <Card key={template.id} className="hover:shadow-md transition-shadow">
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-medium">{template.name}</h4>
                                                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                                                {template.category}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground mt-1">
                                                            Subject: {template.subject}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                            {(template.text_body || template.html_body || '').substring(0, 150)}...
                                                        </p>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleEditTemplate(template)}
                                                            className="h-8 w-8"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDeleteTemplate(template.id)}
                                                            className="h-8 w-8 text-red-500 hover:text-red-700"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </TabsContent>

                        {/* History Tab */}
                        <TabsContent value="history" className="space-y-4">
                            {isLoadingHistory ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    <span className="ml-2 text-muted-foreground">Loading history...</span>
                                </div>
                            ) : emailHistory.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>No emails sent yet</p>
                                    <p className="text-sm">Sent emails will appear here</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {emailHistory.map(entry => (
                                        <Card key={entry.id} className="hover:shadow-md transition-shadow">
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <User className="h-4 w-4 text-muted-foreground" />
                                                            <span className="font-medium">{entry.client_name || 'Unknown'}</span>
                                                            <span className="text-sm text-muted-foreground">
                                                                ({entry.client_email})
                                                            </span>
                                                        </div>
                                                        <p className="text-sm font-medium mt-1">{entry.subject}</p>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            Sent: {new Date(entry.sent_at).toLocaleString()}
                                                        </p>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => setViewingEmail(entry)}
                                                            className="h-8 w-8"
                                                            title="View email"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDeleteHistoryEntry(entry.id)}
                                                            className="h-8 w-8 text-red-500 hover:text-red-700"
                                                            title="Delete record"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Create/Edit Template Dialog */}
            <Dialog open={isCreatingTemplate} onOpenChange={setIsCreatingTemplate}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editingTemplate ? 'Edit Template' : 'Create New Template'}
                        </DialogTitle>
                        <DialogDescription>
                            Create a reusable email template. Use placeholders like {`{{clientName}}`} for dynamic content.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Template Name</Label>
                                <Input
                                    value={newTemplateName}
                                    onChange={(e) => setNewTemplateName(e.target.value)}
                                    placeholder="e.g., Welcome Email"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Category</Label>
                                <Select value={newTemplateCategory} onValueChange={setNewTemplateCategory}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="general">General</SelectItem>
                                        <SelectItem value="appointment">Appointment</SelectItem>
                                        <SelectItem value="followup">Follow-up</SelectItem>
                                        <SelectItem value="payment">Payment</SelectItem>
                                        <SelectItem value="cancellation">Cancellation</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Subject Line</Label>
                            <Input
                                value={newTemplateSubject}
                                onChange={(e) => setNewTemplateSubject(e.target.value)}
                                placeholder="e.g., Your appointment is confirmed"
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Email Body</Label>
                                <div className="flex gap-1 flex-wrap">
                                    {TEMPLATE_VARIABLES.map(v => (
                                        <Button
                                            key={v.key}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => insertTemplateVariable(v.key)}
                                            title={v.description}
                                            className="text-xs h-6"
                                        >
                                            {v.key.replace(/\{\{|\}\}/g, '')}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                            <TemplateEditor 
                                content={newTemplateBody}
                                onChange={setNewTemplateBody}
                                editorRef={templateEditorRef}
                                placeholder="Write your email template here..."
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreatingTemplate(false)}>
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleSaveTemplate}
                            disabled={isSavingTemplate || !newTemplateName.trim() || !newTemplateSubject.trim()}
                        >
                            {isSavingTemplate ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>Save Template</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Email Dialog */}
            <Dialog open={!!viewingEmail} onOpenChange={() => setViewingEmail(null)}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Email Details</DialogTitle>
                        <DialogDescription>
                            Sent to {viewingEmail?.client_name} ({viewingEmail?.client_email})
                        </DialogDescription>
                    </DialogHeader>
                    
                    {viewingEmail && (
                        <div className="space-y-4">
                            <div>
                                <Label className="text-muted-foreground">Subject</Label>
                                <p className="font-medium">{viewingEmail.subject}</p>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Sent At</Label>
                                <p>{new Date(viewingEmail.sent_at).toLocaleString()}</p>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Content</Label>
                                <div className="mt-2 p-4 border rounded-lg bg-muted/50">
                                    <div 
                                        dangerouslySetInnerHTML={{ 
                                            __html: viewingEmail.html_body || viewingEmail.text_body || '' 
                                        }} 
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setViewingEmail(null)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Template Confirmation Dialog */}
            <ConfirmationDialog
                open={deleteTemplateDialog.open}
                onOpenChange={(open) => setDeleteTemplateDialog({ open, templateId: open ? deleteTemplateDialog.templateId : null })}
                onConfirm={confirmDeleteTemplate}
                title="Delete Template"
                description="Are you sure you want to delete this template? This action cannot be undone."
                confirmButtonText="Delete"
                cancelButtonText="Cancel"
                variant="destructive"
            />

            {/* Delete Email Record Confirmation Dialog */}
            <ConfirmationDialog
                open={deleteEmailRecordDialog.open}
                onOpenChange={(open) => setDeleteEmailRecordDialog({ open, entryId: open ? deleteEmailRecordDialog.entryId : null })}
                onConfirm={confirmDeleteEmailRecord}
                title="Delete Email Record"
                description="Are you sure you want to delete this email record? This action cannot be undone."
                confirmButtonText="Delete"
                cancelButtonText="Cancel"
                variant="destructive"
            />
        </div>
    );
}

