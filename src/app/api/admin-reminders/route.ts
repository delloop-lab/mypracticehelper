import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkAuthentication } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET: Fetch admin reminders for current user
 */
export async function GET(request: Request) {
    try {
        // Check authentication (handles both new and fallback methods)
        const { userId, isFallback, userEmail } = await checkAuthentication(request);
        
        // If fallback auth, show legacy reminders (without user_id)
        if (isFallback && userEmail === 'claire@claireschillaci.com') {
            console.log('[Admin Reminders API] Fallback auth detected, showing legacy reminders');
            const { data: reminders, error } = await supabase
                .from('admin_reminders')
                .select(`
                    *,
                    clients (id, name),
                    sessions (id, date, type)
                `)
                .is('user_id', null)
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching admin reminders:', error);
                return NextResponse.json({ error: 'Failed to fetch reminders' }, { status: 500 });
            }

            return NextResponse.json(reminders || []);
        }
        
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: reminders, error } = await supabase
            .from('admin_reminders')
            .select(`
                *,
                clients (id, name),
                sessions (id, date, type)
            `)
            .eq('user_id', userId)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching admin reminders:', error);
            return NextResponse.json({ error: 'Failed to fetch reminders' }, { status: 500 });
        }

        return NextResponse.json(reminders || []);
    } catch (error: any) {
        console.error('Error in GET admin reminders:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * PUT: Update reminder (mark as inactive, etc.)
 */
export async function PUT(request: Request) {
    try {
        // Check authentication
        const { userId, isFallback, userEmail } = await checkAuthentication(request);
        
        // For fallback auth, reject updates
        if (isFallback) {
            return NextResponse.json({ 
                error: 'User account not found. Please run the database migration to create your user account.',
                requiresMigration: true
            }, { status: 403 });
        }
        
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id, is_active } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Reminder ID is required' }, { status: 400 });
        }

        // Verify user owns this reminder
        const { data: existing, error: fetchError } = await supabase
            .from('admin_reminders')
            .select('id')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (fetchError || !existing) {
            return NextResponse.json({ error: 'Reminder not found' }, { status: 404 });
        }

        const updateData: any = {
            updated_at: new Date().toISOString(),
        };

        if (is_active !== undefined) {
            updateData.is_active = is_active;
        }

        const { error } = await supabase
            .from('admin_reminders')
            .update(updateData)
            .eq('id', id)
            .eq('user_id', userId);

        if (error) {
            console.error('Error updating reminder:', error);
            return NextResponse.json({ error: 'Failed to update reminder' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error in PUT admin reminders:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST: Create custom reminder
 */
export async function POST(request: Request) {
    try {
        const userId = await getCurrentUserId(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { title, description, client_id, session_id, due_date } = await request.json();

        if (!title) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 });
        }

        const reminderId = `custom_${userId}_${Date.now()}_${Math.random().toString(36).substring(2)}`;

        const { data, error } = await supabase
            .from('admin_reminders')
            .insert({
                id: reminderId,
                user_id: userId,
                type: 'custom',
                client_id: client_id || null,
                session_id: session_id || null,
                title,
                description: description || null,
                is_active: true,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating reminder:', error);
            return NextResponse.json({ error: 'Failed to create reminder' }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Error in POST admin reminders:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

