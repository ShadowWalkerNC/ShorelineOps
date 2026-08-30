import React, { useState } from 'react'
import { api } from '../../api/client'
import { AppleBadge, AppleButton, AppleCard } from '@/apple-ui'
import { UploadCloud, FileText, CheckCircle2, AlertCircle, ExternalLink, ArrowRight, X } from 'lucide-react'

interface DennisImportModalProps {
  vendorId: string
  vendorName: string
  onClose: () => void
  onSuccess: () => void
}

interface ParsedItem {
  vendorSku: string
  name: string
  brand: string
  packSize: string
  uom: string
  category: string
  unitCost: number
  parLevel: number
  onHand: number
}

export default function DennisImportModal({ vendorId, vendorName, onClose, onSuccess }: DennisImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'upload' | 'preview'>('upload')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      setFile(selectedFile)
      parseCsvFile(selectedFile)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      setFile(droppedFile)
      parseCsvFile(droppedFile)
    }
  }

  const parseCsvFile = (file: File) => {
    setIsParsing(true)
    setError(null)
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0)
        if (lines.length < 2) {
          throw new Error('CSV file must have a header row and at least one item row.')
        }

        const header = lines[0].toLowerCase().split(',').map(h => h.replace(/^["']|["']$/g, '').trim())
        
        // Match column indices flexibly
        const skuIdx = header.findIndex(h => h.includes('sku') || h.includes('item') || h.includes('code'))
        const nameIdx = header.findIndex(h => h.includes('name') || h.includes('desc') || h.includes('product'))
        const brandIdx = header.findIndex(h => h.includes('brand') || h.includes('mfg'))
        const packIdx = header.findIndex(h => h.includes('pack') || h.includes('size'))
        const uomIdx = header.findIndex(h => h.includes('uom') || h.includes('unit'))
        const catIdx = header.findIndex(h => h.includes('cat') || h.includes('dept') || h.includes('group'))
        const costIdx = header.findIndex(h => h.includes('cost') || h.includes('price'))
        const parIdx = header.findIndex(h => h.includes('par'))
        const onHandIdx = header.findIndex(h => h.includes('hand') || h.includes('count') || h.includes('inv'))

        if (skuIdx === -1 || nameIdx === -1) {
          throw new Error('Could not find required "SKU/Item #" or "Description/Name" columns in header.')
        }

        const items: ParsedItem[] = []

        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(',').map(p => p.replace(/^["']|["']$/g, '').trim())
          if (!row[skuIdx] || !row[nameIdx]) continue

          items.push({
            vendorSku: row[skuIdx],
            name: row[nameIdx],
            brand: brandIdx !== -1 && row[brandIdx] ? row[brandIdx] : 'Dennis Select',
            packSize: packIdx !== -1 && row[packIdx] ? row[packIdx] : 'Case',
            uom: uomIdx !== -1 && row[uomIdx] ? row[uomIdx] : 'case',
            category: catIdx !== -1 && row[catIdx] ? row[catIdx] : 'Broadline',
            unitCost: costIdx !== -1 && !isNaN(Number(row[costIdx])) ? Number(row[costIdx]) : 0,
            parLevel: parIdx !== -1 && !isNaN(Number(row[parIdx])) ? Number(row[parIdx]) : 5,
            onHand: onHandIdx !== -1 && !isNaN(Number(row[onHandIdx])) ? Number(row[onHandIdx]) : 0,
          })
        }

        if (items.length === 0) {
          throw new Error('No valid items found in CSV.')
        }

        setParsedItems(items)
        setStep('preview')
      } catch (err: any) {
        setError(err.message || 'Failed to parse CSV file')
      } finally {
        setIsParsing(false)
      }
    }

    reader.onerror = () => {
      setError('Error reading file')
      setIsParsing(false)
    }

    reader.readAsText(file)
  }

  const handleCommitImport = async () => {
    setIsImporting(true)
    setError(null)
    try {
      await api.post('/purchasing/import-guide', {
        vendorId,
        items: parsedItems,
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      onSuccess()
      onClose()
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">Import Dennis Order Guide &amp; Catalog</h3>
                <AppleBadge color="red">Dennis Food Service</AppleBadge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Sync custom contract order guides, par levels, and inventory pricing.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Dennis Food Service Links Banner */}
        <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
          <div>
            <div className="font-bold text-slate-200 flex items-center gap-1.5">
              <span>Dennis Food Service Online Portals</span>
              <AppleBadge color="green">100% Employee Owned</AppleBadge>
            </div>
            <div className="text-slate-400 mt-0.5">
              Export your custom order guide from the Dennis Pepper Portal or browse wholesale lines.
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="https://dennisfoodservice.pepr.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors shadow-sm"
            >
              <span>Dennis Pepper App</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://dennisfoodservice.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs transition-colors"
            >
              <span>Dennis Home</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 'upload' && (
          <div className="space-y-4">
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => document.getElementById('dennis-csv-file-input')?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-3xl p-8 sm:p-12 text-center bg-slate-800/30 hover:bg-slate-800/50 cursor-pointer transition-all space-y-3"
            >
              <div className="w-14 h-14 rounded-full bg-blue-500/20 text-blue-400 mx-auto flex items-center justify-center">
                <FileText className="w-7 h-7" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">Drag &amp; Drop Dennis Food Service CSV File Here</div>
                <div className="text-xs text-slate-400 mt-1">or click to browse from your computer</div>
              </div>
              <input
                id="dennis-csv-file-input"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <AppleButton variant="primary" size="sm" type="button">
                Select CSV File
              </AppleButton>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 text-xs space-y-1 text-slate-400">
              <div className="font-bold text-slate-300">How to export from Dennis Pepper App:</div>
              <div>1. Log in to <strong className="text-slate-200">dennisfoodservice.pepr.app</strong>.</div>
              <div>2. Go to your <strong className="text-slate-200">Order Guide</strong> or <strong className="text-slate-200">Inventory Sheet</strong>.</div>
              <div>3. Click <strong className="text-slate-200">Export as CSV</strong> and drop the file above.</div>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">
                Parsed <strong className="text-emerald-400 font-mono">{parsedItems.length}</strong> items from CSV:
              </span>
              <button
                onClick={() => setStep('upload')}
                className="text-xs text-blue-400 hover:underline"
              >
                Choose different file
              </button>
            </div>

            <div className="rounded-2xl border border-slate-800 overflow-hidden max-h-64 overflow-y-auto bg-slate-800/30">
              <table className="w-full text-left text-xs divide-y divide-slate-800">
                <thead className="bg-slate-800 font-mono uppercase text-[10px] text-slate-400 sticky top-0">
                  <tr>
                    <th className="p-2.5">SKU</th>
                    <th className="p-2.5">Product Name</th>
                    <th className="p-2.5">Pack</th>
                    <th className="p-2.5 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {parsedItems.slice(0, 20).map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="p-2.5 font-mono text-slate-400">{it.vendorSku}</td>
                      <td className="p-2.5 font-semibold text-slate-200">{it.name}</td>
                      <td className="p-2.5 text-slate-400">{it.packSize}</td>
                      <td className="p-2.5 font-mono text-right text-emerald-400">${it.unitCost.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <AppleButton variant="secondary" onClick={() => setStep('upload')}>
                Back
              </AppleButton>
              <AppleButton
                variant="primary"
                onClick={handleCommitImport}
                disabled={isImporting}
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                {isImporting ? 'Importing Catalog…' : `Import ${parsedItems.length} SKUs`}
              </AppleButton>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
