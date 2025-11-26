"use client";

import { useState, useEffect } from "react";
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
import { AlertTriangle } from "lucide-react";

interface DeleteConfirmationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    title?: string;
    description?: string;
    itemName?: string;
    confirmButtonText?: string;
    checkboxText?: string;
    requireConfirmation?: boolean;
}

export function DeleteConfirmationDialog({
    open,
    onOpenChange,
    onConfirm,
    title = "Confirm Deletion",
    description,
    itemName,
    confirmButtonText,
    checkboxText,
    requireConfirmation = true,
}: DeleteConfirmationDialogProps) {
    const [isConfirmed, setIsConfirmed] = useState(false);

    // Reset confirmation when dialog opens/closes or action changes
    useEffect(() => {
        if (!open) {
            setIsConfirmed(false);
        }
    }, [open, title]);

    // Determine button text and checkbox text based on title
    const isArchive = title?.toLowerCase().includes('archive');
    const defaultButtonText = isArchive ? "Archive" : "Delete";
    const defaultCheckboxText = isArchive 
        ? "I understand this will archive the client" 
        : "I understand this action cannot be undone";

    // Debug logging
    useEffect(() => {
        if (open) {
            console.log('[DeleteConfirmationDialog] Dialog opened:', { title, isArchive, defaultButtonText });
        }
    }, [open, title, isArchive, defaultButtonText]);

    const handleConfirm = () => {
        if (!requireConfirmation || isConfirmed) {
            onConfirm();
            setIsConfirmed(false);
            onOpenChange(false);
        }
    };

    const handleCancel = () => {
        setIsConfirmed(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className={`flex items-center gap-2 ${isArchive ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400'}`}>
                        <AlertTriangle className="h-5 w-5" />
                        {title}
                    </DialogTitle>
                    <DialogDescription>
                        {description || `Are you sure you want to ${isArchive ? 'archive' : 'delete'} ${itemName ? `"${itemName}"` : "this item"}? ${isArchive ? 'Archived clients can be restored later.' : 'This action cannot be undone.'}`}
                    </DialogDescription>
                </DialogHeader>
                {requireConfirmation && (
                    <div className="py-4">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="confirm-action"
                                checked={isConfirmed}
                                onCheckedChange={(checked) => setIsConfirmed(checked === true)}
                            />
                            <Label
                                htmlFor="confirm-action"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                {checkboxText || defaultCheckboxText}
                            </Label>
                        </div>
                    </div>
                )}
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={handleCancel}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant={isArchive ? "default" : "destructive"}
                        onClick={handleConfirm}
                        disabled={requireConfirmation && !isConfirmed}
                        className={isArchive ? "bg-orange-600 hover:bg-orange-700 text-white" : ""}
                    >
                        {confirmButtonText || defaultButtonText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

