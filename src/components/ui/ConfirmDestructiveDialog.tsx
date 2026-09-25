import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './dialog'
import { Button } from './button'
import { AlertTriangle, Trash2 } from 'lucide-react'

export interface ConfirmDestructiveDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  title?: string
  resourceType: string
  itemName: string
  consequences?: string[]
  requireNameConfirmation?: boolean
}

/**
 * Reusable, explicit destructive action confirmation dialog.
 * Clearly articulates what is being deleted, what data is affected,
 * and asks for conscious user verification instead of a vague generic prompt.
 */
export default function ConfirmDestructiveDialog({
  open,
  onClose,
  onConfirm,
  title,
  resourceType,
  itemName,
  consequences = [],
  requireNameConfirmation = false,
}: ConfirmDestructiveDialogProps) {
  const [typedName, setTypedName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isConfirmed = !requireNameConfirmation || typedName.trim().toLowerCase() === itemName.trim().toLowerCase()

  const handleConfirm = async () => {
    if (!isConfirmed) return
    setIsSubmitting(true)
    try {
      await onConfirm()
      setTypedName('')
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && !isSubmitting) onClose() }}>
      <DialogContent className="sm:max-w-[460px] p-6 rounded-3xl border border-rose-200/80 dark:border-rose-900/60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl">
        <DialogHeader className="flex flex-col items-center sm:items-start text-center sm:text-left gap-2">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200/80 dark:border-rose-900/80 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 shadow-xs">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white font-sans">
              {title || `Delete ${resourceType}?`}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              This action cannot be undone. Please confirm your intention.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-4 my-2">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs">
            <div className="text-slate-500 dark:text-slate-400 font-medium">Selected {resourceType}:</div>
            <div className="text-sm font-bold text-slate-900 dark:text-white font-mono mt-0.5 truncate">
              {itemName}
            </div>
          </div>

          {consequences.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Downstream Impact:</div>
              <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-400 list-disc list-inside">
                {consequences.map((c, i) => (
                  <li key={i} className="leading-snug">{c}</li>
                ))}
              </ul>
            </div>
          )}

          {requireNameConfirmation && (
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                To confirm, type <span className="font-bold font-mono text-rose-600 dark:text-rose-400">{itemName}</span> below:
              </label>
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder={itemName}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto h-11 px-5 rounded-xl text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmed || isSubmitting}
            className="w-full sm:w-auto h-11 px-5 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 shadow-md shadow-rose-600/20"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isSubmitting ? 'Deleting...' : `Confirm Delete`}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
