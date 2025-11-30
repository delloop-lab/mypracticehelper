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
        id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
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
    // Parse the event time - Calendly can put start_time in various locations
    // When invitee data is in payload.payload, scheduled_event might be a URI that needs fetching
    // or it might be an object with start_time/end_time
    let startTime = invitee?.start_time || invitee?.startTime || 
                    eventData?.start_time || eventData?.startTime ||
                    invitee?.scheduled_event?.start_time || invitee?.scheduled_event?.startTime;
    
    let endTime = invitee?.end_time || invitee?.endTime || 
                  eventData?.end_time || eventData?.endTime ||
                  invitee?.scheduled_event?.end_time || invitee?.scheduled_event?.endTime;
    
    // If eventData is a URI (string), we need to fetch it first
    if (typeof eventData === 'string' && eventData.startsWith('http') && !startTime) {
        console.log('[Calendly] Event data is a URI, fetching to get start_time:', eventData);
        try {
            const eventResponse = await fetch(eventData, {
                headers: {
                    'Accept': 'application/json',
                },
            });
            if (eventResponse.ok) {
                const fetchedEventData = await eventResponse.json();
                const resource = fetchedEventData.resource || fetchedEventData;
                startTime = resource.start_time || resource.startTime;
                endTime = resource.end_time || resource.endTime;
                eventData = resource; // Update eventData to the fetched object
                console.log('[Calendly] ✅ Fetched event data, start_time:', startTime);
            }
        } catch (e: any) {
            console.error('[Calendly] Error fetching event data:', e.message);
        }
    }
    
    // If still no startTime, check if scheduled_event in payload.payload needs fetching
    if (!startTime && invitee?.scheduled_event && typeof invitee.scheduled_event === 'string' && invitee.scheduled_event.startsWith('http')) {
        console.log('[Calendly] scheduled_event is a URI in invitee, fetching:', invitee.scheduled_event);
        try {
            const eventResponse = await fetch(invitee.scheduled_event, {
                headers: {
                    'Accept': 'application/json',
                },
            });
            if (eventResponse.ok) {
                const fetchedEventData = await eventResponse.json();
                const resource = fetchedEventData.resource || fetchedEventData;
                startTime = resource.start_time || resource.startTime;
                endTime = resource.end_time || resource.endTime;
                if (!eventData || typeof eventData === 'string') {
                    eventData = resource; // Update eventData to the fetched object
                }
                console.log('[Calendly] ✅ Fetched scheduled_event, start_time:', startTime);
            }
        } catch (e: any) {
            console.error('[Calendly] Error fetching scheduled_event:', e.message);
        }
    }
    
    if (!startTime) {
        console.error('[Calendly] ❌ No start time found. Event data:', JSON.stringify(eventData, null, 2));
        console.error('[Calendly] Invitee data:', JSON.stringify(invitee, null, 2));
        throw new Error('No start time in Calendly event');
    }

    const startDate = new Date(startTime);
    const endDate = endTime ? new Date(endTime) : new Date(startDate.getTime() + 60 * 60 * 1000); // Default 1 hour
    
    // Validate dates
    if (isNaN(startDate.getTime())) {
        console.error('[Calendly] ❌ Invalid startTime:', startTime);
        throw new Error(`Invalid start time: ${startTime}`);
    }
    
    const duration = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60)); // Duration in minutes
    
    console.log('[Calendly] ✅ Date extracted - Start:', startDate.toISOString(), 'Duration:', duration, 'minutes');

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
    // event_type can be a URI (string) or an object with name property
    let eventTypeName = 'Therapy Session'; // Default fallback
    
    let eventType = eventData.event_type || eventData.eventType;
    
    if (eventType) {
        // If event_type is a URI, fetch it to get the name
        if (typeof eventType === 'string' && eventType.startsWith('http')) {
            console.log('[Calendly] Event type is a URI, fetching:', eventType);
            try {
                const eventTypeResponse = await fetch(eventType, {
                    headers: {
                        'Accept': 'application/json',
                    },
                });
                if (eventTypeResponse.ok) {
                    const eventTypeData = await eventTypeResponse.json();
                    const resource = eventTypeData.resource || eventTypeData;
                    eventTypeName = resource.name || resource.slug || 'Therapy Session';
                    console.log('[Calendly] ✅ Fetched event type name:', eventTypeName);
                } else {
                    console.warn('[Calendly] Failed to fetch event type, using default');
                }
            } catch (e: any) {
                console.warn('[Calendly] Error fetching event type:', e.message);
            }
        } else if (typeof eventType === 'object' && eventType.name) {
            // Event type is an object with name property
            eventTypeName = eventType.name;
        } else if (typeof eventType === 'string' && !eventType.startsWith('http')) {
            // Event type is already a string name (not a URI)
            eventTypeName = eventType;
        }
    }

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

    console.log(`[Calendly] ✅ Created session: ${createdSession.id} for ${startDate.toISOString()}`);
    console.log(`[Calendly] Session details:`, {
        id: createdSession.id,
        date: createdSession.date,
        client_id: createdSession.client_id,
        duration: createdSession.duration,
        metadata: createdSession.metadata,
    });
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
            // Structure 4: { created_at, created_by, payload: { invitee: "...", scheduled_event: "..." } } - URIs that need fetching
            // Structure 5: { created_at, created_by, ... } - notification format, need to check payload.payload
            
            // Try to extract invitee from various possible locations
            let invitee = payload.payload?.invitee || 
                          payload.invitee || 
                          (payload.payload?.event && payload.payload.event.invitee) ||
                          (payload.event && typeof payload.event === 'object' && payload.event.invitee);
            
            // Try to extract scheduled_event/event data from various possible locations
            let eventData = payload.payload?.scheduled_event || 
                            payload.scheduled_event ||
                            payload.payload?.event || 
                            payload.event || 
                            payload;

            // If payload.payload exists, check if it has invitee/scheduled_event URIs or direct fields
            if (payload.payload) {
                console.log('[Calendly Webhook] ✅ Found payload.payload, keys:', Object.keys(payload.payload));
                
                // Check if payload.payload has invitee as a URI or object
                if (payload.payload.invitee && !invitee) {
                    invitee = payload.payload.invitee;
                    console.log('[Calendly Webhook] ✅ Found invitee in payload.payload:', typeof invitee === 'string' ? 'URI' : 'object');
                }
                
                // Check if payload.payload has invitee fields directly (email, name, uri, etc.)
                // This is the case when Calendly sends invitee data as flat fields in payload.payload
                if (!invitee && (payload.payload.email || payload.payload.uri || payload.payload.name)) {
                    // Construct invitee object from payload.payload fields
                    invitee = {
                        email: payload.payload.email,
                        name: payload.payload.name || `${payload.payload.first_name || ''} ${payload.payload.last_name || ''}`.trim(),
                        uri: payload.payload.uri,
                        first_name: payload.payload.first_name,
                        last_name: payload.payload.last_name,
                        text_reminder_number: payload.payload.text_reminder_number,
                        timezone: payload.payload.timezone,
                        questions_and_answers: payload.payload.questions_and_answers,
                        ...payload.payload, // Include all other fields
                    };
                    console.log('[Calendly Webhook] ✅ Constructed invitee from payload.payload fields');
                }
                
                // Check for scheduled_event
                if (payload.payload.scheduled_event && (!eventData || eventData === payload)) {
                    eventData = payload.payload.scheduled_event;
                    console.log('[Calendly Webhook] ✅ Found scheduled_event in payload.payload:', typeof eventData === 'string' ? 'URI' : 'object');
                    // If scheduled_event is an object (not a URI), check if it has start_time
                    if (typeof eventData === 'object' && eventData.start_time) {
                        console.log('[Calendly Webhook] scheduled_event object has start_time:', eventData.start_time);
                    }
                }
            } else {
                console.log('[Calendly Webhook] ⚠️ No payload.payload found in webhook');
                console.log('[Calendly Webhook] Top-level keys:', Object.keys(payload));
                // Check if invitee/scheduled_event might be at top level
                if (payload.invitee && !invitee) {
                    invitee = payload.invitee;
                    console.log('[Calendly Webhook] ✅ Found invitee at top level');
                }
                if (payload.scheduled_event && (!eventData || eventData === payload)) {
                    eventData = payload.scheduled_event;
                    console.log('[Calendly Webhook] ✅ Found scheduled_event at top level');
                }
            }

            // If invitee or eventData are URIs (strings starting with http), fetch them
            // Calendly webhooks often send URIs that need to be fetched
            // Note: Calendly API URIs from webhooks are public and don't require auth
            if (typeof invitee === 'string' && invitee.startsWith('http')) {
                console.log('[Calendly Webhook] Invitee is a URI, fetching:', invitee);
                try {
                    const inviteeResponse = await fetch(invitee, {
                        headers: {
                            'Accept': 'application/json',
                        },
                    });
                    if (inviteeResponse.ok) {
                        const inviteeData = await inviteeResponse.json();
                        invitee = inviteeData.resource || inviteeData;
                        console.log('[Calendly Webhook] ✅ Fetched invitee data, keys:', Object.keys(invitee || {}));
                    } else {
                        const errorText = await inviteeResponse.text();
                        console.error('[Calendly Webhook] Failed to fetch invitee, status:', inviteeResponse.status, 'Response:', errorText);
                    }
                } catch (e: any) {
                    console.error('[Calendly Webhook] Error fetching invitee:', e.message);
                }
            }

            if (typeof eventData === 'string' && eventData.startsWith('http')) {
                console.log('[Calendly Webhook] Event data is a URI, fetching:', eventData);
                try {
                    const eventResponse = await fetch(eventData, {
                        headers: {
                            'Accept': 'application/json',
                        },
                    });
                    if (eventResponse.ok) {
                        const eventResponseData = await eventResponse.json();
                        eventData = eventResponseData.resource || eventResponseData;
                        console.log('[Calendly Webhook] ✅ Fetched event data, keys:', Object.keys(eventData || {}));
                    } else {
                        const errorText = await eventResponse.text();
                        console.error('[Calendly Webhook] Failed to fetch event data, status:', eventResponse.status, 'Response:', errorText);
                    }
                } catch (e: any) {
                    console.error('[Calendly Webhook] Error fetching event data:', e.message);
                }
            }

            console.log('[Calendly Webhook] Extracted invitee:', invitee ? `Found (keys: ${Object.keys(invitee || {}).join(', ')})` : 'Missing');
            console.log('[Calendly Webhook] Extracted eventData:', eventData ? `Found (keys: ${Object.keys(eventData || {}).join(', ')})` : 'Missing');
            
            if (invitee) {
                console.log('[Calendly Webhook] Invitee data:', JSON.stringify(invitee, null, 2));
            }
            if (eventData && eventData !== payload) {
                console.log('[Calendly Webhook] Event data:', JSON.stringify(eventData, null, 2));
            }

            if (!invitee) {
                console.error('[Calendly Webhook] ❌ No invitee data. Full payload:', JSON.stringify(payload, null, 2));
                console.error('[Calendly Webhook] Payload structure:', {
                    hasPayload: !!payload.payload,
                    payloadKeys: payload.payload ? Object.keys(payload.payload) : [],
                    topLevelKeys: Object.keys(payload),
                });
                return NextResponse.json(
                    { 
                        error: 'No invitee data',
                        debug: {
                            payloadKeys: Object.keys(payload),
                            payloadStructure: payload.payload ? Object.keys(payload.payload) : 'no payload property',
                        }
                    },
                    { status: 400 }
                );
            }

            // Extract email and name
            const email = extractEmail(invitee);
            const name = extractName(invitee);

            console.log(`[Calendly Webhook] Extracted email: ${email}, name: ${name || 'N/A'}`);

            if (!email) {
                console.error('[Calendly Webhook] ❌ No email found in invitee data. Invitee keys:', Object.keys(invitee || {}));
                console.error('[Calendly Webhook] Invitee data:', JSON.stringify(invitee, null, 2));
                return NextResponse.json(
                    { 
                        error: 'No email found',
                        debug: {
                            inviteeKeys: Object.keys(invitee || {}),
                            inviteeData: invitee,
                        }
                    },
                    { status: 400 }
                );
            }

            // Find or create client
            console.log(`[Calendly Webhook] Finding/creating client: ${email} (${name || 'No name'})`);
            let client;
            try {
                client = await findOrCreateClient(email, name);
                console.log(`[Calendly Webhook] ✅ Client: ${client.id} - ${client.name}`);
            } catch (clientError: any) {
                console.error('[Calendly Webhook] ❌ Error finding/creating client:', clientError);
                throw clientError;
            }

            // Create session
            console.log(`[Calendly Webhook] Creating session for client ${client.id}`);
            let session;
            try {
                session = await createSessionFromBooking(client.id, eventData, invitee);
                console.log(`[Calendly Webhook] ✅ Successfully created session: ${session.id}`);
            } catch (sessionError: any) {
                console.error('[Calendly Webhook] ❌ Error creating session:', sessionError);
                console.error('[Calendly Webhook] Event data keys:', Object.keys(eventData || {}));
                console.error('[Calendly Webhook] Invitee keys:', Object.keys(invitee || {}));
                throw sessionError;
            }

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
                          (payload.event && typeof payload.event === 'object' && 'invitee' in payload.event ? payload.event.invitee : null);
            const eventData = payload.payload?.scheduled_event || 
                            payload.scheduled_event ||
                            payload.payload?.event || 
                            (payload.event && typeof payload.event === 'object' && 'event' in payload.event ? payload.event.event : null) ||
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


