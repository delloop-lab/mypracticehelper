/**
 * Generate bcrypt hash for password
 * Run with: node scripts/generate-password-hash.js
 */

const bcrypt = require('bcryptjs');

async function generateHash() {
    const password = process.argv[2] || '22Picnic!';
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

