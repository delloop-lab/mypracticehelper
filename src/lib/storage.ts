import { supabase } from './supabase';

// Helper to map database fields to app fields if necessary
// Currently assuming 1:1 mapping for simplicity, but we might need adapters later

export async function getClients() {
    const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching clients:', error);
        return [];
    }

    // Parse JSON fields that are stored as text/jsonb if needed
    // The schema has specific columns, but the app might expect nested objects
    // We need to map the flat DB structure back to the nested app structure if needed
    // For now, let's assume the app adapts or we store complex objects in 'notes' or specific columns

    return data || [];
}

export async function saveClients(clients: any[]) {
    // 1. Get all existing IDs to find deletions
    const { data: existing } = await supabase.from('clients').select('id');
    const existingIds = existing?.map(c => c.id) || [];
    const newIds = clients.map(c => c.id);

    // 2. Delete clients that are no longer in the list
    const idsToDelete = existingIds.filter(id => !newIds.includes(id));
    if (idsToDelete.length > 0) {
        await supabase.from('clients').delete().in('id', idsToDelete);
    }

    // 3. Upsert all clients
    // We need to ensure the data matches the schema columns
    const records = clients.map(client => ({
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        notes: client.notes,
        // Store extra fields in a JSONB column if we had one, 
        // but for now we'll map what we can and maybe lose some data if schema doesn't match
        // TODO: Update schema to include a 'metadata' JSONB column for flexibility
        updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
        .from('clients')
        .upsert(records);

    if (error) {
        console.error('Error saving clients:', error);
        throw error;
    }
}

export async function getRecordings() {
    const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching recordings:', error);
        return [];
    }
    return data || [];
}

export async function saveRecordings(recordings: any[]) {
    // Similar sync logic for recordings
    const { data: existing } = await supabase.from('recordings').select('id');
    const existingIds = existing?.map(r => r.id) || [];
    const newIds = recordings.map(r => r.id);

    const idsToDelete = existingIds.filter(id => !newIds.includes(id));
    if (idsToDelete.length > 0) {
        await supabase.from('recordings').delete().in('id', idsToDelete);
    }

    const records = recordings.map(r => ({
        id: r.id,
        client_id: r.clientId, // Map camelCase to snake_case
        title: r.title,
        transcript: r.transcript,
        audio_url: r.audioUrl,
        duration: r.duration,
        created_at: r.date || new Date().toISOString()
    }));

    const { error } = await supabase
        .from('recordings')
        .upsert(records);

    if (error) {
        console.error('Error saving recordings:', error);
        throw error;
    }
}

// TODO: Implement proper file storage with Supabase Storage
// For now, these are placeholders to prevent build errors
export async function saveAudioFile(fileName: string, buffer: Buffer) {
    console.warn('File storage not yet implemented for Vercel - requires Supabase Storage bucket');
    // In a real implementation:
    // const { data, error } = await supabase.storage.from('recordings').upload(fileName, buffer);
    // return data?.path;
    return `/mock-storage/${fileName}`;
}

export async function saveDocumentFile(fileName: string, buffer: Buffer) {
    console.warn('File storage not yet implemented for Vercel - requires Supabase Storage bucket');
    return `/mock-storage/${fileName}`;
}

export async function getDocuments() {
    // Mock implementation or fetch from a 'documents' table if we created one
    return [];
}

export async function saveDocuments(documents: any[]) {
    // Mock implementation
    console.log('Saving documents metadata to DB (not implemented yet)');
}

