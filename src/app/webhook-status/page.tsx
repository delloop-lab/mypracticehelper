"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw, CheckCircle, XCircle, AlertCircle, Calendar } from "lucide-react";

interface WebhookStatus {
    status: string;
    webhook: {
        url: string;
        signingKeyConfigured: boolean;
        signingKeyPreview: string;
    };
    sessions: {
        total: number;
        calendlyCount: number;
        recentCalendly: Array<{
            id: string;
            date: string;
            created_at: string;
        }>;
    };
    clients: {
        calendlyCreated: number;
        recent: Array<{
            id: string;
            name: string;
            email: string;
            created_at: string;
        }>;
    };
    instructions: {
        checkWebhooks: string;
        setupGuide: string;
        testEndpoint: string;
    };
}

export default function WebhookStatusPage() {
    const [status, setStatus] = useState<WebhookStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [testingEndpoint, setTestingEndpoint] = useState(false);

    const loadStatus = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/calendly/webhook-status');
            if (response.ok) {
                const data = await response.json();
                setStatus(data);
            } else {
                setError('Failed to load webhook status');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load webhook status');
        } finally {
            setLoading(false);
        }
    };

    const testEndpoint = async () => {
        setTestingEndpoint(true);
        try {
            const response = await fetch('/api/calendly/webhook');
            const data = await response.json();
            alert(`Endpoint is active!\n\n${JSON.stringify(data, null, 2)}`);
        } catch (err: any) {
            alert(`Error testing endpoint: ${err.message}`);
        } finally {
            setTestingEndpoint(false);
        }
    };

    useEffect(() => {
        loadStatus();
    }, []);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
                        <p className="text-muted-foreground">Loading webhook status...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                <Card className="border-red-200 bg-red-50">
                    <CardHeader>
                        <CardTitle className="text-red-600">Error</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-red-700">{error}</p>
                        <Button onClick={loadStatus} className="mt-4">
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!status) {
        return null;
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2">Calendly Webhook Status</h1>
                <p className="text-muted-foreground">
                    Check your Calendly integration status and recent activity
                </p>
            </div>

            <div className="space-y-6">
                {/* Webhook Configuration */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Webhook Configuration</CardTitle>
                                <CardDescription>Current webhook setup status</CardDescription>
                            </div>
                            <Button onClick={loadStatus} variant="outline" size="sm">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Refresh
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <div>
                                <p className="font-medium">Webhook URL</p>
                                <p className="text-sm text-muted-foreground font-mono break-all">
                                    {status.webhook.url}
                                </p>
                            </div>
                            <Button
                                onClick={testEndpoint}
                                disabled={testingEndpoint}
                                variant="outline"
                                size="sm"
                            >
                                {testingEndpoint ? (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        Testing...
                                    </>
                                ) : (
                                    <>
                                        Test Endpoint
                                    </>
                                )}
                            </Button>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <div>
                                <p className="font-medium">Signing Key</p>
                                <p className="text-sm text-muted-foreground">
                                    {status.webhook.signingKeyConfigured ? (
                                        <span className="flex items-center gap-2 text-green-600">
                                            <CheckCircle className="h-4 w-4" />
                                            Configured ({status.webhook.signingKeyPreview})
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-2 text-red-600">
                                            <XCircle className="h-4 w-4" />
                                            Not configured
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>

                        {!status.webhook.signingKeyConfigured && (
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="text-sm text-yellow-800">
                                    <AlertCircle className="inline h-4 w-4 mr-1" />
                                    <strong>Warning:</strong> Webhook signing key is not configured. 
                                    This is required for production use. Add <code>CALENDLY_WEBHOOK_SIGNING_KEY</code> to your environment variables.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Sessions Statistics */}
                <Card>
                    <CardHeader>
                        <CardTitle>Sessions Statistics</CardTitle>
                        <CardDescription>Calendly integration activity</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-muted rounded-lg">
                                <p className="text-sm text-muted-foreground">Total Sessions</p>
                                <p className="text-2xl font-bold">{status.sessions.total}</p>
                            </div>
                            <div className="p-4 bg-muted rounded-lg">
                                <p className="text-sm text-muted-foreground">From Calendly</p>
                                <p className="text-2xl font-bold text-blue-600">{status.sessions.calendlyCount}</p>
                            </div>
                        </div>

                        {status.sessions.recentCalendly.length > 0 && (
                            <div>
                                <p className="font-medium mb-2">Recent Calendly Sessions</p>
                                <div className="space-y-2">
                                    {status.sessions.recentCalendly.map((session) => (
                                        <div
                                            key={session.id}
                                            className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-blue-500" />
                                                <span>{formatDate(session.date)}</span>
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                                {formatDate(session.created_at)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {status.sessions.calendlyCount === 0 && (
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="text-sm text-yellow-800">
                                    <AlertCircle className="inline h-4 w-4 mr-1" />
                                    No Calendly sessions found. If you've created appointments, check:
                                    <ul className="list-disc list-inside mt-2 ml-4">
                                        <li>Is the webhook properly configured in Calendly?</li>
                                        <li>Are webhooks being received? (check server logs)</li>
                                        <li>Try creating a test appointment in Calendly</li>
                                    </ul>
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Clients Created */}
                <Card>
                    <CardHeader>
                        <CardTitle>Clients Created from Calendly</CardTitle>
                        <CardDescription>Clients automatically created from bookings</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-4">
                            <p className="text-2xl font-bold">{status.clients.calendlyCreated}</p>
                            <p className="text-sm text-muted-foreground">Total clients created</p>
                        </div>

                        {status.clients.recent.length > 0 && (
                            <div className="space-y-2">
                                {status.clients.recent.map((client) => (
                                    <div
                                        key={client.id}
                                        className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                                    >
                                        <div>
                                            <p className="font-medium">{client.name}</p>
                                            <p className="text-xs text-muted-foreground">{client.email}</p>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {formatDate(client.created_at)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Instructions */}
                <Card>
                    <CardHeader>
                        <CardTitle>How to Check/Configure Webhooks</CardTitle>
                        <CardDescription>Links and instructions</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="font-medium mb-2">1. Setup or Check Webhooks</p>
                            <div className="flex flex-col gap-2">
                                <Link
                                    href="/webhook-setup"
                                    className="flex items-center gap-2 text-blue-600 hover:underline"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                    Use Webhook Setup Tool (Recommended)
                                </Link>
                                <a
                                    href={status.instructions.checkWebhooks}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-blue-600 hover:underline"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                    Open Calendly Webhooks Dashboard
                                </a>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                                Use the setup tool to create webhooks, or check Calendly directly to see existing subscriptions.
                            </p>
                        </div>

                        <div>
                            <p className="font-medium mb-2">2. Verify Webhook URL</p>
                            <p className="text-sm text-muted-foreground mb-2">
                                Your webhook URL should be:
                            </p>
                            <code className="block p-2 bg-muted rounded text-sm break-all">
                                {status.webhook.url}
                            </code>
                            <p className="text-sm text-muted-foreground mt-2">
                                Make sure this exact URL is configured in Calendly.
                            </p>
                        </div>

                        <div>
                            <p className="font-medium mb-2">3. Test the Endpoint</p>
                            <p className="text-sm text-muted-foreground mb-2">
                                Click the "Test Endpoint" button above to verify the endpoint is accessible.
                            </p>
                        </div>

                        <div>
                            <p className="font-medium mb-2">4. Check Server Logs</p>
                            <p className="text-sm text-muted-foreground">
                                If webhooks are being sent but not working, check your Vercel deployment logs for errors.
                                Look for lines starting with <code>[Calendly Webhook]</code>.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

