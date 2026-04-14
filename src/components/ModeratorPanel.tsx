import { useState, useEffect } from 'react'
import {
  Shield, X, LogIn, LogOut, Trash2, Ban, Clock, UserCheck, AlertCircle,
  CheckCircle, Loader2, Search, UserPlus, ChevronRight,
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
)

// ── Types ──────────────────────────────────────────────────────────────────
interface ModUser { kasmail_username: string }

interface Post {
  id: number; title: string; author_display_name: string
  author_username: string; category_id: string; created_at: string
}

interface BanRecord {
  kasmail_username: string; reason: string | null
  banned_by: string; banned_at: string
  permanent: boolean; expires_at: string | null
}

interface TimeoutRecord {
  kasmail_username: string; reason: string | null
  timeout_by: string; timeout_until: string; created_at: string
}

interface Moderator {
  kasmail_username: string; added_at: string; added_by: string | null
}

type Tab = 'posts' | 'users' | 'bans' | 'timeouts' | 'mods'

// ── Verification helpers ───────────────────────────────────────────────────
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

async function sendModVerificationEmail(to: string, code: string): Promise<void> {
  const username = to.split('@')[0]

  const { data: profile } = await supabase
    .from('profiles').select('wallet_address').eq('username', username).single()

  if (!profile?.wallet_address) {
    throw new Error(`No KasMail account found for ${to}.`)
  }

  const { error } = await supabase.from('emails').insert({
    from_wallet: 'system:kasparty-forums',
    to_wallet:   profile.wallet_address,
    subject:     'Kasparty — Moderator sign-in code',
    body:        `Moderator Panel Sign-in\n\nYour access code is:\n\n${code}\n\nThis code expires in 10 minutes. Do not share it.`,
    read: false,
  })

  if (error) throw new Error(`Failed to send code: ${error.message}`)
}

// ── Mod session ────────────────────────────────────────────────────────────
const MOD_SESSION_KEY = 'kasparty_mod_user'

function saveModSession(username: string) { localStorage.setItem(MOD_SESSION_KEY, username) }
function loadModSession(): string | null  { return localStorage.getItem(MOD_SESSION_KEY) }
function clearModSession()               { localStorage.removeItem(MOD_SESSION_KEY) }

const CATEGORY_NAMES: Record<string, string> = {
  general: 'General Discussion',
  tokens:  'KRC-20 Tokens',
  events:  'Events & Parties',
  tech:    'Tech & Dev',
}

// ── Component ──────────────────────────────────────────────────────────────
export default function ModeratorPanel({ onClose }: { onClose: () => void }) {
  // auth
  const [modUser,       setModUser]       = useState<string | null>(loadModSession)
  const [email,         setEmail]         = useState('')
  const [emailError,    setEmailError]    = useState('')
  const [codeSent,      setCodeSent]      = useState(false)
  const [codeInput,     setCodeInput]     = useState('')
  const [codeError,     setCodeError]     = useState('')
  const [sendingCode,   setSendingCode]   = useState(false)

  // panel
  const [tab,           setTab]           = useState<Tab>('posts')
  const [posts,         setPosts]         = useState<Post[]>([])
  const [bans,          setBans]          = useState<BanRecord[]>([])
  const [timeouts,      setTimeouts]      = useState<TimeoutRecord[]>([])
  const [mods,          setMods]          = useState<Moderator[]>([])
  const [panelLoading,  setPanelLoading]  = useState(false)

  // user search / action
  const [userSearch,    setUserSearch]    = useState('')
  const [foundUsers,    setFoundUsers]    = useState<ModUser[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [actionTarget,  setActionTarget]  = useState<string | null>(null)
  const [actionType,    setActionType]    = useState<'ban' | 'timeout' | null>(null)
  const [actionReason,  setActionReason]  = useState('')
  const [actionPerm,    setActionPerm]    = useState(true)
  const [actionExpiry,  setActionExpiry]  = useState('')
  const [actionDuration,setActionDuration]= useState('1h')
  const [actionError,   setActionError]   = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  // add mod
  const [newModUsername, setNewModUsername] = useState('')
  const [modActionMsg,   setModActionMsg]   = useState('')

  // ── Load panel data ────────────────────────────────────────────────────
  useEffect(() => {
    if (modUser) loadPanelData()
  }, [modUser, tab])

  async function loadPanelData() {
    setPanelLoading(true)
    if (tab === 'posts') {
      const { data } = await supabase.from('forum_posts')
        .select('id, title, author_display_name, author_username, category_id, created_at')
        .eq('deleted', false)
        .order('created_at', { ascending: false })
        .limit(100)
      setPosts(data || [])
    } else if (tab === 'bans') {
      const { data } = await supabase.from('forum_bans')
        .select('*').order('banned_at', { ascending: false })
      setBans(data || [])
    } else if (tab === 'timeouts') {
      const { data } = await supabase.from('forum_timeouts')
        .select('*').order('created_at', { ascending: false })
      setTimeouts(data || [])
    } else if (tab === 'mods') {
      const { data } = await supabase.from('forum_moderators')
        .select('*').order('added_at', { ascending: false })
      setMods(data || [])
    }
    setPanelLoading(false)
  }

  // ── Auth: send code ────────────────────────────────────────────────────
  async function handleSendCode() {
    setEmailError('')
    const trimmed = email.trim().toLowerCase()
    const username = trimmed.endsWith('@kasmail.org') ? trimmed.split('@')[0] : null

    if (!username) { setEmailError('Enter your full @kasmail.org address.'); return }

    setSendingCode(true)
    try {
      // Check if this email is a moderator
      const { data: mod } = await supabase.from('forum_moderators')
        .select('kasmail_username').eq('kasmail_username', username).maybeSingle()
      if (!mod) { setEmailError('This address is not registered as a moderator.'); return }

      const code = generateCode()
      await supabase.from('forum_verification_codes').upsert(
        { kasmail_username: username, code, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
        { onConflict: 'kasmail_username' }
      )
      await sendModVerificationEmail(trimmed, code)
      setCodeSent(true)
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to send code.')
    } finally { setSendingCode(false) }
  }

  // ── Auth: verify code ──────────────────────────────────────────────────
  async function handleVerifyCode() {
    setCodeError('')
    const username = email.trim().toLowerCase().split('@')[0]
    const { data, error } = await supabase.from('forum_verification_codes')
      .select('code, expires_at').eq('kasmail_username', username).single()

    if (error || !data) { setCodeError('Code not found. Request a new one.'); return }
    if (new Date(data.expires_at) < new Date()) { setCodeError('Code expired. Request a new one.'); return }
    if (codeInput.trim() !== data.code) { setCodeError('Incorrect code.'); return }

    await supabase.from('forum_verification_codes').delete().eq('kasmail_username', username)
    saveModSession(username)
    setModUser(username)
  }

  // ── Post: delete ───────────────────────────────────────────────────────
  async function handleDeletePost(id: number) {
    if (!confirm('Delete this post? This cannot be undone.')) return
    await supabase.from('forum_posts').update({ deleted: true }).eq('id', id)
    await supabase.from('forum_replies').update({ deleted: true }).eq('post_id', id)
    setPosts(prev => prev.filter(p => p.id !== id))
  }

  // ── User search ────────────────────────────────────────────────────────
  async function handleUserSearch() {
    if (!userSearch.trim()) return
    setSearchLoading(true)
    const q = userSearch.trim().toLowerCase().replace('@kasmail.org', '')
    const { data } = await supabase.from('forum_users')
      .select('kasmail_username')
      .ilike('kasmail_username', `%${q}%`)
      .limit(10)
    setFoundUsers(data || [])
    setSearchLoading(false)
  }

  // ── User: open action modal ────────────────────────────────────────────
  function openAction(username: string, type: 'ban' | 'timeout') {
    setActionTarget(username)
    setActionType(type)
    setActionReason('')
    setActionPerm(true)
    setActionExpiry('')
    setActionDuration('1h')
    setActionError('')
    setActionSuccess('')
  }

  // ── User: submit ban ───────────────────────────────────────────────────
  async function handleBan() {
    if (!actionTarget || !modUser) return
    setActionError('')

    const expiresAt = actionPerm ? null : (actionExpiry ? new Date(actionExpiry).toISOString() : null)

    const { error } = await supabase.from('forum_bans').upsert({
      kasmail_username: actionTarget,
      reason:           actionReason.trim() || null,
      banned_by:        modUser,
      permanent:        actionPerm,
      expires_at:       expiresAt,
    }, { onConflict: 'kasmail_username' })

    if (error) { setActionError(error.message) } else {
      setActionSuccess(`${actionTarget}@kasmail.org has been banned.`)
      setTimeout(() => { setActionTarget(null); setActionType(null); setActionSuccess('') }, 2000)
    }
  }

  // ── User: submit timeout ───────────────────────────────────────────────
  async function handleTimeout() {
    if (!actionTarget || !modUser) return
    setActionError('')

    const durations: Record<string, number> = {
      '1h':  1 * 60 * 60 * 1000,
      '6h':  6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d':  7  * 24 * 60 * 60 * 1000,
    }
    const until = new Date(Date.now() + (durations[actionDuration] ?? durations['1h'])).toISOString()

    const { error } = await supabase.from('forum_timeouts').upsert({
      kasmail_username: actionTarget,
      reason:           actionReason.trim() || null,
      timeout_by:       modUser,
      timeout_until:    until,
    }, { onConflict: 'kasmail_username' })

    if (error) { setActionError(error.message) } else {
      setActionSuccess(`${actionTarget}@kasmail.org timed out for ${actionDuration}.`)
      setTimeout(() => { setActionTarget(null); setActionType(null); setActionSuccess('') }, 2000)
    }
  }

  // ── Unban ─────────────────────────────────────────────────────────────
  async function handleUnban(username: string) {
    await supabase.from('forum_bans').delete().eq('kasmail_username', username)
    setBans(prev => prev.filter(b => b.kasmail_username !== username))
  }

  // ── Remove timeout ─────────────────────────────────────────────────────
  async function handleRemoveTimeout(username: string) {
    await supabase.from('forum_timeouts').delete().eq('kasmail_username', username)
    setTimeouts(prev => prev.filter(t => t.kasmail_username !== username))
  }

  // ── Add mod ────────────────────────────────────────────────────────────
  async function handleAddMod() {
    const username = newModUsername.trim().toLowerCase().replace('@kasmail.org', '')
    if (!username) return
    setModActionMsg('')

    const { data: kp } = await supabase.from('profiles')
      .select('username').eq('username', username).maybeSingle()
    if (!kp) { setModActionMsg(`No KasMail account for ${username}@kasmail.org`); return }

    const { error } = await supabase.from('forum_moderators').upsert({
      kasmail_username: username,
      added_by:         modUser,
    }, { onConflict: 'kasmail_username' })

    if (error) { setModActionMsg(error.message) } else {
      setModActionMsg(`${username}@kasmail.org added as moderator.`)
      setNewModUsername('')
      await loadPanelData()
    }
  }

  // ── Remove mod ─────────────────────────────────────────────────────────
  async function handleRemoveMod(username: string) {
    if (username === modUser) { setModActionMsg("You can't remove yourself."); return }
    if (!confirm(`Remove ${username}@kasmail.org as moderator?`)) return
    await supabase.from('forum_moderators').delete().eq('kasmail_username', username)
    setMods(prev => prev.filter(m => m.kasmail_username !== username))
  }

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-6 px-4">
      <div className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col min-h-[500px]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-kasgreen/10 rounded-xl">
              <Shield size={22} className="text-kasgreen" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Moderator Panel</h2>
              {modUser && <p className="text-xs text-gray-400 dark:text-gray-500">{modUser}@kasmail.org</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {modUser && (
              <button onClick={() => { clearModSession(); setModUser(null); setCodeSent(false); setEmail('') }}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition">
                <LogOut size={15} /> Sign out
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── NOT AUTH: Login form ── */}
        {!modUser && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-full max-w-sm">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-kasgreen/10 mb-4">
                  <LogIn size={28} className="text-kasgreen" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Moderator Access</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                  Enter your moderator kasmail address to receive a sign-in code
                </p>
              </div>

              {!codeSent ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Moderator Email</label>
                    <input type="email" value={email}
                      onChange={e => { setEmail(e.target.value); setEmailError('') }}
                      placeholder="you@kasmail.org"
                      onKeyDown={e => e.key === 'Enter' && handleSendCode()}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-kasgreen text-gray-900 dark:text-white placeholder-gray-400" />
                  </div>
                  {emailError && (
                    <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" /> {emailError}
                    </div>
                  )}
                  <button onClick={handleSendCode} disabled={sendingCode}
                    className="w-full bg-kasgreen text-white py-3 rounded-xl font-bold hover:bg-green-600 transition disabled:opacity-50 flex items-center justify-center gap-2">
                    {sendingCode ? <><Loader2 size={18} className="animate-spin" /> Sending...</> : 'Send Access Code'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                    Code sent to <span className="text-kasgreen font-semibold">{email}</span>
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">6-digit Code</label>
                    <input type="text" inputMode="numeric" maxLength={6} value={codeInput}
                      onChange={e => { setCodeInput(e.target.value.replace(/\D/g, '')); setCodeError('') }}
                      placeholder="123456"
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-kasgreen text-gray-900 dark:text-white placeholder-gray-400 text-center text-2xl tracking-widest font-mono" />
                  </div>
                  {codeError && (
                    <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" /> {codeError}
                    </div>
                  )}
                  <button onClick={handleVerifyCode} disabled={codeInput.length < 6}
                    className="w-full bg-kasgreen text-white py-3 rounded-xl font-bold hover:bg-green-600 transition disabled:opacity-50">
                    Verify & Access Panel
                  </button>
                  <button onClick={() => setCodeSent(false)} className="w-full text-sm text-gray-500 hover:text-kasgreen transition">
                    Use a different email
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── AUTH: Panel ── */}
        {modUser && (
          <>
            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 px-2 overflow-x-auto">
              {(['posts', 'users', 'bans', 'timeouts', 'mods'] as Tab[]).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-3 text-sm font-semibold whitespace-nowrap transition border-b-2 -mb-px ${
                    tab === t
                      ? 'border-kasgreen text-kasgreen'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">

              {panelLoading && (
                <div className="flex justify-center py-12">
                  <Loader2 size={28} className="animate-spin text-kasgreen" />
                </div>
              )}

              {/* ── POSTS TAB ── */}
              {tab === 'posts' && !panelLoading && (
                <div>
                  <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                    All Posts ({posts.length})
                  </h3>
                  {posts.length === 0 ? (
                    <p className="text-center text-gray-400 py-8">No posts yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {posts.map(post => (
                        <div key={post.id}
                          className="flex items-start justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white text-sm leading-snug truncate">{post.title}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {CATEGORY_NAMES[post.category_id] ?? post.category_id}
                              {' · '}{post.author_display_name} ({post.author_username}@kasmail.org)
                              {' · '}{formatDate(post.created_at)}
                            </p>
                          </div>
                          <button onClick={() => handleDeletePost(post.id)}
                            className="shrink-0 flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 px-3 py-1.5 rounded-lg transition font-semibold">
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── USERS TAB ── */}
              {tab === 'users' && !panelLoading && (
                <div>
                  <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Search Users</h3>
                  <div className="flex gap-2 mb-4">
                    <div className="relative flex-1">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleUserSearch()}
                        placeholder="Search by kasmail username..."
                        className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kasgreen text-gray-900 dark:text-white placeholder-gray-400" />
                    </div>
                    <button onClick={handleUserSearch} disabled={searchLoading}
                      className="px-4 py-2.5 bg-kasgreen text-white rounded-xl text-sm font-semibold hover:bg-green-600 transition disabled:opacity-50 flex items-center gap-2">
                      {searchLoading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                      Search
                    </button>
                  </div>

                  {foundUsers.length > 0 && (
                    <div className="space-y-2 mb-6">
                      {foundUsers.map(u => (
                        <div key={u.kasmail_username}
                          className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{u.kasmail_username}@kasmail.org</span>
                          <div className="flex items-center gap-2">
                            <button onClick={() => openAction(u.kasmail_username, 'timeout')}
                              className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 px-3 py-1.5 rounded-lg transition font-semibold">
                              <Clock size={13} /> Timeout
                            </button>
                            <button onClick={() => openAction(u.kasmail_username, 'ban')}
                              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 px-3 py-1.5 rounded-lg transition font-semibold">
                              <Ban size={13} /> Ban
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {foundUsers.length === 0 && userSearch && !searchLoading && (
                    <p className="text-center text-sm text-gray-400 py-4">No users found for "{userSearch}"</p>
                  )}

                  {/* Action modal */}
                  {actionTarget && actionType && (
                    <div className="mt-4 p-5 bg-white dark:bg-gray-800 rounded-2xl border-2 border-kasgreen/30 shadow-lg">
                      <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        {actionType === 'ban' ? <Ban size={16} className="text-red-500" /> : <Clock size={16} className="text-amber-500" />}
                        {actionType === 'ban' ? 'Ban' : 'Timeout'}: {actionTarget}@kasmail.org
                      </h4>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Reason <span className="text-gray-400 font-normal">(optional)</span>
                          </label>
                          <input value={actionReason} onChange={e => setActionReason(e.target.value)}
                            placeholder="Rule violation, spam, etc."
                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kasgreen text-gray-900 dark:text-white placeholder-gray-400" />
                        </div>

                        {actionType === 'ban' ? (
                          <div>
                            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer mb-2">
                              <input type="checkbox" checked={actionPerm} onChange={e => setActionPerm(e.target.checked)}
                                className="rounded text-kasgreen" />
                              Permanent ban
                            </label>
                            {!actionPerm && (
                              <input type="datetime-local" value={actionExpiry}
                                onChange={e => setActionExpiry(e.target.value)}
                                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kasgreen text-gray-900 dark:text-white" />
                            )}
                          </div>
                        ) : (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Duration</label>
                            <div className="flex gap-2 flex-wrap">
                              {['1h', '6h', '24h', '7d'].map(d => (
                                <button key={d} onClick={() => setActionDuration(d)}
                                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                                    actionDuration === d
                                      ? 'bg-kasgreen text-white'
                                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-kasgreen/20'
                                  }`}>{d}</button>
                              ))}
                            </div>
                          </div>
                        )}

                        {actionError && (
                          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
                            {actionError}
                          </div>
                        )}
                        {actionSuccess && (
                          <div className="flex items-center gap-2 text-sm text-kasgreen bg-kasgreen/10 rounded-xl p-3">
                            <CheckCircle size={16} /> {actionSuccess}
                          </div>
                        )}

                        <div className="flex gap-2 pt-1">
                          <button onClick={() => { setActionTarget(null); setActionType(null) }}
                            className="flex-1 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 transition">
                            Cancel
                          </button>
                          <button
                            onClick={actionType === 'ban' ? handleBan : handleTimeout}
                            className={`flex-1 py-2.5 text-sm font-bold text-white rounded-xl transition ${
                              actionType === 'ban'
                                ? 'bg-red-500 hover:bg-red-600'
                                : 'bg-amber-500 hover:bg-amber-600'
                            }`}>
                            Confirm {actionType === 'ban' ? 'Ban' : 'Timeout'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── BANS TAB ── */}
              {tab === 'bans' && !panelLoading && (
                <div>
                  <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                    Banned Users ({bans.length})
                  </h3>
                  {bans.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <UserCheck size={36} className="mx-auto mb-2 opacity-40" />
                      No banned users.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {bans.map(ban => (
                        <div key={ban.kasmail_username}
                          className="flex items-start justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white text-sm">{ban.kasmail_username}@kasmail.org</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              By: {ban.banned_by} · {formatDate(ban.banned_at)}
                              {ban.reason && ` · Reason: ${ban.reason}`}
                            </p>
                            <p className="text-xs text-red-500 mt-0.5">
                              {ban.permanent ? 'Permanent' : `Until: ${ban.expires_at ? formatDate(ban.expires_at) : 'unknown'}`}
                            </p>
                          </div>
                          <button onClick={() => handleUnban(ban.kasmail_username)}
                            className="shrink-0 flex items-center gap-1.5 text-xs text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 px-3 py-1.5 rounded-lg transition font-semibold">
                            <UserCheck size={13} /> Unban
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── TIMEOUTS TAB ── */}
              {tab === 'timeouts' && !panelLoading && (
                <div>
                  <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                    Timed Out Users ({timeouts.length})
                  </h3>
                  {timeouts.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <Clock size={36} className="mx-auto mb-2 opacity-40" />
                      No active timeouts.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {timeouts.map(t => (
                        <div key={t.kasmail_username}
                          className="flex items-start justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white text-sm">{t.kasmail_username}@kasmail.org</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              By: {t.timeout_by}
                              {t.reason && ` · Reason: ${t.reason}`}
                            </p>
                            <p className={`text-xs mt-0.5 ${new Date(t.timeout_until) > new Date() ? 'text-amber-500' : 'text-gray-400'}`}>
                              Until: {formatDate(t.timeout_until)}
                              {new Date(t.timeout_until) <= new Date() && ' (expired)'}
                            </p>
                          </div>
                          <button onClick={() => handleRemoveTimeout(t.kasmail_username)}
                            className="shrink-0 flex items-center gap-1.5 text-xs text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 px-3 py-1.5 rounded-lg transition font-semibold">
                            <CheckCircle size={13} /> Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── MODS TAB ── */}
              {tab === 'mods' && !panelLoading && (
                <div>
                  <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                    Moderators ({mods.length})
                  </h3>

                  {/* Add mod */}
                  <div className="flex gap-2 mb-5">
                    <div className="relative flex-1">
                      <input value={newModUsername}
                        onChange={e => setNewModUsername(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddMod()}
                        placeholder="username (without @kasmail.org)"
                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kasgreen text-gray-900 dark:text-white placeholder-gray-400" />
                    </div>
                    <button onClick={handleAddMod}
                      className="px-4 py-2.5 bg-kasgreen text-white rounded-xl text-sm font-semibold hover:bg-green-600 transition flex items-center gap-2">
                      <UserPlus size={15} /> Add Mod
                    </button>
                  </div>

                  {modActionMsg && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-xl p-3 mb-4">
                      {modActionMsg}
                    </div>
                  )}

                  <div className="space-y-2">
                    {mods.map(m => (
                      <div key={m.kasmail_username}
                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm flex items-center gap-2">
                            {m.kasmail_username}@kasmail.org
                            {m.kasmail_username === modUser && (
                              <span className="text-xs bg-kasgreen/10 text-kasgreen px-2 py-0.5 rounded-full">You</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Added {formatDate(m.added_at)}{m.added_by ? ` by ${m.added_by}` : ''}
                          </p>
                        </div>
                        {m.kasmail_username !== modUser && (
                          <button onClick={() => handleRemoveMod(m.kasmail_username)}
                            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 px-3 py-1.5 rounded-lg transition font-semibold">
                            <X size={13} /> Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                    <p className="text-xs text-blue-600 dark:text-blue-400 flex items-start gap-2">
                      <ChevronRight size={14} className="shrink-0 mt-0.5" />
                      New moderators need an active kasmail.org account. They will access this panel via their kasmail address and a one-time code.
                    </p>
                  </div>
                </div>
              )}

            </div>
          </>
        )}
      </div>
    </div>
  )
}
