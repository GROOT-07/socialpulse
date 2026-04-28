import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ActiveOrg {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  brandColor: string | null
  industry: string
  activePlatforms: string[]
}

interface OrgState {
  activeOrg: ActiveOrg | null
  orgs: ActiveOrg[]

  setActiveOrg: (org: ActiveOrg) => void
  setOrgs: (orgs: ActiveOrg[]) => void
  updateOrgBrandColor: (color: string) => void
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set) => ({
      activeOrg: null,
      orgs: [],

      setActiveOrg: (org) => {
        // Apply org brand color to root CSS variable
        if (typeof document !== 'undefined' && org.brandColor) {
          document.documentElement.style.setProperty('--color-accent', org.brandColor)
        }
        set({ activeOrg: org })
      },

      setOrgs: (orgs) => set({ orgs }),

      updateOrgBrandColor: (color) => {
        if (typeof document !== 'undefined') {
          document.documentElement.style.setProperty('--color-accent', color)
        }
        set((state) => ({
          activeOrg: state.activeOrg ? { ...state.activeOrg, brandColor: color } : null,
        }))
      },
    }),
    {
      name: 'sp-org',
    },
  ),
)
