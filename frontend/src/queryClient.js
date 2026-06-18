import { QueryClient } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime:           30_000,
      refetchOnWindowFocus: false,
      gcTime:              10 * 60_000,
    },
    mutations: {
      retry: 0,
    },
  },
})

export default queryClient
