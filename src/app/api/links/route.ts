import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface Link {
    id: string;
    title: string;
    url: string;
    description: string;
    createdAt?: string;
    updatedAt?: string;
}

export async function GET() {
    try {
        const { data, error } = await supabase
            .from('links')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching links:', error);
            return NextResponse.json([]);
        }

        // Map database fields to app format
        const links = (data || []).map(link => ({
            id: link.id,
            title: link.title || '',
            url: link.url || '',
            description: link.description || '',
            createdAt: link.created_at,
            updatedAt: link.updated_at,
        }));

        return NextResponse.json(links);
    } catch (error) {
        console.error('Error in GET links:', error);
        return NextResponse.json([]);
    }
}

export async function POST(request: Request) {
    try {
        const links: Link[] = await request.json();

        // Prepare records for upsert
        const records = links.map(link => ({
            id: link.id,
            title: link.title,
            url: link.url,
            description: link.description || '',
            created_at: link.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString()
        }));

        const { error } = await supabase
            .from('links')
            .upsert(records);

        if (error) {
            console.error('Supabase error saving links:', error);
            // Check if table doesn't exist
            if (error.message?.includes('relation "links" does not exist') || error.code === '42P01') {
                return NextResponse.json({ 
                    error: 'Links table does not exist. Please run the migration SQL in Supabase.',
                    migration: `CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);`
                }, { status: 500 });
            }
            return NextResponse.json({ error: `Failed to save links: ${error.message}` }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error saving links:', error);
        return NextResponse.json({ 
            error: `Failed to save links: ${error?.message || 'Unknown error'}` 
        }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Link ID is required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('links')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Supabase error deleting link:', error);
            return NextResponse.json({ error: `Failed to delete: ${error.message}` }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting link:', error);
        return NextResponse.json({ 
            error: `Failed to delete link: ${error?.message || 'Unknown error'}` 
        }, { status: 500 });
    }
}

