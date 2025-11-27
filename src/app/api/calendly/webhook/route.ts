import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Session type with metadata
interface Session {
    id: string;
    metadata?: Record<string, any>;
}

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
    // Parse the event time - Calendly can put start_time in either eventData or invitee
    const startTime = invitee?.start_time || invitee?.startTime || 
                      eventData?.start_time || eventData?.startTime ||
                      invitee?.scheduled_event?.start_time || invitee?.scheduled_event?.startTime;
    const endTime = invitee?.end_time || invitee?.endTime || 
                    eventData?.end_time || eventData?.endTime ||
                    invitee?.scheduled_event?.end_time || invitee?.scheduled_event?.endTime;
    
    if (!startTime) {
        console.error('[Calendly] No start time found. Event data:', JSON.stringify(eventData, null, 2));
        console.error('[Calendly] Invitee data:', JSON.stringify(invitee, null, 2));
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
            console.warn('[Calendly Webhook] Missing CALENDLY_WEBHOOK_SIGNING_KEY - Skipping signature verification (NOT RECOMMENDED FOR PRODUCTION)');
            // We allow proceeding without key for testing/debugging purposes if the user can't get the key
        }

        // Get raw body for signature verification
        const rawBody = await request.text();
        const signature = request.headers.get('calendly-webhook-signature') || 
                         request.headers.get('x-calendly-webhook-signature') || '';

        // Verify webhook signature (only if key is present)
        if (signingKey && signature) {
            if (!verifyWebhookSignature(rawBody, signature, signingKey)) {
                console.error('[Calendly Webhook] Invalid signature');
                return NextResponse.json(
                    { error: 'Invalid webhook signature' },
                    { status: 401 }
                );
            }
        } else if (!signingKey) {
             // Warn again if we are skipping
             console.warn('[Calendly Webhook] Processing unverified request due to missing signing key configuration');
        }

        // Parse webhook payload
        const payload = JSON.parse(rawBody);
        const event = payload.event || payload;
        // Extract event type - Calendly can put it at payload.event or payload.event_type or nested in payload
        const eventType = payload.event || payload.event_type || (payload.payload && payload.payload.event_type) || 'invitee.created';

        console.log(`[Calendly Webhook] ========== WEBHOOK RECEIVED ==========`);
        console.log(`[Calendly Webhook] Event type: ${eventType}`);
        console.log(`[Calendly Webhook] Payload keys:`, Object.keys(payload));
        console.log(`[Calendly Webhook] Full payload:`, JSON.stringify(payload, null, 2));
        console.log(`[Calendly Webhook] =======================================`);

        // Handle different event types
        if (eventType === 'invitee.created' || eventType.includes('created')) {
            // New booking
            // Calendly webhook structure can vary - try multiple paths
            // Structure 1: { event: "invitee.created", payload: { invitee: {...}, scheduled_event: {...} } }
            // Structure 2: { event: "invitee.created", invitee: { ... }, scheduled_event: { ... } }
            // Structure 3: { event: "invitee.created", payload: { ... } }
            
            // Try to extract invitee from various possible locations
            const invitee = payload.payload?.invitee || 
                          payload.invitee || 
                          (payload.payload?.event && payload.payload.event.invitee) ||
                          (payload.event && typeof payload.event === 'object' && payload.event.invitee);
            
            // Try to extract scheduled_event/event data from various possible locations
            const eventData = payload.payload?.scheduled_event || 
                            payload.scheduled_event ||
                            payload.payload?.event || 
                            payload.event || 
                            payload;

            console.log('[Calendly Webhook] Extracted invitee:', invitee ? `Found (keys: ${Object.keys(invitee || {}).join(', ')})` : 'Missing');
            console.log('[Calendly Webhook] Extracted eventData:', eventData ? `Found (keys: ${Object.keys(eventData || {}).join(', ')})` : 'Missing');
            
            if (invitee) {
                console.log('[Calendly Webhook] Invitee data:', JSON.stringify(invitee, null, 2));
            }
            if (eventData && eventData !== payload) {
                console.log('[Calendly Webhook] Event data:', JSON.stringify(eventData, null, 2));
            }

            if (!invitee) {
                console.error('[Calendly Webhook] No invitee data. Full payload:', JSON.stringify(payload, null, 2));
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
            console.log(`[Calendly Webhook] Finding/creating client: ${email} (${name})`);
            const client = await findOrCreateClient(email, name);
            console.log(`[Calendly Webhook] Client: ${client.id} - ${client.name}`);

            // Create session
            console.log(`[Calendly Webhook] Creating session for client ${client.id}`);
            const session = await createSessionFromBooking(client.id, eventData, invitee);
            console.log(`[Calendly Webhook] ✅ Successfully created session: ${session.id}`);

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
            // Calendly webhook structure can vary - try multiple paths
            const invitee = payload.payload?.invitee || 
                          payload.invitee || 
                          (event && typeof event === 'object' && event.invitee);
            const eventData = payload.payload?.scheduled_event || 
                            payload.scheduled_event ||
                            payload.payload?.event || 
                            (event && typeof event === 'object' ? event.event : null) ||
                            payload.event || 
                            payload;
            const email = extractEmail(invitee);
            const startTime = invitee?.start_time || invitee?.startTime || 
                            eventData?.start_time || eventData?.startTime;

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
                        .select('id, metadata')
                        .eq('client_id', clients[0].id)
                        .eq('date', startDate.toISOString())
                        .limit(1)
                        .returns<Session[]>();

                    if (sessions && sessions.length > 0) {
                        await supabase
                            .from('sessions')
                            .update({
                                metadata: {
                                    ...(sessions[0].metadata ?? {}),
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


