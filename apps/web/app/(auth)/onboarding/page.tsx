'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const STEPS = [
  { id: 1, label: 'Organization details' },
  { id: 2, label: 'Connect social accounts' },
  { id: 3, label: 'Add competitors' },
  { id: 4, label: 'Choose platforms' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)

  const isLast = step === STEPS.length

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Progress steps */}
      <div className="mb-8 flex items-center justify-between">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className="flex flex-col items-center gap-1.5">
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors duration-normal',
                step > s.id
                  ? 'border-success bg-success text-white'
                  : step === s.id
                  ? 'border-accent bg-accent text-white'
                  : 'border-brand-border-2 bg-surface text-[var(--color-text-4)]',
              )}>
                {step > s.id ? <CheckCircle2 className="h-4 w-4" /> : s.id}
              </div>
              <span className={cn(
                'hidden sm:block text-xs font-medium',
                step === s.id ? 'text-accent' : 'text-[var(--color-text-4)]',
              )}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                'h-px flex-1 mx-2 transition-colors duration-normal',
                step > s.id ? 'bg-success' : 'bg-brand-border',
              )} />
            )}
          </React.Fragment>
        ))}
      </div>

      <Card>
        <CardContent className="py-8 px-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">
              {STEPS[step - 1]?.label}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-3)]">
              Step {step} of {STEPS.length}
            </p>
          </div>

          {/* Step content placeholder — full implementation in Phase 6 */}
          <div className="rounded-lg bg-surface-2 px-4 py-8 text-center">
            <p className="text-sm text-[var(--color-text-4)]">
              Onboarding step {step} — full wizard built in Phase 6.
            </p>
          </div>

          <div className="flex justify-between pt-2">
            <Button
              variant="secondary"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
            >
              Back
            </Button>
            <Button
              variant="primary"
              onClick={() => isLast ? router.replace('/') : setStep((s) => s + 1)}
            >
              {isLast ? 'Go to dashboard' : 'Continue'}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
