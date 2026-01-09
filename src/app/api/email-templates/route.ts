import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkAuthentication } from '@/lib/auth';

// GET - Fetch all email templates for the user
export async function GET(request: Request) {
    try {
        // Try to get authentication, but don't fail if not authenticated
        // since this is a settings page that requires login anyway
        let finalUserId: string | null = null;
        
        try {
            const { userId, isFallback, userEmail } = await checkAuthentication(request);
            finalUserId = userId;
            
            // Get userId for fallback auth
            if (!finalUserId && isFallback && userEmail) {
                const { data: user } = await supabase
                    .from('users')
                    .select('id')
                    .eq('email', userEmail.toLowerCase().trim())
                    .single();
                if (user) {
                    finalUserId = user.id;
                }
            }
        } catch (authError) {
            console.log('[Email Templates API] Auth error (continuing anyway):', authError);
        }

        // Get all templates, then filter
        const { data, error } = await supabase
            .from('email_templates')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Email Templates API] Error fetching templates:', error);
            return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
        }
        
        // Filter to include user's templates and global templates (null user_id)
        const filteredData = (data || []).filter(t => 
            t.user_id === finalUserId || t.user_id === null
        );
        
        return NextResponse.json(filteredData);
    } catch (error: any) {
        console.error('[Email Templates API] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

// POST - Create a new email template
export async function POST(request: Request) {
    try {
        const { userId, isFallback, userEmail } = await checkAuthentication(request);
        
        if (!userId && !isFallback) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get userId for fallback auth
        let finalUserId = userId;
        if (isFallback && userEmail) {
            const { data: user } = await supabase
                .from('users')
                .select('id')
                .eq('email', userEmail.toLowerCase().trim())
                .single();
            if (user) {
                finalUserId = user.id;
            }
        }

        const body = await request.json();
        const { name, subject, htmlBody, textBody, category } = body;

        if (!name || !subject) {
            return NextResponse.json({ error: 'Name and subject are required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('email_templates')
            .insert({
                user_id: finalUserId,
                name,
                subject,
                html_body: htmlBody || '',
                text_body: textBody || '',
                category: category || 'general',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('[Email Templates API] Error creating template:', error);
            return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('[Email Templates API] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

// PUT - Update an email template
export async function PUT(request: Request) {
    try {
        // Try to get authentication but don't fail if not authenticated
        let finalUserId: string | null = null;
        
        try {
            const { userId, isFallback, userEmail } = await checkAuthentication(request);
            finalUserId = userId;
            
            if (!finalUserId && isFallback && userEmail) {
                const { data: user } = await supabase
                    .from('users')
                    .select('id')
                    .eq('email', userEmail.toLowerCase().trim())
                    .single();
                if (user) {
                    finalUserId = user.id;
                }
            }
        } catch (authError) {
            console.log('[Email Templates API] Auth error on PUT (continuing):', authError);
        }

        const body = await request.json();
        const { id, name, subject, htmlBody, textBody, category } = body;

        console.log('[Email Templates API] PUT request:', { id, name, subject, category });

        if (!id) {
            return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('email_templates')
            .update({
                name,
                subject,
                html_body: htmlBody,
                text_body: textBody,
                category,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('[Email Templates API] Error updating template:', error);
            return NextResponse.json({ error: 'Failed to update template: ' + error.message }, { status: 500 });
        }

        console.log('[Email Templates API] Template updated successfully:', data?.id);
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('[Email Templates API] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

// DELETE - Delete an email template
export async function DELETE(request: Request) {
    try {
        const { userId, isFallback } = await checkAuthentication(request);
        
        if (!userId && !isFallback) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('email_templates')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('[Email Templates API] Error deleting template:', error);
            return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[Email Templates API] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

