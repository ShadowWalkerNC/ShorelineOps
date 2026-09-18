import React, { useState, useRef } from 'react'
import { api } from '@/api/client'
import { AppleButton, AppleBadge } from '@/apple-ui'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X, Download, RefreshCw } from 'lucide-react'

interface CensusImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const SAMPLE_CSV = `name,room,status,dietType,texture,portionSize,allergies,beverages,likes,dislikes,isNpo,npoReason
"Eleanor Vance","101","Active","NAS","Pureed","Regular","Dairy","Apple Juice","Pureed Vegetables, Soup","Spicy foods","false",""
"Arthur Pendelton","102","Active","Regular","Regular","Large","Peanuts","Coffee, Water","Steak, Roast Chicken","Shellfish","false",""
"Martha Higgins","103","Active","NPO","Regular","Regular","","Water","","","true","Surgery scheduled 08:00 AM"
"Robert Jenkins","104","Active","Consistent Carbohydrate","Minced & Moist","Regular","Strawberries","Skim Milk","Fish, Rice","Broccoli","false",""`

export default function CensusImportModal({ isOpen, onClose, onSuccess }: CensusImportModalProps) {
  const [csvContent, setCsvContent] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    created: number
    updated: number
    totalProcessed: number
    errors: string[]
  } | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setCsvContent(text)
      setResult(null)
      setApiError(null)
    }
    reader.readAsText(file)
  }

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'shoreline_census_template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleImport = async () => {
    if (!csvContent.trim()) {
      setApiError('Please select a CSV file or paste CSV content before importing.')
      return
    }

    setImporting(true)
    setApiError(null)
    setResult(null)

    try {
      const res = await api.post('/residents/import-csv', { csv: csvContent })
      setResult(res.data)
      if (res.data.success && (res.data.created > 0 || res.data.updated > 0)) {
        onSuccess()
      }
    } catch (err: any) {
      setApiError(err.response?.data?.error || err.message || 'Failed to import census CSV.')
    } finally {
      setImporting(false)
    }
  }

  const lineCount = csvContent.trim() ? csvContent.trim().split(/\r\n|\r|\n/).length - 1 : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Import Census &amp; Diet Orders</h2>
              <p className="text-xs text-slate-500">Fast batch onboarding from CSV, PCC, or EHR census export</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Need a spreadsheet template?</h4>
              <p className="text-xs text-slate-500 mt-0.5">Download our pre-formatted CSV template with standard clinical columns.</p>
            </div>
            <AppleButton
              variant="secondary"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              onClick={handleDownloadTemplate}
            >
              Download Template
            </AppleButton>
          </div>

          {/* File Picker */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-teal-500 rounded-2xl p-6 text-center cursor-pointer transition-colors"
            >
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {fileName ? (
                  <span className="text-teal-600 font-bold">{fileName}</span>
                ) : (
                  'Click to select or drop a census CSV file'
                )}
              </p>
              <p className="text-xs text-slate-400 mt-1">Supports UTF-8 CSV with standard clinical header rows</p>
            </div>
          </div>

          {/* Direct CSV Preview / Paste */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                CSV Data Preview {lineCount > 0 && `(${lineCount} resident rows)`}
              </label>
              {csvContent && (
                <button
                  onClick={() => { setCsvContent(''); setFileName(null); setResult(null); }}
                  className="text-xs text-slate-400 hover:text-red-500"
                >
                  Clear
                </button>
              )}
            </div>
            <textarea
              rows={6}
              value={csvContent}
              onChange={(e) => { setCsvContent(e.target.value); setResult(null); setApiError(null); }}
              placeholder="Or paste CSV content directly here..."
              className="w-full font-mono text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          {/* Error Message */}
          {apiError && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>{apiError}</div>
            </div>
          )}

          {/* Result Summary */}
          {result && (
            <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 space-y-2">
              <div className="flex items-center gap-2 text-teal-800 dark:text-teal-200 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                <span>Census import completed!</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <AppleBadge color="blue">{result.created} Added</AppleBadge>
                <AppleBadge color="green">{result.updated} Updated</AppleBadge>
                <AppleBadge color="gray">{result.totalProcessed} Processed</AppleBadge>
              </div>
              {result.errors.length > 0 && (
                <div className="mt-2 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <p className="font-bold">Warnings / Skipped Rows ({result.errors.length}):</p>
                  <ul className="list-disc list-inside space-y-0.5 max-h-24 overflow-y-auto">
                    {result.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <AppleButton variant="secondary" onClick={onClose}>
            {result ? 'Done' : 'Cancel'}
          </AppleButton>
          <AppleButton
            variant="primary"
            onClick={handleImport}
            disabled={importing || !csvContent.trim()}
            icon={importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          >
            {importing ? 'Processing Census…' : 'Import Census'}
          </AppleButton>
        </div>
      </div>
    </div>
  )
}
