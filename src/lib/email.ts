import nodemailer from 'nodemailer';

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

// Create reminder email template
export function createReminderEmail(
    clientName: string,
    appointmentDate: Date,
    appointmentType: string,
    duration: number,
    timezone?: string
): { subject: string; html: string; text: string } {
    const formattedDateTime = formatAppointmentDateTime(appointmentDate, timezone);
    const durationText = duration ? `${duration} minutes` : '1 hour';

    const subject = `Reminder: Your appointment tomorrow - ${formattedDateTime.split(',')[0]}`;

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

// Send reminder email
export async function sendReminderEmail(
    to: string,
    clientName: string,
    appointmentDate: Date,
    appointmentType: string,
    duration: number,
    timezone?: string
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
        timezone
    );

    await transporter.sendMail({
        from: `"${smtpFromName}" <${smtpFrom}>`,
        to: to,
        subject: subject,
        html: html,
        text: text,
    });
}

