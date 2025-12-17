import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { X, Maximize2, Minimize2, Send, Wallet, MessageSquare, User, Loader2, ExternalLink, RefreshCw } from 'lucide-react'

declare global {
  interface Window {
    kasware?: {
      requestAccounts: () => Promise<string[]>
      getAccounts: () => Promise<string[]>
      getBalance: () => Promise<{ total: number }>
      on: (event: string, callback: (accounts: string[]) => void) => void
    }
  }
}

const MIN_KAS_BALANCE = 100000000
const MESSAGES_PER_PAGE = 50

interface Message {
  id: number
  user_address: string
  content: string
  created_at: string
  timestamp?: string
}

interface UserStatus {
  address: string
  last_seen: string
  online: boolean
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const [userAddress, setUserAddress] = useState<string | null>(null)
  const [userBalance, setUserBalance] = useState<number>(0)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [connectedUsers, setConnectedUsers] = useState<UserStatus[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const [, setTyping] = useState(false)
  const [typingUsers, ] = useState<string[]>([])
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const presenceRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const formatAddress = (addr: string): string => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const connectWallet = async (): Promise<void> => {
    try {
      setLoading(true)
      if (!window.kasware) {
        throw new Error('Kasware wallet not detected. Please install the extension.')
      }
      
      const accounts = await window.kasware.requestAccounts()
      const addr = accounts[0]
      if (!addr) {
        throw new Error('No account found.')
      }

      const balance = await window.kasware.getBalance()
      setUserBalance(balance.total)
      
      if (balance.total < MIN_KAS_BALANCE) {
        throw new Error('Insufficient KAS balance. Need at least 1 KAS.')
      }

      setUserAddress(addr)
      setConnectionStatus('connecting')
      
      await loadMessages(true)
      await subscribeToRealtime()
      await updatePresence()
      
      setConnectionStatus('connected')
      
      if (window.kasware.on) {
        window.kasware.on('accountsChanged', (accounts: string[]) => {
          if (accounts[0]) {
            setUserAddress(accounts[0])
          } else {
            handleDisconnect()
          }
        })
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error connecting wallet.')
      setConnectionStatus('disconnected')
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async (reset = false): Promise<void> => {
    if (loading && !reset) return
    
    setLoading(true)
    const currentPage = reset ? 0 : page
    const from = currentPage * MESSAGES_PER_PAGE
    
    const { data, error } = await supabase
      .from('messages')
      .select('id, user_address, content, created_at')
      .order('created_at', { ascending: false })
      .range(from, from + MESSAGES_PER_PAGE - 1)
    
    if (error) {
      console.error('Error loading messages:', error)
    } else if (data) {
      const newMessages = (data as Message[]).reverse()
      
      if (reset) {
        setMessages(newMessages)
        setPage(1)
      } else {
        setMessages(prev => [...newMessages, ...prev])
        setPage(prev => prev + 1)
      }
      
      setHasMore(data.length === MESSAGES_PER_PAGE)
    }
    
    setLoading(false)
  }

  const subscribeToRealtime = async (): Promise<void> => {
    if (subscriptionRef.current) {
      await supabase.removeChannel(subscriptionRef.current)
    }

    subscriptionRef.current = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          const newMessage = payload.new as Message
          setMessages(prev => [...prev, newMessage])
          
          if (newMessage.user_address !== userAddress) {
            const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-message-pop-alert-2354.mp3')
            audio.volume = 0.3
            audio.play().catch(() => {})
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected')
        }
      })
  }

  const updatePresence = async (): Promise<void> => {
    if (!userAddress) return
    
    if (presenceRef.current) {
      await supabase.removeChannel(presenceRef.current)
    }

    presenceRef.current = supabase
      .channel('online-users')
      .on(
        'presence',
        { event: 'sync' },
        () => {
          if (!presenceRef.current) return
          const state = presenceRef.current.presenceState<Record<string, { address: string; online_at: string }>>()
          const users = Object.keys(state).map(key => ({
            address: key,
            last_seen: new Date().toISOString(),
            online: true
          }))
          setConnectedUsers(users)
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && presenceRef.current) {
          await presenceRef.current.track({ 
            address: userAddress,
            online_at: new Date().toISOString() 
          })
        }
      })
  }

  const handleTyping = useCallback(() => {
    if (!userAddress) return
    
    setTyping(true)
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false)
    }, 3000)
  }, [userAddress])

  const sendMessage = async (): Promise<void> => {
    if (!input.trim() || !userAddress || sending) return
    
    const messageContent = input.trim()
    setSending(true)
    setTyping(false)
    
    try {
      const optimisticId = Date.now()
      const optimisticMessage: Message = {
        id: optimisticId,
        user_address: userAddress,
        content: messageContent,
        created_at: new Date().toISOString(),
        timestamp: new Date().toISOString()
      }
      
      setMessages(prev => [...prev, optimisticMessage])
      setInput('')
      
      const { error } = await supabase
        .from('messages')
        .insert({
          user_address: userAddress,
          content: messageContent
        })
      
      if (error) {
        setMessages(prev => prev.filter(m => m.id !== optimisticId))
        throw error
      }
      
      inputRef.current?.focus()
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const handleDisconnect = (): void => {
    setUserAddress(null)
    setUserBalance(0)
    setMessages([])
    setConnectionStatus('disconnected')
    
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current)
      subscriptionRef.current = null
    }
    
    if (presenceRef.current) {
      supabase.removeChannel(presenceRef.current)
      presenceRef.current = null
    }
  }

  const handleScroll = (): void => {
    if (!messagesContainerRef.current || loading || !hasMore) return
    
    const container = messagesContainerRef.current
    if (container.scrollTop === 0) {
      loadMessages()
    }
  }

  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      const container = messagesContainerRef.current
      const isNearBottom = container ? 
        container.scrollHeight - container.clientHeight - container.scrollTop < 100 : true
      
      if (isNearBottom) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [messages])

  useEffect(() => {
    if (connectionStatus === 'connected') {
      const interval = setInterval(async () => {
        const { data } = await supabase
          .from('users')
          .select('address, last_seen, online')
          .eq('online', true)
        
        if (data) {
          setConnectedUsers(data as UserStatus[])
        }
      }, 30000)
      
      return () => clearInterval(interval)
    }
  }, [connectionStatus])

  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
      }
      if (presenceRef.current) {
        supabase.removeChannel(presenceRef.current)
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-kasgreen to-green-600 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all duration-300 z-50 group"
        aria-label="Open chat"
      >
        <div className="relative">
          <MessageSquare size={28} className="text-white" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
        </div>
        <div className="absolute -top-12 right-0 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
          Join KASPA Chat
        </div>
      </button>
    )
  }

  return (
    <div className={`fixed z-50 ${maximized ? 'inset-0 md:inset-4' : 'bottom-4 right-4 md:bottom-6 md:right-6 w-full md:w-[400px] h-[600px] md:h-[600px]'} transition-all duration-300`}>
      <div className="relative w-full h-full">
        <div className="absolute inset-0 bg-gradient-to-br from-kasgreen/20 to-purple-500/20 rounded-3xl blur-xl"></div>
        
        <div className="relative h-full bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 flex flex-col">
          
          <div className="bg-gradient-to-r from-kasgreen via-green-500 to-emerald-600 text-white p-5 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <MessageSquare size={24} />
              </div>
              <div>
                <h3 className="font-bold text-xl">𐤊 Party Chat</h3>
                <div className="flex items-center gap-2 text-sm opacity-90">
                  <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-400 animate-pulse' : connectionStatus === 'connecting' ? 'bg-yellow-400' : 'bg-red-400'}`}></div>
                  <span>
                    {connectionStatus === 'connected' && `${connectedUsers.length} online`}
                    {connectionStatus === 'connecting' && 'Connecting...'}
                    {connectionStatus === 'disconnected' && 'Disconnected'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMaximized(!maximized)}
                className="p-2 hover:bg-white/20 rounded-xl transition"
                aria-label={maximized ? "Minimize" : "Maximize"}
              >
                {maximized ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-2 hover:bg-white/20 rounded-xl transition"
                aria-label="Close chat"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            {!userAddress ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
                <div className="text-center">
                  <div className="text-6xl mb-4">💬</div>
                  <h4 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">
                    Welcome to KASPA Chat
                  </h4>
                  <p className="text-gray-600 dark:text-gray-300 mb-2">
                    Connect your Kasware wallet to join the conversation
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Minimum 1 KAS required to prevent spam
                  </p>
                </div>
                
                <button
                  onClick={connectWallet}
                  disabled={loading}
                  className="group relative overflow-hidden bg-gradient-to-r from-kasgreen to-green-600 text-white px-10 py-4 rounded-xl font-bold hover:shadow-xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="flex items-center gap-3">
                      <Loader2 size={20} className="animate-spin" />
                      Connecting...
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Wallet size={20} />
                      Connect Kasware Wallet
                      <ExternalLink size={16} className="opacity-80" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                </button>

                <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <div className="text-2xl font-bold text-kasgreen">50+</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Active Users</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <div className="text-2xl font-bold text-kasgreen">24/7</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Live Chat</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <div className="text-2xl font-bold text-kasgreen">⚡</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Real-time</div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-kasgreen/20 to-green-500/20 rounded-xl">
                      <User size={20} className="text-kasgreen" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white">
                        {formatAddress(userAddress)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Balance: {(userBalance / 100000000).toFixed(2)} KAS
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleDisconnect}
                    className="px-4 py-2 text-sm bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg transition"
                  >
                    Disconnect
                  </button>
                </div>

                <div 
                  ref={messagesContainerRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto p-4 flex flex-col gap-4"
                >
                  {hasMore && messages.length >= MESSAGES_PER_PAGE && (
                    <div className="text-center py-4">
                      <button
                        onClick={() => loadMessages()}
                        disabled={loading}
                        className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center gap-2 mx-auto hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                      >
                        {loading ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <RefreshCw size={14} />
                            Load older messages
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.user_address === userAddress ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 ${message.user_address === userAddress
                          ? 'bg-gradient-to-r from-kasgreen to-green-500 text-white rounded-br-none'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-none'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className={`text-xs font-medium ${message.user_address === userAddress ? 'text-green-100' : 'text-gray-500 dark:text-gray-400'}`}>
                            {formatAddress(message.user_address)}
                          </div>
                          <div className={`text-xs ${message.user_address === userAddress ? 'text-green-100' : 'text-gray-500 dark:text-gray-400'}`}>
                            {formatTime(message.created_at)}
                          </div>
                        </div>
                        <div className="break-words">{message.content}</div>
                      </div>
                    </div>
                  ))}

                  {typingUsers.length > 0 && (
                    <div className="flex justify-start">
                      <div className="max-w-[75%] rounded-2xl p-4 bg-gray-100 dark:bg-gray-800">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-300"></div>
                          </div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {typingUsers.length > 1 ? 'Multiple users typing...' : `${formatAddress(typingUsers[0])} typing...`}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                  <div className="flex gap-3">
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value)
                        handleTyping()
                      }}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Type your message..."
                      className="flex-1 px-5 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-kasgreen transition"
                      disabled={sending}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!input.trim() || sending}
                      className="bg-gradient-to-r from-kasgreen to-green-600 text-white p-3 rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      {sending ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : (
                        <Send size={20} />
                      )}
                    </button>
                  </div>
                  
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <div>
                      {connectedUsers.length > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-2">
                            {connectedUsers.slice(0, 3).map((user, idx) => (
                              <div
                                key={user.address}
                                className="w-6 h-6 rounded-full bg-gradient-to-r from-kasgreen/30 to-green-500/30 border-2 border-white dark:border-gray-900 flex items-center justify-center text-xs"
                                style={{ zIndex: 3 - idx }}
                              >
                                {user.address.slice(2, 4)}
                              </div>
                            ))}
                          </div>
                          <span>{connectedUsers.length} online</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      Press Enter to send
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}