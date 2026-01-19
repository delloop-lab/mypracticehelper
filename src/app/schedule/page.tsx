"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Scheduling } from "@/components/scheduling";

function SchedulePageContent() {
    const searchParams = useSearchParams();
    const clientParam = searchParams.get('client');
    const editParam = searchParams.get('edit');
    
    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <Scheduling 
                preSelectedClient={clientParam || undefined}
                editAppointmentId={editParam || undefined}
            />
        </div>
    );
}

export default function SchedulePage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <SchedulePageContent />
        </Suspense>
    );
}
