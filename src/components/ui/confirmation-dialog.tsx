"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface ConfirmationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    title?: string;
    description?: string;
    confirmButtonText?: string;
    cancelButtonText?: string;
    variant?: "default" | "destructive";
}

export function ConfirmationDialog({
    open,
    onOpenChange,
    onConfirm,
    title = "Confirm Action",
    description,
    confirmButtonText = "OK",
    cancelButtonText = "Cancel",
    variant = "default",
}: ConfirmationDialogProps) {
    const handleConfirm = () => {
        onConfirm();
        onOpenChange(false);
    };

    const handleCancel = () => {
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className={`flex items-center gap-2 ${
                        variant === "destructive" 
                            ? "text-red-600 dark:text-red-400" 
                            : ""
                    }`}>
                        <AlertCircle className="h-5 w-5" />
                        {title}
                    </DialogTitle>
                    <DialogDescription>
                        {description || "Are you sure you want to proceed?"}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={handleCancel}
                    >
                        {cancelButtonText}
                    </Button>
                    <Button
                        variant={variant === "destructive" ? "destructive" : "default"}
                        onClick={handleConfirm}
                    >
                        {confirmButtonText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
