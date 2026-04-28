import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthUser {
  id: string
  email: string
  role: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'VIEWER'
  activeOrgId: string | null
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean

  setAuth: (user: AuthUser, tokens: { accessToken: string; refreshToken: string }) => void
  setAccessToken: (token: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, tokens) => {
        // Also store access token in sessionStorage for the API client
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('sp_access_token', tokens.accessToken)
        }
        set({ user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, isAuthenticated: true })
      },

      setAccessToken: (token) => {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('sp_access_token', token)
        }
        set({ accessToken: token })
      },

      clearAuth: () => {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('sp_access_token')
        }
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
      },
    }),
    {
      name: 'sp-auth',
      // Only persist refresh token + user — access token is session-only
      partialize: (state) => ({
        user: state.user,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)
