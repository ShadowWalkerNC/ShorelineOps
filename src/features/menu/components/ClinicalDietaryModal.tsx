import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertTriangle } from 'lucide-react'

export interface ClinicalDietaryModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ClinicalDietaryModal({ isOpen, onClose }: ClinicalDietaryModalProps) {
  return <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
      <DialogTitle className="pr-10">Dietary review</DialogTitle>
      <DialogDescription className="text-sm">Review status for menu balance, texture preparation, and substitutions.</DialogDescription>
      <Tabs defaultValue="audit">
        <TabsList className="grid h-auto w-full grid-cols-3" aria-label="Dietary review areas">
          <TabsTrigger value="audit" className="min-h-12 whitespace-normal">Menu balance</TabsTrigger>
          <TabsTrigger value="texture" className="min-h-12 whitespace-normal">Texture preparation</TabsTrigger>
          <TabsTrigger value="substitution" className="min-h-12 whitespace-normal">Substitutions</TabsTrigger>
        </TabsList>
        <TabsContent value="audit" className="space-y-4">
          <h3 className="flex items-center gap-2 font-semibold"><AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0" />Not evaluated</h3>
          <p>This panel has no recorded evaluation for the selected menu. Protein rotation, variety, meal timing, nutrition targets, and regulatory review have not been checked here.</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">A review needs the menu version, complete recipes and portions, meal schedule, and applicable facility requirements. Review those records with an authorized reviewer before recording a result.</p>
        </TabsContent>
        <TabsContent value="texture" className="space-y-4">
          <h3 className="font-semibold">No validated formulation loaded</h3>
          <p>Use the approved recipe and prescribed texture level. A generic ingredient ratio cannot establish the texture of a prepared batch.</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">Confirm preparation and testing requirements through your facility’s approved texture procedure and record the actual batch result in its production record.</p>
        </TabsContent>
        <TabsContent value="substitution" className="space-y-4">
          <h3 className="font-semibold">No substitution evaluated</h3>
          <p>This panel has no ingredient specifications, current resident order, or approved replacement to compare.</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">Review product ingredients, allergies, nutrient requirements, and texture before using a replacement. An authorized review must establish suitability; suggestions do not approve a substitution.</p>
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
}
