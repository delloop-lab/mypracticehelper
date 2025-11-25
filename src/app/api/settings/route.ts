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

