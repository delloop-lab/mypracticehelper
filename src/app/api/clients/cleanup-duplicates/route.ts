import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST() {
    try {
        console.log('[CLEANUP] Starting duplicate cleanup...');
        
        // Get all clients
        const { data: allClients, error: fetchError } = await supabase
            .from('clients')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (fetchError) {
            console.error('[CLEANUP] Error fetching clients:', fetchError);
            return NextResponse.json({ error: `Failed to fetch clients: ${fetchError.message}` }, { status: 500 });
        }
        
        if (!allClients || allClients.length === 0) {
            return NextResponse.json({ message: 'No clients found' });
        }
        
        // Group clients by normalized name (case-insensitive)
        const nameGroups = new Map<string, any[]>();
        
        allClients.forEach((client: any) => {
            if (!client.name) return;
            const normalizedName = client.name.toLowerCase().trim();
            if (!nameGroups.has(normalizedName)) {
                nameGroups.set(normalizedName, []);
            }
            nameGroups.get(normalizedName)!.push(client);
        });
        
        const duplicates: any[] = [];
        const toDelete: string[] = [];
        const toKeep: Map<string, string> = new Map(); // normalized name -> ID to keep
        
        // Find duplicates and decide which to keep
        nameGroups.forEach((clients, normalizedName) => {
            if (clients.length > 1) {
                console.log(`[CLEANUP] Found ${clients.length} duplicates for "${normalizedName}"`);
                
                // Sort by: 1) has more data (non-empty fields), 2) most recent
                clients.sort((a, b) => {
                    // Count non-empty fields
                    const aFields = Object.values(a).filter(v => v !== null && v !== undefined && v !== '').length;
                    const bFields = Object.values(b).filter(v => v !== null && v !== undefined && v !== '').length;
                    if (bFields !== aFields) return bFields - aFields;
                    
                    // If same, prefer most recent
                    const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
                    const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
                    return bDate - aDate;
                });
                
                const keepClient = clients[0];
                const deleteClients = clients.slice(1);
                
                toKeep.set(normalizedName, keepClient.id);
                duplicates.push({
                    name: normalizedName,
                    keep: { id: keepClient.id, name: keepClient.name },
                    delete: deleteClients.map((c: any) => ({ id: c.id, name: c.name }))
                });
                
                deleteClients.forEach((c: any) => toDelete.push(c.id));
            }
        });
        
        if (toDelete.length === 0) {
            return NextResponse.json({ 
                message: 'No duplicates found',
                duplicates: []
            });
        }
        
        console.log(`[CLEANUP] Will delete ${toDelete.length} duplicate clients`);
        console.log(`[CLEANUP] Will keep:`, Array.from(toKeep.entries()));
        
        // Before deleting, reassign sessions and notes
        let sessionsReassigned = 0;
        let notesReassigned = 0;
        
        for (const [normalizedName, keepId] of toKeep.entries()) {
            const deleteIds = duplicates.find(d => d.name === normalizedName)?.delete.map((d: any) => d.id) || [];
            
            // Reassign sessions
            for (const deleteId of deleteIds) {
                const { data: sessions } = await supabase
                    .from('sessions')
                    .select('id')
                    .eq('client_id', deleteId);
                
                if (sessions && sessions.length > 0) {
                    const { error: sessionError } = await supabase
                        .from('sessions')
                        .update({ client_id: keepId })
                        .eq('client_id', deleteId);
                    
                    if (!sessionError) {
                        sessionsReassigned += sessions.length;
                    }
                }
            }
            
            // Reassign session notes
            for (const deleteId of deleteIds) {
                const { data: notes } = await supabase
                    .from('session_notes')
                    .select('id')
                    .eq('client_id', deleteId);
                
                if (notes && notes.length > 0) {
                    const { error: noteError } = await supabase
                        .from('session_notes')
                        .update({ client_id: keepId })
                        .eq('client_id', deleteId);
                    
                    if (!noteError) {
                        notesReassigned += notes.length;
                    }
                }
            }
        }
        
        // Delete duplicate clients
        const { error: deleteError } = await supabase
            .from('clients')
            .delete()
            .in('id', toDelete);
        
        if (deleteError) {
            console.error('[CLEANUP] Error deleting duplicates:', deleteError);
            return NextResponse.json({ 
                error: `Failed to delete duplicates: ${deleteError.message}`,
                sessionsReassigned,
                notesReassigned
            }, { status: 500 });
        }
        
        return NextResponse.json({
            success: true,
            message: `Cleaned up ${toDelete.length} duplicate clients`,
            deleted: toDelete.length,
            duplicates: duplicates.map(d => ({
                name: d.name,
                kept: d.keep,
                deleted: d.delete.length
            })),
            sessionsReassigned,
            notesReassigned
        });
        
    } catch (error: any) {
        console.error('[CLEANUP] Error:', error);
        return NextResponse.json({
            error: `Cleanup failed: ${error?.message || 'Unknown error'}`,
            stack: error?.stack
        }, { status: 500 });
    }
}










