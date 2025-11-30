"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle, ExternalLink, Copy, RefreshCw } from "lucide-react";

export default function WebhookSetupPage() {
    const [accessToken, setAccessToken] = useState("");
    const [organizationUri, setOrganizationUri] = useState("");
    const [webhookUrl, setWebhookUrl] = useState("");
    const [signingKey, setSigningKey] = useState("");
    const [webhooks, setWebhooks] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const getHeaders = () => ({
        'Authorization': `Bearer ${accessToken.trim()}`,
        'Content-Type': 'application/json'
    });

    const getOrganization = async () => {
        const token = accessToken.trim();
        if (!token) {
            setStatus({ type: 'error', message: 'Please enter your Personal Access Token' });
            return;
        }

        setLoading(true);
        setStatus(null);

        try {
            const response = await fetch('https://api.calendly.com/users/me', { 
                headers: getHeaders() 
            });
            const data = await response.json();

            if (response.ok) {
                const orgUri = data.resource?.current_organization || data.resource?.uri;
                setOrganizationUri(orgUri);
                setStatus({ 
                    type: 'success', 
                    message: `✅ Connected as: ${data.resource?.name || 'User'}` 
                });
                listWebhooks(); // Auto-load webhooks
            } else {
                throw new Error(data.message || 'Unknown error');
            }
        } catch (e: any) {
            setStatus({ type: 'error', message: `Error: ${e.message}` });
        } finally {
            setLoading(false);
        }
    };

    const listWebhooks = async () => {
        if (!organizationUri) {
            setStatus({ type: 'error', message: 'Please connect and find organization first' });
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(
                `https://api.calendly.com/webhook_subscriptions?organization=${encodeURIComponent(organizationUri)}&scope=organization`,
                { headers: getHeaders() }
            );
            const data = await response.json();

            if (response.ok) {
                const webhooksList = data.collection || [];
                setWebhooks(webhooksList);
                
                // Try to fetch signing key from first webhook if we don't have it
                if (webhooksList.length > 0 && !signingKey) {
                    const firstWebhook = webhooksList[0];
                    if (firstWebhook.uri) {
                        try {
                            const detailsResponse = await fetch(firstWebhook.uri, {
                                headers: getHeaders()
                            });
                            const detailsData = await detailsResponse.json();
                            if (detailsData.resource?.signing_key) {
                                setSigningKey(detailsData.resource.signing_key);
                                setStatus({ 
                                    type: 'success', 
                                    message: '✅ Found signing key from existing webhook!' 
                                });
                            }
                        } catch (e) {
                            console.log('Could not fetch webhook details:', e);
                        }
                    }
                }
                
                if (webhooksList.length === 0) {
                    setStatus({ type: 'success', message: 'No active webhooks found.' });
                }
            } else {
                throw new Error(data.message || 'Failed to list webhooks');
            }
        } catch (e: any) {
            setStatus({ type: 'error', message: `Error: ${e.message}` });
        } finally {
            setLoading(false);
        }
    };

    const fetchSigningKey = async (webhookUri: string) => {
        if (!webhookUri) return;
        
        setLoading(true);
        try {
            const response = await fetch(webhookUri, {
                headers: getHeaders()
            });
            const data = await response.json();
            
            if (response.ok && data.resource?.signing_key) {
                setSigningKey(data.resource.signing_key);
                setStatus({ 
                    type: 'success', 
                    message: '✅ Signing key retrieved!' 
                });
            } else {
                setStatus({ 
                    type: 'error', 
                    message: 'Signing key not available in API response. Check Calendly dashboard.' 
                });
            }
        } catch (e: any) {
            setStatus({ type: 'error', message: `Error: ${e.message}` });
        } finally {
            setLoading(false);
        }
    };

    const createWebhook = async () => {
        const token = accessToken.trim();
        const orgUri = organizationUri;
        const url = webhookUrl.trim();

        if (!token || !orgUri || !url) {
            setStatus({ type: 'error', message: 'Please fill in all fields' });
            return;
        }

        setLoading(true);
        setStatus(null);

        try {
            const response = await fetch('https://api.calendly.com/webhook_subscriptions', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    url: url,
                    events: ['invitee.created', 'invitee.canceled'],
                    organization: orgUri,
                    scope: 'organization'
                })
            });

            const data = await response.json();

            if (response.ok) {
                // Try to get signing key from response
                let signingKeyValue = data.resource?.signing_key || 
                                    data.collection?.[0]?.signing_key;
                
                // If not in response, try to fetch webhook details
                if (!signingKeyValue && data.resource?.uri) {
                    try {
                        const detailsResponse = await fetch(data.resource.uri, {
                            headers: getHeaders()
                        });
                        const detailsData = await detailsResponse.json();
                        signingKeyValue = detailsData.resource?.signing_key;
                    } catch (e) {
                        console.log('Could not fetch webhook details:', e);
                    }
                }
                
                if (!signingKeyValue) {
                    signingKeyValue = 'Check Calendly dashboard for signing key';
                    setStatus({ 
                        type: 'success', 
                        message: '✅ Webhook created! Signing key not returned - check Calendly dashboard at https://calendly.com/integrations/api_webhooks/webhooks' 
                    });
                } else {
                    setStatus({ 
                        type: 'success', 
                        message: '✅ Webhook created successfully!' 
                    });
                }
                
                setSigningKey(signingKeyValue);
                listWebhooks(); // Refresh list
            } else {
                throw new Error(data.message || JSON.stringify(data));
            }
        } catch (e: any) {
            setStatus({ type: 'error', message: `Error: ${e.message}` });
        } finally {
            setLoading(false);
        }
    };

    const deleteWebhook = async (uri: string) => {
        if (!confirm('Are you sure you want to delete this webhook?')) return;

        setLoading(true);
        try {
            const response = await fetch(uri, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (response.ok) {
                listWebhooks(); // Refresh list
                setStatus({ type: 'success', message: 'Webhook deleted successfully' });
            } else {
                throw new Error('Failed to delete webhook');
            }
        } catch (e: any) {
            setStatus({ type: 'error', message: `Error: ${e.message}` });
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setStatus({ type: 'success', message: 'Copied to clipboard!' });
        setTimeout(() => setStatus(null), 2000);
    };

    // Auto-detect webhook URL from current domain
    const detectWebhookUrl = () => {
        if (typeof window !== 'undefined') {
            const baseUrl = window.location.origin;
            setWebhookUrl(`${baseUrl}/api/calendly/webhook`);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2">🔗 Calendly Webhook Setup</h1>
                <p className="text-muted-foreground">
                    Configure your Calendly webhook integration
                </p>
            </div>

            <div className="space-y-6">
                {/* Status Messages */}
                {status && (
                    <Card className={status.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-2">
                                {status.type === 'success' ? (
                                    <CheckCircle className="h-5 w-5 text-green-600" />
                                ) : (
                                    <AlertCircle className="h-5 w-5 text-red-600" />
                                )}
                                <p className={status.type === 'success' ? 'text-green-800' : 'text-red-800'}>
                                    {status.message}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Step 1: Authentication */}
                <Card>
                    <CardHeader>
                        <CardTitle>Step 1: Authentication</CardTitle>
                        <CardDescription>
                            Enter your Personal Access Token (PAT) from Calendly
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="accessToken">Personal Access Token</Label>
                            <Input
                                id="accessToken"
                                type="password"
                                placeholder="Paste your Personal Access Token here"
                                value={accessToken}
                                onChange={(e) => setAccessToken(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Get your token from{" "}
                                <a
                                    href="https://calendly.com/integrations/api_webhooks/personal_access_tokens"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline inline-flex items-center gap-1"
                                >
                                    Calendly Personal Access Tokens
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={getOrganization} disabled={loading}>
                                {loading ? (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        Connecting...
                                    </>
                                ) : (
                                    "Connect & Find Organization"
                                )}
                            </Button>
                            <Button onClick={listWebhooks} variant="outline" disabled={loading || !organizationUri}>
                                List Existing Webhooks
                            </Button>
                        </div>
                        {organizationUri && (
                            <div className="p-3 bg-muted rounded-lg">
                                <p className="text-sm font-medium">Organization URI:</p>
                                <code className="text-xs break-all">{organizationUri}</code>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Step 2: Create Webhook */}
                <Card>
                    <CardHeader>
                        <CardTitle>Step 2: Create New Webhook</CardTitle>
                        <CardDescription>
                            Enter your webhook URL where Calendly will send events
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="webhookUrl">Webhook URL</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="webhookUrl"
                                    type="url"
                                    placeholder="https://your-app.vercel.app/api/calendly/webhook"
                                    value={webhookUrl}
                                    onChange={(e) => setWebhookUrl(e.target.value)}
                                />
                                <Button onClick={detectWebhookUrl} variant="outline" size="sm">
                                    Auto-detect
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                ⚠️ Ensure this matches your <strong>real deployed domain</strong>. 
                                Do not use <code>localhost</code> unless testing locally.
                            </p>
                        </div>
                        <Button onClick={createWebhook} disabled={loading || !organizationUri || !webhookUrl}>
                            {loading ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                "Create Webhook"
                            )}
                        </Button>

                        {/* Signing Key Display */}
                        {signingKey && (
                            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <h3 className="font-bold text-yellow-900 mb-1">
                                            🔥 IMPORTANT: Save This Key Now!
                                        </h3>
                                        <p className="text-sm text-yellow-800">
                                            The Signing Key is <strong>only shown once</strong>. Copy it immediately.
                                        </p>
                                    </div>
                                    <Button
                                        onClick={() => copyToClipboard(signingKey)}
                                        variant="outline"
                                        size="sm"
                                    >
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                                <Input
                                    value={signingKey}
                                    readOnly
                                    className="bg-white border-yellow-300 font-mono text-sm"
                                />
                                <p className="text-sm text-yellow-800 mt-2">
                                    <strong>Next Step:</strong> Add this to your Vercel Environment Variables as{" "}
                                    <code className="bg-yellow-100 px-1 rounded">CALENDLY_WEBHOOK_SIGNING_KEY</code>
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Step 3: Active Webhooks */}
                <Card>
                    <CardHeader>
                        <CardTitle>Step 3: Active Webhooks</CardTitle>
                        <CardDescription>
                            Your current webhook subscriptions
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {webhooks.length === 0 ? (
                            <p className="text-muted-foreground">
                                No webhooks found. Click "List Existing Webhooks" to check.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {webhooks.map((hook: any) => (
                                    <div
                                        key={hook.uri}
                                        className="flex items-center justify-between p-3 border rounded-lg"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium break-all">{hook.callback_url}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span
                                                    className={`text-xs px-2 py-1 rounded ${
                                                        hook.state === 'active'
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-gray-100 text-gray-800'
                                                    }`}
                                                >
                                                    {hook.state}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    Created: {new Date(hook.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => fetchSigningKey(hook.uri)}
                                                variant="outline"
                                                size="sm"
                                                disabled={loading}
                                            >
                                                Get Key
                                            </Button>
                                            <Button
                                                onClick={() => deleteWebhook(hook.uri)}
                                                variant="destructive"
                                                size="sm"
                                                disabled={loading}
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Instructions */}
                <Card>
                    <CardHeader>
                        <CardTitle>Next Steps</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <p>1. Copy the signing key above (if you created a new webhook)</p>
                        <p>2. Go to Vercel Dashboard → Your Project → Settings → Environment Variables</p>
                        <p>3. Add: <code className="bg-muted px-1 rounded">CALENDLY_WEBHOOK_SIGNING_KEY</code> = (your signing key)</p>
                        <p>4. Redeploy your app</p>
                        <p>5. Test by creating a Calendly appointment</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}


