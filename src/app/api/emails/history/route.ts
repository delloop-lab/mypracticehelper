import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkAuthentication } from '@/lib/auth';

// GET - Fetch email history
export async function GET(request: Request) {
    try {
        // Try to get authentication
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
            console.log('[Email History API] Auth error (continuing):', authError);
        }

        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const clientId = searchParams.get('clientId');

        let query = supabase
            .from('email_history')
            .select('*')
            .or(`user_id.eq.${finalUserId},user_id.is.null`)
            .order('sent_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (clientId) {
            query = query.eq('client_id', clientId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[Email History API] Error fetching history:', error);
            return NextResponse.json({ error: 'Failed to fetch email history' }, { status: 500 });
        }

        return NextResponse.json(data || []);
    } catch (error: any) {
        console.error('[Email History API] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

// DELETE - Delete an email history entry
export async function DELETE(request: Request) {
    try {
        const { userId, isFallback } = await checkAuthentication(request);
        
        if (!userId && !isFallback) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'History ID is required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('email_history')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('[Email History API] Error deleting entry:', error);
            return NextResponse.json({ error: 'Failed to delete history entry' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[Email History API] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

