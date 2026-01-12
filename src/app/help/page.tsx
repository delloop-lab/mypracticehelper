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
                            <h3 className="font-semibold mb-2">What is a Session Note</h3>
                            <p className="text-sm text-muted-foreground">
                                A Session Note is a record written by a therapist after a session to summarise what happened, capture observations, and note any follow-up actions. It helps track the client's progress over time.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-2">What is an Admin Note</h3>
                            <p className="text-sm text-muted-foreground">
                                An Admin Note is an internal note used by the clinic or practice staff to record administrative details, reminders, or follow-ups related to a client or session.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-2">How do I add a new client?</h3>
                            <p className="text-sm text-muted-foreground">
                                Go to the Clients page and click "Add New Client." Fill in the client's details—name, email, phone, and any other relevant information. You can also import multiple clients at once from an .xlsx file.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-2">How do I mark a client form as signed?</h3>
                            <p className="text-sm text-muted-foreground">
                                Open the client's details by clicking on their card, then check the "New Client Form Signed" box in the edit dialog. This will automatically remove them from the reminders list.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-2">How do I record Session Notes?</h3>
                            <p className="text-sm text-muted-foreground">
                                Go to the Recordings page and create a new recording. Automatic AI transcription will capture the session. For best results, use Chrome or Edge.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-2">How do I add Admin Notes?</h3>
                            <p className="text-sm text-muted-foreground">
                                Go to the Sessions page, open the relevant session, and add notes about the session or the client's demeanour. These notes are internal and help your team stay organised.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-2">How do I set up Calendly integration?</h3>
                            <p className="text-sm text-muted-foreground">
                                Go to Settings &gt; Calendly and enter your Calendly Personal Access Token (PAT). Once set up, any appointments booked in Calendly will automatically appear in your schedule.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-2">How do I create custom reminders?</h3>
                            <p className="text-sm text-muted-foreground">
                                Go to Settings &gt; Reminders, click "Create New Reminder," and choose a template or make your own. Custom reminders appear in the Reminders page and can be configured to trigger based on specific conditions.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-2">How do I upload documents for a client?</h3>
                            <p className="text-sm text-muted-foreground">
                                You can upload documents in two ways:
                                <br />
                                <br />
                                Open the client's details, go to the Documents tab, and click "Upload Document."
                                <br />
                                <br />
                                Go to the Documents page to upload company-wide or client-specific files.
                                <br />
                                <br />
                                All documents are stored securely and can be viewed or deleted anytime.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-2">How do I mark a session as paid?</h3>
                            <p className="text-sm text-muted-foreground">
                                Go to the Revenue page, find the session, and click the payment status to toggle between paid and unpaid. You can also edit the fee for each session.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-2">Can I customize appointment types?</h3>
                            <p className="text-sm text-muted-foreground">
                                Yes! Go to Settings &gt; Appointments to add, edit, or remove appointment types. Each type can have its own duration and default fee, and you can enable or disable specific types as needed.
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




