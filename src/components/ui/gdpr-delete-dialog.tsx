"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, AlertCircle } from "lucide-react";

interface GDPRDeleteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    clientName?: string;
}

export function GDPRDeleteDialog({
    open,
    onOpenChange,
    onConfirm,
    clientName,
}: GDPRDeleteDialogProps) {
    const [firstConfirm, setFirstConfirm] = useState(false);
    const [secondConfirm, setSecondConfirm] = useState(false);
    const [step, setStep] = useState<1 | 2>(1);

    const handleFirstConfirm = () => {
        if (firstConfirm) {
            setStep(2);
        }
    };

    const handleFinalConfirm = () => {
        if (firstConfirm && secondConfirm) {
            onConfirm();
            // Reset state
            setFirstConfirm(false);
            setSecondConfirm(false);
            setStep(1);
            onOpenChange(false);
        }
    };

    const handleCancel = () => {
        setFirstConfirm(false);
        setSecondConfirm(false);
        setStep(1);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                {step === 1 ? (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                <AlertTriangle className="h-5 w-5" />
                                GDPR Deletion Request - First Warning
                            </DialogTitle>
                            <DialogDescription>
                                You are about to permanently delete {clientName ? `"${clientName}"` : "this client"} and ALL associated data including:
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-2">
                            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                                <li>All session notes and clinical records</li>
                                <li>All appointment history</li>
                                <li>All voice recordings and transcripts</li>
                                <li>All documents and attachments</li>
                                <li>All payment records</li>
                                <li>All relationship data</li>
                            </ul>
                            <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md">
                                <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                                    ⚠️ This action is IRREVERSIBLE and complies with GDPR "Right to be Forgotten" requests.
                                </p>
                            </div>
                        </div>
                        <div className="py-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="first-confirm"
                                    checked={firstConfirm}
                                    onCheckedChange={(checked) => setFirstConfirm(checked === true)}
                                />
                                <Label
                                    htmlFor="first-confirm"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    I understand this will permanently delete all data and cannot be undone
                                </Label>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={handleCancel}>
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleFirstConfirm}
                                disabled={!firstConfirm}
                            >
                                Continue to Final Warning
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                <AlertCircle className="h-5 w-5" />
                                Final Confirmation Required
                            </DialogTitle>
                            <DialogDescription>
                                This is your final warning. Are you absolutely certain you want to permanently delete {clientName ? `"${clientName}"` : "this client"}?
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <div className="p-4 bg-red-50 dark:bg-red-950/20 border-2 border-red-300 dark:border-red-700 rounded-md">
                                <p className="text-sm text-red-900 dark:text-red-100 font-semibold mb-2">
                                    ⚠️ FINAL WARNING: GDPR COMPLIANT DELETION
                                </p>
                                <p className="text-sm text-red-800 dark:text-red-200">
                                    This will permanently remove all data from the database. This action cannot be reversed, even by system administrators. 
                                    This complies with GDPR Article 17 (Right to Erasure).
                                </p>
                            </div>
                        </div>
                        <div className="py-4 space-y-3">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="second-confirm"
                                    checked={secondConfirm}
                                    onCheckedChange={(checked) => setSecondConfirm(checked === true)}
                                />
                                <Label
                                    htmlFor="second-confirm"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    I confirm this is a GDPR deletion request and I want to permanently delete all data
                                </Label>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setStep(1)}>
                                Go Back
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleFinalConfirm}
                                disabled={!secondConfirm}
                            >
                                Permanently Delete All Data
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}




