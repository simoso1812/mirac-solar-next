'use client'

import { useQuotationStore } from '@/stores/quotation-store'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { StepClient } from './step-client'
import { StepProject } from './step-project'
import { StepTechnical } from './step-technical'
import { StepAdvanced } from './step-advanced'
import { StepReview } from './step-review'

const STEPS = [
  { label: 'Cliente', number: 0 },
  { label: 'Proyecto', number: 1 },
  { label: 'Técnico', number: 2 },
  { label: 'Avanzado', number: 3 },
  { label: 'Revisión', number: 4 },
]

export function QuotationWizard() {
  const { currentStep } = useQuotationStore()
  const progress = ((currentStep + 1) / STEPS.length) * 100

  return (
    <div className="space-y-6">
      {/* Progress header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className={cn(
                'flex items-center gap-1.5 text-sm font-medium',
                step.number === currentStep
                  ? 'text-mirac-red'
                  : step.number < currentStep
                    ? 'text-foreground'
                    : 'text-muted-foreground'
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                  step.number === currentStep
                    ? 'bg-mirac-red text-white'
                    : step.number < currentStep
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground'
                )}
              >
                {step.number + 1}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </div>
          ))}
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Step content */}
      {currentStep === 0 && <StepClient />}
      {currentStep === 1 && <StepProject />}
      {currentStep === 2 && <StepTechnical />}
      {currentStep === 3 && <StepAdvanced />}
      {currentStep === 4 && <StepReview />}
    </div>
  )
}
