"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { APP_VERSION } from "@/lib/version";
import { RefreshCw, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CURRENT_VERSION = APP_VERSION;
const REMIND_LATER_KEY = "version-update-remind-later";
const REMIND_LATER_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Compares two version strings (e.g., "1.2.3" vs "1.3.0")
 * Returns: 1 if version1 > version2, -1 if version1 < version2, 0 if equal
 */
function compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    // Pad shorter version with zeros
    const maxLength = Math.max(v1Parts.length, v2Parts.length);
    while (v1Parts.length < maxLength) v1Parts.push(0);
    while (v2Parts.length < maxLength) v2Parts.push(0);
    
    for (let i = 0; i < maxLength; i++) {
        if (v1Parts[i] > v2Parts[i]) return 1;
        if (v1Parts[i] < v2Parts[i]) return -1;
    }
    
    return 0;
}

export function VersionUpdateModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [latestVersion, setLatestVersion] = useState<string | null>(null);
    const [isChecking, setIsChecking] = useState(true);
    const [hasChecked, setHasChecked] = useState(false);

    useEffect(() => {
        // Only check once
        if (hasChecked) return;

        const checkForUpdate = async () => {
            // Check if user chose "remind me later" recently
            const remindLaterTimestamp = localStorage.getItem(REMIND_LATER_KEY);
            if (remindLaterTimestamp) {
                const timestamp = parseInt(remindLaterTimestamp, 10);
                const now = Date.now();
                const timeSinceRemind = now - timestamp;
                
                // If less than 24 hours have passed, don't show modal
                if (timeSinceRemind < REMIND_LATER_DURATION) {
                    setIsChecking(false);
                    setHasChecked(true);
                    return;
                }
            }

            try {
                // Fetch latest version from version.json
                const response = await fetch('/version.json', {
                    cache: 'no-store',
                    headers: {
                        'Cache-Control': 'no-cache',
                    },
                });

                if (!response.ok) {
                    console.log('[Version Update] Failed to fetch version.json:', response.status);
                    setIsChecking(false);
                    setHasChecked(true);
                    return;
                }

                const data = await response.json();
                const latest = data.latest;

                if (!latest || typeof latest !== 'string') {
                    console.log('[Version Update] Invalid version format in version.json');
                    setIsChecking(false);
                    setHasChecked(true);
                    return;
                }

                setLatestVersion(latest);

                // Compare versions
                const comparison = compareVersions(latest, CURRENT_VERSION);
                
                if (comparison > 0) {
                    // Latest version is newer than current
                    setIsOpen(true);
                }
            } catch (error) {
                console.error('[Version Update] Error checking for updates:', error);
            } finally {
                setIsChecking(false);
                setHasChecked(true);
            }
        };

        // Small delay to avoid blocking initial render
        const timer = setTimeout(checkForUpdate, 1000);
        
        return () => clearTimeout(timer);
    }, [hasChecked]);

    const handleRefresh = () => {
        // Dismiss modal immediately
        setIsOpen(false);
        // Reload the page to get the latest version
        window.location.reload();
    };

    const handleRemindLater = () => {
        // Store current timestamp in localStorage FIRST
        localStorage.setItem(REMIND_LATER_KEY, Date.now().toString());
        // Mark as checked to prevent re-checking
        setHasChecked(true);
        // Dismiss modal
        setIsOpen(false);
    };

    const handleOpenChange = (open: boolean) => {
        // Only allow closing, not opening via external triggers
        if (!open) {
            setIsOpen(false);
        }
    };

    // Don't render anything while checking or if no update available
    if (isChecking || !isOpen) {
        return null;
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <Dialog open={isOpen} onOpenChange={handleOpenChange}>
                    <DialogContent 
                        className="sm:max-w-md w-[calc(100%-2rem)] mx-4 z-[100]"
                        aria-describedby="version-update-description"
                        onEscapeKeyDown={(e) => {
                            // Prevent closing on Escape - user must choose an action
                            e.preventDefault();
                        }}
                        onInteractOutside={(e) => {
                            // Prevent closing by clicking outside - user must choose an action
                            e.preventDefault();
                        }}
                    >
                        <DialogHeader>
                            <DialogTitle className="text-xl sm:text-2xl font-bold text-center sm:text-left">
                                Update Available
                            </DialogTitle>
                            <DialogDescription 
                                id="version-update-description"
                                className="text-base sm:text-sm text-center sm:text-left mt-2"
                            >
                                A new version of the app is available. Please refresh to get the latest features!
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-4 px-1">
                            <div className="bg-muted/50 rounded-lg p-3 text-sm">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-muted-foreground">Current Version:</span>
                                    <span className="font-medium">{CURRENT_VERSION}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Latest Version:</span>
                                    <span className="font-semibold text-primary">{latestVersion}</span>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                            <Button
                                variant="outline"
                                onClick={handleRemindLater}
                                className="w-full sm:w-auto order-2 sm:order-1 min-h-[44px] text-base sm:text-sm"
                                aria-label="Remind me later about this update"
                            >
                                Remind me later
                            </Button>
                            <Button
                                onClick={handleRefresh}
                                className="w-full sm:w-auto order-1 sm:order-2 min-h-[44px] text-base sm:text-sm bg-primary hover:bg-primary/90"
                                aria-label="Refresh the page to get the latest version"
                            >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Refresh Now
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </AnimatePresence>
    );
}
