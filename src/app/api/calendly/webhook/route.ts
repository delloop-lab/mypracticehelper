import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Verify Calendly webhook signature
function verifyWebhookSignature(
    payload: string,
    signature: string,
    signingKey: string
): boolean {
    try {
        const hmac = crypto.createHmac('sha256', signingKey);
        const digest = hmac.update(payload).digest('base64');
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(digest)
        );
    } catch (error) {
        console.error('[Calendly Webhook] Signature verification error:', error);
        return false;
    }
}

// Extract email from Calendly invitee data
function extractEmail(invitee: any): string | null {
    if (invitee?.email) return invitee.email;
    if (invitee?.email_address) return invitee.email_address;
    if (invitee?.questions_and_answers) {
        for (const qa of invitee.questions_and_answers) {
            if (qa?.question?.toLowerCase().includes('email')) {
                return qa.answer;
            }
        }
    }
    return null;
}

// Extract name from Calendly invitee data
function extractName(invitee: any): string {
    if (invitee?.name) return invitee.name;
    if (invitee?.first_name || invitee?.last_name) {
        return [invitee.first_name, invitee.last_name].filter(Boolean).join(' ');
    }
    return 'Calendly Booking';
}

// Find or create client by email
async function findOrCreateClient(email: string, name: string) {
    // First, try to find existing client by email
    const { data: existingClients } = await supabase
        .from('clients')
        .select('*')
        .or(`email.eq.${email},metadata->>email.eq.${email}`)
        .limit(1);

    if (existingClients && existingClients.length > 0) {
        console.log(`[Calendly] Found existing client: ${existingClients[0].name} (${email})`);
        return existingClients[0];
    }

    // Create new client
    const newClient = {
        name: name || email.split('@')[0],
        email: email,
        notes: `Created from Calendly booking`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    const { data: createdClient, error } = await supabase
        .from('clients')
        .insert([newClient])
        .select()
        .single();

    if (error) {
        console.error('[Calendly] Error creating client:', error);
        throw error;
    }

    console.log(`[Calendly] Created new client: ${createdClient.name} (${email})`);
    return createdClient;
}

// Create session from Calendly booking
async function createSessionFromBooking(
    clientId: string,
    eventData: any,
    invitee: any
) {
    // Parse the event time
    const startTime = eventData.start_time || eventData.startTime;
    const endTime = eventData.end_time || eventData.endTime;
    
    if (!startTime) {
        throw new Error('No start time in Calendly event');
    }

    const startDate = new Date(startTime);
    const endDate = endTime ? new Date(endTime) : new Date(startDate.getTime() + 60 * 60 * 1000); // Default 1 hour
    
    const duration = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60)); // Duration in minutes

    // Check if session already exists (avoid duplicates)
    const { data: existingSessions } = await supabase
        .from('sessions')
        .select('id')
        .eq('client_id', clientId)
        .eq('date', startDate.toISOString())
        .limit(1);

    if (existingSessions && existingSessions.length > 0) {
        console.log(`[Calendly] Session already exists for ${startDate.toISOString()}`);
        return existingSessions[0];
    }

    // Get event type name if available
    const eventType = eventData.event_type || eventData.eventType || 'Therapy Session';
    const eventTypeName = typeof eventType === 'string' ? eventType : (eventType.name || 'Therapy Session');

    // Create session
    const sessionData: any = {
        id: `cal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        client_id: clientId,
        date: startDate.toISOString(),
        duration: duration,
        type: eventTypeName,
        notes: `Booked via Calendly${invitee?.questions_and_answers ? '\n\n' + invitee.questions_and_answers.map((qa: any) => `${qa.question}: ${qa.answer}`).join('\n') : ''}`,
        metadata: {
            source: 'calendly',
            calendlyEventUri: eventData.uri || eventData.event_uri,
            calendlyInviteeUri: invitee?.uri || invitee?.invitee_uri,
            status: 'confirmed',
            paymentStatus: 'unpaid',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    const { data: createdSession, error } = await supabase
        .from('sessions')
        .insert([sessionData])
        .select()
        .single();

    if (error) {
        console.error('[Calendly] Error creating session:', error);
        throw error;
    }

    console.log(`[Calendly] Created session: ${createdSession.id} for ${startDate.toISOString()}`);
    return createdSession;
}

export async function POST(request: Request) {
    try {
        // Get webhook signing key
        const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
        if (!signingKey) {
            console.error('[Calendly Webhook] Missing CALENDLY_WEBHOOK_SIGNING_KEY');
            return NextResponse.json(
                { error: 'Webhook signing key not configured' },
                { status: 500 }
            );
        }

        // Get raw body for signature verification
        const rawBody = await request.text();
        const signature = request.headers.get('calendly-webhook-signature') || 
                         request.headers.get('x-calendly-webhook-signature') || '';

        // Verify webhook signature (if provided)
        if (signature && !verifyWebhookSignature(rawBody, signature, signingKey)) {
            console.error('[Calendly Webhook] Invalid signature');
            return NextResponse.json(
                { error: 'Invalid webhook signature' },
                { status: 401 }
            );
        }

        // Parse webhook payload
        const payload = JSON.parse(rawBody);
        const event = payload.event || payload;
        const eventType = event.event || payload.event_type || 'invitee.created';

        console.log(`[Calendly Webhook] Received event: ${eventType}`);

        // Handle different event types
        if (eventType === 'invitee.created' || eventType.includes('created')) {
            // New booking
            const invitee = event.invitee || payload.invitee;
            const eventData = event.event || payload.event || event;

            if (!invitee) {
                console.error('[Calendly Webhook] No invitee data');
                return NextResponse.json(
                    { error: 'No invitee data' },
                    { status: 400 }
                );
            }

            // Extract email and name
            const email = extractEmail(invitee);
            const name = extractName(invitee);

            if (!email) {
                console.error('[Calendly Webhook] No email found in invitee data');
                return NextResponse.json(
                    { error: 'No email found' },
                    { status: 400 }
                );
            }

            // Find or create client
            const client = await findOrCreateClient(email, name);

            // Create session
            const session = await createSessionFromBooking(client.id, eventData, invitee);

            return NextResponse.json({
                success: true,
                event: eventType,
                clientId: client.id,
                clientName: client.name,
                sessionId: session.id,
                message: `Session created for ${client.name}`,
            });

        } else if (eventType === 'invitee.canceled' || eventType.includes('canceled')) {
            // Cancellation - mark session as canceled if found
            const invitee = event.invitee || payload.invitee;
            const email = extractEmail(invitee);
            const eventData = event.event || payload.event || event;
            const startTime = eventData.start_time || eventData.startTime;

            if (email && startTime) {
                const startDate = new Date(startTime);
                
                // Find client
                const { data: clients } = await supabase
                    .from('clients')
                    .select('id')
                    .or(`email.eq.${email},metadata->>email.eq.${email}`)
                    .limit(1);

                if (clients && clients.length > 0) {
                    // Find and update session
                    const { data: sessions } = await supabase
                        .from('sessions')
                        .select('id')
                        .eq('client_id', clients[0].id)
                        .eq('date', startDate.toISOString())
                        .limit(1);

                    if (sessions && sessions.length > 0) {
                        await supabase
                            .from('sessions')
                            .update({
                                metadata: {
                                    ...sessions[0].metadata,
                                    status: 'canceled',
                                },
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', sessions[0].id);

                        console.log(`[Calendly] Marked session as canceled: ${sessions[0].id}`);
                    }
                }
            }

            return NextResponse.json({
                success: true,
                event: eventType,
                message: 'Cancellation processed',
            });

        } else {
            // Unknown event type
            console.log(`[Calendly Webhook] Unhandled event type: ${eventType}`);
            return NextResponse.json({
                success: true,
                event: eventType,
                message: 'Event received but not processed',
            });
        }

    } catch (error: any) {
        console.error('[Calendly Webhook] Error:', error);
        return NextResponse.json(
            {
                error: error.message || 'Internal server error',
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            },
            { status: 500 }
        );
    }
}

// Handle GET requests (for webhook verification)
export async function GET() {
    return NextResponse.json({
        message: 'Calendly webhook endpoint is active',
        instructions: 'Configure this URL in Calendly webhook settings',
        url: '/api/calendly/webhook',
    });
}


