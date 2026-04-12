import { useState, useEffect } from 'react'
import { MessageSquare, ChevronRight, ThumbsUp, Eye, Clock, Pin, Tag, Search, Plus, ArrowLeft, Send, User, Flame, Mail, LogIn, LogOut, CheckCircle, AlertCircle, ExternalLink, Loader2 } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

// ─── Supabase (same project as KasMail) ──────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
)

// ─── Email via rapid-worker edge function ─────────────────────────────────
const SEND_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rapid-worker`

async function sendVerificationEmail(to: string, code: string, type: 'register' | 'login' | 'resend'): Promise<void> {
  const subject = type === 'login'
    ? 'Kasparty Forums - Sign-in code'
    : 'Kasparty Forums - Your verification code'
  const body =
    `Kasparty Forums Verification\n\nYour ${type === 'login' ? 'sign-in' : 'verification'} code is:\n\n${code}\n\nExpires in 10 minutes. Do not share it.`

  const username = to.split('@')[0]

  // Look up the recipient's wallet address so we can write directly to their inbox
  const { data: profile } = await supabase
    .from('profiles')
    .select('wallet_address')
    .eq('username', username)
    .single()

  if (!profile?.wallet_address) {
    throw new Error(`No KasMail account found for ${to}.`)
  }

  // Call rapid-worker (creates outgoing record + audit trail)
  const res = await fetch(SEND_FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify({ from: 'verify@kasmail.org', to, subject, text: body }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || err.details || `HTTP ${res.status}`)
  }

  // The rapid-worker creates the inbox copy with an empty body — fix it by
  // finding that record and updating it with the real content.
  const { data: broken } = await supabase
    .from('emails')
    .select('id')
    .eq('from_wallet', 'external:verify@kasmail.org')
    .eq('to_wallet', profile.wallet_address)
    .eq('body', '(No content)')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (broken?.id) {
    await supabase
      .from('emails')
      .update({ body })
      .eq('id', broken.id)
  }
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// ─── Session (localStorage — survives page refresh) ───────────────────────
const SESSION_KEY = 'kasparty_forum_user'

interface ForumUser {
  kasmail_username: string
  display_name: string
}

function saveSession(user: ForumUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
}
function loadSession(): ForumUser | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') }
  catch { return null }
}
function clearSession() { localStorage.removeItem(SESSION_KEY) }

// ─── Data types ───────────────────────────────────────────────────────────
interface Post {
  id: number; title: string; author: string; authorShort: string
  content: string; replies: Reply[]; views: number; likes: number
  createdAt: string; pinned?: boolean; tags: string[]
}
interface Reply {
  id: number; author: string; authorShort: string
  content: string; createdAt: string; likes: number
}
interface Category {
  id: string; name: string; description: string
  icon: string; color: string; posts: Post[]
}

const INITIAL_CATEGORIES: Category[] = [
  {
    id: 'general', name: 'General Discussion',
    description: 'Anything and everything about Kaspa and Kasparty',
    icon: '💬', color: 'from-kasgreen/20 to-green-500/10',
    posts: [
      {
        id: 1, title: 'Welcome to the Kasparty Forums! 🎉',
        author: 'kaspa:qz3xr...7f2k', authorShort: 'qz3x',
        content: `Welcome to the official Kasparty community forums! This is your place to discuss everything Kaspa, share token discoveries, post upcoming events, and connect with the community.\n\nA few ground rules:\n- Be respectful and constructive\n- No spam or self-promotion without community value\n- DYOR — nothing here is financial advice\n- Have fun and support the KAS ecosystem!\n\nHappy posting 🚀`,
        replies: [
          { id: 1, author: 'kaspa:qp9mn...3a1b', authorShort: 'qp9m', content: 'Awesome to see forums added! This is exactly what the community needed.', createdAt: '2026-03-25T10:30:00Z', likes: 12 },
          { id: 2, author: 'kaspa:qr7ks...8d4c', authorShort: 'qr7k', content: "Let's get the discussions going. Kaspa to the moon 🌕", createdAt: '2026-03-25T11:45:00Z', likes: 8 },
        ],
        views: 312, likes: 47, createdAt: '2026-03-24T09:00:00Z', pinned: true, tags: ['announcement', 'welcome'],
      },
      {
        id: 2, title: 'What got you into Kaspa? Share your story',
        author: 'kaspa:qm5xt...2p9w', authorShort: 'qm5x',
        content: 'Curious to hear how everyone found their way into the KAS ecosystem. Was it the tech? The community? A specific token launch? Drop your story below 👇',
        replies: [
          { id: 1, author: 'kaspa:qn2fs...6r3e', authorShort: 'qn2f', content: 'Found it through a Reddit post about GHOSTDAG. The tech immediately blew my mind — blockDAG was a genuinely new idea.', createdAt: '2026-03-26T08:10:00Z', likes: 15 },
          { id: 2, author: 'kaspa:qk8vl...1j7y', authorShort: 'qk8v', content: 'Honestly? Someone in a Telegram group mentioned it and I spent 3 days going down the rabbit hole. Never looked back.', createdAt: '2026-03-26T09:22:00Z', likes: 9 },
          { id: 3, author: 'kaspa:qt4bp...5m2d', authorShort: 'qt4b', content: 'Mining! Started mining KAS early and stayed for the community.', createdAt: '2026-03-26T12:05:00Z', likes: 6 },
        ],
        views: 189, likes: 31, createdAt: '2026-03-26T07:00:00Z', tags: ['community', 'introductions'],
      },
    ],
  },
  {
    id: 'tokens', name: 'KRC-20 Tokens',
    description: 'Discuss KRC-20 token launches, analysis, and gems',
    icon: '🪙', color: 'from-yellow-400/20 to-amber-500/10',
    posts: [
      {
        id: 3, title: 'How to evaluate a new KRC-20 token before aping in',
        author: 'kaspa:qd6yw...9c5a', authorShort: 'qd6y',
        content: `With so many new KRC-20 tokens launching every week, it's easy to get caught up in the hype. Here's my personal checklist:\n\n1. **Check the mint supply** — Is most of the supply already minted by insiders?\n2. **Holder distribution** — Are the top 10 wallets holding >50%? Red flag.\n3. **Community activity** — Is there a real Telegram/Discord or just bots?\n4. **Use case** — Does it solve something or is it pure speculation?\n5. **Dev transparency** — Are the devs known or anonymous with no track record?\n\nNone of this is financial advice. DYOR always.`,
        replies: [
          { id: 1, author: 'kaspa:qh1ct...4v8x', authorShort: 'qh1c', content: "Great list. I'd add: check how long the mint phase lasted. Tokens that minted out in under an hour often have very uneven distribution.", createdAt: '2026-03-25T15:00:00Z', likes: 22 },
          { id: 2, author: 'kaspa:qj9rs...7b2f', authorShort: 'qj9r', content: 'Also look at whether liquidity is locked. Unlocked LP is a major rug risk.', createdAt: '2026-03-25T16:30:00Z', likes: 18 },
        ],
        views: 445, likes: 62, createdAt: '2026-03-25T14:00:00Z', pinned: true, tags: ['dyor', 'krc20', 'guide'],
      },
      {
        id: 4, title: 'Which KRC-20 tokens are you watching this week?',
        author: 'kaspa:ql3vz...8e1b', authorShort: 'ql3v',
        content: "Weekly thread — drop your watchlist tokens and why you're watching them. Not financial advice, just community discussion!",
        replies: [
          { id: 1, author: 'kaspa:qo7mx...2a4c', authorShort: 'qo7m', content: 'Watching KANGO and NACHO closely. Both have active devs and real community engagement.', createdAt: '2026-03-27T10:00:00Z', likes: 7 },
        ],
        views: 203, likes: 28, createdAt: '2026-03-27T09:00:00Z', tags: ['watchlist', 'weekly'],
      },
    ],
  },
  {
    id: 'events', name: 'Events & Parties',
    description: 'Upcoming Kaspa events, AMAs, and community parties',
    icon: '🎉', color: 'from-purple-500/20 to-pink-500/10',
    posts: [
      {
        id: 5, title: '[AMA] Kasparty Dev Team — Submit your questions here',
        author: 'kaspa:qz3xr...7f2k', authorShort: 'qz3x',
        content: "We're hosting a community AMA next Saturday! Drop your questions in the replies and we'll answer the top-voted ones live.\n\nTopics we can cover:\n- Roadmap updates\n- Chat & Forums features\n- Token leaderboard mechanics\n- Community governance plans\n\nUpvote the questions you want answered most!",
        replies: [
          { id: 1, author: 'kaspa:qw2nt...6k9s', authorShort: 'qw2n', content: 'Q: Will there be wallet-gated event tickets on Kasparty?', createdAt: '2026-03-26T14:00:00Z', likes: 34 },
          { id: 2, author: 'kaspa:qe5pv...3m7r', authorShort: 'qe5p', content: 'Q: Any plans for a Kasparty mobile app?', createdAt: '2026-03-26T15:30:00Z', likes: 27 },
          { id: 3, author: 'kaspa:qi8lk...1d6t', authorShort: 'qi8l', content: 'Q: How is the 1 KAS minimum working out for preventing spam?', createdAt: '2026-03-26T17:00:00Z', likes: 19 },
        ],
        views: 578, likes: 89, createdAt: '2026-03-26T12:00:00Z', pinned: true, tags: ['ama', 'official', 'community'],
      },
    ],
  },
  {
    id: 'tech', name: 'Tech & Dev',
    description: 'Technical discussions, building on Kaspa, developer resources',
    icon: '⚙️', color: 'from-blue-500/20 to-cyan-500/10',
    posts: [
      {
        id: 6, title: 'Resources for building on Kaspa — the definitive list',
        author: 'kaspa:qa1uc...5h8j', authorShort: 'qa1u',
        content: `Compiling the best resources for devs getting into the Kaspa ecosystem:\n\n**Official**\n- kaspa.org — Main site\n- github.com/kaspanet — Core repos\n- docs.kas.pa — Developer docs\n\n**Community**\n- KRC-20 API: krc20.kaspa.org\n- Kaspa REST API: api.kaspa.org\n\n**SDKs**\n- kaspa-wasm (Rust → WASM): github.com/kaspanet/rusty-kaspa\n- kaspa-js: community maintained\n\nAdd anything I've missed below!`,
        replies: [
          { id: 1, author: 'kaspa:qb4gh...2n1p', authorShort: 'qb4g', content: 'Great list! Also worth checking the #dev channel in the official Kaspa Discord.', createdAt: '2026-03-24T16:00:00Z', likes: 11 },
        ],
        views: 267, likes: 38, createdAt: '2026-03-24T15:00:00Z', pinned: true, tags: ['resources', 'development', 'guide'],
      },
    ],
  },
]

type View = 'categories' | 'category' | 'post' | 'new-post'
type AuthView = 'none' | 'register' | 'verify' | 'login'

export default function Forums() {
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES)
  const [view, setView] = useState<View>('categories')
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [replyText, setReplyText] = useState('')
  const [newPostTitle, setNewPostTitle] = useState('')
  const [newPostContent, setNewPostContent] = useState('')
  const [newPostTag, setNewPostTag] = useState('')
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set())
  const [likedReplies, setLikedReplies] = useState<Set<number>>(new Set())

  // Auth
  const [currentUser, setCurrentUser] = useState<ForumUser | null>(null)
  const [authView, setAuthView] = useState<AuthView>('none')
  const [regEmail, setRegEmail] = useState('')
  const [regUsername, setRegUsername] = useState('')
  const [regError, setRegError] = useState('')
  const [regSuccess, setRegSuccess] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginError, setLoginError] = useState('')
  const [verifyInput, setVerifyInput] = useState('')
  const [verifyError, setVerifyError] = useState('')
  const [codeSending, setCodeSending] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')
  const [pendingUsername, setPendingUsername] = useState('')
  const [isLoginFlow, setIsLoginFlow] = useState(false)

  // Restore session on mount
  useEffect(() => {
    const saved = loadSession()
    if (saved) setCurrentUser(saved)
  }, [])

  const totalPosts = categories.reduce((sum, c) => sum + c.posts.length, 0)
  const totalReplies = categories.reduce((sum, c) => sum + c.posts.reduce((s, p) => s + p.replies.length, 0), 0)

  const formatDate = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  const handleLikePost = (postId: number) => {
    if (likedPosts.has(postId)) return
    setLikedPosts(prev => new Set([...prev, postId]))
    setCategories(prev => prev.map(cat => ({ ...cat, posts: cat.posts.map(p => p.id === postId ? { ...p, likes: p.likes + 1 } : p) })))
    if (selectedPost?.id === postId) setSelectedPost(prev => prev ? { ...prev, likes: prev.likes + 1 } : prev)
  }

  const handleLikeReply = (postId: number, replyId: number) => {
    if (likedReplies.has(replyId)) return
    setLikedReplies(prev => new Set([...prev, replyId]))
    setCategories(prev => prev.map(cat => ({ ...cat, posts: cat.posts.map(p => p.id === postId ? { ...p, replies: p.replies.map(r => r.id === replyId ? { ...r, likes: r.likes + 1 } : r) } : p) })))
    if (selectedPost?.id === postId) setSelectedPost(prev => prev ? { ...prev, replies: prev.replies.map(r => r.id === replyId ? { ...r, likes: r.likes + 1 } : r) } : prev)
  }

  const handleSubmitReply = () => {
    if (!replyText.trim() || !selectedPost || !selectedCategory) return
    const newReply: Reply = {
      id: Date.now(),
      author: currentUser ? `${currentUser.kasmail_username}@kasmail.org` : 'anonymous',
      authorShort: currentUser ? currentUser.kasmail_username.slice(0, 4) : 'anon',
      content: replyText.trim(), createdAt: new Date().toISOString(), likes: 0,
    }
    const updatedPost = { ...selectedPost, replies: [...selectedPost.replies, newReply] }
    setSelectedPost(updatedPost)
    setCategories(prev => prev.map(cat => cat.id === selectedCategory.id ? { ...cat, posts: cat.posts.map(p => p.id === selectedPost.id ? updatedPost : p) } : cat))
    setReplyText('')
  }

  const handleCreatePost = () => {
    if (!newPostTitle.trim() || !newPostContent.trim() || !selectedCategory) return
    const newPost: Post = {
      id: Date.now(),
      title: newPostTitle.trim(),
      author: currentUser ? `${currentUser.kasmail_username}@kasmail.org` : 'anonymous',
      authorShort: currentUser ? currentUser.kasmail_username.slice(0, 4) : 'anon',
      content: newPostContent.trim(), replies: [], views: 1, likes: 0,
      createdAt: new Date().toISOString(),
      tags: newPostTag.trim() ? [newPostTag.trim().toLowerCase()] : [],
    }
    setCategories(prev => prev.map(cat => cat.id === selectedCategory.id ? { ...cat, posts: [newPost, ...cat.posts] } : cat))
    setNewPostTitle(''); setNewPostContent(''); setNewPostTag('')
    setView('category')
  }

  // ── REGISTER: verify kasmail exists → store code → send email ────────────
  const handleSendCode = async () => {
    setRegError('')
    const email = regEmail.trim().toLowerCase()
    const username = email.endsWith('@kasmail.org') ? email.split('@')[0] : ''
    const displayName = regUsername.trim()

    if (!email.endsWith('@kasmail.org')) {
      setRegError('Only @kasmail.org addresses are accepted.')
      return
    }
    if (!displayName || displayName.length < 3) {
      setRegError('Display name must be at least 3 characters.')
      return
    }
    if (displayName.length > 20) {
      setRegError('Display name must be 20 characters or fewer.')
      return
    }

    setCodeSending(true)
    try {
      // 1. Confirm kasmail account exists
      const { data: kasmailProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .single()

      if (!kasmailProfile) {
        setRegError(`No KasMail account found for ${email}. Get one at kasmail.org first.`)
        return
      }

      // 2. Check not already registered
      const { data: existing } = await supabase
        .from('forum_users')
        .select('kasmail_username')
        .eq('kasmail_username', username)
        .single()

      if (existing) {
        setRegError('Already registered. Sign in instead.')
        return
      }

      // 3. Upsert verification code with 10-min expiry
      const code = generateCode()
      const { error: upsertErr } = await supabase
        .from('forum_verification_codes')
        .upsert(
          { kasmail_username: username, code, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
          { onConflict: 'kasmail_username' }
        )
      if (upsertErr) throw new Error('Failed to store code.')

      // 4. Send email
      await sendVerificationEmail(email, code, 'register')

      setPendingEmail(email)
      setPendingUsername(displayName)
      setIsLoginFlow(false)
      setAuthView('verify')
    } catch (err) {
      setRegError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setCodeSending(false)
    }
  }

  // ── VERIFY ────────────────────────────────────────────────────────────────
  const handleVerifyCode = async () => {
    setVerifyError('')
    const username = pendingEmail.split('@')[0]
    try {
      const { data, error } = await supabase
        .from('forum_verification_codes')
        .select('code, expires_at')
        .eq('kasmail_username', username)
        .single()

      if (error || !data) { setVerifyError('Code not found. Request a new one.'); return }
      if (new Date(data.expires_at) < new Date()) { setVerifyError('Code expired. Request a new one.'); return }
      if (verifyInput.trim() !== data.code) { setVerifyError('Incorrect code. Check your kasmail inbox.'); return }

      // Delete used code
      await supabase.from('forum_verification_codes').delete().eq('kasmail_username', username)

      let displayName = pendingUsername

      if (!isLoginFlow) {
        // Create forum account
        await supabase.from('forum_users').insert({ kasmail_username: username, display_name: displayName })
      } else {
        // Fetch stored display name for login
        const { data: userData } = await supabase
          .from('forum_users').select('display_name').eq('kasmail_username', username).single()
        if (userData?.display_name) displayName = userData.display_name
      }

      const user: ForumUser = { kasmail_username: username, display_name: displayName }
      saveSession(user)
      setCurrentUser(user)
      setRegSuccess(`Welcome${isLoginFlow ? ' back' : ''}, ${displayName}!`)
      setAuthView('none')
      setRegEmail(''); setRegUsername(''); setVerifyInput('')
      setPendingEmail(''); setPendingUsername('')
      setTimeout(() => setRegSuccess(''), 3000)
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Verification failed. Try again.')
    }
  }

  // ── RESEND ────────────────────────────────────────────────────────────────
  const handleResendCode = async () => {
    if (!pendingEmail) return
    setVerifyError('')
    const username = pendingEmail.split('@')[0]
    const code = generateCode()
    try {
      await supabase.from('forum_verification_codes').upsert(
        { kasmail_username: username, code, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
        { onConflict: 'kasmail_username' }
      )
      await sendVerificationEmail(pendingEmail, code, 'resend')
      setVerifyInput('')
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Could not resend. Try again.')
    }
  }

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setLoginError('')
    const email = loginEmail.trim().toLowerCase()
    const username = email.endsWith('@kasmail.org') ? email.split('@')[0] : ''

    if (!email.endsWith('@kasmail.org')) {
      setLoginError('Please enter your @kasmail.org address.')
      return
    }

    setCodeSending(true)
    try {
      // 1. Confirm kasmail account exists
      const { data: kasmailProfile } = await supabase
        .from('profiles').select('username').eq('username', username).single()
      if (!kasmailProfile) {
        setLoginError(`No KasMail account found for ${email}.`)
        return
      }

      // 2. Confirm forum account exists
      const { data: forumUser } = await supabase
        .from('forum_users').select('kasmail_username').eq('kasmail_username', username).single()
      if (!forumUser) {
        setLoginError('No forum account found. Please register first.')
        return
      }

      // 3. Send code
      const code = generateCode()
      await supabase.from('forum_verification_codes').upsert(
        { kasmail_username: username, code, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
        { onConflict: 'kasmail_username' }
      )
      await sendVerificationEmail(email, code, 'login')

      setPendingEmail(email)
      setPendingUsername(username)
      setIsLoginFlow(true)
      setAuthView('verify')
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Failed to send sign-in code.')
    } finally {
      setCodeSending(false)
    }
  }

  const handleLogout = () => { clearSession(); setCurrentUser(null) }

  const requireAuth = (action: () => void) => {
    if (!currentUser) { setAuthView('register'); return }
    action()
  }

  const searchResults = searchQuery.length > 2
    ? categories.flatMap(cat => cat.posts
        .filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.content.toLowerCase().includes(searchQuery.toLowerCase()))
        .map(p => ({ post: p, category: cat })))
    : []

  return (
    <section id="forums" className="py-16 px-4 sm:px-6 max-w-5xl mx-auto">

      {/* ── REGISTER ── */}
      {authView === 'register' && (
        <div className="max-w-lg mx-auto">
          <button onClick={() => { setAuthView('none'); setRegError('') }}
            className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-kasgreen transition text-sm font-medium mb-8">
            <ArrowLeft size={16} /> Back to Forums
          </button>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg">
            <div className="text-center mb-7">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-kasgreen/10 mb-4">
                <Mail size={30} className="text-kasgreen" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create your account</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Requires an active @kasmail.org address</p>
            </div>
            <div className="bg-kasgreen/5 border border-kasgreen/20 rounded-xl p-4 mb-6">
              <p className="text-sm font-semibold text-kasgreen mb-1">Need a @kasmail.org address?</p>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">KasMail keeps the forums spam-free. Get your free address first.</p>
              <a href="https://kasmail.org" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-bold text-white bg-kasgreen px-4 py-2 rounded-lg hover:bg-green-600 transition">
                <ExternalLink size={14} /> Get your free @kasmail.org address
              </a>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kasmail Address</label>
                <input type="email" value={regEmail} onChange={e => { setRegEmail(e.target.value); setRegError('') }}
                  placeholder="you@kasmail.org"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-kasgreen text-gray-900 dark:text-white placeholder-gray-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name</label>
                <input type="text" value={regUsername} onChange={e => { setRegUsername(e.target.value); setRegError('') }}
                  placeholder="KaspaWhale" maxLength={20}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-kasgreen text-gray-900 dark:text-white placeholder-gray-400" />
                <p className="text-xs text-gray-400 mt-1">3–20 characters, shown on your posts</p>
              </div>
              {regError && (
                <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" /> {regError}
                </div>
              )}
              <button onClick={handleSendCode} disabled={codeSending}
                className="w-full bg-kasgreen text-white py-3 rounded-xl font-bold hover:bg-green-600 transition disabled:opacity-50 flex items-center justify-center gap-2">
                {codeSending ? <><Loader2 size={18} className="animate-spin" /> Verifying & sending...</> : 'Send Verification Code'}
              </button>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                Already have an account?{' '}
                <button onClick={() => { setAuthView('login'); setRegError('') }} className="text-kasgreen font-semibold hover:underline">Sign in</button>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── VERIFY ── */}
      {authView === 'verify' && (
        <div className="max-w-lg mx-auto">
          <button onClick={() => { setAuthView(isLoginFlow ? 'login' : 'register'); setVerifyError('') }}
            className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-kasgreen transition text-sm font-medium mb-8">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-kasgreen/10 mb-4">
              <CheckCircle size={30} className="text-kasgreen" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Check your kasmail inbox</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">A 6-digit code was sent to:</p>
            <p className="font-semibold text-kasgreen mb-6">{pendingEmail}</p>
            <div className="text-left space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Verification Code</label>
                <input type="text" inputMode="numeric" maxLength={6} value={verifyInput}
                  onChange={e => { setVerifyInput(e.target.value.replace(/\D/g, '')); setVerifyError('') }}
                  placeholder="123456"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-kasgreen text-gray-900 dark:text-white placeholder-gray-400 text-center text-2xl tracking-widest font-mono" />
              </div>
              {verifyError && (
                <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" /> {verifyError}
                </div>
              )}
              <button onClick={handleVerifyCode} disabled={verifyInput.length < 6}
                className="w-full bg-kasgreen text-white py-3 rounded-xl font-bold hover:bg-green-600 transition disabled:opacity-50">
                {isLoginFlow ? 'Verify & Sign In' : 'Verify & Complete Registration'}
              </button>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                Didn't receive it?{' '}
                <button onClick={handleResendCode} className="text-kasgreen font-semibold hover:underline">Resend code</button>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── LOGIN ── */}
      {authView === 'login' && (
        <div className="max-w-lg mx-auto">
          <button onClick={() => { setAuthView('none'); setLoginError('') }}
            className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-kasgreen transition text-sm font-medium mb-8">
            <ArrowLeft size={16} /> Back to Forums
          </button>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg">
            <div className="text-center mb-7">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-kasgreen/10 mb-4">
                <LogIn size={30} className="text-kasgreen" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sign in</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">We'll send a one-time code to your kasmail inbox</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kasmail Address</label>
                <input type="email" value={loginEmail} onChange={e => { setLoginEmail(e.target.value); setLoginError('') }}
                  placeholder="you@kasmail.org"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-kasgreen text-gray-900 dark:text-white placeholder-gray-400" />
              </div>
              {loginError && (
                <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" /> {loginError}
                </div>
              )}
              <button onClick={handleLogin} disabled={codeSending}
                className="w-full bg-kasgreen text-white py-3 rounded-xl font-bold hover:bg-green-600 transition disabled:opacity-50 flex items-center justify-center gap-2">
                {codeSending ? <><Loader2 size={18} className="animate-spin" /> Sending code...</> : 'Send Sign-in Code'}
              </button>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                Don't have an account?{' '}
                <button onClick={() => { setAuthView('register'); setLoginError('') }} className="text-kasgreen font-semibold hover:underline">Register</button>
              </p>
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700 text-center">
                <a href="https://kasmail.org" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-kasgreen font-semibold hover:underline">
                  <ExternalLink size={12} /> Get a kasmail.org address
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN FORUMS ── */}
      {authView === 'none' && (<>

      {regSuccess && (
        <div className="flex items-center gap-2 text-sm text-kasgreen bg-kasgreen/10 rounded-xl p-3 mb-4">
          <CheckCircle size={16} /> {regSuccess}
        </div>
      )}

      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="p-3 bg-kasgreen/10 rounded-2xl"><MessageSquare size={28} className="text-kasgreen" /></div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">Community Forums</h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400 text-lg">Discuss, discover, and connect with the Kaspa community</p>
        <div className="flex items-center justify-center gap-6 mt-4 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1"><MessageSquare size={14} />{totalPosts} posts</span>
          <span className="flex items-center gap-1"><User size={14} />{totalReplies} replies</span>
          <span className="flex items-center gap-1"><Flame size={14} className="text-kasgreen" />Active community</span>
        </div>
      </div>

      {/* Auth bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 px-5 py-3">
        {currentUser ? (
          <>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-kasgreen to-green-500 flex items-center justify-center text-white text-xs font-bold">
                {currentUser.display_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <span className="font-semibold text-gray-900 dark:text-white text-sm">{currentUser.display_name}</span>
                <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{currentUser.kasmail_username}@kasmail.org</span>
              </div>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-500 transition font-medium">
              <LogOut size={15} /> Sign out
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1"><Mail size={14} className="text-kasgreen" /> Requires <span className="font-semibold text-kasgreen">@kasmail.org</span> to post</span>
              <a href="https://kasmail.org" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-kasgreen border border-kasgreen/30 px-2 py-1 rounded-lg hover:bg-kasgreen/10 transition">
                <ExternalLink size={11} /> Get kasmail
              </a>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setAuthView('login')} className="text-sm font-semibold text-kasgreen hover:underline">Sign in</button>
              <button onClick={() => setAuthView('register')} className="text-sm font-bold bg-kasgreen text-white px-4 py-2 rounded-xl hover:bg-green-600 transition">Register</button>
            </div>
          </>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search posts..."
          className="w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-kasgreen transition text-gray-900 dark:text-white placeholder-gray-400" />
      </div>

      {searchQuery.length > 2 && (
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"
          </div>
          {searchResults.length === 0
            ? <div className="p-8 text-center text-gray-500 dark:text-gray-400">No posts found.</div>
            : searchResults.map(({ post, category }) => (
              <button key={post.id}
                onClick={() => { setSelectedCategory(category); setSelectedPost(post); setView('post'); setSearchQuery('') }}
                className="w-full flex items-start gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition text-left border-b border-gray-100 dark:border-gray-700 last:border-0">
                <span className="text-xl mt-0.5">{category.icon}</span>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">{post.title}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{category.name} · {post.replies.length} replies</div>
                </div>
              </button>
            ))
          }
        </div>
      )}

      {/* Categories */}
      {view === 'categories' && (
        <div className="space-y-4">
          {categories.map(category => (
            <button key={category.id} onClick={() => { setSelectedCategory(category); setView('category') }}
              className="w-full group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-kasgreen/50 hover:shadow-lg transition-all duration-200 overflow-hidden text-left">
              <div className={`bg-gradient-to-r ${category.color} p-5 flex items-center gap-4`}>
                <span className="text-3xl">{category.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-kasgreen transition">{category.name}</h3>
                    <ChevronRight size={18} className="text-gray-400 group-hover:text-kasgreen group-hover:translate-x-1 transition-all" />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{category.description}</p>
                </div>
                <div className="hidden sm:flex flex-col items-end gap-1 text-sm text-gray-500 dark:text-gray-400 shrink-0">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">{category.posts.length} posts</span>
                  <span>{category.posts.reduce((s, p) => s + p.replies.length, 0)} replies</span>
                </div>
              </div>
              {category.posts.length > 0 && (
                <div className="px-5 py-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
                  <Clock size={13} />
                  <span className="truncate">Latest: <span className="text-gray-700 dark:text-gray-300 font-medium">{category.posts[0].title}</span></span>
                  <span className="shrink-0">{formatDate(category.posts[0].createdAt)}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Category posts */}
      {view === 'category' && selectedCategory && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setView('categories')}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-kasgreen transition text-sm font-medium">
              <ArrowLeft size={16} /> All Categories
            </button>
            <button onClick={() => requireAuth(() => setView('new-post'))}
              className="flex items-center gap-2 bg-kasgreen text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-green-600 transition">
              <Plus size={16} /> New Post
            </button>
          </div>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">{selectedCategory.icon}</span>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{selectedCategory.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{selectedCategory.description}</p>
            </div>
          </div>
          <div className="space-y-3">
            {selectedCategory.posts.map(post => (
              <button key={post.id} onClick={() => { setSelectedPost(post); setView('post') }}
                className="w-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-kasgreen/50 hover:shadow-md transition-all duration-200 p-5 text-left group">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {post.pinned && (
                        <span className="inline-flex items-center gap-1 text-xs bg-kasgreen/10 text-kasgreen px-2 py-0.5 rounded-full font-semibold">
                          <Pin size={10} /> Pinned
                        </span>
                      )}
                      {post.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                          <Tag size={10} /> {tag}
                        </span>
                      ))}
                    </div>
                    <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-kasgreen transition text-base leading-snug">{post.title}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">{post.content.slice(0, 120)}...</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400 dark:text-gray-500">
                      <span className="flex items-center gap-1"><User size={12} />{post.authorShort}</span>
                      <span className="flex items-center gap-1"><Clock size={12} />{formatDate(post.createdAt)}</span>
                      <span className="flex items-center gap-1"><Eye size={12} />{post.views}</span>
                      <span className="flex items-center gap-1"><ThumbsUp size={12} />{post.likes}</span>
                      <span className="flex items-center gap-1 text-kasgreen font-semibold"><MessageSquare size={12} />{post.replies.length} replies</span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-gray-300 group-hover:text-kasgreen shrink-0 mt-1 transition" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Post detail */}
      {view === 'post' && selectedPost && selectedCategory && (
        <div>
          <button onClick={() => setView('category')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-kasgreen transition text-sm font-medium mb-6">
            <ArrowLeft size={16} /> {selectedCategory.name}
          </button>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-4">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {selectedPost.pinned && (
                <span className="inline-flex items-center gap-1 text-xs bg-kasgreen/10 text-kasgreen px-2 py-0.5 rounded-full font-semibold">
                  <Pin size={10} /> Pinned
                </span>
              )}
              {selectedPost.tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
                  <Tag size={10} /> {tag}
                </span>
              ))}
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{selectedPost.title}</h3>
            <div className="flex items-center gap-3 mb-5 pb-5 border-b border-gray-100 dark:border-gray-700">
              <div className="w-9 h-9 rounded-full bg-gradient-to-r from-kasgreen to-green-500 flex items-center justify-center text-white text-xs font-bold">
                {selectedPost.authorShort.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{selectedPost.author}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{formatDate(selectedPost.createdAt)}</div>
              </div>
              <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><Eye size={14} />{selectedPost.views}</span>
              </div>
            </div>
            <div className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line mb-6">{selectedPost.content}</div>
            <button onClick={() => handleLikePost(selectedPost.id)}
              className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl transition font-medium ${likedPosts.has(selectedPost.id) ? 'bg-kasgreen/10 text-kasgreen' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-kasgreen/10 hover:text-kasgreen'}`}>
              <ThumbsUp size={15} /> {selectedPost.likes} {likedPosts.has(selectedPost.id) ? 'Liked' : 'Like'}
            </button>
          </div>

          <div className="mb-4">
            <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              {selectedPost.replies.length} {selectedPost.replies.length === 1 ? 'Reply' : 'Replies'}
            </h4>
            <div className="space-y-3">
              {selectedPost.replies.map(reply => (
                <div key={reply.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-kasgreen to-green-500 flex items-center justify-center text-white text-xs font-bold">
                      {reply.authorShort.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">{reply.author}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{formatDate(reply.createdAt)}</div>
                    </div>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{reply.content}</p>
                  <button onClick={() => handleLikeReply(selectedPost.id, reply.id)}
                    className={`mt-3 flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition font-medium ${likedReplies.has(reply.id) ? 'bg-kasgreen/10 text-kasgreen' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-kasgreen/10 hover:text-kasgreen'}`}>
                    <ThumbsUp size={12} /> {reply.likes}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {currentUser ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Post a Reply</h4>
              <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                placeholder="Write your reply..." rows={3}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-kasgreen text-gray-900 dark:text-white placeholder-gray-400 resize-none text-sm" />
              <div className="flex justify-end mt-3">
                <button onClick={handleSubmitReply} disabled={!replyText.trim()}
                  className="flex items-center gap-2 bg-kasgreen text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-green-600 transition disabled:opacity-40 disabled:cursor-not-allowed">
                  <Send size={15} /> Post Reply
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 text-center">
              <Mail size={22} className="text-kasgreen mx-auto mb-2" />
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                You must be registered with a <span className="font-semibold text-kasgreen">@kasmail.org</span> address to reply.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setAuthView('login')} className="text-sm font-semibold text-kasgreen border border-kasgreen px-4 py-2 rounded-xl hover:bg-kasgreen/10 transition">Sign In</button>
                <button onClick={() => setAuthView('register')} className="text-sm font-bold bg-kasgreen text-white px-4 py-2 rounded-xl hover:bg-green-600 transition">Register</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* New post */}
      {view === 'new-post' && selectedCategory && (
        <div>
          <button onClick={() => setView('category')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-kasgreen transition text-sm font-medium mb-6">
            <ArrowLeft size={16} /> Back to {selectedCategory.name}
          </button>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-5">Create New Post</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                <input value={newPostTitle} onChange={e => setNewPostTitle(e.target.value)}
                  placeholder="What's your post about?"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-kasgreen text-gray-900 dark:text-white placeholder-gray-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content</label>
                <textarea value={newPostContent} onChange={e => setNewPostContent(e.target.value)}
                  placeholder="Share your thoughts, questions, or insights..." rows={6}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-kasgreen text-gray-900 dark:text-white placeholder-gray-400 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tag <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={newPostTag} onChange={e => setNewPostTag(e.target.value)}
                  placeholder="e.g. discussion, question, guide"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-kasgreen text-gray-900 dark:text-white placeholder-gray-400" />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => setView('category')}
                  className="px-5 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition">Cancel</button>
                <button onClick={handleCreatePost} disabled={!newPostTitle.trim() || !newPostContent.trim()}
                  className="flex items-center gap-2 bg-kasgreen text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-green-600 transition disabled:opacity-40 disabled:cursor-not-allowed">
                  <Send size={15} /> Publish Post
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </>)}
    </section>
  )
}