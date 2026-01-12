"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpCircle, BookOpen, MessageCircle, Settings, Users, Calendar, Landmark, FileText, Bell, Mic, Upload, Search } from "lucide-react";

export default function HelpPage() {
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-7xl">
            <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2">Help & Support</h1>
                <p className="text-muted-foreground">
                    Get answers to common questions and learn how to make the most of My Practice Helper
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Managing Clients
                        </CardTitle>
                        <CardDescription>
                            Learn how to add, edit, and manage your client information
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>• Add new clients with contact details</li>
                            <li>• Track client sessions and documents</li>
                            <li>• Mark required forms as signed</li>
                            <li>• Archive or delete clients</li>
                        </ul>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            Scheduling & Appointments
                        </CardTitle>
                        <CardDescription>
                            Manage your calendar and appointments
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>• View upcoming appointments</li>
                            <li>• Edit appointment times and types</li>
                            <li>• Integrate with Calendly</li>
                            <li>• Track session history</li>
                        </ul>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Landmark className="h-5 w-5" />
                            Revenue
                        </CardTitle>
                        <CardDescription>
                            Track revenue and manage payments
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>• View revenue by period</li>
                            <li>• Track paid and unpaid sessions</li>
                            <li>• See outstanding accounts</li>
                            <li>• View revenue charts</li>
                        </ul>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Session and Admin Notes
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>• Write Admin Notes</li>
                            <li>• Record Session Notes audio</li>
                            <li>• Automatic AI Transcription of recordings</li>
                            <li>• AI Clinical Assessment of of actual session recordings</li>
                            <li>• Filter and search notes</li>
                        </ul>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Bell className="h-5 w-5" />
                            Reminders
                        </CardTitle>
                        <CardDescription>
                            Stay on top of important tasks
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>• Track sessions awaiting session notes</li>
                            <li>• Monitor unsigned client forms</li>
                            <li>• View unpaid sessions</li>
                            <li>• Create custom reminders</li>
                        </ul>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Documents
                        </CardTitle>
                        <CardDescription>
                            Manage client and company documents
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>• Upload company or client documents</li>
                            <li>• View and download documents</li>
                            <li>• Share document links</li>
                            <li>• Organize by client or type</li>
                        </ul>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Settings className="h-5 w-5" />
                            Settings
                        </CardTitle>
                        <CardDescription>
                            Customize your practice settings
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>• Configure appointment types</li>
                            <li>• Upload your practice logo</li>
                            <li>• Manage custom reminders</li>
                            <li>• Set up Calendly integration</li>
                        </ul>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <HelpCircle className="h-5 w-5" />
                            Frequently Asked Questions
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h3 className="font-semibold mb-2">How do I add a new client?</h3>
                            <p className="text-sm text-muted-foreground">
                                Go to the Clients page and click the "Add New Client" button. Fill in the client's information including name, email, phone, and any other relevant details. You can also import clients from an .xlsx file.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-2">How do I mark a client form as signed?</h3>
                            <p className="text-sm text-muted-foreground">
                                Open the client's details by clicking on their card, then check the "New Client Form Signed" checkbox in the edit dialog. This will remove them from the reminders list.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-2">How do I record Clinical Notes?</h3>
                            <p className="text-sm text-muted-foreground">
                                Go to the Recording page and create a new recording with automatic AI transcription. Recordings work best in Chrome or Edge browsers.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-2">How to add Session Notes</h3>
                            <p className="text-sm text-muted-foreground">
                                You can add simple notes about the session and the person's demeanour by going to Sessions and editing the relevant session.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-2">How do I set up Calendly integration?</h3>
                            <p className="text-sm text-muted-foreground">
                                Go to Settings and find the Calendly section. You'll need a Calendly Personal Access Token (PAT). Once configured, appointments booked in Calendly will automatically appear in your schedule.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-2">How do I create custom reminders?</h3>
                            <p className="text-sm text-muted-foreground">
                                Go to Settings &gt; Reminders. Click "Create New Reminder" and choose from available templates or create your own. Custom reminders will appear in the Reminders page and can be configured to check for specific conditions.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-2">How do I upload documents for a client?</h3>
                            <p className="text-sm text-muted-foreground">
                                You can upload documents in two ways: 1) Open the client's details dialog and go to the Documents tab, then click "Upload Document" and select the file, or 2) Go to the Documents page and upload company documents or client-specific documents. Documents are stored securely and can be viewed or deleted at any time.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-2">How do I mark a session as paid?</h3>
                            <p className="text-sm text-muted-foreground">
                                Go to the Revenue page and find the session in the list. Click on the payment status to toggle between paid and unpaid. You can also edit the fee amount for each session.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-2">Can I customize appointment types?</h3>
                            <p className="text-sm text-muted-foreground">
                                Yes! Go to Settings &gt; Appointments. You can add, edit, or delete appointment types. Each type can have its own duration and default fee. You can also enable or disable specific types.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5" />
                            Quick Tips
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-3">
                            <Search className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                            <div>
                                <h3 className="font-semibold mb-1">Use the search function</h3>
                                <p className="text-sm text-muted-foreground">
                                    Most pages have a search bar to quickly find clients, sessions, or notes. Use it to filter by name, date, or other criteria.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Bell className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                            <div>
                                <h3 className="font-semibold mb-1">Check reminders daily</h3>
                                <p className="text-sm text-muted-foreground">
                                    The Reminders page helps you stay on top of important tasks like unsigned forms, sessions needing notes, and unpaid sessions.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Mic className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                            <div>
                                <h3 className="font-semibold mb-1">Use audio recordings for efficiency</h3>
                                <p className="text-sm text-muted-foreground">
                                    Recordings with AI transcription can save you time. Speak naturally about the session, and the AI will structure it into clinical sections.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Upload className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                            <div>
                                <h3 className="font-semibold mb-1">Import and export data</h3>
                                <p className="text-sm text-muted-foreground">
                                    You can import clients from .xlsx files and export your data for backup or migration purposes. Look for the import/export options in the Clients page.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MessageCircle className="h-5 w-5" />
                            Need More Help?
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                            If you can't find the answer you're looking for, please don't hesitate to reach out to our support team.
                        </p>
                        <a href="mailto:help@mypracticehelper.com">
                            <Button variant="outline">
                                <MessageCircle className="h-4 w-4 mr-2" />
                                Contact Support
                            </Button>
                        </a>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}




