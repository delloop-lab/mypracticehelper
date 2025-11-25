import { NextResponse } from 'next/server';

export async function GET() {
    // Return empty list as local backups are not supported in cloud mode
    return NextResponse.json({ backups: [] });
}

export async function POST() {
    return NextResponse.json({
        error: 'Local backups are not supported in the online version. Please use the "Export Data" feature (coming soon).'
    }, { status: 501 });
}

export async function DELETE() {
    return NextResponse.json({
        error: 'Not supported'
    }, { status: 501 });
}

