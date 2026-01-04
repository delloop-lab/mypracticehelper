import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const userId = await getCurrentUserId(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { clientId, signed } = await request.json();

        if (!clientId || typeof signed !== 'boolean') {
            return NextResponse.json(
                { error: 'clientId and signed (boolean) are required' },
                { status: 400 }
            );
        }

        // Update the client
        const { error } = await supabase
            .from('clients')
            .update({ 
                new_client_form_signed: signed,
                updated_at: new Date().toISOString()
            })
            .eq('id', clientId)
            .eq('user_id', userId); // Ensure user owns this client

        if (error) {
            console.error('Error updating client form status:', error);
            return NextResponse.json(
                { error: 'Failed to update client' },
                { status: 500 }
            );
        }

        // If form is signed, deactivate any related reminders
        if (signed) {
            await supabase
                .from('admin_reminders')
                .update({ is_active: false })
                .eq('client_id', clientId)
                .eq('type', 'new_client_form')
                .eq('user_id', userId);
        }

        return NextResponse.json({ 
            success: true,
            message: `Form status updated to ${signed ? 'signed' : 'unsigned'}`
        });

    } catch (error: any) {
        console.error('Error in toggle-form-signed:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}





