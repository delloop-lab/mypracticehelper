import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkAuthentication } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const { userId, isFallback, userEmail } = await checkAuthentication(request);
        
        // Allow authenticated users (either via sessionToken or fallback auth)
        if (!userId && !isFallback) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        // For fallback auth, we need to find the user by email
        let finalUserId = userId;
        if (isFallback && userEmail) {
            const { data: user } = await supabase
                .from('users')
                .select('id')
                .eq('email', userEmail.toLowerCase().trim())
                .single();
            
            if (!user) {
                return NextResponse.json({ error: 'User not found' }, { status: 404 });
            }
            finalUserId = user.id;
        }
        
        if (!finalUserId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all clients for this user that don't have the form signed
        const { data: clients, error: fetchError } = await supabase
            .from('clients')
            .select('id')
            .eq('user_id', finalUserId)
            .is('archived', false)
            .eq('new_client_form_signed', false);

        if (fetchError) {
            console.error('Error fetching clients:', fetchError);
            return NextResponse.json(
                { error: 'Failed to fetch clients' },
                { status: 500 }
            );
        }

        if (!clients || clients.length === 0) {
            return NextResponse.json({ 
                success: true,
                message: 'All clients already have their forms signed',
                updated: 0
            });
        }

        const clientIds = clients.map(c => c.id);

        // Update all clients to mark forms as signed
        const { error: updateError } = await supabase
            .from('clients')
            .update({ 
                new_client_form_signed: true,
                updated_at: new Date().toISOString()
            })
            .in('id', clientIds)
            .eq('user_id', finalUserId);

        if (updateError) {
            console.error('Error updating clients:', updateError);
            return NextResponse.json(
                { error: 'Failed to update clients' },
                { status: 500 }
            );
        }

        // Deactivate all related reminders for these clients
        await supabase
            .from('admin_reminders')
            .update({ is_active: false })
            .in('client_id', clientIds)
            .eq('type', 'new_client_form')
            .eq('user_id', finalUserId);

        return NextResponse.json({ 
            success: true,
            message: `Successfully marked ${clients.length} client${clients.length > 1 ? 's' : ''} as having forms signed`,
            updated: clients.length
        });

    } catch (error: any) {
        console.error('Error in bulk-mark-forms-signed:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}




