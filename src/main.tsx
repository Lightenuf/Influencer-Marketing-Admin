import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: true, staleTime: 10_000 },
  },
  /**
   * 저장이 실패했는데 화면이 조용하면, 적은 내용이 남은 줄 알고 넘어가게 된다.
   * (새로고침해야 사라진 것을 안다)
   * 그래서 어디서 저장하다 실패하든 한곳에서 붙잡아 화면 위에 알린다.
   */
  mutationCache: new MutationCache({
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error)
      window.dispatchEvent(new CustomEvent('breevo:save-failed', { detail: message }))
    },
  }),
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
