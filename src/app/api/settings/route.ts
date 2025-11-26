import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const DEFAULT_SETTINGS = {
    calendlyUrl: "",
    appointmentTypes: [
        { name: "Initial Consultation", duration: 60, fee: 80, enabled: true },
        { name: "Follow-up Session", duration: 60, fee: 80, enabled: true },
        { name: "Therapy Session", duration: 60, fee: 80, enabled: true },
        { name: "Couples Therapy Session", duration: 60, fee: 100, enabled: true },
        { name: "Family Therapy", duration: 60, fee: 80, enabled: true },
        { name: "Discovery Session", duration: 30, fee: 0, enabled: true },
    ],
    defaultDuration: 60,
    defaultFee: 80,
    currency: "EUR",
    timezone: "UTC",
    blockedDays: [],
    reminderEmailTemplate: {
        subject: "Reminder: Your appointment tomorrow - {{date}}",
        htmlBody: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="color: #0069ff; margin-top: 0;">Appointment Reminder</h1>
    </div>
    
    <p>Dear {{clientName}},</p>
    
    <p>This is a friendly reminder that you have an appointment scheduled for:</p>
    
    <div style="background-color: #e7f3ff; padding: 15px; border-left: 4px solid #0069ff; margin: 20px 0;">
        <p style="margin: 0; font-size: 18px; font-weight: bold;">{{dateTime}}</p>
        <p style="margin: 5px 0 0 0; color: #666;">{{appointmentType}} • {{duration}}</p>
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
</html>`,
        textBody: `Appointment Reminder

Dear {{clientName}},

This is a friendly reminder that you have an appointment scheduled for:

{{dateTime}}
{{appointmentType}} • {{duration}}

If you need to reschedule or cancel, please contact me as soon as possible.

I look forward to seeing you tomorrow.

Best regards,
Claire Schillaci

---
This is an automated reminder. Please do not reply to this email.`,
    },
};

export async function GET() {
    try {
        const { data, error } = await supabase
            .from('settings')
            .select('config')
            .eq('id', 'default')
            .single();

        if (error || !data) {
            console.warn('Settings not found or error, returning defaults:', error);
            return NextResponse.json(DEFAULT_SETTINGS);
        }

        return NextResponse.json(data.config);
    } catch (error) {
        console.error('Error reading settings:', error);
        return NextResponse.json(DEFAULT_SETTINGS);
    }
}

export async function POST(request: Request) {
    try {
        const settings = await request.json();

        const { error } = await supabase
            .from('settings')
            .upsert({
                id: 'default',
                config: settings,
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error('Supabase error saving settings:', error);
            throw error;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving settings:', error);
        return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }
}

