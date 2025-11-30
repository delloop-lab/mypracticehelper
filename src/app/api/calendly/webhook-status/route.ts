import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // Check environment variables
        const webhookKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
        const hasWebhookKey = !!webhookKey;

        // Get webhook URL (use request headers to detect actual domain)
        const host = request.headers.get('host') || '';
        const protocol = request.headers.get('x-forwarded-proto') || 'https';
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                       (host ? `${protocol}://${host}` : null) ||
                       (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
                       'https://your-app.vercel.app';
        const webhookUrl = `${baseUrl}/api/calendly/webhook`;

        // Check for recent Calendly sessions
        const { data: calendlySessions, error: sessionsError } = await supabase
            .from('sessions')
            .select('id, date, client_id, metadata, created_at')
            .order('created_at', { ascending: false })
            .limit(10);

        // Filter for Calendly sessions
        const calendlyOnly = (calendlySessions || []).filter((s: any) => {
            try {
                const metadata = s.metadata || {};
                return metadata.source === 'calendly';
            } catch {
                return false;
            }
        });

        // Get total session count
        const { count: totalSessions } = await supabase
            .from('sessions')
            .select('*', { count: 'exact', head: true });

        // Get clients created from Calendly
        const { data: clients } = await supabase
            .from('clients')
            .select('id, name, email, notes, created_at')
            .ilike('notes', '%Calendly%')
            .order('created_at', { ascending: false })
            .limit(10);

        // Check recent webhook activity by looking at recent sessions
        const recentSessions = (calendlySessions || []).slice(0, 10);
        const webhookActivity = recentSessions.map((s: any) => ({
            id: s.id,
            date: s.date,
            created_at: s.created_at,
            isCalendly: (s.metadata || {}).source === 'calendly',
        }));

        return NextResponse.json({
            status: 'ok',
            webhook: {
                url: webhookUrl,
                signingKeyConfigured: hasWebhookKey,
                signingKeyPreview: webhookKey ? `${webhookKey.substring(0, 10)}...` : 'Not set',
                endpointTest: `${webhookUrl} (GET to verify endpoint is active)`,
            },
            activity: {
                recentSessions: webhookActivity,
                lastCalendlySession: calendlyOnly.length > 0 ? calendlyOnly[0].created_at : null,
            },
            sessions: {
                total: totalSessions || 0,
                calendlyCount: calendlyOnly.length,
                recentCalendly: calendlyOnly.slice(0, 5).map((s: any) => ({
                    id: s.id,
                    date: s.date,
                    created_at: s.created_at,
                })),
            },
            clients: {
                calendlyCreated: clients?.length || 0,
                recent: clients?.slice(0, 5).map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    email: c.email,
                    created_at: c.created_at,
                })) || [],
            },
            instructions: {
                checkWebhooks: 'https://calendly.com/integrations/api_webhooks/webhooks',
                setupGuide: 'See CALENDLY_WEBHOOK_SETUP.md or calendly-webhook-setup.html',
                testEndpoint: `${webhookUrl} (GET request to verify endpoint is active)`,
            },
        });
    } catch (error: any) {
        console.error('[Webhook Status] Error:', error);
        return NextResponse.json(
            {
                status: 'error',
                error: error.message || 'Unknown error',
            },
            { status: 500 }
        );
    }
}

