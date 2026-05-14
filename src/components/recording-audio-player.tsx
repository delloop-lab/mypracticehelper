"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactEventHandler } from "react";

function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0 || Number.isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}

/** WebM from MediaRecorder often omits duration until fully buffered; seekable end can help. */
function readMediaDurationSeconds(media: HTMLMediaElement): number | null {
    const d = media.duration;
    if (Number.isFinite(d) && d > 0 && !Number.isNaN(d)) return d;
    try {
        if (media.seekable && media.seekable.length > 0) {
            const end = media.seekable.end(media.seekable.length - 1);
            if (Number.isFinite(end) && end > 0) return end;
        }
    } catch {
        /* ignore */
    }
    return null;
}

export type RecordingAudioPlayerProps = {
    src: string;
    className?: string;
    audioClassName?: string;
    autoPlay?: boolean;
    setAudioRef?: (el: HTMLAudioElement | null) => void;
    onPlay?: ReactEventHandler<HTMLAudioElement>;
    onError?: ReactEventHandler<HTMLAudioElement>;
    onLoadStart?: ReactEventHandler<HTMLAudioElement>;
    onCanPlay?: ReactEventHandler<HTMLAudioElement>;
    onCanPlayThrough?: ReactEventHandler<HTMLAudioElement>;
    onWaiting?: ReactEventHandler<HTMLAudioElement>;
    onPlaying?: ReactEventHandler<HTMLAudioElement>;
    onPause?: ReactEventHandler<HTMLAudioElement>;
    onEnded?: ReactEventHandler<HTMLAudioElement>;
};

export function RecordingAudioPlayer({
    src,
    className,
    audioClassName,
    autoPlay,
    setAudioRef,
    onPlay,
    onError,
    onLoadStart,
    onCanPlay,
    onCanPlayThrough,
    onWaiting,
    onPlaying,
    onPause,
    onEnded,
}: RecordingAudioPlayerProps) {
    const innerRef = useRef<HTMLAudioElement | null>(null);
    const [, setTick] = useState(0);
    const bump = useCallback(() => setTick((n) => n + 1), []);
    /** True after user requests play until `playing`, or during `waiting` (initial buffer or mid-play stall). */
    const [isPlaybackLoading, setIsPlaybackLoading] = useState(false);

    useEffect(() => {
        setIsPlaybackLoading(false);
    }, [src]);

    const mergeRef = useCallback(
        (el: HTMLAudioElement | null) => {
            innerRef.current = el;
            setAudioRef?.(el);
        },
        [setAudioRef]
    );

    useEffect(() => {
        const a = innerRef.current;
        if (!a) return;
        const sync = () => bump();

        // WebM produced by MediaRecorder ships without a Duration EBML element, so `media.duration` is
        // `Infinity` until the file is fully read. The well-known workaround: seek past the end once, let
        // the browser settle on the real `duration`, then snap back to 0. This is NOT a new duration
        // system — `media.duration` and `media.seekable.end()` are still the sole sources. It only nudges
        // the browser to resolve them. One-shot per `src` to avoid loops.
        let nudgePhase: "idle" | "seeking" | "done" = "idle";
        const onLoadedMetadata = () => {
            sync();
            if (nudgePhase === "idle" && !Number.isFinite(a.duration)) {
                nudgePhase = "seeking";
                try { a.currentTime = Number.MAX_SAFE_INTEGER; } catch { /* ignore */ }
            }
        };
        const onDurationChange = () => {
            sync();
            if (nudgePhase === "seeking" && Number.isFinite(a.duration) && a.duration > 0) {
                nudgePhase = "done";
                try { a.currentTime = 0; } catch { /* ignore */ }
            }
        };

        a.addEventListener("timeupdate", sync);
        a.addEventListener("durationchange", onDurationChange);
        a.addEventListener("progress", sync);
        a.addEventListener("loadedmetadata", onLoadedMetadata);
        a.addEventListener("canplaythrough", sync);
        return () => {
            a.removeEventListener("timeupdate", sync);
            a.removeEventListener("durationchange", onDurationChange);
            a.removeEventListener("progress", sync);
            a.removeEventListener("loadedmetadata", onLoadedMetadata);
            a.removeEventListener("canplaythrough", sync);
        };
    }, [src, bump]);

    const media = innerRef.current;
    const total = media ? readMediaDurationSeconds(media) : null;
    const current = media?.currentTime ?? 0;

    const handlePlay: ReactEventHandler<HTMLAudioElement> = (e) => {
        setIsPlaybackLoading(true);
        onPlay?.(e);
    };

    const handlePlaying: ReactEventHandler<HTMLAudioElement> = (e) => {
        setIsPlaybackLoading(false);
        onPlaying?.(e);
    };

    const handleWaiting: ReactEventHandler<HTMLAudioElement> = (e) => {
        setIsPlaybackLoading(true);
        onWaiting?.(e);
    };

    const handlePause: ReactEventHandler<HTMLAudioElement> = (e) => {
        setIsPlaybackLoading(false);
        onPause?.(e);
    };

    const handleEnded: ReactEventHandler<HTMLAudioElement> = (e) => {
        setIsPlaybackLoading(false);
        onEnded?.(e);
    };

    const handleError: ReactEventHandler<HTMLAudioElement> = (e) => {
        setIsPlaybackLoading(false);
        onError?.(e);
    };

    return (
        <div className={className}>
            {/* Native <audio controls> paints in a platform layer above siblings; keep loading UI BELOW it. */}
            <audio
                ref={mergeRef}
                controls
                preload="auto"
                src={src}
                autoPlay={autoPlay}
                className={audioClassName ?? "w-full"}
                onPlay={handlePlay}
                onError={handleError}
                onLoadStart={onLoadStart}
                onCanPlay={onCanPlay}
                onCanPlayThrough={onCanPlayThrough}
                onWaiting={handleWaiting}
                onPlaying={handlePlaying}
                onPause={handlePause}
                onEnded={handleEnded}
            />
            {isPlaybackLoading && (
                <div
                    className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-foreground"
                    aria-live="polite"
                    aria-busy="true"
                >
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
                    <span>Loading audio…</span>
                </div>
            )}
            <div className="mt-0.5 text-right text-xs tabular-nums text-muted-foreground">
                {formatTime(current)} / {total != null ? formatTime(total) : "…"}
            </div>
        </div>
    );
}
