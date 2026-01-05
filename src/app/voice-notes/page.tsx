import { Suspense } from "react";
import { VoiceNotes } from "@/components/voice-notes";

export default function VoiceNotesPage() {
    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2">Voice Notes</h1>
                <p className="text-muted-foreground">
                    Record new sessions and automatically generate structured notes.
                </p>
            </div>
            <Suspense fallback={null}>
                <VoiceNotes />
            </Suspense>
        </div>
    );
}
