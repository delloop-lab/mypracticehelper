import { NextResponse } from 'next/server';
import { getClients, saveClients } from '@/lib/storage';
import { checkAuthentication } from '@/lib/auth';

// Map relationship types to their reciprocals
const getReciprocalRelationshipType = (type: string): string => {
    const reciprocalMap: Record<string, string> = {
        "Mum": "Daughter",
        "Mother": "Daughter",
        "Dad": "Son",
        "Father": "Son",
        "Daughter": "Mum",
        "Son": "Dad",
        "Wife": "Husband",
        "Husband": "Wife",
        "Partner": "Partner",
        "Sister": "Sister",
        "Brother": "Brother",
        "Friend": "Friend",
        "Guardian": "Ward",
        "Ward": "Guardian",
    };
    return reciprocalMap[type] || type;
};

export async function POST(request: Request) {
    try {
        const { userId, isFallback, userEmail } = await checkAuthentication(request);
        
        if (isFallback && userEmail === 'claire@claireschillaci.com') {
            // For fallback auth, fix legacy data
            const clients = await getClients(false, null);
            const fixedClients = fixRelationshipTypes(clients);
            await saveClients(fixedClients, null);
            return NextResponse.json({ 
                success: true, 
                message: `Fixed relationships for ${fixedClients.length} clients`,
                fixed: fixedClients.length
            });
        }
        
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all clients
        const clients = await getClients(false, userId);
        const archivedClients = await getClients(true, userId);
        const allClients = [...clients, ...archivedClients];
        
        // Fix relationship types
        const fixedClients = fixRelationshipTypes(allClients);
        
        // Save fixed clients
        await saveClients(fixedClients, userId);
        
        return NextResponse.json({ 
            success: true, 
            message: `Fixed relationships for ${fixedClients.length} clients`,
            fixed: fixedClients.length
        });
    } catch (error: any) {
        console.error('[Fix Relationships API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fix relationships' },
            { status: 500 }
        );
    }
}

function fixRelationshipTypes(clients: any[]): any[] {
    // Create a map of clients by ID for quick lookup
    const clientMap = new Map(clients.map(c => [c.id, c]));
    
    return clients.map(client => {
        if (!client.relationships || client.relationships.length === 0) {
            return client;
        }
        
        const fixedRelationships = client.relationships.map((rel: any) => {
            const relatedClient = clientMap.get(rel.relatedClientId);
            if (!relatedClient) return rel;
            
            // Check if the related client has a relationship back
            const reverseRel = relatedClient.relationships?.find((r: any) => r.relatedClientId === client.id);
            if (!reverseRel) return rel;
            
            // The relationship types should be reciprocals of each other
            // If current type's reciprocal matches reverse type, current type is correct
            const currentTypeReciprocal = getReciprocalRelationshipType(rel.type);
            if (currentTypeReciprocal === reverseRel.type) {
                // Current type is correct
                return rel;
            }
            
            // If reverse type's reciprocal matches current type, current type is also correct
            const reverseTypeReciprocal = getReciprocalRelationshipType(reverseRel.type);
            if (reverseTypeReciprocal === rel.type) {
                // Current type is correct
                return rel;
            }
            
            // If types don't match as reciprocals, the current type is likely backwards
            // Convert it to be the reciprocal of the reverse type
            return {
                ...rel,
                type: reverseTypeReciprocal
            };
        });
        
        return {
            ...client,
            relationships: fixedRelationships
        };
    });
}

