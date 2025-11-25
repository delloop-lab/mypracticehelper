"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Square, Loader2, CheckCircle2, AlertCircle, Upload } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface NoteSection {
    title: string;
    content: string;
}

interface Client {
    id: string;
    name: string;
    notes: string;
}

export function VoiceNotes() {
    // Core state
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [structuredNotes, setStructuredNotes] = useState<NoteSection[]>([]);
    const [error, setError] = useState("");
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioURL, setAudioURL] = useState<string>("");
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

    // UI state for client saving
    const [clients, setClients] = useState<Client[]>([]);
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [selectedClientId, setSelectedClientId] = useState<string>("");
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
    const [isDragging, setIsDragging] = useState(false);

    // Refs
    const recognitionRef = useRef<any>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const transcriptRef = useRef<string>("");

    // Load clients on mount
    useEffect(() => {
        const loadClients = async () => {
            try {
                const res = await fetch("/api/clients");
                if (res.ok) setClients(await res.json());
            } catch (e) {
                console.error("Error loading clients", e);
            }
        };
        loadClients();
    }, []);

    // Initialize SpeechRecognition (WebKit only - works in Chrome/Edge)
    useEffect(() => {
        if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition;
            const rec = new SpeechRecognition();
            rec.continuous = true;
            rec.interimResults = true;
            rec.lang = "en-US";
            rec.onresult = (ev: any) => {
                let final = "";
                for (let i = ev.resultIndex; i < ev.results.length; i++) {
                    if (ev.results[i].isFinal) {
                        final += ev.results[i][0].transcript + " ";
                    }
                }
                setTranscript((p) => {
                    const newTranscript = p + final;
                    transcriptRef.current = newTranscript;
                    return newTranscript;
                });
            };
            rec.onerror = (ev: any) => {
                console.error("Speech error", ev.error);
                setError(`Recognition error: ${ev.error}`);
                setIsRecording(false);
            };
            rec.onend = () => {
                // handled by stopRecording
            };
            recognitionRef.current = rec;
        }
        return () => {
            recognitionRef.current?.stop();
        };
    }, []);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const startRecording = async () => {
        setError("");
        setTranscript("");
        transcriptRef.current = "";
        setStructuredNotes([]);
        setRecordingTime(0);
        setAudioURL("");
        setAudioBlob(null);
        setSaveStatus("idle");
        audioChunksRef.current = [];

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mr = new MediaRecorder(stream);
            mediaRecorderRef.current = mr;
            mr.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };
            mr.onstop = () => {
                stream.getTracks().forEach((t) => t.stop());
            };
            mr.start();
        } catch (e: any) {
            console.error("Audio error:", e);
            setError(`Could not access microphone: ${e.message}`);
            return;
        }

        setIsRecording(true);
        timerRef.current = setInterval(() => setRecordingTime((p) => p + 1), 1000);

        if (recognitionRef.current) {
            try {
                recognitionRef.current.start();
            } catch (e) {
                console.error(e);
                setError("Could not start speech recognition");
                mediaRecorderRef.current?.stop();
                setIsRecording(false);
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }
            }
        } else {
            console.warn("Speech recognition not supported – recording audio only");
        }
    };

    const stopRecording = () => {
        recognitionRef.current?.stop();
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        mediaRecorderRef.current?.stop();
        setIsRecording(false);

        setTimeout(() => {
            const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
            const url = URL.createObjectURL(blob);
            setAudioBlob(blob);
            setAudioURL(url);
            // Use transcriptRef.current which has the latest value
            const currentTranscript = transcriptRef.current;
            console.log("Stopping recording with transcript:", currentTranscript);
            console.log("Transcript length:", currentTranscript.length);
            // Pass the transcript to processTranscript
            processTranscript(currentTranscript, blob);
        }, 500);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowed = ["audio/mp3", "audio/webm", "audio/m4u", "audio/wav", "audio/m4a", "audio/x-m4a", "audio/mp4", "audio/mpeg"];
        if (!allowed.includes(file.type)) {
            setError("Unsupported audio file type");
            return;
        }

        const blob = file;
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioURL(url);

        // For uploaded files, use special marker to indicate no transcript available
        processTranscript("__FILE_UPLOAD__", blob);
    };

    const processTranscript = async (text: string, blob: Blob) => {
        setIsProcessing(true);

        await new Promise((r) => setTimeout(r, 500));

        // Check if this is a file upload (no transcript) or a live recording (has transcript)
        let formattedText: string;
        if (text === "__FILE_UPLOAD__") {
            formattedText = "No transcript available (file upload)";
        } else if (text) {
            formattedText = formatVoiceCommands(text);
        } else {
            formattedText = "No transcript captured";
        }

        const notes: NoteSection[] = [{ title: "Session Notes", content: formattedText }];
        setStructuredNotes(notes);
        setIsProcessing(false);

        try {
            await saveRecording(formattedText, blob, notes);
            console.log("Recording saved successfully");
            window.dispatchEvent(new Event("recordings-updated"));
        } catch (err) {
            console.error("Failed to save recording:", err);
            setError("Failed to save recording. Please try again.");
        }
    };

    const formatVoiceCommands = (text: string): string => {
        let formatted = text;
        const replacements: [RegExp, string][] = [
            [/\s+period\s+/gi, ". "],
            [/\s+period$/gi, "."],
            [/\s+full stop\s+/gi, ". "],
            [/\s+full stop$/gi, "."],
            [/\s+comma\s+/gi, ", "],
            [/\s+comma$/gi, ","],
            [/\s+question mark\s+/gi, "? "],
            [/\s+question mark$/gi, "?"],
            [/\s+exclamation point\s+/gi, "! "],
            [/\s+exclamation point$/gi, "!"],
            [/\s+exclamation mark\s+/gi, "! "],
            [/\s+exclamation mark$/gi, "!"],
            [/\s+colon\s+/gi, ": "],
            [/\s+colon$/gi, ":"],
            [/\s+semicolon\s+/gi, "; "],
            [/\s+semicolon$/gi, ";"],
            [/\s+new line\s+/gi, "\n"],
            [/\s+new line$/gi, "\n"],
            [/\s+new paragraph\s+/gi, "\n\n"],
            [/\s+new paragraph$/gi, "\n\n"],
        ];
        replacements.forEach(([p, r]) => {
            formatted = formatted.replace(p, r);
        });
        formatted = formatted
            .split("\n")
            .map((line) => line.replace(/\s+/g, " ").trim())
            .join("\n");
        formatted = formatted.replace(/(^\w|[.!?]\s+\w)/g, (m) => m.toUpperCase());
        return formatted;
    };

    const saveRecording = async (transcript: string, blob: Blob, notes: NoteSection[]) => {
        const form = new FormData();
        form.append("file", blob);
        const meta = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            duration: recordingTime,
            transcript,
            notes
        };
        form.append("data", JSON.stringify(meta));
        const response = await fetch("/api/recordings", { method: "POST", body: form });
        if (!response.ok) throw new Error(`Failed to save recording: ${response.statusText}`);
        return await response.json();
    };

    const downloadAudio = () => {
        if (!audioBlob) return;
        const url = URL.createObjectURL(audioBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `session-${new Date().toISOString().slice(0, 10)}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleSaveToClient = () => {
        setIsSaveDialogOpen(true);
        setSaveStatus("idle");
    };

    const assignRecordingToClient = async (clientName: string) => {
        try {
            const res = await fetch("/api/recordings");
            if (!res.ok) return;
            const recordings = await res.json();
            const idx = recordings.findIndex((r: any) => !r.clientName);
            if (idx === -1) return;
            recordings[idx].clientName = clientName;
            await fetch("/api/recordings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(recordings),
            });
            window.dispatchEvent(new Event("recordings-updated"));
        } catch (e) {
            console.error(e);
        }
    };

    const confirmSaveToClient = async () => {
        if (!selectedClientId) return;
        setSaveStatus("saving");
        const client = clients.find((c) => c.id === selectedClientId);
        if (!client) {
            setSaveStatus("error");
            return;
        }
        try {
            await assignRecordingToClient(client.name);
            setSaveStatus("success");
            setTimeout(() => {
                setIsSaveDialogOpen(false);
                setSelectedClientId("");
                setSaveStatus("idle");
            }, 1500);
        } catch (e) {
            console.error(e);
            setSaveStatus("error");
        }
    };

    return (
        <div className="space-y-6 max-w-3xl mx-auto p-4">
            <Card className="border-primary/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Mic className="h-5 w-5 text-primary" /> Voice Notes
                    </CardTitle>
                    <CardDescription>Record session notes with automatic transcription (Chrome/Edge only).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col items-center justify-center py-8">
                        <AnimatePresence mode="wait">
                            {!isRecording && !isProcessing && structuredNotes.length === 0 && (
                                <motion.div
                                    key="idle"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="flex flex-col items-center space-y-4"
                                >
                                    <Button size="lg" onClick={startRecording} className="h-24 w-24 rounded-full bg-primary hover:bg-primary/90">
                                        <Mic className="h-10 w-10" />
                                    </Button>
                                    <p className="text-sm text-muted-foreground">Click to start recording</p>
                                </motion.div>
                            )}

                            {isRecording && (
                                <motion.div
                                    key="recording"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="flex flex-col items-center space-y-4 w-full"
                                >
                                    <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="relative">
                                        <Button size="lg" onClick={stopRecording} className="h-24 w-24 rounded-full bg-red-500 hover:bg-red-600 shadow-lg z-10">
                                            <Square className="h-10 w-10" />
                                        </Button>
                                        <div className="absolute -inset-2 rounded-full border-4 border-red-500 opacity-50 animate-ping" />
                                    </motion.div>
                                    <p className="text-2xl font-bold text-red-500">{formatTime(recordingTime)}</p>
                                    <p className="text-sm text-muted-foreground">Recording… Click red button to stop</p>
                                    <Button onClick={stopRecording} size="lg" variant="destructive" className="w-full max-w-xs">
                                        <Square className="mr-2 h-5 w-5" /> STOP RECORDING
                                    </Button>
                                </motion.div>
                            )}

                            {isProcessing && (
                                <motion.div
                                    key="processing"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="flex flex-col items-center space-y-4"
                                >
                                    <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Loader2 className="h-10 w-10 text-primary animate-spin" />
                                    </div>
                                    <p className="text-sm text-muted-foreground">Processing your notes…</p>
                                </motion.div>
                            )}

                            {!isRecording && !isProcessing && structuredNotes.length > 0 && (
                                <motion.div
                                    key="complete"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="flex flex-col items-center space-y-4"
                                >
                                    <div className="h-24 w-24 rounded-full bg-green-500/10 flex items-center justify-center">
                                        <CheckCircle2 className="h-10 w-10 text-green-500" />
                                    </div>
                                    <p className="text-sm text-muted-foreground">Recording complete!</p>
                                    <Button onClick={startRecording} variant="outline">
                                        <Mic className="mr-2 h-4 w-4" /> Record New Notes
                                    </Button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-500">
                            <AlertCircle className="h-4 w-4" /> {error}
                        </div>
                    )}

                    {audioURL && (
                        <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
                            <h4 className="text-sm font-semibold">Audio Recording:</h4>
                            <audio controls src={audioURL} className="w-full" />
                            <Button onClick={downloadAudio} variant="outline" size="sm" className="w-full">
                                Download Recording
                            </Button>
                        </div>
                    )}

                    {transcript && (
                        <div className="rounded-lg border border-border bg-muted/50 p-4">
                            <h4 className="mb-2 text-sm font-semibold">Transcript:</h4>
                            <p className="text-sm text-muted-foreground">{transcript}</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {structuredNotes.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    {structuredNotes.map((section, i) => (
                        <Card key={i} className="border-primary/10">
                            <CardHeader>
                                <CardTitle className="text-base">{section.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{section.content}</p>
                            </CardContent>
                        </Card>
                    ))}
                    <div className="flex gap-2">
                        <Button className="flex-1" onClick={handleSaveToClient}>
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Save to Client Record
                        </Button>
                    </div>
                </motion.div>
            )}

            <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Save Notes to Client Record</DialogTitle>
                        <DialogDescription>Select a client to append these notes to their record.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="client-select">Select Client</Label>
                        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                            <SelectTrigger id="client-select">
                                <SelectValue placeholder="Select a client..." />
                            </SelectTrigger>
                            <SelectContent>
                                {clients.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                        {c.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={confirmSaveToClient} disabled={!selectedClientId || saveStatus === "saving"}>
                            {saveStatus === "saving" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {saveStatus === "success" ? "Saved!" : "Save Notes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* File upload UI */}
            <div className="mt-6">
                <div
                    className={`relative border-2 border-dashed rounded-lg p-8 transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                        }`}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                    }}
                    onDragLeave={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                    }}
                    onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                            const syntheticEvent = {
                                target: { files: [file] }
                            } as unknown as React.ChangeEvent<HTMLInputElement>;
                            handleFileUpload(syntheticEvent);
                        }
                    }}
                >
                    <input
                        type="file"
                        accept="audio/mp3, audio/webm, audio/m4u, audio/wav, audio/m4a, audio/mp4, audio/mpeg"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center justify-center text-center space-y-2">
                        <div className="p-3 bg-primary/10 rounded-full">
                            <Upload className="h-6 w-6 text-primary" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium">
                                Drag & drop your audio file here or click to browse
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Supports MP3, WAV, M4A, WebM (max 25MB) - Note: Uploaded files won't have transcripts
                            </p>
                        </div>
                    </div>
                </div>

                {audioBlob && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 flex items-center justify-between p-3 bg-muted/50 rounded-lg border"
                    >
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Mic className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">Audio ready</p>
                                <p className="text-xs text-muted-foreground">
                                    {(audioBlob.size / (1024 * 1024)).toFixed(2)} MB
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
