"use client";

import type { ReactNode } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function ConfirmDialog({open, onOpenChange, title, description, confirm, cancel = "Keep it", onConfirm}: {open: boolean; onOpenChange: (open: boolean) => void; title: string; description: ReactNode; confirm: string; cancel?: string; onConfirm: () => void}) {
  return <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent className="account-dialog">
      <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel className="button button-outline">{cancel}</AlertDialogCancel><AlertDialogAction className="button button-dark" onClick={onConfirm}>{confirm}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
