/**
 * Generate bcrypt hash for password
 * Run with: node scripts/generate-password-hash.js
 */

const bcrypt = require('bcryptjs');

async function generateHash() {
    // Password should be passed as command line argument for security
    // Usage: node scripts/generate-password-hash.js "your-password-here"
    const password = process.argv[2];
    
    if (!password) {
        console.error('Error: Password must be provided as command line argument');
        console.error('Usage: node scripts/generate-password-hash.js "your-password-here"');
        process.exit(1);
    }
    const hash = await bcrypt.hash(password, 10);
    console.log('\n========================================');
    console.log('Password:', password);
    console.log('Bcrypt Hash:', hash);
    console.log('========================================\n');
    console.log('Copy this hash into migration-multi-user-step2-create-first-user.sql');
    console.log('Replace REPLACE_WITH_BCRYPT_HASH with:', hash);
    console.log('\n');
}

generateHash().catch(console.error);

