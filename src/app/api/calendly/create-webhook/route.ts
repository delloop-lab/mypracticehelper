import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Helper endpoint to create a Calendly webhook subscription
 * 
 * You'll need:
 * 1. Personal Access Token from Calendly (Account → Personal Access Tokens)
 * 2. Your organization/user URI
 * 
 * Usage:
 * POST /api/calendly/create-webhook
 * Body: {
 *   "accessToken": "your-personal-access-token",
 *   "organizationUri": "https://api.calendly.com/organizations/...",
 *   "webhookUrl": "https://your-app.vercel.app/api/calendly/webhook"
 * }
 */
export async function POST(request: Request) {
    try {
        const { accessToken, organizationUri, webhookUrl, userUri } = await request.json();

        if (!accessToken) {
            return NextResponse.json(
                { error: 'Personal Access Token is required' },
                { status: 400 }
            );
        }

        if (!webhookUrl) {
            return NextResponse.json(
                { error: 'Webhook URL is required' },
                { status: 400 }
            );
        }

        // Determine scope (organization or user)
        const scope = organizationUri ? 'organization' : 'user';
        const ownerUri = organizationUri || userUri;

        if (!ownerUri) {
            return NextResponse.json(
                { error: 'Either organizationUri or userUri is required' },
                { status: 400 }
            );
        }

        // Create webhook subscription via Calendly API
        const response = await fetch('https://api.calendly.com/webhook_subscriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: webhookUrl,
                events: ['invitee.created', 'invitee.canceled'],
                organization: organizationUri || undefined,
                user: userUri || undefined,
                scope: scope,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[Calendly] Webhook creation error:', data);
            return NextResponse.json(
                {
                    error: 'Failed to create webhook',
                    details: data,
                },
                { status: response.status }
            );
        }

        return NextResponse.json({
            success: true,
            webhook: data,
            message: 'Webhook subscription created successfully',
            signingKey: data.resource?.signing_key || 'Check Calendly dashboard for signing key',
        });

    } catch (error: any) {
        console.error('[Calendly] Error creating webhook:', error);
        return NextResponse.json(
            {
                error: error.message || 'Internal server error',
            },
            { status: 500 }
        );
    }
}

/**
 * GET endpoint to help user find their organization/user URI
 */
export async function GET() {
    return NextResponse.json({
        instructions: 'To create a webhook, you need:',
        steps: [
            '1. Get your Personal Access Token from Calendly:',
            '   - Go to Account → Personal Access Tokens',
            '   - Create a new token with webhook permissions',
            '',
            '2. Get your Organization/User URI:',
            '   - Make a GET request to: https://api.calendly.com/users/me',
            '   - Use header: Authorization: Bearer YOUR_TOKEN',
            '   - Find "current_organization" or "uri" in the response',
            '',
            '3. Create webhook:',
            '   POST /api/calendly/create-webhook',
            '   Body: {',
            '     "accessToken": "your-token",',
            '     "organizationUri": "https://api.calendly.com/organizations/...",',
            '     "webhookUrl": "https://your-app.vercel.app/api/calendly/webhook"',
            '   }',
        ],
        example: {
            method: 'POST',
            url: '/api/calendly/create-webhook',
            body: {
                accessToken: 'your-personal-access-token',
                organizationUri: 'https://api.calendly.com/organizations/XXXXXXXX',
                webhookUrl: 'https://your-app.vercel.app/api/calendly/webhook',
            },
        },
    });
}


