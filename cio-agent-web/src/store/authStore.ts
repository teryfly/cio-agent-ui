import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../api/types'

interface AuthState {
  token: string | null
  user: User | null
  setToken: (token: string) => void
  setUser: (user: User) => void
  logout: () => void
  isAdmin: () => boolean
  isTokenValid: () => boolean
}

/** Decode JWT payload without verification (client-side only) */
function decodeJwtExpiry(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    // Base64url → base64: replace - with +, _ with /
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')

    // Add padding
    const pad = base64.length % 4
    if (pad === 2) base64 += '=='
    else if (pad === 3) base64 += '='

    const payload = JSON.parse(atob(base64))
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,

      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),

      logout: () => {
        set({ token: null, user: null })
        localStorage.removeItem('auth-storage')
      },

      isAdmin: () => get().user?.role === 'admin',

      isTokenValid: () => {
        const { token } = get()
        if (!token) return false
        const exp = decodeJwtExpiry(token)
        // If we can't parse expiry (e.g. non-standard JWT), assume valid
        // but only if the token looks structurally correct (3 parts)
        if (exp === null) {
          return token.split('.').length === 3
        }
        // Add a 10-second buffer to account for clock skew
        return (Date.now() / 1000) < (exp - 10)
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
)
