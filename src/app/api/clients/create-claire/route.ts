import { NextResponse } from 'next/server';
import { saveClients } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

export async function POST() {
    try {
        // Get existing clients to avoid duplicates
        const { data: existingClients } = await supabase.from('clients').select('id, name');
        
        // Check if Claire already exists
        const claireExists = existingClients?.some((c: any) => 
            c.name && c.name.toLowerCase().includes('claire')
        );
        
        if (claireExists) {
            return NextResponse.json({ 
                success: false, 
                message: 'Claire Schillaci already exists',
                existingClients: existingClients?.map((c: any) => c.name)
            });
        }
        
        // Create Claire Schillaci client
        const claireClient = {
            id: Date.now().toString(),
            name: "Claire Schillaci",
            firstName: "Claire",
            lastName: "Schillaci",
            email: "claire@claireschillaci.com",
            phone: "",
            nextAppointment: "",
            notes: "",
            recordings: 0,
            sessions: 0,
            documents: [],
            relationships: [],
            currency: 'EUR',
            sessionFee: 0,
            archived: false
        };
        
        // Get all existing clients and add Claire
        const { data: allClients } = await supabase.from('clients').select('*');
        const clientsToSave = [...(allClients || []), claireClient];
        
        await saveClients(clientsToSave);
        
        return NextResponse.json({ 
            success: true, 
            message: 'Claire Schillaci created successfully',
            client: claireClient
        });
        
    } catch (error: any) {
        console.error('Error creating Claire Schillaci:', error);
        return NextResponse.json({ 
            error: `Failed to create client: ${error?.message || 'Unknown error'}` 
        }, { status: 500 });
    }
}








