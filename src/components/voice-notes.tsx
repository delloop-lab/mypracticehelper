"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Square, Loader2, CheckCircle2, AlertCircle, Upload, ExternalLink, Sparkles } from "lucide-react";
import Link from "next/link";
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
    const searchParams = useSearchParams();
    
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
    const [selectedSessionId, setSelectedSessionId] = useState<string>("");
    const [availableSessions, setAvailableSessions] = useState<{ id: string; date: string; type: string }[]>([]);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
    const [isDragging, setIsDragging] = useState(false);
    const [currentTherapist, setCurrentTherapist] = useState<string>("");
    const [isUploadedFile, setIsUploadedFile] = useState(false);

    // Refs
    const recognitionRef = useRef<any>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const transcriptRef = useRef<string>("");
    const streamRef = useRef<MediaStream | null>(null);
    const isRecordingStoppedRef = useRef<boolean>(false);

    // Load clients on mount
    useEffect(() => {
        const loadClients = async () => {
            try {
                console.log('[Voice Notes] Loading clients...');
                const res = await fetch("/api/clients");
                if (res.ok) {
                    const data = await res.json();
                    console.log('[Voice Notes] Loaded', data.length, 'clients');
                    setClients(data);
                    
                    // Check for URL params to auto-select client
                    const clientParam = searchParams.get('client');
                    const clientIdParam = searchParams.get('clientId');
                    const sessionIdParam = searchParams.get('sessionId');
                    
                    if (clientIdParam) {
                        // Try to find by ID first
                        const clientById = data.find((c: Client) => c.id === clientIdParam);
                        if (clientById) {
                            console.log('[Voice Notes] Auto-selecting client by ID:', clientById.name, 'ID:', clientById.id);
                            setSelectedClientId(clientById.id);
                            // Get date parameter to find specific session
                            const dateParam = searchParams.get('date');
                            console.log('[Voice Notes] Calling loadSessionsForClient with:', {
                                clientId: clientById.id,
                                clientName: clientById.name,
                                dateParam,
                                sessionIdParam
                            });
                            // Load sessions for this client, including the target session if provided
                            // Pass client name directly to avoid timing issues
                            loadSessionsForClient(clientById.id, sessionIdParam || undefined, dateParam || undefined, clientById.name).then(() => {
                                if (sessionIdParam) {
                                    console.log('[Voice Notes] Auto-selecting session by ID:', sessionIdParam);
                                    // Set the sessionId - even if not in the list, allow it to be set
                                    setSelectedSessionId(sessionIdParam);
                                    // If session not found in available sessions, add it manually
                                    setTimeout(() => {
                                        setAvailableSessions(prev => {
                                            const exists = prev.some(s => s.id === sessionIdParam);
                                            if (!exists) {
                                                console.log('[Voice Notes] Session not in list, adding manually');
                                                return [...prev, {
                                                    id: sessionIdParam,
                                                    date: dateParam ? new Date(dateParam).toISOString() : new Date().toISOString(),
                                                    type: 'Session'
                                                }];
                                            }
                                            return prev;
                                        });
                                    }, 500);
                                }
                            });
                        }
                    } else if (clientParam) {
                        // Try to find by name
                        const clientByName = data.find((c: Client) => 
                            c.name.toLowerCase() === clientParam.toLowerCase()
                        );
                        if (clientByName) {
                            console.log('[Voice Notes] Auto-selecting client by name:', clientByName.name);
                            setSelectedClientId(clientByName.id);
                            // Get date parameter to find specific session
                            const dateParam = searchParams.get('date');
                            // Load sessions for this client, including the target session if provided
                            // Pass client name directly to avoid timing issues
                            loadSessionsForClient(clientByName.id, sessionIdParam || undefined, dateParam || undefined, clientByName.name).then(() => {
                                if (sessionIdParam) {
                                    console.log('[Voice Notes] Auto-selecting session by ID:', sessionIdParam);
                                    // Set the sessionId - even if not in the list, allow it to be set
                                    setSelectedSessionId(sessionIdParam);
                                    // If session not found in available sessions, add it manually
                                    setTimeout(() => {
                                        setAvailableSessions(prev => {
                                            const exists = prev.some(s => s.id === sessionIdParam);
                                            if (!exists) {
                                                console.log('[Voice Notes] Session not in list, adding manually');
                                                return [...prev, {
                                                    id: sessionIdParam,
                                                    date: dateParam ? new Date(dateParam).toISOString() : new Date().toISOString(),
                                                    type: 'Session'
                                                }];
                                            }
                                            return prev;
                                        });
                                    }, 500);
                                }
                            });
                        }
                    }
                }
            } catch (e) {
                console.error("[Voice Notes] Error loading clients", e);
            }
        };
        loadClients();
    }, [searchParams]);

    // Load therapist name on mount (from logged-in user's first_name and last_name)
    useEffect(() => {
        const loadTherapist = async () => {
            try {
                console.log('[Voice Notes] ========== Fetching therapist name ==========');
                const response = await fetch('/api/auth/me');
                if (response.ok) {
                    const userData = await response.json();
                    console.log('[Voice Notes] User data from /api/auth/me:', userData);
                    
                    const nameParts: string[] = [];
                    if (userData.first_name && userData.first_name.trim()) {
                        nameParts.push(userData.first_name.trim());
                    }
                    if (userData.last_name && userData.last_name.trim()) {
                        nameParts.push(userData.last_name.trim());
                    }
                    
                    if (nameParts.length > 0) {
                        const name = nameParts.join(' ');
                        console.log('[Voice Notes] Therapist name:', name);
                        setCurrentTherapist(name);
                    } else if (userData.email) {
                        // Fallback to email if name not set
                        const emailParts = userData.email.split('@')[0].split('.');
                        const name = emailParts.map((part: string) => 
                            part.charAt(0).toUpperCase() + part.slice(1)
                        ).join(' ');
                        setCurrentTherapist(name);
                    }
                } else {
                    console.error('[Voice Notes] Failed to fetch user:', response.status);
                }
            } catch (error) {
                console.error('[Voice Notes] Error fetching therapist:', error);
            }
        };
        loadTherapist();
    }, []);

    // Load sessions for selected client
    const loadSessionsForClient = async (clientId: string, sessionIdToInclude?: string, targetDate?: string, clientNameOverride?: string) => {
        setIsLoadingSessions(true);
        setAvailableSessions([]);
        setSelectedSessionId("");
        
        try {
            // Use provided client name, or look it up from clients array
            // If still not found, wait a bit for clients to load (race condition fix)
            let client = clients.find(c => c.id === clientId);
            let clientName = clientNameOverride || client?.name;
            
            // If client name still not found, wait a moment and retry (handles race condition)
            if (!clientName && clients.length > 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
                client = clients.find(c => c.id === clientId);
                clientName = clientNameOverride || client?.name;
            }
            
            console.log('[Voice Notes] Loading sessions for client:', { clientId, clientName, targetDate, sessionIdToInclude, clientNameOverride, clientsLength: clients.length });
            
            if (!clientName && !clientId) {
                console.error('[Voice Notes] Cannot load sessions: no client name or ID');
                setIsLoadingSessions(false);
                return;
            }
            
            const response = await fetch('/api/appointments');
            if (response.ok) {
                const appointments = await response.json();
                console.log('[Voice Notes] Total appointments loaded:', appointments.length);
                
                // Debug: Log ALL appointments to see their client fields
                console.log('[Voice Notes] Sample appointments (first 5):', appointments.slice(0, 5).map((apt: any) => ({
                    id: apt.id,
                    clientName: apt.clientName,
                    clientId: apt.clientId,
                    client_id: apt.client_id,
                    date: apt.date
                })));
                
                // Debug: Log appointments for this client
                const matchingAppointments = appointments.filter((apt: any) => 
                    apt.clientId === clientId || 
                    apt.client_id === clientId ||
                    (clientName && (apt.clientName === clientName || apt.clientName?.toLowerCase() === clientName?.toLowerCase()))
                );
                console.log('[Voice Notes] Appointments matching client:', matchingAppointments.length, matchingAppointments.map((apt: any) => ({
                    id: apt.id,
                    clientName: apt.clientName,
                    clientId: apt.clientId || apt.client_id,
                    date: apt.date
                })));
                
                const now = new Date();
                
                // Parse target date if provided
                let targetDateOnly: Date | null = null;
                if (targetDate) {
                    try {
                        const [year, month, day] = targetDate.split('-').map(Number);
                        targetDateOnly = new Date(year, month - 1, day, 0, 0, 0);
                        console.log('[Voice Notes] Target date parsed:', targetDate, '->', targetDateOnly.toISOString());
                    } catch (e) {
                        console.warn('[Voice Notes] Invalid target date:', targetDate);
                    }
                }
                
                // Filter to past sessions and today's sessions for this client
                // If targetDate is provided, also include sessions matching that date (even if slightly in future)
                const pastSessions = appointments
                    .filter((apt: any) => {
                        // Parse date and time properly
                        const dateStr = apt.date.split('T')[0];
                        const timeStr = apt.time || '00:00';
                        
                        // Handle 12-hour format (e.g., "08:00 am", "02:00 pm")
                        let aptHours = 0;
                        let aptMinutes = 0;
                        const timeLower = timeStr.toLowerCase().trim();
                        const isPM = timeLower.includes('pm');
                        const isAM = timeLower.includes('am');
                        const timeMatch = timeLower.match(/(\d{1,2}):(\d{2})/);
                        
                        if (timeMatch) {
                            aptHours = parseInt(timeMatch[1], 10);
                            aptMinutes = parseInt(timeMatch[2], 10);
                            if (isPM && aptHours !== 12) aptHours += 12;
                            else if (isAM && aptHours === 12) aptHours = 0;
                        }
                        
                        const [year, month, day] = dateStr.split('-').map(Number);
                        const aptDateTime = new Date(year, month - 1, day, aptHours, aptMinutes, 0);
                        
                        // Include sessions that are in the past OR from today (regardless of time)
                        // This allows recording notes for sessions that just completed
                        const aptDateOnly = new Date(year, month - 1, day, 0, 0, 0);
                        const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
                        const isFromTodayOrEarlier = aptDateOnly <= todayDateOnly;
                        
                        // If targetDate is provided, also include sessions matching that exact date
                        const matchesTargetDate = targetDateOnly ? aptDateOnly.getTime() === targetDateOnly.getTime() : false;
                        
                        // Match by clientId first (most reliable), then by name
                        const matchesClient = 
                            apt.clientId === clientId ||
                            apt.client_id === clientId ||
                            (clientName && apt.clientName === clientName) ||
                            (clientName && apt.clientName?.toLowerCase() === clientName?.toLowerCase());
                        
                        const shouldInclude = (isFromTodayOrEarlier || matchesTargetDate) && matchesClient;
                        
                        // Log all appointments for this client to debug
                        if (apt.clientId === clientId || apt.client_id === clientId || 
                            (clientName && (apt.clientName === clientName || apt.clientName?.toLowerCase() === clientName?.toLowerCase()))) {
                            console.log('[Voice Notes] Session match check:', {
                                aptId: apt.id,
                                aptClientName: apt.clientName,
                                aptClientId: apt.clientId || apt.client_id,
                                expectedClientId: clientId,
                                expectedClientName: clientName,
                                aptDate: dateStr,
                                matchesClient,
                                isFromTodayOrEarlier,
                                matchesTargetDate,
                                shouldInclude
                            });
                        }
                        return shouldInclude;
                    })
                    .map((apt: any) => ({
                        id: apt.id,
                        date: apt.date,
                        type: apt.type || 'Session',
                        time: apt.time
                    }))
                    .sort((a: any, b: any) => {
                        // Sort by date descending (most recent first)
                        const dateA = new Date(a.date);
                        const dateB = new Date(b.date);
                        return dateB.getTime() - dateA.getTime();
                    });
                
                console.log('[Voice Notes] Found past sessions:', pastSessions.length, pastSessions);
                
                // If a specific sessionId is provided and not in past sessions, add it
                let sessionsToShow = [...pastSessions];
                if (sessionIdToInclude) {
                    const sessionExists = sessionsToShow.some(s => s.id === sessionIdToInclude);
                    if (!sessionExists) {
                        
                        // Find the session in all appointments - try multiple matching strategies
                        let targetSession = appointments.find((apt: any) => 
                            apt.id === sessionIdToInclude &&
                            (apt.clientName === clientName ||
                             apt.clientName?.toLowerCase() === clientName?.toLowerCase() ||
                             apt.clientId === clientId ||
                             apt.client_id === clientId)
                        );
                        
                        // If not found, try matching by ID only (in case client matching fails)
                        if (!targetSession) {
                            targetSession = appointments.find((apt: any) => apt.id === sessionIdToInclude);
                        }
                        
                        // If still not found, try removing prefix (apt-xxx-yyy -> xxx-yyy or just match the UUID part)
                        if (!targetSession && sessionIdToInclude.includes('-')) {
                            const parts = sessionIdToInclude.split('-');
                            // Try matching with just the UUID part (last part after last dash)
                            const uuidPart = parts[parts.length - 1];
                            targetSession = appointments.find((apt: any) => 
                                apt.id === uuidPart || 
                                apt.id.endsWith(uuidPart) ||
                                apt.id.includes(uuidPart)
                            );
                        }
                        
                        if (targetSession) {
                            // Verify it matches the client
                            const matchesClient = 
                                targetSession.clientName === clientName ||
                                targetSession.clientName?.toLowerCase() === clientName?.toLowerCase() ||
                                targetSession.clientId === clientId ||
                                targetSession.client_id === clientId;
                            
                            if (matchesClient || !clientName) {
                                sessionsToShow.push({
                                    id: targetSession.id,
                                    date: targetSession.date,
                                    type: targetSession.type || 'Session'
                                });
                                console.log('[Voice Notes] ✅ Added target session to list');
                            } else {
                                console.warn('[Voice Notes] ⚠️ Target session found but client mismatch:', {
                                    sessionClient: targetSession.clientName,
                                    expectedClient: clientName
                                });
                            }
                        } else {
                            console.error('[Voice Notes] ❌ Target session not found in appointments list');
                        }
                    } else {
                    }
                }
                
                // Sort by date (newest first)
                sessionsToShow.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
                
                console.log('[Voice Notes] Setting available sessions:', sessionsToShow.length, sessionsToShow);
                setAvailableSessions(sessionsToShow);
                
                // If targetDate is provided and no sessionId, try to auto-select matching session
                if (targetDate && !sessionIdToInclude && sessionsToShow.length > 0) {
                    console.log('[Voice Notes] Looking for sessions matching target date:', targetDate);
                    // Find sessions matching the target date
                    const matchingSessions = sessionsToShow.filter((s: any) => {
                        const sessionDateStr = s.date.split('T')[0];
                        const matches = sessionDateStr === targetDate;
                        console.log('[Voice Notes] Comparing session date:', sessionDateStr, 'with target:', targetDate, 'matches:', matches);
                        return matches;
                    });
                    
                    console.log('[Voice Notes] Found matching sessions:', matchingSessions.length, matchingSessions);
                    
                    // Auto-select if exactly one session matches the date
                    if (matchingSessions.length === 1) {
                        console.log('[Voice Notes] Auto-selecting session matching date:', matchingSessions[0].id);
                        setSelectedSessionId(matchingSessions[0].id);
                    } else if (matchingSessions.length > 1) {
                        // Multiple sessions on same date - select the most recent one
                        const mostRecent = matchingSessions.sort((a: any, b: any) => 
                            new Date(b.date).getTime() - new Date(a.date).getTime()
                        )[0];
                        console.log('[Voice Notes] Multiple sessions on date, selecting most recent:', mostRecent.id);
                        setSelectedSessionId(mostRecent.id);
                    } else {
                        console.warn('[Voice Notes] No sessions found matching target date:', targetDate);
                    }
                }
            }
        } catch (error) {
            console.error('[Voice Notes] Error loading sessions:', error);
        } finally {
            setIsLoadingSessions(false);
        }
    };

    // Initialize SpeechRecognition (WebKit only - works in Chrome/Edge)
    useEffect(() => {
        if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition;
            const rec = new SpeechRecognition();
            rec.continuous = true;
            rec.interimResults = true;
            rec.lang = "en-US";
            rec.onresult = (ev: any) => {
                // Don't update transcript if recording has been stopped
                if (isRecordingStoppedRef.current) {
                    return;
                }
                
                // Build complete transcript from ALL results (not just new ones)
                // This ensures we capture everything even if recognition restarts
                let completeFinalTranscript = "";
                let latestInterim = "";
                
                for (let i = 0; i < ev.results.length; i++) {
                    const transcript = ev.results[i][0].transcript;
                    if (ev.results[i].isFinal) {
                        completeFinalTranscript += transcript + " ";
                    } else {
                        // Only keep the latest interim result
                        latestInterim = transcript;
                    }
                }
                
                // Update the ref with all final results (this is what we'll save)
                transcriptRef.current = completeFinalTranscript.trim();
                
                // Update display state with final + interim
                const displayText = completeFinalTranscript.trim() + (latestInterim ? " " + latestInterim + "..." : "");
                setTranscript(displayText);
            };
            rec.onerror = (ev: any) => {
                // Treat "no-speech" as a benign warning instead of an error
                if (ev.error === "no-speech") {
                    console.warn("No speech detected - this is normal if you haven't spoken yet");
                    return;
                }

                console.error("Speech recognition error:", ev.error);
                setError(`Recognition error: ${ev.error}`);
                setIsRecording(false);
            };
            rec.onend = () => {
                // If recording is still active and hasn't been stopped, restart recognition to keep it continuous
                if (isRecording && !isRecordingStoppedRef.current && recognitionRef.current) {
                    try {
                        recognitionRef.current.start();
                    } catch (e) {
                        console.error("Failed to restart recognition:", e);
                    }
                }
            };
            rec.onstart = () => {
                // Speech recognition started
            };
            recognitionRef.current = rec;
        } else {
            console.warn("WebKit Speech Recognition not available - transcription will not work");
        }
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, [isRecording]);

    // Cleanup MediaRecorder and stream on unmount
    useEffect(() => {
        return () => {
            // Stop MediaRecorder if still recording
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                try {
                    mediaRecorderRef.current.stop();
                } catch (e) {
                    console.warn('Error stopping MediaRecorder on unmount:', e);
                }
            }
            // Stop all stream tracks
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => {
                    track.stop();
                });
                streamRef.current = null;
            }
            // Clear timer
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, []);

    // Warn user before navigating away during recording
    useEffect(() => {
        if (!isRecording) return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = 'You are currently recording. Are you sure you want to leave? Your recording will be lost.';
            return e.returnValue;
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [isRecording]);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const startRecording = async () => {
        // Require both client and session to be selected
        if (!selectedClientId || !selectedSessionId) {
            setError("Please select both a client and a session before starting recording");
            return;
        }

        setError("");
        setTranscript("");
        transcriptRef.current = "";
        setStructuredNotes([]);
        setRecordingTime(0);
        setAudioURL("");
        setAudioBlob(null);
        setIsUploadedFile(false);
        setSaveStatus("idle");
        audioChunksRef.current = [];
        isRecordingStoppedRef.current = false; // Reset stop flag when starting new recording

        // Check if getUserMedia is available
        if (typeof window === "undefined") {
            setError("Microphone access is not available in this environment.");
            return;
        }

        // Check protocol (HTTPS required for microphone access, except localhost)
        const isSecure = window.location.protocol === 'https:' || 
                        window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' ||
                        window.location.hostname.includes('.vercel.app');
        
        if (!isSecure) {
            setError("Microphone access requires HTTPS. Please access this site via HTTPS (secure connection).");
            return;
        }

        // Check for mediaDevices API
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            // Try fallback for older browsers
            const getUserMedia = navigator.mediaDevices?.getUserMedia || 
                                (navigator as any).getUserMedia || 
                                (navigator as any).webkitGetUserMedia || 
                                (navigator as any).mozGetUserMedia;
            
            if (!getUserMedia) {
                setError("Your browser does not support microphone access. Please use Chrome, Edge, or Safari on a mobile device.");
                return;
            }
        }

        try {
            // Get stream with audio-only constraints (explicitly disable video)
            // Browser will still choose its preferred audio settings (commonly 48kHz)
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: false
            });
            
            streamRef.current = stream; // Store stream for cleanup
            
            // Log actual audio track settings to see sample rate
            try {
                const audioTracks = stream.getAudioTracks();
                if (audioTracks.length > 0) {
                    const audioTrack = audioTracks[0];
                    if (audioTrack && typeof audioTrack.getSettings === 'function') {
                        const settings = audioTrack.getSettings();
                        console.log("[Voice Notes] Audio track settings:", {
                            sampleRate: settings.sampleRate,
                            channelCount: settings.channelCount,
                            echoCancellation: settings.echoCancellation,
                            noiseSuppression: settings.noiseSuppression,
                            autoGainControl: settings.autoGainControl
                        });
                        console.log("[Voice Notes] Actual sample rate being used:", settings.sampleRate || "unknown (browser default)");
                    }
                }
            } catch (error) {
                console.error("[Voice Notes] Error getting audio track settings:", error);
            }
            
            // Determine the best MIME type for this browser
            let mimeType = "audio/webm";
            const options: any = {};
            
            if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
                mimeType = "audio/webm;codecs=opus";
            } else if (MediaRecorder.isTypeSupported("audio/webm")) {
                mimeType = "audio/webm";
            } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
                mimeType = "audio/mp4";
            } else if (MediaRecorder.isTypeSupported("audio/m4a")) {
                mimeType = "audio/m4a";
            }
            
            options.mimeType = mimeType;
            
            const mr = new MediaRecorder(stream, options);
            mediaRecorderRef.current = mr;
            
            // Reset audio chunks for new recording
            audioChunksRef.current = [];
            
            mr.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };
            mr.onstop = () => {
                stream.getTracks().forEach((t) => t.stop());
            };
            mr.onerror = (e: any) => {
                console.error("MediaRecorder error:", e);
                setError("Error during recording: " + (e.error?.message || "Unknown error"));
            };
            mr.start(1000); // Collect data every second
        } catch (e: any) {
            console.error("Audio error:", e);
            let errorMessage = "Could not access microphone.";
            
            if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
                errorMessage = "Microphone permission denied. Please grant microphone access in your browser settings and try again.";
            } else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
                errorMessage = "No microphone found. Please connect a microphone and try again.";
            } else if (e.name === "NotReadableError" || e.name === "TrackStartError") {
                errorMessage = "Microphone is already in use by another application. Please close other apps using the microphone.";
            } else if (e.name === "OverconstrainedError" || e.name === "ConstraintNotSatisfiedError") {
                errorMessage = "Microphone constraints could not be satisfied. Please try again.";
            } else {
                errorMessage = `Could not access microphone: ${e.message || e.name || "Unknown error"}`;
            }
            
            setError(errorMessage);
            return;
        }

        setIsRecording(true);
        timerRef.current = setInterval(() => setRecordingTime((p) => p + 1), 1000);

        if (recognitionRef.current) {
            try {
                recognitionRef.current.start();
            } catch (e: any) {
                // If it's already running, that's okay
                if (!e.message || !e.message.includes("already started")) {
                    console.error("Failed to start speech recognition:", e);
                    setError("Could not start speech recognition. Audio will be recorded but not transcribed.");
                }
            }
        } else {
            console.warn("Speech recognition not supported – recording audio only");
            setError("Speech recognition not available in this browser. Audio will be recorded but not transcribed.");
        }
    };

    const stopRecording = () => {
        // Mark recording as stopped to prevent further transcript updates
        isRecordingStoppedRef.current = true;
        
        // Stop the timer first
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        
        // Stop media recorder
        mediaRecorderRef.current?.stop();
        
        // Stop speech recognition and wait a bit for final results
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                console.warn("Error stopping recognition:", e);
            }
        }
        
        setIsRecording(false);

        // Wait a bit longer to ensure final transcript is captured
        setTimeout(() => {
            // Determine the best MIME type based on browser support
            let mimeType = "audio/webm";
            if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
                mimeType = "audio/webm;codecs=opus";
            } else if (MediaRecorder.isTypeSupported("audio/webm")) {
                mimeType = "audio/webm";
            } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
                mimeType = "audio/mp4";
            } else if (MediaRecorder.isTypeSupported("audio/m4a")) {
                mimeType = "audio/m4a";
            }
            
            const blob = new Blob(audioChunksRef.current, { type: mimeType });
            const url = URL.createObjectURL(blob);
            setAudioBlob(blob);
            setAudioURL(url);
            setIsUploadedFile(false); // Reset flag when recording is made
            
            // Get the final transcript - use transcriptRef which has final results only
            let currentTranscript = transcriptRef.current.trim();
            
            // If transcriptRef is empty, try to get from state (might have interim results)
            if (!currentTranscript && transcript) {
                // Remove interim markers (...)
                currentTranscript = transcript.replace(/\s*\.\.\.\s*$/, "").trim();
            }
            
            // If no transcript and we have audio, always use OpenAI fallback
            if (!currentTranscript && blob.size > 0) {
                console.log("[Voice Notes] No transcript from WebKit Speech Recognition, will use OpenAI Whisper fallback");
            }
            
            // Pass the transcript to processTranscript
            processTranscript(currentTranscript, blob);
        }, 1500); // Increased timeout to 1.5 seconds to allow final results to be captured
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Require both client and session to be selected
        if (!selectedClientId || !selectedSessionId) {
            setError("Please select both a client and a session before uploading a file");
            return;
        }

        const allowed = ["audio/mp3", "audio/webm", "video/webm", "audio/m4u", "audio/wav", "audio/m4a", "audio/x-m4a", "audio/mp4", "audio/mpeg", "video/mp4"];
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        const isAllowedType = allowed.includes(file.type) || 
            (fileExtension === 'webm' && (file.type.startsWith('audio/') || file.type.startsWith('video/'))) ||
            (fileExtension === 'mp3' && file.type.startsWith('audio/')) ||
            (fileExtension === 'wav' && file.type.startsWith('audio/')) ||
            (fileExtension === 'm4a' && (file.type.startsWith('audio/') || file.type === 'audio/x-m4a')) ||
            (fileExtension === 'mp4' && (file.type.startsWith('audio/') || file.type.startsWith('video/'))) ||
            (fileExtension === 'ogg' && file.type.startsWith('audio/')) ||
            (fileExtension === 'aac' && file.type.startsWith('audio/'));
        
        if (!isAllowedType) {
            console.warn('[Voice Notes] File type check failed:', { 
                fileName: file.name, 
                fileType: file.type, 
                fileExtension,
                allowedTypes: allowed 
            });
            setError(`Unsupported audio file type: ${file.type || 'unknown'}. Supported: .mp3, .webm, .wav, .m4a, .mp4, .ogg, .aac`);
            return;
        }

        const blob = file;
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioURL(url);
        setIsUploadedFile(true); // Mark as uploaded file

        // Calculate duration from audio file BEFORE processing
        let durationInSeconds = 0;
        try {
            const audio = new Audio(url);
            await new Promise((resolve, reject) => {
                audio.onloadedmetadata = () => {
                    durationInSeconds = Math.floor(audio.duration);
                    console.log('[Voice Notes] Uploaded file duration:', durationInSeconds, 'seconds');
                    setRecordingTime(durationInSeconds);
                    resolve(null);
                };
                audio.onerror = () => {
                    console.warn('[Voice Notes] Could not load audio metadata');
                    resolve(null); // Continue even if duration can't be calculated
                };
                // Timeout after 5 seconds
                setTimeout(() => {
                    console.warn('[Voice Notes] Duration calculation timeout');
                    resolve(null);
                }, 5000);
            });
        } catch (err) {
            console.warn('[Voice Notes] Could not calculate audio duration:', err);
            // Continue without duration
        }

        // Set duration before processing so it's available in processTranscript
        setRecordingTime(durationInSeconds);
        
        // Store duration in a way that processTranscript can access it
        // We'll pass it through a closure or use the state
        // For now, ensure it's set before processing
        if (durationInSeconds > 0) {
            console.log('[Voice Notes] Duration set before processing:', durationInSeconds);
        }

        // For uploaded files, use special marker so processTranscript knows to use STT
        // Note: duration will be recalculated in processTranscript if still 0
        processTranscript("__FILE_UPLOAD__", blob);
    };

    const processTranscript = async (text: string, blob: Blob) => {
        setIsProcessing(true);

        // Determine base transcript text:
        // - For uploaded files ("__FILE_UPLOAD__"), call backend STT
        // - For live recordings, use provided transcript
        let baseText = text;

        if (text === "__FILE_UPLOAD__") {
            try {
                const formData = new FormData();
                formData.append("file", blob);

                const response = await fetch("/api/audio/transcribe-upload", {
                    method: "POST",
                    body: formData,
                });

                if (response.ok) {
                    const data = await response.json();
                    baseText = (data.transcript as string) || "";
                    console.log("Uploaded audio transcribed successfully. Length:", baseText.length);
                } else {
                    console.error("Transcription API failed for uploaded file:", await response.text());
                    baseText = "";
                }
            } catch (err) {
                console.error("Error calling transcription API for uploaded file:", err);
                baseText = "";
            }
        }

        // Handle cases where we still have no transcript text
        // For manual recordings with empty transcript, fall back to OpenAI Whisper API
        if (!baseText && text !== "__FILE_UPLOAD__") {
            console.log("Manual recording has no transcript, falling back to OpenAI Whisper API...");
            console.log("Blob details - Type:", blob.type, "Size:", blob.size, "bytes");
            
            // Check if blob is valid
            if (blob.size === 0) {
                console.error("Audio blob is empty, cannot transcribe");
                setIsProcessing(false);
                setError("Recording failed - no audio data captured. Please try again.");
                return;
            }
            
            try {
                const formData = new FormData();
                // Create a File object with proper name and type for better API handling
                const audioFile = new File([blob], `recording-${Date.now()}.${blob.type.includes('webm') ? 'webm' : blob.type.includes('mp4') ? 'm4a' : 'wav'}`, {
                    type: blob.type || 'audio/webm'
                });
                formData.append("file", audioFile);
                
                console.log("Sending audio to OpenAI Whisper API - File type:", audioFile.type, "Size:", audioFile.size);

                const response = await fetch("/api/audio/transcribe-upload", {
                    method: "POST",
                    body: formData,
                });

                console.log("OpenAI API response status:", response.status, response.statusText);

                if (response.ok) {
                    const data = await response.json();
                    baseText = (data.transcript as string) || "";
                    console.log("Manual recording transcribed via OpenAI Whisper. Length:", baseText.length);
                    if (baseText) {
                        console.log("Transcript preview:", baseText.substring(0, 100));
                    }
                } else {
                    const errorText = await response.text();
                    console.error("OpenAI transcription API failed for manual recording:", errorText);
                    console.error("Response status:", response.status);
                    // Continue with empty transcript - will show "No transcript captured"
                }
            } catch (err: any) {
                console.error("Error calling OpenAI transcription API for manual recording:", err);
                console.error("Error details:", err.message, err.stack);
                // Continue with empty transcript - will show "No transcript captured"
            }
        }

        let formattedText: string;
        if (!baseText) {
            // If this was a file upload, treat it as a hard error instead of saving a useless recording
            if (text === "__FILE_UPLOAD__") {
                setIsProcessing(false);
                setError("Could not generate a transcript from the uploaded audio file. Please try again or record directly.");
            } else {
                formattedText = "No transcript captured";
                setIsProcessing(false);
                
                // Get client info for metadata even if no transcript
                let clientNameForSave: string | undefined = undefined;
                let clientIdForSave: string | undefined = undefined;
                if (selectedClientId) {
                    const selectedClient = clients.find(c => c.id === selectedClientId);
                    if (selectedClient) {
                        clientNameForSave = selectedClient.name;
                        clientIdForSave = selectedClient.id;
                    }
                }
                
                const notes: NoteSection[] = [{ title: "Session Notes", content: formattedText }];
                setStructuredNotes(notes);
                try {
                    await saveRecording(formattedText, blob, notes, clientIdForSave, clientNameForSave, selectedSessionId || undefined);
                    window.dispatchEvent(new Event("recordings-updated"));
                } catch (err: any) {
                    console.error("Failed to save recording:", err);
                    setError(err?.message || "Failed to save recording. Please try again.");
                }
            }
            return;
        }

        // First, prepare a readable raw transcript
        // - For live mic recordings we still run `formatVoiceCommands` to turn "period"/"comma" into punctuation.
        // - For uploaded files (already processed by OpenAI STT), we gently reflow into sentences/paragraphs
        //   without rewriting the content, so it reads more like real-world writing.
        const formatNaturalTranscript = (raw: string): string => {
            if (!raw) return raw;

            // Improve readability without breaking URLs or abbreviations:
            // - Only insert breaks after sentence-ending punctuation
            // - AND only when followed by a space + capital letter or opening quote.
            //   This avoids splitting inside "example.com.au" or similar.
            const formatted = raw
                .trim()
                .replace(/([.!?])\s+(?=[A-Z"“])/g, "$1\n\n")
                .trim();

            return formatted;
        };

        const basicFormatted =
            text === "__FILE_UPLOAD__"
                ? formatNaturalTranscript(baseText)
                : formatVoiceCommands(baseText);

        // Show the transcript in the UI (this is what the user reviews)
        setTranscript(basicFormatted);

        // Fetch metadata for structured notes header
        let clientName: string | undefined = undefined;
        let clientId: string | undefined = undefined;
        let therapistName: string | undefined = undefined;
        const sessionDate = new Date().toISOString();
        
        // For uploaded files, calculate duration from blob if not already set
        let duration = recordingTime;
        if (text === "__FILE_UPLOAD__" && duration === 0) {
            // Try to get duration from audioURL if available
            if (audioURL) {
                try {
                    const audio = new Audio(audioURL);
                    await new Promise<void>((resolve) => {
                        let resolved = false;
                        const finish = () => {
                            if (!resolved) {
                                resolved = true;
                                resolve();
                            }
                        };
                        audio.onloadedmetadata = () => {
                            if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
                                duration = Math.floor(audio.duration);
                                console.log('[Voice Notes] Calculated duration in processTranscript:', duration, 'seconds');
                                setRecordingTime(duration);
                            }
                            finish();
                        };
                        audio.onerror = () => {
                            console.warn('[Voice Notes] Audio metadata load error');
                            finish();
                        };
                        // Try to load
                        audio.load();
                        // Timeout after 3 seconds
                        setTimeout(() => {
                            if (duration === 0) {
                                console.warn('[Voice Notes] Duration calculation timeout, using 0');
                            }
                            finish();
                        }, 3000);
                    });
                } catch (err) {
                    console.warn('[Voice Notes] Could not calculate duration in processTranscript:', err);
                }
            }
            // Also try to get duration from the blob directly if audioURL method failed
            if (duration === 0 && blob) {
                try {
                    // Create a temporary URL for the blob
                    const tempUrl = URL.createObjectURL(blob);
                    const audio = new Audio(tempUrl);
                    await new Promise<void>((resolve) => {
                        audio.onloadedmetadata = () => {
                            if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
                                duration = Math.floor(audio.duration);
                                console.log('[Voice Notes] Calculated duration from blob:', duration, 'seconds');
                                setRecordingTime(duration);
                            }
                            URL.revokeObjectURL(tempUrl);
                            resolve();
                        };
                        audio.onerror = () => {
                            URL.revokeObjectURL(tempUrl);
                            resolve();
                        };
                        audio.load();
                        setTimeout(() => {
                            URL.revokeObjectURL(tempUrl);
                            resolve();
                        }, 3000);
                    });
                } catch (err) {
                    console.warn('[Voice Notes] Could not calculate duration from blob:', err);
                }
            }
        }
        console.log('[Voice Notes] Final duration for AI processing:', duration, 'seconds');

        // Get client name and ID from selected client
        if (selectedClientId) {
            const selectedClient = clients.find(c => c.id === selectedClientId);
            if (selectedClient) {
                clientName = selectedClient.name;
                clientId = selectedClient.id;
            }
        }

        // Use pre-fetched therapist name (from useEffect on mount)
        therapistName = currentTherapist || undefined;
        console.log('[Voice Notes] Using therapist name:', therapistName);

        // Determine if this is an uploaded file (client's words) or live recording (therapist's notes)
        const isUploadedFile = text === "__FILE_UPLOAD__";
        
        let structuredText = basicFormatted;
        
        if (isUploadedFile) {
            // UPLOADED FILES: Apply AI structuring because these are client's spoken words
            // that need to be organized into structured session notes
            try {
                console.log("Processing UPLOADED transcript with AI...", { clientName, therapistName, sessionDate, duration });
                const response = await fetch('/api/ai/process-transcript', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        transcript: basicFormatted,
                        clientName,
                        therapistName,
                        sessionDate,
                        duration
                    })
                });

                if (response.ok) {
                    const data = await response.json() as { structured?: string; method?: string };
                    structuredText = data.structured || basicFormatted;
                    console.log(`[Voice Notes] Uploaded transcript processed using ${data.method || 'unknown'} method`);
                    console.log(`[Voice Notes] Structured text length: ${structuredText.length}, Transcript length: ${basicFormatted.length}`);
                    console.log(`[Voice Notes] Structured preview:`, structuredText.substring(0, 200));
                    if (structuredText === basicFormatted) {
                        console.warn('[Voice Notes] ⚠️ Structured text is same as transcript - AI may not have processed it');
                    }
                } else {
                    const errorText = await response.text();
                    console.error('[Voice Notes] AI processing failed:', errorText);
                    console.warn('AI processing failed for uploaded file, using basic transcript only');
                }
            } catch (err) {
                console.error('Error processing uploaded transcript with AI:', err);
                // Keep structuredText as basicFormatted
            }
        } else {
            // LIVE MIC RECORDINGS: These are therapist's spoken notes after the session
            // No AI structuring needed - just save the raw transcript as-is
            console.log("Live recording - saving therapist's notes without AI structuring");
            
            // Just use the plain transcript - no headers or formatting
            structuredText = basicFormatted;
        }

        // Notes saved with the recording
        // Only create notes for uploaded files (AI Clinical Assessment)
        // Live recordings should only have transcript, no notes
        const notes: NoteSection[] = isUploadedFile ? [{ title: "AI Clinical Assessment", content: structuredText }] : [];
        setStructuredNotes(notes);

        // Stop the spinner now that transcription is complete
        // Saving will happen in the background
        setIsProcessing(false);

        try {
            // Save the raw-but-formatted transcript, and keep AI Clinical Assessment separately
            // Include client information and session ID if available
            const sessionId = selectedSessionId || undefined;
            await saveRecording(basicFormatted, blob, notes, clientId, clientName, sessionId);
            window.dispatchEvent(new Event("recordings-updated"));
        } catch (err: any) {
            console.error("Failed to save recording:", err);
            setError(err?.message || "Failed to save recording. Please try again.");
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

    const saveRecording = async (transcript: string, blob: Blob, notes: NoteSection[], clientId?: string, clientName?: string, sessionId?: string) => {
        const recordingId = Date.now().toString();
        const fileName = `${recordingId}.webm`;
        const sizeMB = (blob.size / (1024 * 1024)).toFixed(1);
        
        // Step 1: Get a signed upload URL from our API
        const signedUrlResponse = await fetch("/api/storage/signed-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fileName,
                contentType: "audio/webm",
                bucket: "audio"
            })
        });
        
        if (!signedUrlResponse.ok) {
            const errorData = await signedUrlResponse.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to get upload URL: ${signedUrlResponse.status}`);
        }
        
        const { signedUrl, publicUrl } = await signedUrlResponse.json();
        
        // Step 2: Upload directly to Supabase Storage (bypassing Vercel)
        const uploadResponse = await fetch(signedUrl, {
            method: "PUT",
            headers: { 
                "Content-Type": "audio/webm",
                "x-upsert": "true"
            },
            body: blob
        });
        
        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text().catch(() => '');
            console.error('[Voice Notes] Upload failed:', uploadResponse.status, errorText);
            throw new Error(`Direct upload failed: ${uploadResponse.status} ${uploadResponse.statusText}. ${errorText}`);
        }
        
        // Step 3: Save metadata to our API (no file, just metadata)
        // Use our API route for audio playback (works regardless of bucket public settings)
        const meta: any = {
            id: recordingId,
            date: new Date().toISOString(),
            duration: recordingTime,
            transcript,
            notes,
            audioURL: `/api/audio/${fileName}`,
            fileName
        };
        
        // Include client information if available
        if (clientId) {
            meta.client_id = clientId;
            meta.clientId = clientId;
        }
        if (clientName) {
            meta.clientName = clientName;
        }
        // Include session ID if available
        if (sessionId) {
            meta.session_id = sessionId;
            meta.sessionId = sessionId;
        }
        
        const metadataResponse = await fetch("/api/recordings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ metadata: meta, directUpload: true })
        });
        
        if (!metadataResponse.ok) {
            const errorData = await metadataResponse.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to save recording metadata: ${metadataResponse.status}`);
        }
        
        return await metadataResponse.json();
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

    const assignRecordingToClient = async (clientId: string, sessionId?: string) => {
        try {
            const res = await fetch("/api/recordings");
            if (!res.ok) return;
            const recordings = await res.json();
            // Find the most recent recording without a client assigned
            const idx = recordings.findIndex((r: any) => !r.client_id && !r.clientId);
            if (idx === -1) return;
            
            // Get client name
            const client = clients.find(c => c.id === clientId);
            const clientName = client?.name;
            
            // Set the clientId
            recordings[idx].clientId = clientId;
            recordings[idx].client_id = clientId; // Also set snake_case for database
            if (clientName) {
                recordings[idx].clientName = clientName;
            }
            
            // Set session ID if provided
            if (sessionId) {
                recordings[idx].sessionId = sessionId;
                recordings[idx].session_id = sessionId;
                console.log('[Voice Notes] Assigning recording to session:', sessionId);
            }
            
            // Regenerate structured notes with correct client if notes exist
            if (recordings[idx].notes && recordings[idx].notes.length > 0 && recordings[idx].transcript) {
                try {
                    // Fetch therapist name - the therapist is the person whose FIRST and LAST names are in their profile
                    let therapistName: string | undefined = undefined;
                    const userResponse = await fetch('/api/auth/me');
                    if (userResponse.ok) {
                        const userData = await userResponse.json() as { first_name?: string | null; last_name?: string | null; email?: string };
                        console.log('[Voice Notes] User data for therapist name (regenerate):', { first_name: userData.first_name, last_name: userData.last_name, email: userData.email });
                        
                        // Build therapist name from first_name and last_name (even if one is null)
                        const nameParts: string[] = [];
                        if (userData.first_name && userData.first_name.trim()) {
                            nameParts.push(userData.first_name.trim());
                        }
                        if (userData.last_name && userData.last_name.trim()) {
                            nameParts.push(userData.last_name.trim());
                        }
                        
                        if (nameParts.length > 0) {
                            therapistName = nameParts.join(' ').trim();
                            console.log('[Voice Notes] Therapist name from profile (regenerate):', therapistName);
                        } else if (userData.email) {
                            // Fallback: Extract from email if first_name/last_name are not available
                            const emailParts = userData.email.split('@')[0].split('.');
                            if (emailParts.length > 1) {
                                therapistName = emailParts.map(part => 
                                    part.charAt(0).toUpperCase() + part.slice(1)
                                ).join(' ');
                            } else {
                                therapistName = emailParts[0].charAt(0).toUpperCase() + emailParts[0].slice(1);
                            }
                            console.log('[Voice Notes] Therapist name from email fallback (regenerate):', therapistName);
                        }
                    }
                    
                    // Regenerate structured notes with correct metadata
                    const response = await fetch('/api/ai/process-transcript', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            transcript: recordings[idx].transcript,
                            clientName: clientName || undefined,
                            therapistName,
                            sessionDate: recordings[idx].date,
                            duration: recordings[idx].duration
                        })
                    });
                    
                    if (response.ok) {
                        const data = await response.json() as { structured?: string };
                        if (data.structured) {
                            // Update the notes with regenerated content
                            recordings[idx].notes = [{ title: "Session Notes", content: data.structured }];
                        }
                    }
                } catch (err) {
                    console.warn('Could not regenerate structured notes:', err);
                }
            }
            
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
            // Pass the client ID and session ID
            await assignRecordingToClient(client.id, selectedSessionId || undefined);
            setSaveStatus("success");
            setTimeout(() => {
                setIsSaveDialogOpen(false);
                setSelectedClientId("");
                setSelectedSessionId("");
                setAvailableSessions([]);
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
                        <Mic className="h-5 w-5 text-primary" /> Recording
                    </CardTitle>
                    <CardDescription>Record Session Notes with automatic transcription (Chrome/Edge only).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Client and Therapist Info - Select BEFORE recording */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg border">
                        <div className="space-y-2">
                            <Label htmlFor="pre-record-client" className="text-sm font-medium">
                                Select Client *
                            </Label>
                            <Select 
                                value={selectedClientId} 
                                onValueChange={async (value) => {
                                    setSelectedClientId(value);
                                    // Load sessions for this client
                                    const selectedClient = clients.find(c => c.id === value);
                                    await loadSessionsForClient(value, undefined, undefined, selectedClient?.name);
                                }}
                            >
                                <SelectTrigger id="pre-record-client">
                                    <SelectValue placeholder="Select a client..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {[...clients]
                                        .sort((a, b) => {
                                            // Extract first name (everything before first space)
                                            const firstNameA = a.name.split(' ')[0] || a.name;
                                            const firstNameB = b.name.split(' ')[0] || b.name;
                                            return firstNameA.localeCompare(firstNameB);
                                        })
                                        .map((c) => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.name}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Therapist</Label>
                            <div className="p-2 rounded-md text-sm bg-muted border font-medium">
                                {currentTherapist || 'Loading...'}
                            </div>
                        </div>
                    </div>
                    
                    {/* Session Selection - REQUIRED - Shows after client is selected */}
                    {selectedClientId && (
                        <div className="p-4 bg-muted/50 rounded-lg border space-y-2">
                            <Label htmlFor="pre-record-session" className="text-sm font-medium">
                                Select Session *
                            </Label>
                            {isLoadingSessions ? (
                                <div className="text-sm text-muted-foreground p-2">Loading sessions...</div>
                            ) : availableSessions.length > 0 ? (
                                <>
                                    <Select 
                                        value={selectedSessionId || ""} 
                                        onValueChange={(value) => {
                                            setSelectedSessionId(value);
                                        }}
                                    >
                                        <SelectTrigger id="pre-record-session">
                                            <SelectValue placeholder="Select a session (required)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableSessions.map((session) => (
                                                <SelectItem key={session.id} value={session.id}>
                                                    {new Date(session.date).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })} - {session.type}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Select a session to link this recording. Recording and file upload are disabled until both client and session are selected.
                                    </p>
                                </>
                            ) : (
                                <div className="text-xs text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                                    ⚠️ No sessions found for this client. Please create a session first before recording.
                                </div>
                            )}
                        </div>
                    )}

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
                                    <Button 
                                        size="lg" 
                                        onClick={startRecording} 
                                        disabled={!selectedClientId || !selectedSessionId}
                                        className="h-24 w-24 rounded-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Mic className="h-10 w-10" />
                                    </Button>
                                    <p className="text-sm text-muted-foreground text-center">
                                        {!selectedClientId 
                                            ? 'Please select a client first'
                                            : !selectedSessionId
                                            ? 'Please select a session to enable recording'
                                            : `Recording for: ${clients.find(c => c.id === selectedClientId)?.name} - ${availableSessions.find(s => s.id === selectedSessionId)?.type || 'session'}`}
                                    </p>
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
                                    <Button 
                                        onClick={startRecording} 
                                        variant="outline"
                                        disabled={!selectedClientId || !selectedSessionId}
                                    >
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
                            <motion.div
                                animate={{ opacity: [1, 0.5, 1] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            >
                                <Button onClick={downloadAudio} variant="destructive" size="sm" className="w-full">
                                    Download Recording
                                </Button>
                            </motion.div>
                        </div>
                    )}

                    {transcript && (
                        <div className="rounded-lg border border-border bg-muted/50 p-4">
                            <h4 className="mb-2 text-sm font-semibold">Transcript:</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {transcript}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {structuredNotes.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    {/* We intentionally hide AI Clinical Assessment here and only show the raw transcript above.
                        The assessment is still saved and can be viewed in Recording History / Session Notes. */}
                    <div className="flex flex-col gap-2">
                        {selectedClientId ? (
                            // Client was already selected before recording - already saved
                            <div className="flex items-center justify-between gap-2 p-3 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                    <span className="text-green-700 dark:text-green-300 font-medium">
                                        ✓ Saved to {clients.find(c => c.id === selectedClientId)?.name || 'client'} record
                                    </span>
                                </div>
                                <Link href={`/clients?highlight=${selectedClientId}${selectedSessionId ? `&session=${selectedSessionId}` : ''}`}>
                                    <Button variant="outline" size="sm" className="gap-1">
                                        <ExternalLink className="h-4 w-4" />
                                        View Client
                                    </Button>
                                </Link>
                            </div>
                        ) : (
                            // No client selected before recording - show button to assign
                            <Button className="flex-1" onClick={handleSaveToClient}>
                                <CheckCircle2 className="mr-2 h-4 w-4" /> Assign to Client Record
                            </Button>
                        )}
                    </div>
                </motion.div>
            )}

            <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Save Notes to Client Record</DialogTitle>
                        <DialogDescription>Select a client to append these notes to their record.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="client-select">Select Client *</Label>
                            <Select 
                                value={selectedClientId} 
                                onValueChange={async (value) => {
                                    setSelectedClientId(value);
                                    setSelectedSessionId(""); // Clear session when client changes
                                    // Load sessions for this client
                                    if (value) {
                                        const selectedClient = clients.find(c => c.id === value);
                                        await loadSessionsForClient(value, undefined, undefined, selectedClient?.name);
                                    } else {
                                        setAvailableSessions([]);
                                    }
                                }}
                            >
                                <SelectTrigger id="client-select">
                                    <SelectValue placeholder="Select a client..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {[...clients]
                                        .sort((a, b) => {
                                            // Extract first name (everything before first space)
                                            const firstNameA = a.name.split(' ')[0] || a.name;
                                            const firstNameB = b.name.split(' ')[0] || b.name;
                                            return firstNameA.localeCompare(firstNameB);
                                        })
                                        .map((c) => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.name}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        {/* Session Selection - Show when client is selected */}
                        {selectedClientId && (
                            <div className="space-y-2">
                                <Label htmlFor="session-select">Link to Session (Optional)</Label>
                                {isLoadingSessions ? (
                                    <div className="text-sm text-muted-foreground">Loading sessions...</div>
                                ) : availableSessions.length > 0 ? (
                                    <Select
                                        value={selectedSessionId || "none"}
                                        onValueChange={(value) => {
                                            setSelectedSessionId(value === "none" ? "" : value);
                                        }}
                                    >
                                        <SelectTrigger id="session-select">
                                            <SelectValue placeholder="Select a session..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No session (unlinked)</SelectItem>
                                            {availableSessions.map(session => (
                                                <SelectItem key={session.id} value={session.id}>
                                                    {new Date(session.date).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })} - {session.type}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                                        No past sessions found for this client. Recording will be saved without a session link.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        {saveStatus === "success" ? (
                            <>
                                <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
                                    Close
                                </Button>
                                <Link href={`/clients?highlight=${selectedClientId}`}>
                                    <Button className="gap-1">
                                        <ExternalLink className="h-4 w-4" />
                                        View Client
                                    </Button>
                                </Link>
                            </>
                        ) : (
                            <>
                                <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={confirmSaveToClient} disabled={!selectedClientId || saveStatus === "saving"}>
                                    {saveStatus === "saving" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Notes
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* File upload UI */}
            <Card className="border-primary/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        New Upload
                    </CardTitle>
                    <CardDescription>Create a Clinical Analysis of a Session Recording using AI</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div
                        className={`relative border-2 border-dashed rounded-lg p-8 transition-colors ${
                            !selectedClientId || !selectedSessionId
                                ? "border-muted-foreground/10 bg-muted/20 opacity-50 cursor-not-allowed"
                                : isDragging 
                                ? "border-primary bg-primary/5" 
                                : "border-muted-foreground/25 hover:border-primary/50"
                        }`}
                    onDragOver={(e) => {
                        if (!selectedClientId || !selectedSessionId) {
                            e.preventDefault();
                            return;
                        }
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
                        if (!selectedClientId || !selectedSessionId) {
                            return;
                        }
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
                        accept="audio/*,video/webm,.mp3,.wav,.m4a,.webm,.mp4,.mpeg,.ogg,.aac"
                        onChange={handleFileUpload}
                        disabled={!selectedClientId || !selectedSessionId}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className="flex flex-col items-center justify-center text-center space-y-2">
                        <div className={`p-3 rounded-full ${!selectedClientId || !selectedSessionId ? "bg-muted" : "bg-primary/10"}`}>
                            <Upload className={`h-6 w-6 ${!selectedClientId || !selectedSessionId ? "text-muted-foreground" : "text-primary"}`} />
                        </div>
                        <div className="space-y-1">
                            <p className={`text-sm font-medium ${!selectedClientId || !selectedSessionId ? "text-muted-foreground" : ""}`}>
                                {!selectedClientId || !selectedSessionId
                                    ? "Please select a client and session to enable file upload"
                                    : "Drag & drop an actual Session Audio Recording file here or click to browse"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Supports MP3, WAV, M4A, WebM (max 25MB) - Uploaded actual session recordings will be transcribed and formed into Clinical Analysis using AI
                            </p>
                        </div>
                    </div>
                </div>

                {audioBlob && isUploadedFile && (
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
                </CardContent>
            </Card>
        </div>
    );
}
