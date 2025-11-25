import { NextResponse } from 'next/server';

export async function POST() {
    return NextResponse.json({
        error: 'Restore from local backup is not supported in the online version.'
    }, { status: 501 });
}

