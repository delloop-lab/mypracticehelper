import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Daily cron job to check and create admin reminders:
 * 1. New clients without forms signed
 * 2. Unpaid past sessions
 * 3. Custom reminders (already handled by reminders table)
 */
export async function GET(request: Request) {
    // Verify this is called by Vercel Cron (optional security check)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log('[Admin Reminders Cron] Starting daily reminder check...');

        // Get all users (therapists)
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id');

        if (usersError || !users) {
            console.error('[Admin Reminders Cron] Error fetching users:', usersError);
            return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
        }

        const results = {
            usersProcessed: 0,
            newClientFormReminders: 0,
            unpaidSessionReminders: 0,
            errors: [] as string[],
        };

        // Process each user
        for (const user of users) {
            results.usersProcessed++;

            try {
                // 1. Check for new clients without forms signed
                const { data: newClients, error: clientsError } = await supabase
                    .from('clients')
                    .select('id, name, created_at')
                    .eq('user_id', user.id)
                    .eq('new_client_form_signed', false)
                    .is('archived', false);

                if (clientsError) {
                    console.error(`[Admin Reminders Cron] Error fetching new clients for user ${user.id}:`, clientsError);
                    results.errors.push(`Failed to fetch new clients for user ${user.id}`);
                    continue;
                }

                // Create/update reminders for new clients
                if (newClients && newClients.length > 0) {
                    for (const client of newClients) {
                        const reminderId = `new_form_${user.id}_${client.id}`;
                        
                        // Check if reminder already exists
                        const { data: existing } = await supabase
                            .from('admin_reminders')
                            .select('id')
                            .eq('id', reminderId)
                            .single();

                        if (!existing) {
                            // Create new reminder
                            const { error: createError } = await supabase
                                .from('admin_reminders')
                                .insert({
                                    id: reminderId,
                                    user_id: user.id,
                                    type: 'new_client_form',
                                    client_id: client.id,
                                    title: `New Client Form Required: ${client.name}`,
                                    description: `Please ensure the new client form is ready and signed for ${client.name}`,
                                    is_active: true,
                                });

                            if (createError) {
                                console.error(`[Admin Reminders Cron] Error creating reminder for client ${client.id}:`, createError);
                                results.errors.push(`Failed to create reminder for client ${client.name}`);
                            } else {
                                results.newClientFormReminders++;
                                console.log(`[Admin Reminders Cron] Created reminder for new client: ${client.name}`);
                            }
                        } else {
                            // Update last_sent_at to trigger reminder again
                            await supabase
                                .from('admin_reminders')
                                .update({ 
                                    last_sent_at: new Date().toISOString(),
                                    is_active: true,
                                    updated_at: new Date().toISOString()
                                })
                                .eq('id', reminderId);
                            results.newClientFormReminders++;
                        }
                    }
                }

                // 2. Check for unpaid past sessions
                const now = new Date();
                const { data: unpaidSessions, error: sessionsError } = await supabase
                    .from('sessions')
                    .select('id, client_id, date, type, metadata')
                    .eq('user_id', user.id)
                    .lt('date', now.toISOString()); // Past sessions only

                if (sessionsError) {
                    console.error(`[Admin Reminders Cron] Error fetching sessions for user ${user.id}:`, sessionsError);
                    results.errors.push(`Failed to fetch sessions for user ${user.id}`);
                    continue;
                }

                // Get clients for these sessions
                const clientIds = [...new Set(unpaidSessions?.map((s: any) => s.client_id).filter(Boolean) || [])];
                const { data: sessionClients } = await supabase
                    .from('clients')
                    .select('id, name')
                    .in('id', clientIds)
                    .eq('user_id', user.id);

                const clientMap = new Map((sessionClients || []).map((c: any) => [c.id, c.name]));

                // Check each session for payment status
                if (unpaidSessions) {
                    for (const session of unpaidSessions) {
                        // Check payment status from metadata
                        let metadata: any = {};
                        try {
                            if (session.metadata && typeof session.metadata === 'object') {
                                metadata = session.metadata;
                            } else if (typeof session.metadata === 'string') {
                                metadata = JSON.parse(session.metadata);
                            }
                        } catch {
                            metadata = {};
                        }

                        const paymentStatus = metadata.paymentStatus || 'unpaid';
                        const isPaid = paymentStatus === 'paid';

                        if (!isPaid) {
                            const reminderId = `unpaid_${user.id}_${session.id}`;
                            const clientName = clientMap.get(session.client_id) || 'Unknown Client';
                            const sessionDate = new Date(session.date).toLocaleDateString();

                            // Check if reminder already exists
                            const { data: existing } = await supabase
                                .from('admin_reminders')
                                .select('id')
                                .eq('id', reminderId)
                                .single();

                            if (!existing) {
                                // Create new reminder
                                const { error: createError } = await supabase
                                    .from('admin_reminders')
                                    .insert({
                                        id: reminderId,
                                        user_id: user.id,
                                        type: 'unpaid_session',
                                        client_id: session.client_id,
                                        session_id: session.id,
                                        title: `Unpaid Session: ${clientName} - ${sessionDate}`,
                                        description: `Session on ${sessionDate} for ${clientName} has not been marked as paid`,
                                        is_active: true,
                                    });

                                if (createError) {
                                    console.error(`[Admin Reminders Cron] Error creating unpaid reminder for session ${session.id}:`, createError);
                                    results.errors.push(`Failed to create reminder for session ${session.id}`);
                                } else {
                                    results.unpaidSessionReminders++;
                                    console.log(`[Admin Reminders Cron] Created reminder for unpaid session: ${clientName} - ${sessionDate}`);
                                }
                            } else {
                                // Update last_sent_at to trigger reminder again
                                await supabase
                                    .from('admin_reminders')
                                    .update({ 
                                        last_sent_at: new Date().toISOString(),
                                        is_active: true,
                                        updated_at: new Date().toISOString()
                                    })
                                    .eq('id', reminderId);
                                results.unpaidSessionReminders++;
                            }
                        } else {
                            // Session is paid, deactivate reminder if it exists
                            const reminderId = `unpaid_${user.id}_${session.id}`;
                            await supabase
                                .from('admin_reminders')
                                .update({ is_active: false })
                                .eq('id', reminderId);
                        }
                    }
                }

                // 3. Check custom reminder templates
                const { data: customTemplates, error: templatesError } = await supabase
                    .from('custom_reminder_templates')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('is_enabled', true);

                if (templatesError) {
                    console.error(`[Admin Reminders Cron] Error fetching custom templates for user ${user.id}:`, templatesError);
                    results.errors.push(`Failed to fetch custom templates for user ${user.id}`);
                } else if (customTemplates && customTemplates.length > 0) {
                    for (const template of customTemplates) {
                        try {
                            // Check frequency - only process daily templates on daily cron
                            if (template.frequency !== 'daily') {
                                continue; // Skip non-daily templates for now
                            }

                            // Process based on condition type
                            if (template.condition_type === 'new_client_form') {
                                // This is already handled above, but we can use the template for custom messaging
                                const config = template.condition_config || {};
                                const field = config.field || 'new_client_form_signed';
                                const value = config.value !== undefined ? config.value : false;

                                // Get clients matching the condition
                                // Use type assertion to avoid TypeScript deep instantiation error
                                let query = supabase
                                    .from('clients')
                                    .select('id, name')
                                    .eq('user_id', user.id)
                                    .is('archived', false);
                                
                                // Apply dynamic field filter
                                if (field === 'new_client_form_signed') {
                                    query = query.eq('new_client_form_signed', value as boolean);
                                }
                                
                                const { data: matchingClients } = await query;

                                if (matchingClients && matchingClients.length > 0) {
                                    for (const client of matchingClients) {
                                        const reminderId = `custom_${template.id}_${user.id}_${client.id}`;
                                        
                                        // Check if reminder already exists
                                        const { data: existing } = await supabase
                                            .from('admin_reminders')
                                            .select('id')
                                            .eq('id', reminderId)
                                            .single();

                                        if (!existing) {
                                            // Create new reminder
                                            const { error: createError } = await supabase
                                                .from('admin_reminders')
                                                .insert({
                                                    id: reminderId,
                                                    user_id: user.id,
                                                    type: 'custom',
                                                    client_id: client.id,
                                                    title: template.title.replace('{{clientName}}', client.name),
                                                    description: template.description ? template.description.replace('{{clientName}}', client.name) : null,
                                                    is_active: true,
                                                });

                                            if (createError) {
                                                console.error(`[Admin Reminders Cron] Error creating custom reminder for client ${client.id}:`, createError);
                                            }
                                        } else {
                                            // Update last_sent_at to trigger reminder again
                                            await supabase
                                                .from('admin_reminders')
                                                .update({ 
                                                    last_sent_at: new Date().toISOString(),
                                                    is_active: true,
                                                    updated_at: new Date().toISOString()
                                                })
                                                .eq('id', reminderId);
                                        }
                                    }
                                }
                            }
                        } catch (templateError: any) {
                            const errorMsg = `Error processing template ${template.id}: ${templateError.message}`;
                            console.error(`[Admin Reminders Cron] ${errorMsg}`, templateError);
                            results.errors.push(errorMsg);
                        }
                    }
                }

            } catch (error: any) {
                const errorMsg = `Error processing user ${user.id}: ${error.message}`;
                console.error(`[Admin Reminders Cron] ${errorMsg}`, error);
                results.errors.push(errorMsg);
            }
        }

        console.log(`[Admin Reminders Cron] Complete: ${results.newClientFormReminders} new client form reminders, ${results.unpaidSessionReminders} unpaid session reminders`);

        return NextResponse.json({
            success: true,
            message: 'Admin reminders processed',
            ...results,
        });

    } catch (error: any) {
        console.error('[Admin Reminders Cron] Unexpected error:', error);
        return NextResponse.json(
            {
                error: error.message || 'Internal server error',
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            },
            { status: 500 }
        );
    }
}

