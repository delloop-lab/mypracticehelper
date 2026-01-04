import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const { id, restore } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
        }

        if (restore) {
            // Restore archived client
            const { error } = await supabase
                .from('clients')
                .update({ 
                    archived: false,
                    archived_at: null
                })
                .eq('id', id);

            if (error) {
                console.error('Error restoring client:', error);
                return NextResponse.json({ error: 'Failed to restore client' }, { status: 500 });
            }

            return NextResponse.json({ success: true, message: 'Client restored successfully' });
        } else {
            // Archive client
            const { error } = await supabase
                .from('clients')
                .update({ 
                    archived: true,
                    archived_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) {
                console.error('Error archiving client:', error);
                return NextResponse.json({ error: 'Failed to archive client' }, { status: 500 });
            }

            return NextResponse.json({ success: true, message: 'Client archived successfully' });
        }
    } catch (error: any) {
        console.error('Error in archive/restore:', error);
        return NextResponse.json({ 
            error: `Failed to process request: ${error?.message || 'Unknown error'}` 
        }, { status: 500 });
    }
}










