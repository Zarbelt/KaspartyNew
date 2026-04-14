import { useState } from 'react'
import { Shield } from 'lucide-react'
import Header from '../components/Header'
import Forums from '../components/Forums'
import ModeratorPanel from '../components/ModeratorPanel'
import Footer from '../components/Footer'
import ChatWidget from '../components/ChatWidget'

interface Props {
  darkMode: boolean
  setDarkMode: (v: boolean) => void
}

export default function ForumsPage({ darkMode, setDarkMode }: Props) {
  const [modPanelOpen, setModPanelOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      <Header darkMode={darkMode} setDarkMode={setDarkMode} />

      {/* Forum banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-blue-800 to-kasgreen text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold mb-2 tracking-tight">
              Kaspa Forum
            </h1>
            <p className="text-white/75 text-sm sm:text-base max-w-xl">
              Your community for everything Kaspa — discuss tokens, share ideas, and connect with the ecosystem.
            </p>
          </div>
          <button
            onClick={() => setModPanelOpen(true)}
            className="flex items-center gap-2 text-white/60 hover:text-white border border-white/25 hover:border-white/50 px-4 py-2 rounded-xl text-sm transition shrink-0"
          >
            <Shield size={15} />
            Mod Panel
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="h-1 bg-gradient-to-r from-kasgreen/40 via-blue-500/20 to-transparent" />

      {/* Forums content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Forums />
      </div>

      <Footer />
      <ChatWidget />

      {modPanelOpen && (
        <ModeratorPanel onClose={() => setModPanelOpen(false)} />
      )}
    </div>
  )
}
