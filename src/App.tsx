import { useState, useEffect, createContext, useContext } from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import SearchSection from './components/SearchSection'
import TokenLeaderboard from './components/TokenLeaderboard'
import Events from './components/Events'
import ChatWidget from './components/ChatWidget'
import Footer from './components/Footer'
import ForumsPage from './pages/ForumsPage'

// ── Lightweight client-side router (no extra packages needed) ──────────────
export type Page = 'home' | 'forums'

interface RouterCtx {
  page: Page
  navigate: (p: Page) => void
}

export const RouterContext = createContext<RouterCtx>({ page: 'home', navigate: () => {} })
export const useRouter = () => useContext(RouterContext)

function resolvePage(): Page {
  const path = window.location.pathname
  const hash = window.location.hash
  return path === '/forums' || hash === '#forums' ? 'forums' : 'home'
}

function App() {
  const [darkMode, setDarkMode] = useState(false)
  const [page, setPage] = useState<Page>(resolvePage)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  useEffect(() => {
    const onPop = () => setPage(resolvePage())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function navigate(p: Page) {
    window.history.pushState({}, '', p === 'forums' ? '/forums' : '/')
    setPage(p)
    window.scrollTo(0, 0)
  }

  return (
    <RouterContext.Provider value={{ page, navigate }}>
      {page === 'home' ? (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 dark:from-gray-900 dark:to-black transition-all duration-500 overflow-x-hidden">
          <Header darkMode={darkMode} setDarkMode={setDarkMode} />
          <Hero />
          <SearchSection />
          <TokenLeaderboard />
          <Events />
          <Footer />
          <ChatWidget />
        </div>
      ) : (
        <ForumsPage darkMode={darkMode} setDarkMode={setDarkMode} />
      )}
    </RouterContext.Provider>
  )
}

export default App
