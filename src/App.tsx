import { useState, useEffect } from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import SearchSection from './components/SearchSection'
import TokenLeaderboard from './components/TokenLeaderboard'
import Events from './components/Events'
import ChatWidget from './components/ChatWidget'
import Footer from './components/Footer'

function App() {
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 dark:from-gray-900 dark:to-black transition-all duration-500 overflow-x-hidden">
      <Header darkMode={darkMode} setDarkMode={setDarkMode} />
      <Hero />
      <SearchSection />
      <TokenLeaderboard />
      <Events />
      <Footer />
      <ChatWidget />
    </div>
  )
}

export default App