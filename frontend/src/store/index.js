import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'hawala-auth' }
  )
)

export const useLangStore = create(
  persist(
    (set) => ({
      lang: 'tr',
      setLang: (lang) => set({ lang }),
    }),
    { name: 'hawala-lang' }
  )
)
