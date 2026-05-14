/**
 * Compatibility helpers for the voice recording subsystem.
 *
 * These three functions are the single read-side/write-side adapters for the
 * recording lifecycle. They exist so that legacy rows (which may store the
 * transcript as JSON `{ transcript, notes }` and may reference audio via the
 * legacy `/api/audio/{id}.webm` path) continue to work while new code follows
 * a strict, simpler convention.
 *
 * Single sources of truth enforced here:
 *   - Audio:      recording.audio_url (resolved by getAudioUrl)
 *   - Transcript: recording.transcript (read via readTranscriptText)
 *   - Writes:     recording.transcript is plain text only (via prepareTranscriptWrite)
 *
 * Phase 1 contract: this file is pure and has no project imports.
 * It MUST NOT depend on React, Next, Supabase, or any DB code.
 */

/** Structured note that may accompany a transcript (e.g. AI Clinical Assessment). */
export interface NoteSection {
    title: string;
    content: string;
}

/** Result of reading a stored transcript value, regardless of legacy shape. */
export interface TranscriptRead {
    /** Plain-text transcript ready to display. May be the literal placeholder. */
    text: string;
    /** Structured notes if a legacy JSON transcript carried them; otherwise empty. */
    notes: NoteSection[];
    /** True when `text` is the "No transcript captured" placeholder. */
    placeholder: boolean;
}

/** Anything we can resolve into a playback URL for a recording. */
export type AudioSource =
    | string
    | null
    | undefined
    | {
          audioURL?: string | null;
          audio_url?: string | null;
          id?: string | null;
      };

/** Placeholder value used when transcription returned no text. Matched case-insensitively on read. */
export const NO_TRANSCRIPT_PLACEHOLDER = "No transcript captured";

/**
 * Resolve a playback URL.
 *
 * Accepts:
 *   - A string URL or path. Absolute (`http(s)://`) and `/api/audio/...` URLs
 *     are returned as-is. Bare filenames or paths are prefixed with `/api/audio/`.
 *   - A recording-like object with `audioURL` / `audio_url` / `id`.
 *
 * Supports both legacy `/api/audio/{id}.webm` (bucket root) and the new
 * `/api/audio/recordings/{uuid}.webm` paths without any migration.
 *
 * Returns `""` if no URL can be derived.
 */
export function getAudioUrl(input: AudioSource): string {
    if (!input) return "";
    if (typeof input === "string") return normalizeAudioPath(input);

    const candidates: Array<string | null | undefined> = [
        typeof input.audioURL === "string" ? input.audioURL : null,
        typeof input.audio_url === "string" ? input.audio_url : null,
        typeof input.id === "string" && input.id.trim() ? `${input.id.trim()}.webm` : null,
    ];

    for (const c of candidates) {
        if (typeof c === "string" && c.trim()) {
            return normalizeAudioPath(c);
        }
    }
    return "";
}

function normalizeAudioPath(raw: string): string {
    const u = raw.trim();
    if (!u) return "";
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    if (u.startsWith("/api/audio/")) return u;
    // Strip any leading slashes so we don't produce `/api/audio//foo.webm`.
    return `/api/audio/${u.replace(/^\/+/, "")}`;
}

/**
 * Read a stored transcript value into a uniform shape, accepting every legacy form:
 *   - null / undefined / non-string  -> empty result
 *   - empty / whitespace string      -> empty result
 *   - JSON `{ transcript, notes }`   -> parsed into text + notes
 *   - JSON array of NoteSection      -> notes preserved, text joined from contents
 *   - JSON string                    -> used as plain text
 *   - any other plain text           -> used verbatim
 *
 * Never throws. Never strips content from valid input.
 */
export function readTranscriptText(raw: unknown): TranscriptRead {
    if (raw == null || typeof raw !== "string") {
        return { text: "", notes: [], placeholder: false };
    }
    const trimmed = raw.trim();
    if (!trimmed) return { text: "", notes: [], placeholder: false };

    // Try JSON first. If parsing fails, fall through to plain-text path.
    try {
        const parsed: unknown = JSON.parse(trimmed);

        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            const obj = parsed as Record<string, unknown>;
            const text = typeof obj.transcript === "string" ? obj.transcript : "";
            const notes = Array.isArray(obj.notes) ? coerceNotes(obj.notes) : [];
            return {
                text,
                notes,
                placeholder: isPlaceholder(text),
            };
        }

        if (Array.isArray(parsed)) {
            const notes = coerceNotes(parsed);
            const text = notes.map((n) => n.content).filter(Boolean).join(" ").trim();
            return { text, notes, placeholder: isPlaceholder(text) };
        }

        if (typeof parsed === "string") {
            return {
                text: parsed,
                notes: [],
                placeholder: isPlaceholder(parsed),
            };
        }
    } catch {
        /* not JSON; fall through */
    }

    return {
        text: trimmed,
        notes: [],
        placeholder: isPlaceholder(trimmed),
    };
}

function coerceNotes(arr: unknown[]): NoteSection[] {
    return arr
        .filter((n): n is Record<string, unknown> => n != null && typeof n === "object")
        .map((n) => ({
            title: typeof n.title === "string" ? n.title : "",
            content: typeof n.content === "string" ? n.content : "",
        }));
}

function isPlaceholder(s: string): boolean {
    return s.trim().toLowerCase() === NO_TRANSCRIPT_PLACEHOLDER.toLowerCase();
}

/**
 * Prepare a transcript value for writing to `recordings.transcript`.
 *
 * Contract for NEW code:
 *   - This function returns the plain string verbatim.
 *   - New code MUST NOT pre-wrap the transcript in JSON. Notes belong on their
 *     own field in the metadata payload (e.g. `notes`), not embedded in the
 *     transcript column.
 *
 * Legacy rows that already store JSON are NOT rewritten by this helper; they
 * are read via `readTranscriptText` and left in place.
 */
export function prepareTranscriptWrite(text: string | null | undefined): string {
    if (text == null) return "";
    if (typeof text !== "string") return "";
    return text;
}
