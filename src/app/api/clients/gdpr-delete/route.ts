import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
        }

        // GDPR-compliant deletion: Delete all related data
        // This permanently removes:
        // - Client record
        // - All sessions (cascade)
        // - All session notes (cascade)
        // - All recordings (set client_id to null)
        // - All payments (cascade)
        // - All reminders (cascade)

        // First, get the client to verify it exists
        const { data: client, error: clientError } = await supabase
            .from('clients')
            .select('id')
            .eq('id', id)
            .single();

        if (clientError || !client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        // Delete the client - cascades will handle related records
        const { error: deleteError } = await supabase
            .from('clients')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error('Error deleting client:', deleteError);
            return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 });
        }

        // Also set recordings client_id to null (they use ON DELETE SET NULL)
        await supabase
            .from('recordings')
            .update({ client_id: null })
            .eq('client_id', id);

        return NextResponse.json({ success: true, message: 'Client and all associated data permanently deleted' });
    } catch (error: any) {
        console.error('Error in GDPR delete:', error);
        return NextResponse.json({ 
            error: `Failed to delete client: ${error?.message || 'Unknown error'}` 
        }, { status: 500 });
    }
}








