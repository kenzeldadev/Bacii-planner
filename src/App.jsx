import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import TreeView from './TreeView'
import { t } from './i18n'

function secondsUntilBacii() {
  const examDate = new Date(2027, 7, 10)
  return Math.max(0, Math.floor((examDate.getTime() - Date.now()) / 1000))
}

function BaciiCountdown({ language }) {
  const [remainingSeconds, setRemainingSeconds] = useState(secondsUntilBacii)

  useEffect(() => {
    const timer = setInterval(() => setRemainingSeconds(secondsUntilBacii()), 1000)
    return () => clearInterval(timer)
  }, [])

  const days = Math.floor(remainingSeconds / 86_400)
  const hours = Math.floor((remainingSeconds % 86_400) / 3600)
  const minutes = Math.floor((remainingSeconds % 3600) / 60)
  const seconds = remainingSeconds % 60
  const pad = (value) => String(value).padStart(2, '0')
  const time = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`

  return (
    <div
      className="flex items-baseline gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 sm:text-sm"
      aria-label={`${t(language, 'daysUntilBacii', { count: days })}, ${time}`}
    >
      {t(language, 'daysUntilBacii', { count: days })}
      <span
        className="text-[10px] font-medium tabular-nums text-blue-600 sm:text-xs"
        aria-hidden="true"
      >
        {time}
      </span>
    </div>
  )
}

function LoginForm({ language }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setBusy(false)
  }

  return (
    <div className="min-h-full flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 space-y-4"
      >
        <div>
          <h1 className="text-xl font-bold">{t(language, 'appName')}</h1>
          <p className="text-sm text-gray-500">{t(language, 'signInPrompt')}</p>
        </div>
        <label className="block text-sm font-medium">
          {t(language, 'email')}
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </label>
        <label className="block text-sm font-medium">
          {t(language, 'password')}
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-blue-700 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {busy ? t(language, 'signingIn') : t(language, 'signIn')}
        </button>
      </form>
    </div>
  )
}

export default function App() {
  // undefined = still checking, null = logged out, object = logged in
  const [session, setSession] = useState(undefined)
  const [language, setLanguage] = useState(() => localStorage.getItem('bacii-language') || 'en')
  const [nightMode, setNightMode] = useState(() => localStorage.getItem('bacii-night-mode') === 'true')

  useEffect(() => {
    localStorage.setItem('bacii-language', language)
    document.documentElement.lang = language === 'km' ? 'km' : 'en'
  }, [language])

  useEffect(() => {
    localStorage.setItem('bacii-night-mode', String(nightMode))
  }, [nightMode])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return <div className="flex h-full items-center justify-center text-gray-500">{t(language, 'loading')}</div>
  }

  const email = session?.user.email

  return (
    <div
      id="app"
      data-theme={nightMode ? 'dark' : 'light'}
      lang={language === 'km' ? 'km' : 'en'}
      className="flex h-full flex-col bg-gray-100 text-gray-900"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-bold">{t(language, 'appName')}</h1>
          <BaciiCountdown language={language} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="language" className="sr-only">{t(language, 'language')}</label>
          <select
            id="language"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="rounded border border-gray-300 bg-white px-2 py-1.5"
          >
            <option value="en">English</option>
            <option value="km">ខ្មែរ</option>
          </select>
          <button
            type="button"
            aria-pressed={nightMode}
            onClick={() => setNightMode((current) => !current)}
            className="rounded border border-gray-300 px-3 py-1.5 hover:bg-gray-50"
          >
            {nightMode ? `☀ ${t(language, 'dayMode')}` : `☾ ${t(language, 'nightMode')}`}
          </button>
          {session ? (
            <>
              <span className="hidden text-gray-500 sm:inline">{email}</span>
              <button
                onClick={() => supabase.auth.signOut()}
                className="rounded border border-gray-300 px-3 py-1.5 hover:bg-gray-50"
              >
                {t(language, 'signOut')}
              </button>
            </>
          ) : null}
        </div>
      </header>
      <main className="min-h-0 flex-1">
        {session ? (
          <TreeView userEmail={email} language={language} nightMode={nightMode} />
        ) : (
          <LoginForm language={language} />
        )}
      </main>
    </div>
  )
}
