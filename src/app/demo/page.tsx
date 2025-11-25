import { VoiceNotes } from "@/components/voice-notes";

export default function DemoPage() {
    return (
        <div className="container px-4 py-20 md:px-8">
            <div className="mx-auto max-w-4xl space-y-8">
                <div className="space-y-4 text-center">
                    <h1 className="text-4xl font-bold tracking-tight">
                        Voice-to-Notes Demo
                    </h1>
                    <p className="text-xl text-muted-foreground">
                        Experience the future of clinical documentation
                    </p>
                </div>

                <VoiceNotes />

                <div className="rounded-lg border border-primary/20 bg-primary/5 p-6 space-y-4">
                    <h3 className="font-semibold">How it works:</h3>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                        <li>Click the microphone button to start recording your session notes</li>
                        <li>Speak naturally about the session - mention presenting problems, interventions, progress, etc.</li>
                        <li>Click stop when finished (or after 2-5 minutes)</li>
                        <li>Our AI will automatically structure your notes into clinical sections</li>
                        <li>Review, edit if needed, and save to the client record</li>
                    </ol>
                    <p className="text-xs text-muted-foreground mt-4">
                        💡 <strong>Tip:</strong> For best results, use Chrome or Edge browser. The speech recognition works entirely in your browser for privacy.
                    </p>
                </div>
            </div>
        </div>
    );
}
