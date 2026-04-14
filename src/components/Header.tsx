import { Moon, Sun, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from '../App'

interface Props {
  darkMode: boolean
  setDarkMode: (v: boolean) => void
}

export default function Header({ darkMode, setDarkMode }: Props) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { navigate } = useRouter()

  return (
    <header className="bg-kasgreen shadow-lg sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 py-3 md:py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 md:gap-4">
          <img
            src="/kasparty.jpg"
            alt="Logo"
            className="h-10 md:h-12 rounded-full shadow-md"
          />
          <h1 className="text-lg md:text-2xl font-bold text-white">Kasparty.com</h1>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          <button
            onClick={() => navigate('forums')}
            className="text-white hover:text-gray-200 transition font-medium"
          >
            Forums
          </button>
          <a
            href="https://kaspa.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:text-gray-200 transition"
          >
            Kaspa Org
          </a>
          <a
            href="https://kaspa.stream"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:text-gray-200 transition"
          >
            Explorer
          </a>
          <a
            href="https://t.me/+UPNAZh5Cv0dlODM5"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:text-gray-200 transition"
          >
            KRC20
          </a>
          <a
            href="https://kasmail.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white border border-white/40 hover:bg-white/10 transition px-3 py-1.5 rounded-lg text-sm font-semibold"
          >
            Kasmail.org
          </a>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="text-white hover:text-gray-200 transition"
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <Sun size={24} /> : <Moon size={24} />}
          </button>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center gap-4">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="text-white"
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="text-white"
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-kasgreen border-t border-green-600 px-4 py-4">
          <div className="flex flex-col gap-4">
            <button
              onClick={() => { navigate('forums'); setIsMenuOpen(false) }}
              className="text-white hover:text-gray-200 transition py-2 font-medium text-left"
            >
              Forums
            </button>
            <a
              href="https://kaspa.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-gray-200 transition py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              Kaspa Org
            </a>
            <a
              href="https://kaspa.stream"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-gray-200 transition py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              Explorer
            </a>
            <a
              href="https://t.me/+UPNAZh5Cv0dlODM5"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-gray-200 transition py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              KRC20
            </a>
            <a
              href="https://kasmail.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-gray-200 transition py-2 font-semibold"
              onClick={() => setIsMenuOpen(false)}
            >
              Kasmail.org
            </a>
          </div>
        </div>
      )}
    </header>
  )
}
