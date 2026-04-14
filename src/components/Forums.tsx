import { useState, useEffect, useCallback } from 'react'
import {
  MessageSquare, ChevronRight, Clock, Pin, Tag, Search, Plus, ArrowLeft,
  Send, User, Flame, Mail, LogIn, LogOut, CheckCircle, AlertCircle,
  ExternalLink, Loader2,
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
)

// ── Deliver verification code into KasMail inbox ───────────────────────────
async function sendVerificationEmail(
  to: string, code: string, type: 'register' | 'login' | 'resend'
): Promise<void> {
  const username = to.split('@')[0]
  const subject = type === 'login'
    ? 'Kasparty Forums — Sign-in code'
    : 'Kasparty Forums — Your verification code'
  const body =
    `Kasparty Forums Verification\n\nYour ${type === 'login' ? 'sign-in' : 'verification'} code is:\n\n${code}\n\nThis code expires in 10 minutes. Do not share it with anyone.`

  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('wallet_address').eq('username', username).single()

  if (profileError || !profile?.wallet_address) {
    throw new Error(`No KasMail account found for ${to}.`)
  }

  const { error: insertError } = await supabase.from('emails').insert({
    from_wallet: 'system:kasparty-forums',
    to_wallet: profile.wallet_address,
    subject,
    body,
    read: false,
  })

  if (insertError) {
    throw new Error(`Failed to deliver verification email: ${insertError.message}`)
  }
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// ── Session ────────────────────────────────────────────────────────────────
const SESSION_KEY = 'kasparty_forum_user'

interface ForumUser {
  kasmail_username: string
  display_name: string
}

function saveSession(u: ForumUser)  { localStorage.setItem(SESSION_KEY, JSON.stringify(u)) }
function loadSession(): ForumUser | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') }
  catch { return null }
}
function clearSession() { localStorage.removeItem(SESSION_KEY) }

// ── Types ──────────────────────────────────────────────────────────────────
interface CategoryMeta {
  id: string; name: string; description: string; icon: string; color: string
}

interface DBPost {
  id: number; category_id: string; title: string; content: string
  author_username: string; author_display_name: string
  pinned: boolean; tags: string[]; reply_count: number; created_at: string
}

interface DBReply {
  id: number; post_id: number; content: string
  author_username: string; author_display_name: string; created_at: string
}

interface LatestPost { title: string; created_at: string }

const CATEGORIES: CategoryMeta[] = [
  { id: 'general', name: 'General Discussion',
    description: 'Anything and everything about Kaspa and Kasparty',
    icon: '💬', color: 'from-kasgreen/20 to-green-500/10' },
  { id: 'tokens', name: 'KRC-20 Tokens',
    description: 'Discuss KRC-20 token launches, analysis, and gems',
    icon: '🪙', color: 'from-yellow-400/20 to-amber-500/10' },
  { id: 'events', name: 'Events & Parties',
    description: 'Upcoming Kaspa events, AMAs, and community parties',
    icon: '🎉', color: 'from-purple-500/20 to-pink-500/10' },
  { id: 'tech', name: 'Tech & Dev',
    description: 'Technical discussions, building on Kaspa, developer resources',
    icon: '⚙️', color: 'from-blue-500/20 to-cyan-500/10' },
]

type View     = 'categories' | 'category' | 'post' | 'new-post'
type AuthView = 'none' | 'register' | 'verify' | 'login'

// ── Component ──────────────────────────────────────────────────────────────
export default function Forums() {
  // navigation
  const [view,               setView]               = useState<View>('categories')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedPostId,     setSelectedPostId]     = useState<number | null>(null)

  // DB data
  const [posts,          setPosts]          = useState<DBPost[]>([])
  const [replies,        setReplies]        = useState<DBReply[]>([])
  const [categoryStats,  setCategoryStats]  = useState<Record<string, number>>({})
  const [latestPosts,    setLatestPosts]    = useState<Record<string, LatestPost>>({})

  // loading / error
  const [loading,       setLoading]       = useState(false)
  const [posting,       setPosting]       = useState(false)
  const [postError,     setPostError]     = useState('')

  // search
  const [searchQuery,   setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState<DBPost[]>([])

  // forms
  const [replyText,      setReplyText]      = useState('')
  const [newPostTitle,   setNewPostTitle]   = useState('')
  const [newPostContent, setNewPostContent] = useState('')
  const [newPostTag,     setNewPostTag]     = useState('')

  // auth
  const [currentUser,   setCurrentUser]   = useState<ForumUser | null>(null)
  const [authView,      setAuthView]      = useState<AuthView>('none')
  const [regEmail,      setRegEmail]      = useState('')
  const [regUsername,   setRegUsername]   = useState('')
  const [regError,      setRegError]      = useState('')
  const [regSuccess,    setRegSuccess]    = useState('')
  const [loginEmail,    setLoginEmail]    = useState('')
  const [loginError,    setLoginError]    = useState('')
  const [verifyInput,   setVerifyInput]   = useState('')
  const [verifyError,   setVerifyError]   = useState('')
  const [codeSending,   setCodeSending]   = useState(false)
  const [pendingEmail,  setPendingEmail]  = useState('')
  const [pendingUsername, setPendingUsername] = useState('')
  const [isLoginFlow,   setIsLoginFlow]   = useState(false)

  // derived
  const selectedCategory = CATEGORIES.find(c => c.id === selectedCategoryId) ?? null
  const selectedPost     = posts.find(p => p.id === selectedPostId) ?? null

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = loadSession()
    if (saved) setCurrentUser(saved)
    loadCategoryStats()
  }, [])

  // ── DB helpers ────────────────────────────────────────────────────────────
  async function loadCategoryStats() {
    const { data } = await supabase
      .from('forum_posts').select('category_id').eq('deleted', false)

    if (data) {
      const stats: Record<string, number> = {}
      data.forEach(r => { stats[r.category_id] = (stats[r.category_id] || 0) + 1 })
      setCategoryStats(stats)
    }

    // Latest post per category
    const latest: Record<string, LatestPost> = {}
    for (const cat of CATEGORIES) {
      const { data: lp } = await supabase
        .from('forum_posts').select('title, created_at')
        .eq('category_id', cat.id).eq('deleted', false)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (lp) latest[cat.id] = lp
    }
    setLatestPosts(latest)
  }

  async function loadPostsForCategory(categoryId: string) {
    setLoading(true)
    const { data, error } = await supabase
      .from('forum_posts').select('*')
      .eq('category_id', categoryId).eq('deleted', false)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
    if (!error && data) setPosts(data)
    setLoading(false)
  }

  async function loadRepliesForPost(postId: number) {
    const { data, error } = await supabase
      .from('forum_replies').select('*')
      .eq('post_id', postId).eq('deleted', false)
      .order('created_at', { ascending: true })
    if (!error && data) setReplies(data)
  }

  async function checkRestriction(username: string): Promise<string | null> {
    const { data: ban } = await supabase
      .from('forum_bans').select('permanent, expires_at, reason')
      .eq('kasmail_username', username).maybeSingle()
    if (ban && (ban.permanent || !ban.expires_at || new Date(ban.expires_at) > new Date())) {
      return `You are banned from this forum.${ban.reason ? ` Reason: ${ban.reason}` : ''}`
    }

    const { data: tout } = await supabase
      .from('forum_timeouts').select('timeout_until, reason')
      .eq('kasmail_username', username).maybeSingle()
    if (tout && new Date(tout.timeout_until) > new Date()) {
      return `You are timed out until ${new Date(tout.timeout_until).toLocaleString()}.${tout.reason ? ` Reason: ${tout.reason}` : ''}`
    }
    return null
  }

  // ── Post / Reply ──────────────────────────────────────────────────────────
  const handleCreatePost = async () => {
    if (!newPostTitle.trim() || !newPostContent.trim() || !selectedCategoryId || !currentUser) return
    setPosting(true); setPostError('')

    const restriction = await checkRestriction(currentUser.kasmail_username)
    if (restriction) { setPostError(restriction); setPosting(false); return }

    const { error } = await supabase.from('forum_posts').insert({
      category_id:        selectedCategoryId,
      title:              newPostTitle.trim(),
      content:            newPostContent.trim(),
      author_username:     currentUser.kasmail_username,
      author_display_name: currentUser.display_name,
      tags: newPostTag.trim() ? [newPostTag.trim().toLowerCase()] : [],
    })

    if (error) {
      setPostError('Failed to create post. Please try again.')
    } else {
      setNewPostTitle(''); setNewPostContent(''); setNewPostTag('')
      await loadPostsForCategory(selectedCategoryId)
      await loadCategoryStats()
      setView('category')
    }
    setPosting(false)
  }

  const handleSubmitReply = async () => {
    if (!replyText.trim() || !selectedPostId || !currentUser) return
    setPosting(true); setPostError('')

    const restriction = await checkRestriction(currentUser.kasmail_username)
    if (restriction) { setPostError(restriction); setPosting(false); return }

    const { error } = await supabase.from('forum_replies').insert({
      post_id:             selectedPostId,
      content:             replyText.trim(),
      author_username:     currentUser.kasmail_username,
      author_display_name: currentUser.display_name,
    })

    if (!error) {
      await supabase.from('forum_posts')
        .update({ reply_count: (selectedPost?.reply_count ?? 0) + 1 })
        .eq('id', selectedPostId)

      setReplyText('')
      await loadRepliesForPost(selectedPostId)
      setPosts(prev => prev.map(p =>
        p.id === selectedPostId ? { ...p, reply_count: p.reply_count + 1 } : p
      ))
    }
    setPosting(false)
  }

  // ── Search ────────────────────────────────────────────────────────────────
  const doSearch = useCallback(async (q: string) => {
    if (q.length <= 2) { setSearchResults([]); return }
    const { data } = await supabase
      .from('forum_posts').select('*')
      .eq('deleted', false)
      .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
      .order('created_at', { ascending: false }).limit(20)
    setSearchResults(data || [])
  }, [])

  useEffect(() => {
    const t = setTimeout(() => doSearch(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery, doSearch])

  // ── Auth: REGISTER ────────────────────────────────────────────────────────
  const handleSendCode = async () => {
    setRegError('')
    const email = regEmail.trim().toLowerCase()
    const username = email.endsWith('@kasmail.org') ? email.split('@')[0] : ''
    const displayName = regUsername.trim()

    if (!email.endsWith('@kasmail.org')) { setRegError('Only @kasmail.org addresses are accepted.'); return }
    if (!displayName || displayName.length < 3) { setRegError('Display name must be at least 3 characters.'); return }
    if (displayName.length > 20) { setRegError('Display name must be 20 characters or fewer.'); return }

    setCodeSending(true)
    try {
      const { data: kp } = await supabase.from('profiles')
        .select('username').eq('username', username).single()
      if (!kp) { setRegError(`No KasMail account found for ${email}. Get one at kasmail.org first.`); return }

      const { data: ex } = await supabase.from('forum_users')
        .select('kasmail_username').eq('kasmail_username', username).single()
      if (ex) { setRegError('Already registered. Sign in instead.'); return }

      const code = generateCode()
      const { error: ue } = await supabase.from('forum_verification_codes').upsert(
        { kasmail_username: username, code, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
        { onConflict: 'kasmail_username' }
      )
      if (ue) throw new Error('Failed to store code.')
      await sendVerificationEmail(email, code, 'register')

      setPendingEmail(email); setPendingUsername(displayName)
      setIsLoginFlow(false); setAuthView('verify')
    } catch (err) {
      setRegError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally { setCodeSending(false) }
  }

  // ── Auth: VERIFY ──────────────────────────────────────────────────────────
  const handleVerifyCode = async () => {
    setVerifyError('')
    const username = pendingEmail.split('@')[0]
    try {
      const { data, error } = await supabase.from('forum_verification_codes')
        .select('code, expires_at').eq('kasmail_username', username).single()

      if (error || !data) { setVerifyError('Code not found. Request a new one.'); return }
      if (new Date(data.expires_at) < new Date()) { setVerifyError('Code expired. Request a new one.'); return }
      if (verifyInput.trim() !== data.code) { setVerifyError('Incorrect code. Check your kasmail inbox.'); return }

      await supabase.from('forum_verification_codes').delete().eq('kasmail_username', username)
      let displayName = pendingUsername

      if (!isLoginFlow) {
        await supabase.from('forum_users').insert({ kasmail_username: username, display_name: displayName })
      } else {
        const { data: ud } = await supabase.from('forum_users')
          .select('display_name').eq('kasmail_username', username).single()
        if (ud?.display_name) displayName = ud.display_name
      }

      const user: ForumUser = { kasmail_username: username, display_name: displayName }
      saveSession(user); setCurrentUser(user)
      setRegSuccess(`Welcome${isLoginFlow ? ' back' : ''}, ${displayName}!`)
      setAuthView('none')
      setRegEmail(''); setRegUsername(''); setVerifyInput(''); setPendingEmail(''); setPendingUsername('')
      setTimeout(() => setRegSuccess(''), 3000)
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Verification failed. Try again.')
    }
  }

  // ── Auth: RESEND ──────────────────────────────────────────────────────────
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

  // ── Auth: LOGIN ───────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setLoginError('')
    const email = loginEmail.trim().toLowerCase()
    const username = email.endsWith('@kasmail.org') ? email.split('@')[0] : ''

    if (!email.endsWith('@kasmail.org')) { setLoginError('Please enter your @kasmail.org address.'); return }

    setCodeSending(true)
    try {
      const { data: kp } = await supabase.from('profiles')
        .select('username').eq('username', username).single()
      if (!kp) { setLoginError(`No KasMail account found for ${email}.`); return }

      const { data: fu } = await supabase.from('forum_users')
        .select('kasmail_username').eq('kasmail_username', username).single()
      if (!fu) { setLoginError('No forum account found. Please register first.'); return }

      const code = generateCode()
      await supabase.from('forum_verification_codes').upsert(
        { kasmail_username: username, code, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
        { onConflict: 'kasmail_username' }
      )
      await sendVerificationEmail(email, code, 'login')
      setPendingEmail(email); setPendingUsername(username)
      setIsLoginFlow(true); setAuthView('verify')
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Failed to send sign-in code.')
    } finally { setCodeSending(false) }
  }

  const handleLogout = () => { clearSession(); setCurrentUser(null) }
  const requireAuth  = (action: () => void) => { if (!currentUser) { setAuthView('register'); return } action() }

  const totalPosts = Object.values(categoryStats).reduce((a, b) => a + b, 0)

  const formatDate = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
    if (diff < 60)    return 'just now'
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
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

        {/* Stats header */}
        <div className="flex flex-wrap items-center gap-6 mb-6 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
            <MessageSquare size={16} className="text-kasgreen" />{totalPosts} posts
          </span>
          <span className="flex items-center gap-1.5">
            <Flame size={16} className="text-kasgreen" />Active community
          </span>
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
                <span className="flex items-center gap-1"><Mail size={14} className="text-kasgreen" /> Requires <span className="font-semibold text-kasgreen ml-1">@kasmail.org</span> to post</span>
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
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search all posts..."
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-kasgreen transition text-gray-900 dark:text-white placeholder-gray-400" />
        </div>

        {/* Search results */}
        {searchQuery.length > 2 && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"
            </div>
            {searchResults.length === 0
              ? <div className="p-8 text-center text-gray-500 dark:text-gray-400">No posts found.</div>
              : searchResults.map(post => {
                const cat = CATEGORIES.find(c => c.id === post.category_id)
                return (
                  <button key={post.id}
                    onClick={async () => {
                      setSelectedCategoryId(post.category_id)
                      await loadPostsForCategory(post.category_id)
                      setSelectedPostId(post.id)
                      await loadRepliesForPost(post.id)
                      setView('post')
                      setSearchQuery('')
                    }}
                    className="w-full flex items-start gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition text-left border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <span className="text-xl mt-0.5">{cat?.icon ?? '💬'}</span>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">{post.title}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {cat?.name} · {post.reply_count} {post.reply_count === 1 ? 'reply' : 'replies'} · {formatDate(post.created_at)}
                      </div>
                    </div>
                  </button>
                )
              })
            }
          </div>
        )}

        {/* ── CATEGORIES VIEW ── */}
        {view === 'categories' && (
          <div className="space-y-4">
            {CATEGORIES.map(cat => (
              <button key={cat.id}
                onClick={async () => {
                  setSelectedCategoryId(cat.id)
                  await loadPostsForCategory(cat.id)
                  setView('category')
                }}
                className="w-full group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-kasgreen/50 hover:shadow-lg transition-all duration-200 overflow-hidden text-left">
                <div className={`bg-gradient-to-r ${cat.color} p-5 flex items-center gap-4`}>
                  <span className="text-3xl">{cat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-kasgreen transition">{cat.name}</h3>
                      <ChevronRight size={18} className="text-gray-400 group-hover:text-kasgreen group-hover:translate-x-1 transition-all" />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{cat.description}</p>
                  </div>
                  <div className="hidden sm:flex flex-col items-end gap-1 text-sm text-gray-500 dark:text-gray-400 shrink-0">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{categoryStats[cat.id] ?? 0} posts</span>
                  </div>
                </div>
                {latestPosts[cat.id] && (
                  <div className="px-5 py-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
                    <Clock size={13} />
                    <span className="truncate">Latest: <span className="text-gray-700 dark:text-gray-300 font-medium">{latestPosts[cat.id].title}</span></span>
                    <span className="shrink-0">{formatDate(latestPosts[cat.id].created_at)}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── CATEGORY POSTS VIEW ── */}
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

            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 size={32} className="animate-spin text-kasgreen" />
              </div>
            ) : posts.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                <MessageSquare size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400 font-medium">No posts yet in this category.</p>
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Be the first to start a discussion!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map(post => (
                  <button key={post.id}
                    onClick={async () => {
                      setSelectedPostId(post.id)
                      await loadRepliesForPost(post.id)
                      setView('post')
                    }}
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
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{post.content.slice(0, 140)}{post.content.length > 140 ? '…' : ''}</p>
                        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400 dark:text-gray-500">
                          <span className="flex items-center gap-1"><User size={12} />{post.author_display_name}</span>
                          <span className="flex items-center gap-1"><Clock size={12} />{formatDate(post.created_at)}</span>
                          <span className="flex items-center gap-1 text-kasgreen font-semibold"><MessageSquare size={12} />{post.reply_count} {post.reply_count === 1 ? 'reply' : 'replies'}</span>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-gray-300 group-hover:text-kasgreen shrink-0 mt-1 transition" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── POST DETAIL VIEW ── */}
        {view === 'post' && selectedPost && selectedCategory && (
          <div>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm mb-6">
              <button onClick={() => setView('categories')} className="text-gray-400 hover:text-kasgreen transition">Forums</button>
              <ChevronRight size={14} className="text-gray-300" />
              <button onClick={() => setView('category')} className="text-gray-400 hover:text-kasgreen transition">{selectedCategory.name}</button>
              <ChevronRight size={14} className="text-gray-300" />
              <span className="text-gray-600 dark:text-gray-300 font-medium truncate max-w-xs">{selectedPost.title}</span>
            </div>

            {/* Post */}
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
                  {selectedPost.author_display_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{selectedPost.author_display_name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{selectedPost.author_username}@kasmail.org · {formatDate(selectedPost.created_at)}</div>
                </div>
              </div>
              <div className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">{selectedPost.content}</div>
            </div>

            {/* Replies */}
            <div className="mb-4">
              <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
              </h4>
              {replies.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-400 dark:text-gray-500 text-sm">
                  No replies yet. Be the first to respond!
                </div>
              ) : (
                <div className="space-y-3">
                  {replies.map(reply => (
                    <div key={reply.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-kasgreen to-green-500 flex items-center justify-center text-white text-xs font-bold">
                          {reply.author_display_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">{reply.author_display_name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{reply.author_username}@kasmail.org · {formatDate(reply.created_at)}</div>
                        </div>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{reply.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reply box */}
            {postError && (
              <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl p-3 mb-3">
                <AlertCircle size={16} className="shrink-0 mt-0.5" /> {postError}
              </div>
            )}
            {currentUser ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Post a Reply</h4>
                <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                  placeholder="Write your reply..." rows={3}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-kasgreen text-gray-900 dark:text-white placeholder-gray-400 resize-none text-sm" />
                <div className="flex justify-end mt-3">
                  <button onClick={handleSubmitReply} disabled={!replyText.trim() || posting}
                    className="flex items-center gap-2 bg-kasgreen text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-green-600 transition disabled:opacity-40 disabled:cursor-not-allowed">
                    {posting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Post Reply
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

        {/* ── NEW POST VIEW ── */}
        {view === 'new-post' && selectedCategory && (
          <div>
            <button onClick={() => setView('category')}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-kasgreen transition text-sm font-medium mb-6">
              <ArrowLeft size={16} /> Back to {selectedCategory.name}
            </button>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-5">Create New Post</h3>
              {postError && (
                <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl p-3 mb-4">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" /> {postError}
                </div>
              )}
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
                    placeholder="Share your thoughts, questions, or insights..." rows={8}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-kasgreen text-gray-900 dark:text-white placeholder-gray-400 resize-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tag <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input value={newPostTag} onChange={e => setNewPostTag(e.target.value)}
                    placeholder="e.g. discussion, question, guide"
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-kasgreen text-gray-900 dark:text-white placeholder-gray-400" />
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button onClick={() => { setView('category'); setPostError('') }}
                    className="px-5 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition">
                    Cancel
                  </button>
                  <button onClick={handleCreatePost} disabled={!newPostTitle.trim() || !newPostContent.trim() || posting}
                    className="flex items-center gap-2 bg-kasgreen text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-green-600 transition disabled:opacity-40 disabled:cursor-not-allowed">
                    {posting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Publish Post
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </>)}
    </div>
  )
}
