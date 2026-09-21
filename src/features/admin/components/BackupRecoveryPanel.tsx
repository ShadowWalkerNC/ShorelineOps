import React, { useState } from 'react'
import { AppleBadge, AppleButton, AppleCard } from '@/apple-ui'
import { tokenManager } from '@/security/tokenManager'
import {
  Download,
  Upload,
  Database,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ArrowRight,
  HardDrive,
  FileText,
  Sparkles,
} from 'lucide-react'

interface BackupPreview {
  valid: boolean
  summary: {
    facilityName: string
    exportedAt: string
    residentsToRestore: number
    recipesToRestore: number
    inventoryToRestore: number
  }
}

export default function BackupRecoveryPanel() {
  const [downloading, setDownloading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileContent, setFileContent] = useState<any | null>(null)
  const [preview, setPreview] = useState<BackupPreview | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreResult, setRestoreResult] = useState<{ success: boolean; message: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  // 1. Export facility backup
  const handleExportBackup = async () => {
    setDownloading(true)
    setError(null)
    try {
      const token = tokenManager.getAccessToken()
      const res = await fetch('/api/admin/backup/export', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      if (!res.ok) {
        throw new Error('Export failed on the server.')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `shoreline_facility_backup_${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: any) {
      setError(`Failed to download backup: ${err.message}`)
    } finally {
      setDownloading(false)
    }
  }

  // 2. Handle file selection & pre-flight dry-run inspection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setError(null)
    setPreview(null)
    setRestoreResult(null)
    setAnalyzing(true)

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      setFileContent(parsed)

      const token = tokenManager.getAccessToken()
      const res = await fetch('/api/admin/backup/restore?dryRun=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(parsed),
      })

      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || 'Invalid backup format.')
      }

      const previewData: BackupPreview = await res.json()
      setPreview(previewData)
    } catch (err: any) {
      setError(`Failed to parse backup snapshot: ${err.message}`)
    } finally {
      setAnalyzing(false)
    }
  }

  // 3. Execute actual restore after user confirmation
  const handleExecuteRestore = async () => {
    if (!fileContent) return
    setRestoring(true)
    setError(null)
    setShowConfirmModal(false)

    try {
      const token = tokenManager.getAccessToken()
      const res = await fetch('/api/admin/backup/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(fileContent),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Restore failed.')
      }

      setRestoreResult({
        success: true,
        message: data.message || `Successfully restored ${data.restoredCount} resident clinical profiles.`,
      })
      setSelectedFile(null)
      setPreview(null)
      setFileContent(null)
    } catch (err: any) {
      setError(`Failed to execute restore: ${err.message}`)
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header with Title & Contextual Purpose */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white font-sans tracking-tight flex items-center gap-2.5">
          <HardDrive className="w-6 h-6 text-primary" />
          Backup, Export &amp; Disaster Recovery
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Generate complete, portable JSON snapshots of your facility census, therapeutic diet orders, master recipes, and par inventories. Recover easily in case of accidental loss or system migration with safe pre-flight validation.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {restoreResult && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{restoreResult.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Step 1: Export Facility Data */}
        <AppleCard className="p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
              <Download className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Export Facility Snapshot
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Create a complete archive of resident profiles, active diet orders, allergen tags, master recipes, and current distributor inventory levels. Ideal for routine weekly backups.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <AppleButton
              variant="primary"
              onClick={handleExportBackup}
              disabled={downloading}
              className="w-full flex items-center justify-center gap-2 text-xs font-semibold py-2.5"
            >
              <Download className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} />
              {downloading ? 'Preparing Backup Snapshot…' : 'Download Complete Facility Backup'}
            </AppleButton>
          </div>
        </AppleCard>

        {/* Step 2: Restore from Backup */}
        <AppleCard className="p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
              <Upload className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Restore from Backup
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Upload a previously exported Shoreline Care OS backup file. The system will inspect and show a preview of all records before making any changes.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <label className="w-full flex items-center justify-center gap-2 text-xs font-semibold py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-800 dark:text-slate-200 cursor-pointer transition-colors shadow-xs">
              <Upload className="w-4 h-4 text-purple-500" />
              <span>{selectedFile ? selectedFile.name : 'Select Backup JSON File'}</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
                disabled={analyzing || restoring}
              />
            </label>
          </div>
        </AppleCard>
      </div>

      {/* Pre-Flight Preview Card */}
      {preview && (
        <AppleCard className="p-6 space-y-4 border-purple-200 dark:border-purple-900/40 bg-purple-50/20 dark:bg-purple-950/10">
          <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Pre-Flight Backup Inspection Preview
              </h4>
            </div>
            <AppleBadge color="green">Validated Format</AppleBadge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center py-2">
            <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-700/60 shadow-xs">
              <div className="text-xs text-slate-400 font-medium">Facility</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white truncate mt-1">
                {preview.summary.facilityName}
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-700/60 shadow-xs">
              <div className="text-xs text-slate-400 font-medium">Residents to Sync</div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {preview.summary.residentsToRestore}
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-700/60 shadow-xs">
              <div className="text-xs text-slate-400 font-medium">Master Recipes</div>
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                {preview.summary.recipesToRestore}
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-700/60 shadow-xs">
              <div className="text-xs text-slate-400 font-medium">Inventory Items</div>
              <div className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                {preview.summary.inventoryToRestore}
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Exported timestamp: {new Date(preview.summary.exportedAt).toLocaleString()}. Restoring will safely upsert clinical profiles without dropping unreferenced history.
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <AppleButton
              variant="secondary"
              onClick={() => {
                setSelectedFile(null)
                setPreview(null)
                setFileContent(null)
              }}
              className="text-xs"
            >
              Cancel
            </AppleButton>
            <AppleButton
              variant="primary"
              onClick={() => setShowConfirmModal(true)}
              className="text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white"
            >
              Proceed to Safe Restore
            </AppleButton>
          </div>
        </AppleCard>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/15 text-amber-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Confirm Clinical Data Restore
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                You are about to restore <strong>{preview?.summary.residentsToRestore} resident profiles</strong> from the backup of <strong>{preview?.summary.facilityName}</strong>. Existing records matching these IDs will be synchronized.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-4">
              <AppleButton
                variant="secondary"
                onClick={() => setShowConfirmModal(false)}
                className="w-1/2 text-xs"
                disabled={restoring}
              >
                Cancel
              </AppleButton>
              <AppleButton
                variant="primary"
                onClick={handleExecuteRestore}
                disabled={restoring}
                className="w-1/2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {restoring ? 'Restoring Data…' : 'Yes, Restore Now'}
              </AppleButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
