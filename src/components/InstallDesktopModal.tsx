import React, { useState, useEffect } from 'react'
import { AppleBadge, AppleButton, AppleCard } from '@/apple-ui'
import {
  Download,
  Laptop,
  Tablet,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  HardDrive,
  Monitor,
  Share,
  PlusSquare,
  ArrowRight,
  ExternalLink,
  X,
} from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface Props {
  open: boolean
  onClose: () => void
}

export default function InstallDesktopModal({ open, onClose }: Props) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [activeTab, setActiveTab] = useState<'pwa' | 'windows' | 'tablet'>('pwa')

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Check if already in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!open) return null

  const handle1ClickInstall = async () => {
    if (installPrompt) {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setIsInstalled(true)
        setInstallPrompt(null)
      }
    } else {
      // Fallback: trigger browser install instructions
      alert("To install Shoreline Care OS to your desktop:\n\n1. Look for the 'Install' icon (computer screen with down arrow) in your browser address bar on the right.\n2. Click 'Install' to add Shoreline to your Windows Desktop or Mac Dock.\n3. The app will open in its own clean window with no browser tabs!")
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 relative overflow-hidden">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Install Shoreline Care OS
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Run Shoreline as a fast, native desktop app on your facility PC or kitchen tablet.
          </p>
        </div>

        {/* Top Hero Banner */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-teal-500/10 via-blue-500/5 to-purple-500/10 border border-teal-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Laptop className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  1-Click Instant Desktop App
                </h3>
                <AppleBadge color="green" dot>
                  Easiest Method
                </AppleBadge>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                No downloads, no unzipping, and zero technical setup required.
              </p>
            </div>
          </div>

          <AppleButton
            variant="primary"
            size="md"
            icon={<Download className="w-4 h-4" />}
            onClick={handle1ClickInstall}
          >
            {isInstalled ? 'Already Installed' : 'Install to Desktop'}
          </AppleButton>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl gap-1">
          <button
            onClick={() => setActiveTab('pwa')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'pwa'
                ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Browser 1-Click (Chrome/Edge)</span>
          </button>
          <button
            onClick={() => setActiveTab('tablet')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'tablet'
                ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Tablet className="w-3.5 h-3.5" />
            <span>iPad / Android Tablet</span>
          </button>
          <button
            onClick={() => setActiveTab('windows')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'windows'
                ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Windows Offline Installer</span>
          </button>
        </div>

        {/* Tab 1: Browser 1-Click (PWA) */}
        {activeTab === 'pwa' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                <div className="w-6 h-6 rounded-lg bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 font-bold text-xs flex items-center justify-center font-mono">
                  1
                </div>
                <div className="font-bold text-xs text-slate-900 dark:text-white">Look at Address Bar</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  In Chrome or Microsoft Edge, look for the <strong>Install</strong> icon on the right of the address bar.
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                <div className="w-6 h-6 rounded-lg bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 font-bold text-xs flex items-center justify-center font-mono">
                  2
                </div>
                <div className="font-bold text-xs text-slate-900 dark:text-white">Click "Install"</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Click the prompt to confirm. Shoreline creates a desktop shortcut automatically.
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                <div className="w-6 h-6 rounded-lg bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 font-bold text-xs flex items-center justify-center font-mono">
                  3
                </div>
                <div className="font-bold text-xs text-slate-900 dark:text-white">Open Anytime</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Double-click your new desktop icon to open Shoreline like any normal Windows program!
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>
                <strong>Best for Dietary Directors &amp; Nurses:</strong> Updates happen automatically with zero IT maintenance.
              </span>
            </div>
          </div>
        )}

        {/* Tab 2: iPad / Tablet */}
        {activeTab === 'tablet' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                  <Share className="w-4 h-4 text-blue-500" />
                  <span>iPad / iPhone (Safari)</span>
                </div>
                <ol className="list-decimal list-inside text-xs text-slate-600 dark:text-slate-300 space-y-1.5 pt-1">
                  <li>Open Shoreline in Safari.</li>
                  <li>Tap the <strong>Share</strong> button (box with up arrow).</li>
                  <li>Scroll down and tap <strong>"Add to Home Screen"</strong>.</li>
                  <li>Tap <strong>Add</strong> in the top right corner.</li>
                </ol>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                  <PlusSquare className="w-4 h-4 text-emerald-500" />
                  <span>Android Tablet (Chrome)</span>
                </div>
                <ol className="list-decimal list-inside text-xs text-slate-600 dark:text-slate-300 space-y-1.5 pt-1">
                  <li>Open Shoreline in Chrome.</li>
                  <li>Tap the <strong>Three Dots (&vellip;)</strong> menu.</li>
                  <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
                  <li>Tap <strong>Install</strong> to confirm.</li>
                </ol>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 flex items-center gap-2.5 text-xs text-blue-800 dark:text-blue-300">
              <Sparkles className="w-4 h-4 shrink-0 text-blue-600" />
              <span>
                <strong>Perfect for Kitchen Line Tablets:</strong> Full-screen touch interface with big gloved buttons for cooks.
              </span>
            </div>
          </div>
        )}

        {/* Tab 3: Windows Offline Package */}
        {activeTab === 'windows' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                    Standalone Local Server &amp; Database Package
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    For facilities that want 100% offline local SQLite storage on a dedicated kitchen PC.
                  </p>
                </div>
                <a
                  href="https://github.com/ShadowWalkerNC/ShorelineOps/releases/latest"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs transition-all shrink-0 flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download ZIP</span>
                </a>
              </div>

              <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-[11px] font-mono font-bold flex items-center justify-center">1</span>
                  <span>Extract <code>ShorelineOps-v5.0.0-Windows-Setup.zip</code> to any folder.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-[11px] font-mono font-bold flex items-center justify-center">2</span>
                  <span>Double-click <code>Setup.bat</code> to create your desktop shortcut.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-[11px] font-mono font-bold flex items-center justify-center">3</span>
                  <span>Double-click <strong>"Shoreline Care OS"</strong> on your desktop to launch.</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
