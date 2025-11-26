import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

// Create SMTP transporter for IONOS
function createTransporter() {
    const smtpHost = process.env.SMTP_HOST || 'smtp.ionos.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || smtpUser;
    const smtpFromName = process.env.SMTP_FROM_NAME || 'Claire Schillaci';

    if (!smtpUser || !smtpPass) {
        throw new Error('SMTP credentials not configured');
    }

    return nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for other ports
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
    });
}

// Format appointment date/time for email
function formatAppointmentDateTime(date: Date, timezone?: string): string {
    const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone || 'UTC',
    };
    return date.toLocaleString('en-US', options);
}

// Replace placeholders in template
function replacePlaceholders(template: string, replacements: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(replacements)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        result = result.replace(regex, value);
    }
    return result;
}

// Create reminder email template
export function createReminderEmail(
    clientName: string,
    appointmentDate: Date,
    appointmentType: string,
    duration: number,
    timezone?: string,
    customTemplate?: { subject: string; htmlBody: string; textBody: string }
): { subject: string; html: string; text: string } {
    const formattedDateTime = formatAppointmentDateTime(appointmentDate, timezone);
    const formattedDate = formattedDateTime.split(',')[0];
    const durationText = duration ? `${duration} minutes` : '1 hour';

    // Use custom template if provided, otherwise use default
    if (customTemplate) {
        const replacements = {
            clientName,
            dateTime: formattedDateTime,
            date: formattedDate,
            appointmentType,
            duration: durationText,
            logoUrl: '{{logoUrl}}', // Will be replaced in sendReminderEmail
        };

        const subject = customTemplate.subject 
            ? replacePlaceholders(customTemplate.subject, replacements)
            : `Reminder: Your appointment tomorrow - ${formattedDate}`;

        return {
            subject: subject,
            html: replacePlaceholders(customTemplate.htmlBody, replacements),
            text: replacePlaceholders(customTemplate.textBody, replacements),
        };
    }

    // Default template
    const subject = `Reminder: Your appointment tomorrow - ${formattedDate}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Appointment Reminder</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="color: #0069ff; margin-top: 0;">Appointment Reminder</h1>
    </div>
    
    <p>Dear ${clientName},</p>
    
    <p>This is a friendly reminder that you have an appointment scheduled for:</p>
    
    <div style="background-color: #e7f3ff; padding: 15px; border-left: 4px solid #0069ff; margin: 20px 0;">
        <p style="margin: 0; font-size: 18px; font-weight: bold;">${formattedDateTime}</p>
        <p style="margin: 5px 0 0 0; color: #666;">${appointmentType} • ${durationText}</p>
    </div>
    
    <p>If you need to reschedule or cancel, please contact me as soon as possible.</p>
    
    <p>I look forward to seeing you tomorrow.</p>
    
    <p>Best regards,<br>
    <strong>Claire Schillaci</strong></p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="font-size: 12px; color: #999; margin: 0;">
        This is an automated reminder. Please do not reply to this email.
    </p>
</body>
</html>
    `.trim();

    const text = `
Appointment Reminder

Dear ${clientName},

This is a friendly reminder that you have an appointment scheduled for:

${formattedDateTime}
${appointmentType} • ${durationText}

If you need to reschedule or cancel, please contact me as soon as possible.

I look forward to seeing you tomorrow.

Best regards,
Claire Schillaci

---
This is an automated reminder. Please do not reply to this email.
    `.trim();

    return { subject, html, text };
}

// Get base URL for logo in emails
function getBaseUrl(): string {
    // In production, use the actual domain
    if (process.env.NEXT_PUBLIC_APP_URL) {
        return process.env.NEXT_PUBLIC_APP_URL;
    }
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    // Fallback for local development
    return 'http://localhost:3000';
}

// Send reminder email
export async function sendReminderEmail(
    to: string,
    clientName: string,
    appointmentDate: Date,
    appointmentType: string,
    duration: number,
    timezone?: string,
    customTemplate?: { subject: string; htmlBody: string; textBody: string }
): Promise<void> {
    const transporter = createTransporter();
    const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER;
    const smtpFromName = process.env.SMTP_FROM_NAME || 'Claire Schillaci';

    if (!smtpFrom) {
        throw new Error('SMTP_FROM not configured');
    }

    const { subject, html, text } = createReminderEmail(
        clientName,
        appointmentDate,
        appointmentType,
        duration,
        timezone,
        customTemplate
    );

    // Prepare attachments with logo embedded using CID
    const attachments: any[] = [];
    let logoCid = null;
    
    try {
        const logoPath = path.join(process.cwd(), 'public', 'logo.png');
        if (fs.existsSync(logoPath)) {
            logoCid = 'logo@algarve-therapy';
            attachments.push({
                filename: 'logo.png',
                path: logoPath,
                cid: logoCid, // Content-ID for inline image
            });
            if (process.env.NODE_ENV === 'development') {
                console.log('[Email] Logo attached with CID:', logoCid);
            }
        } else {
            console.warn('[Email] Logo file not found at:', logoPath);
        }
    } catch (error) {
        console.error('[Email] Error reading logo file:', error);
    }

    // Replace logo placeholder with CID reference
    let finalHtml = html;
    if (logoCid) {
        finalHtml = html.replace(/\{\{logoUrl\}\}/g, `cid:${logoCid}`);
    } else {
        // Remove logo div if logo not found
        finalHtml = html.replace(/<div[^>]*>\s*<img[^>]*src="\{\{logoUrl\}\}"[^>]*>\s*<\/div>/gi, '');
    }

    const mailOptions: any = {
        from: `"${smtpFromName}" <${smtpFrom}>`,
        to: to,
        subject: subject || 'Appointment Reminder', // Ensure subject is always set
        html: finalHtml, // HTML email body only - no plain text
    };

    // Add attachments if we have them
    if (attachments.length > 0) {
        mailOptions.attachments = attachments;
    }

    // Log for debugging (only in development)
    if (process.env.NODE_ENV === 'development') {
        console.log('[Email] Sending HTML email');
        console.log('[Email] HTML length:', finalHtml.length, 'characters');
        console.log('[Email] Attachments:', attachments.length);
    }

    await transporter.sendMail(mailOptions);
}

