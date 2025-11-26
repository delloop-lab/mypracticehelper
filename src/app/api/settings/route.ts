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
    <!-- Logo centered at top -->
    <div style="text-align: center; margin-bottom: 30px;">
        <img src="{{logoUrl}}" alt="Algarve Therapy Centre" style="max-width: 200px; height: auto;" />
    </div>
    
    <p>Hi {{clientName}},</p>
    
    <p>This is a quick reminder about your {{appointmentType}} scheduled for {{dateTime}}. The session will run for {{duration}}.</p>
    
    <p>If you need to reschedule, just let me know.</p>
    
    <p>See you then,</p>
    
    <p>Claire<br>
    <strong>Algarve Therapy Centre</strong><br>
    Tel: 937596665</p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="font-size: 12px; color: #999; margin: 0;">
        This is an automated reminder. Please do not reply to this email.
    </p>
</body>
</html>`,
        textBody: `Appointment Reminder

Hi {{clientName}},

This is a quick reminder about your {{appointmentType}} scheduled for {{dateTime}}. The session will run for {{duration}}.

If you need to reschedule, just let me know.

See you then,

Claire
Algarve Therapy Centre
Tel: 937596665

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

