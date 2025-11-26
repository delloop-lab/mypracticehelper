import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const clientId = process.env.CALENDLY_CLIENT_ID;
    const clientSecret = process.env.CALENDLY_CLIENT_SECRET;
    const webhookKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;

    const status: any = {
        environment: process.env.NODE_ENV,
        clientId: clientId ? '✅ SET' : '❌ MISSING',
        clientSecret: clientSecret ? '✅ SET' : '❌ MISSING',
        webhookKey: webhookKey ? '✅ SET' : '❌ MISSING',
        clientIdPreview: clientId ? `${clientId.substring(0, 15)}...` : 'N/A',
        clientSecretPreview: clientSecret ? `${clientSecret.substring(0, 10)}...` : 'N/A',
        webhookKeyPreview: webhookKey ? `${webhookKey.substring(0, 10)}...` : 'N/A',
    };

    // Test if we can read the values (basic validation)
    if (clientId && clientId.length > 0) {
        status.clientIdLength = clientId.length;
        status.clientIdValid = clientId.startsWith('XX_') ? '✅ Valid format' : '⚠️ Unexpected format';
    }

    if (clientSecret && clientSecret.length > 0) {
        status.clientSecretLength = clientSecret.length;
        status.clientSecretValid = '✅ Present';
    }

    if (webhookKey && webhookKey.length > 0) {
        status.webhookKeyLength = webhookKey.length;
        status.webhookKeyValid = '✅ Present';
    }

    // Summary
    const allSet = clientId && clientSecret && webhookKey;
    status.summary = allSet ? '✅ All credentials are loaded' : '❌ Some credentials are missing';

    return NextResponse.json(status, {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
        },
    });
}

