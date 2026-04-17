'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';

export function ConfirmDialog({ open, onOpenChange, title, description, onConfirm, withNotes = false, confirmLabel = 'Konfirmasi', destructive = false }) {
  const [notes, setNotes] = useState('');

  function handleConfirm() {
    onConfirm(withNotes ? notes : undefined);
    setNotes('');
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {withNotes && (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Catatan (opsional)..."
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={destructive ? 'bg-red-600 hover:bg-red-700 focus:ring-red-600' : ''}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
