// Script to restore clients from local backup file
// Run with: node restore-clients.js

const fs = require('fs');
const path = require('path');

async function restoreClients() {
    try {
        // Read the local clients.json backup
        const clientsFile = path.join(__dirname, 'data', 'clients.json');
        const clientsData = fs.readFileSync(clientsFile, 'utf8');
        const clients = JSON.parse(clientsData);
        
        console.log(`Found ${clients.length} clients in backup file:`);
        clients.forEach(c => {
            console.log(`  - ${c.name} (ID: ${c.id})`);
        });
        
        // Find Claire and Lilli
        const lilli = clients.find(c => c.name && c.name.toLowerCase().includes('lilli'));
        const claire = clients.find(c => c.name && c.name.toLowerCase().includes('claire'));
        
        console.log('\nLooking for Claire and Lilli:');
        console.log('Lilli found:', lilli ? `Yes - ${lilli.name}` : 'No');
        console.log('Claire found:', claire ? `Yes - ${claire.name}` : 'No');
        
        // Send to API to restore
        const clientsToRestore = [lilli, claire].filter(Boolean);
        
        if (clientsToRestore.length === 0) {
            console.log('\nNo clients to restore found in backup.');
            return;
        }
        
        console.log(`\nRestoring ${clientsToRestore.length} clients...`);
        
        // Use fetch to restore via API
        const response = await fetch('http://localhost:3000/api/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clientsToRestore)
        });
        
        if (response.ok) {
            console.log('✅ Clients restored successfully!');
        } else {
            const error = await response.text();
            console.error('❌ Failed to restore:', error);
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

// Note: This requires the dev server to be running
// Or you can manually copy the client data and use the Supabase dashboard
console.log('To restore clients:');
console.log('1. Make sure your dev server is running (npm run dev)');
console.log('2. Run: node restore-clients.js');
console.log('\nOR manually restore via Supabase dashboard or API\n');

// Uncomment to run automatically:
// restoreClients();










