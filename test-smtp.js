/**
 * Standalone SMTP Email Test Script
 * 
 * This script tests your SMTP email configuration without affecting the live app.
 * 
 * Usage:
 * 1. Create a .env.local file with your SMTP settings (if not already present)
 * 2. Run: node test-smtp.js
 * 
 * Environment Variables Required:
 * - SMTP_HOST: Your SMTP server (e.g., smtp.ionos.com)
 * - SMTP_PORT: SMTP port (587 for TLS, 465 for SSL)
 * - SMTP_USER: Your SMTP username/email
 * - SMTP_PASS: Your SMTP password
 * - SMTP_FROM: Email address to send from (optional, defaults to SMTP_USER)
 * - SMTP_FROM_NAME: Display name for sender (optional, defaults to "Test Sender")
 */

require('dotenv').config({ path: '.env.local' });
const nodemailer = require('nodemailer');

// SMTP Configuration from environment variables
const SMTP_CONFIG = {
    host: process.env.SMTP_HOST || 'smtp.ionos.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    fromName: process.env.SMTP_FROM_NAME || 'Test Sender',
};

// Test email recipient - CHANGE THIS to your test email
const TEST_RECIPIENT = process.env.TEST_EMAIL || 'your-email@example.com';

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
    console.log('\n' + '='.repeat(60));
    log(title, 'bright');
    console.log('='.repeat(60));
}

async function testSMTPConnection() {
    logSection('📧 SMTP Email Test Script');
    
    // Validate configuration
    log('\n1️⃣  Checking SMTP Configuration...', 'cyan');
    console.log('   Host:', SMTP_CONFIG.host);
    console.log('   Port:', SMTP_CONFIG.port);
    console.log('   User:', SMTP_CONFIG.user ? '✓ Set' : '✗ Missing');
    console.log('   Pass:', SMTP_CONFIG.pass ? '✓ Set' : '✗ Missing');
    console.log('   From:', SMTP_CONFIG.from);
    console.log('   Name:', SMTP_CONFIG.fromName);
    console.log('   Test Recipient:', TEST_RECIPIENT);
    
    if (!SMTP_CONFIG.user || !SMTP_CONFIG.pass) {
        log('\n❌ ERROR: SMTP_USER and SMTP_PASS are required!', 'red');
        log('\nPlease set these in your .env.local file:', 'yellow');
        log('   SMTP_HOST=smtp.ionos.com', 'yellow');
        log('   SMTP_PORT=587', 'yellow');
        log('   SMTP_USER=your-email@domain.com', 'yellow');
        log('   SMTP_PASS=your-password', 'yellow');
        log('   SMTP_FROM=noreply@domain.com (optional)', 'yellow');
        log('   SMTP_FROM_NAME=Your Name (optional)', 'yellow');
        log('   TEST_EMAIL=recipient@example.com (optional)', 'yellow');
        process.exit(1);
    }
    
    if (TEST_RECIPIENT === 'your-email@example.com') {
        log('\n⚠️  WARNING: Please change TEST_RECIPIENT to your actual email!', 'yellow');
        log('   You can set TEST_EMAIL in .env.local or edit this script.', 'yellow');
        console.log('');
    }
    
    // Create transporter
    log('\n2️⃣  Creating SMTP Transport...', 'cyan');
    const transporter = nodemailer.createTransport({
        host: SMTP_CONFIG.host,
        port: SMTP_CONFIG.port,
        secure: SMTP_CONFIG.port === 465, // true for 465, false for other ports
        auth: {
            user: SMTP_CONFIG.user,
            pass: SMTP_CONFIG.pass,
        },
        debug: true, // Enable debug output
        logger: true, // Log to console
    });
    
    // Test connection
    try {
        log('\n3️⃣  Testing SMTP Connection...', 'cyan');
        await transporter.verify();
        log('   ✅ SMTP connection successful!', 'green');
    } catch (error) {
        log('\n❌ SMTP Connection Failed!', 'red');
        console.error('   Error:', error.message);
        
        if (error.code === 'EAUTH') {
            log('\n💡 Authentication failed. Common causes:', 'yellow');
            log('   • Wrong username or password', 'yellow');
            log('   • Two-factor authentication enabled (may need app-specific password)', 'yellow');
            log('   • SMTP access not enabled for this account', 'yellow');
        } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
            log('\n💡 Connection failed. Common causes:', 'yellow');
            log('   • Wrong SMTP host or port', 'yellow');
            log('   • Firewall blocking connection', 'yellow');
            log('   • SSL/TLS configuration mismatch', 'yellow');
        }
        
        process.exit(1);
    }
    
    // Send test email
    try {
        log('\n4️⃣  Sending Test Email...', 'cyan');
        
        const mailOptions = {
            from: `"${SMTP_CONFIG.fromName}" <${SMTP_CONFIG.from}>`,
            to: TEST_RECIPIENT,
            subject: '✅ SMTP Test Email - Success!',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #4CAF50; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
        <h1 style="margin: 0;">✅ SMTP Test Successful!</h1>
    </div>
    
    <p>Congratulations! Your SMTP email configuration is working correctly.</p>
    
    <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #4CAF50; margin: 20px 0;">
        <h3 style="margin-top: 0;">Configuration Details:</h3>
        <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Host:</strong> ${SMTP_CONFIG.host}</li>
            <li><strong>Port:</strong> ${SMTP_CONFIG.port}</li>
            <li><strong>User:</strong> ${SMTP_CONFIG.user}</li>
            <li><strong>From:</strong> ${SMTP_CONFIG.from}</li>
            <li><strong>Display Name:</strong> ${SMTP_CONFIG.fromName}</li>
        </ul>
    </div>
    
    <p>You can now use these settings in your application with confidence!</p>
    
    <p style="font-size: 12px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
        This is an automated test email sent at ${new Date().toLocaleString()}
    </p>
</body>
</html>
            `,
            text: `
✅ SMTP Test Successful!

Congratulations! Your SMTP email configuration is working correctly.

Configuration Details:
- Host: ${SMTP_CONFIG.host}
- Port: ${SMTP_CONFIG.port}
- User: ${SMTP_CONFIG.user}
- From: ${SMTP_CONFIG.from}
- Display Name: ${SMTP_CONFIG.fromName}

You can now use these settings in your application with confidence!

This is an automated test email sent at ${new Date().toLocaleString()}
            `.trim(),
        };
        
        const info = await transporter.sendMail(mailOptions);
        
        log('\n   ✅ Test email sent successfully!', 'green');
        console.log('   Message ID:', info.messageId);
        console.log('   Preview URL:', nodemailer.getTestMessageUrl(info) || 'N/A');
        
        logSection('🎉 SUCCESS! Your SMTP is configured correctly!');
        log('\n📬 Check your inbox at: ' + TEST_RECIPIENT, 'green');
        log('\n💡 Next Steps:', 'cyan');
        log('   1. Check your email inbox (might be in spam)', 'yellow');
        log('   2. If received, your SMTP settings are correct!', 'yellow');
        log('   3. You can now use these settings in production', 'yellow');
        console.log('');
        
    } catch (error) {
        log('\n❌ Failed to Send Test Email!', 'red');
        console.error('   Error:', error.message);
        
        if (error.responseCode) {
            console.error('   Response Code:', error.responseCode);
        }
        if (error.response) {
            console.error('   Server Response:', error.response);
        }
        
        process.exit(1);
    }
}

// Run the test
testSMTPConnection()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        log('\n❌ Unexpected Error:', 'red');
        console.error(error);
        process.exit(1);
    });
