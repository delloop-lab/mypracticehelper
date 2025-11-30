import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkAuthentication } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // Check authentication (handles both new and fallback methods)
        const { userId, isFallback, userEmail } = await checkAuthentication(request);
        
        // If fallback auth, show legacy templates (without user_id)
        if (isFallback && userEmail === 'claire@claireschillaci.com') {
            console.log('[Custom Reminder Templates API] Fallback auth detected, showing legacy templates');
            const { data, error } = await supabase
                .from('custom_reminder_templates')
                .select('*')
                .is('user_id', null)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching custom reminder templates:', error);
                return NextResponse.json(
                    { error: 'Failed to fetch templates' },
                    { status: 500 }
                );
            }

            return NextResponse.json(data || []);
        }
        
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data, error } = await supabase
            .from('custom_reminder_templates')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching custom reminder templates:', error);
            return NextResponse.json(
                { error: 'Failed to fetch templates' },
                { status: 500 }
            );
        }

        return NextResponse.json(data || []);
    } catch (error: any) {
        console.error('Error in GET custom-reminder-templates:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        // Check authentication
        const { userId, isFallback, userEmail } = await checkAuthentication(request);
        
        // For fallback auth, we need to create the user first or use a temporary ID
        // For now, reject saves if user doesn't exist (they need to run migration)
        if (isFallback) {
            return NextResponse.json({ 
                error: 'User account not found. Please run the database migration to create your user account.',
                requiresMigration: true
            }, { status: 403 });
        }
        
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { title, description, conditionType, conditionConfig, frequency, isEnabled } = await request.json();

        if (!title || !conditionType) {
            return NextResponse.json(
                { error: 'Title and condition type are required' },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from('custom_reminder_templates')
            .insert({
                user_id: userId,
                title,
                description: description || null,
                condition_type: conditionType,
                condition_config: conditionConfig || {},
                frequency: frequency || 'daily',
                is_enabled: isEnabled !== undefined ? isEnabled : true,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating custom reminder template:', error);
            return NextResponse.json(
                { error: 'Failed to create template' },
                { status: 500 }
            );
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Error in POST custom-reminder-templates:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

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

        const { id, title, description, conditionType, conditionConfig, frequency, isEnabled } = await request.json();

        if (!id) {
            return NextResponse.json(
                { error: 'Template ID is required' },
                { status: 400 }
            );
        }

        const updateData: any = {
            updated_at: new Date().toISOString()
        };

        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (conditionType !== undefined) updateData.condition_type = conditionType;
        if (conditionConfig !== undefined) updateData.condition_config = conditionConfig;
        if (frequency !== undefined) updateData.frequency = frequency;
        if (isEnabled !== undefined) updateData.is_enabled = isEnabled;

        const { data, error } = await supabase
            .from('custom_reminder_templates')
            .update(updateData)
            .eq('id', id)
            .eq('user_id', userId) // Ensure user owns this template
            .select()
            .single();

        if (error) {
            console.error('Error updating custom reminder template:', error);
            return NextResponse.json(
                { error: 'Failed to update template' },
                { status: 500 }
            );
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Error in PUT custom-reminder-templates:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: Request) {
    try {
        // Check authentication
        const { userId, isFallback, userEmail } = await checkAuthentication(request);
        
        // For fallback auth, reject deletes
        if (isFallback) {
            return NextResponse.json({ 
                error: 'User account not found. Please run the database migration to create your user account.',
                requiresMigration: true
            }, { status: 403 });
        }
        
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { error: 'Template ID is required' },
                { status: 400 }
            );
        }

        const { error } = await supabase
            .from('custom_reminder_templates')
            .delete()
            .eq('id', id)
            .eq('user_id', userId); // Ensure user owns this template

        if (error) {
            console.error('Error deleting custom reminder template:', error);
            return NextResponse.json(
                { error: 'Failed to delete template' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error in DELETE custom-reminder-templates:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

