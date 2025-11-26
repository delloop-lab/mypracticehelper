import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Create SMTP transporter
function createTransporter() {
    const smtpHost = process.env.SMTP_HOST || 'smtp.ionos.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || smtpUser;

    if (!smtpUser || !smtpPass) {
        throw new Error('SMTP credentials not configured');
    }

    return nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
    });
}

export async function POST(request: Request) {
    try {
        const { name, email, message } = await request.json();

        // Validate input
        if (!name || !email || !message) {
            return NextResponse.json(
                { error: 'Name, email, and message are required' },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        const transporter = createTransporter();
    const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER;
    const smtpFromName = 'My Practice Helper';

        if (!smtpFrom) {
            throw new Error('SMTP_FROM not configured');
        }

        // Create email content
        const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">
        New Contact Form Submission
    </h2>
    
    <div style="margin-top: 20px;">
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
    </div>
    
    <div style="margin-top: 30px;">
        <h3 style="color: #333; margin-bottom: 10px;">Message:</h3>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; white-space: pre-wrap;">
${message}
        </div>
    </div>
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
        <p>This message was sent from the My Practice Helper contact form.</p>
    </div>
</body>
</html>
        `.trim();

        const textBody = `
New Contact Form Submission

Name: ${name}
Email: ${email}

Message:
${message}

---
This message was sent from the My Practice Helper contact form.
        `.trim();

        // Send email
        await transporter.sendMail({
            from: `"${smtpFromName}" <${smtpFrom}>`,
            to: 'lou@schillaci.me',
            replyTo: email,
            subject: `Contact Form: ${name}`,
            html: htmlBody,
            text: textBody,
        });

        return NextResponse.json({ 
            success: true, 
            message: 'Message sent successfully' 
        });

    } catch (error: any) {
        console.error('Error sending contact form email:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to send message' },
            { status: 500 }
        );
    }
}

