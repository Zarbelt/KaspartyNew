import { Moon, Sun } from 'lucide-react'

interface Props {
  darkMode: boolean
  setDarkMode: (v: boolean) => void
}

export default function Header({ darkMode, setDarkMode }: Props) {
  return (
    <header className="bg-kasgreen shadow-lg sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src="/kasparty.jpg" alt="Logo" className="h-12 rounded-full shadow-md" />
          <h1 className="text-2xl font-bold text-white">Kasparty.com</h1>
        </div>
        <div className="flex items-center gap-6">
          <a href="https://kaspa.org" target="_blank" className="text-white hover:text-gray-200 transition">Kaspa Org</a>
          <a href="https://kaspa.stream" target="_blank" className="text-white hover:text-gray-200 transition">Explorer</a>
          <a href="https://t.me/+UPNAZh5Cv0dlODM5" target="_blank" className="text-white hover:text-gray-200 transition">KRC20</a>
          <button onClick={() => setDarkMode(!darkMode)} className="text-white">
            {darkMode ? <Sun size={24} /> : <Moon size={24} />}
          </button>
        </div>
      </nav>
    </header>
  )
}