import { create } from 'zustand'

export interface GeneratorPrefill {
  platform?: string        // 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE' etc.
  topic?: string           // pre-filled topic
  context?: string         // additional context
  tone?: string            // pre-filled tone
  hook?: string            // pre-filled hook from sprint/brief
  caption?: string         // pre-filled caption
  hashtags?: string[]      // pre-filled hashtags
  shouldFocus?: boolean    // if true, page should auto-focus the generate button
  source?: string          // 'brief' | 'sprint' | 'trends' | 'audit'
}

interface GeneratorStore {
  prefill: GeneratorPrefill | null
  setPrefill: (data: GeneratorPrefill) => void
  clearPrefill: () => void
}

export const useGeneratorStore = create<GeneratorStore>((set) => ({
  prefill: null,
  setPrefill: (data) => set({ prefill: data }),
  clearPrefill: () => set({ prefill: null }),
}))
