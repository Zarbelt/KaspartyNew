import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { X, Minus } from 'lucide-react'

declare global {
  interface Window {
    kasware?: {
      requestAccounts: () => Promise<string[]>
      getAccounts: () => Promise<string[]>
      getBalance: () => Promise<{ total: number }>
    }
  }
}

const MIN_KAS_BALANCE = 100000000

interface Message {
  id: number
  user_address: string
  content: string
  created_at: string
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const [userAddress, setUserAddress] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const connectWallet = async () => {
    try {
      if (!window.kasware) {
        throw new Error('Kasware wallet not detected. Please install the extension.')
      }
      let accounts = await window.kasware.getAccounts()
      let addr: string | undefined
      if (!accounts || accounts.length === 0) {
        accounts = await window.kasware.requestAccounts()
        addr = accounts[0]
      } else {
        addr = accounts[0]
      }
      if (!addr) {
        throw new Error('No account found.')
      }
      const balance = await window.kasware.getBalance()
      if (balance.total < MIN_KAS_BALANCE) {
        throw new Error('Insufficient KAS balance. Need at least 1 KAS.')
      }
      setUserAddress(addr)
      loadHistory()
      subscribe()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error connecting wallet or insufficient KAS balance.')
    }
  }

  const loadHistory = async () => {
    const { data } = await supabase
      .from('messages')
      .select('id, user_address, content, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) {
      setMessages((data as Message[]).reverse())
    }
  }

  const subscribe = () => {
    supabase
      .channel('messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
        }
      )
      .subscribe()
  }

  const send = async () => {
    if (!input.trim() || !userAddress) return
    await supabase
      .from('messages')
      .insert({ user_address: userAddress, content: input.trim() })
    setInput('')
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-kasgreen rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition z-50"
      >
        <span className="text-3xl">💬</span>
      </button>
    )
  }

  return (
    <div
      className={`fixed ${
        maximized ? 'inset-8' : 'bottom-8 right-8 w-96'
      } bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden z-50 transition-all duration-300`}
    >
      <div className="bg-gradient-to-r from-kasgreen to-green-600 text-white p-4 flex justify-between items-center">
        <h3 className="font-bold text-lg">𐤊Party Chat v1.0</h3>
        <div className="flex gap-2">
          <button onClick={() => setMaximized(!maximized)}>
            <Minus size={20} />
          </button>
          <button onClick={() => setOpen(false)}>
            <X size={20} />
          </button>
        </div>
      </div>
      <div className="p-4 h-96 flex flex-col">
        {!userAddress ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <p className="text-center text-gray-600 dark:text-gray-300">
              Connect Kasware wallet to join chat<br />(Minimum 1 KAS to prevent spam)
            </p>
            <button
              onClick={connectWallet}
              className="bg-kasgreen text-white px-8 py-3 rounded-xl font-bold hover:bg-kasgreen/90 transition"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto flex flex-col-reverse pb-2">
              <div ref={messagesEndRef} />
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`my-2 ${m.user_address === userAddress ? 'text-right' : 'text-left'}`}
                >
                  <div
                    className={`inline-block max-w-xs p-3 rounded-2xl ${
                      m.user_address === userAddress
                        ? 'bg-kasgreen text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    <div className="text-xs opacity-70">
                      {m.user_address.slice(0, 8)}...
                    </div>
                    <div>{m.content}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && send()}
                placeholder="Type your message..."
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-kasgreen"
              />
              <button
                onClick={send}
                className="bg-kasgreen text-white px-6 py-3 rounded-xl font-bold hover:bg-kasgreen/90 transition"
              >
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}