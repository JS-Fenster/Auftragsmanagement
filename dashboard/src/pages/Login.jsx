import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, LogIn } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const navigate = useNavigate()
  const { session } = useAuth()

  if (session) {
    navigate('/', { replace: true })
    return null
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'E-Mail oder Passwort falsch.'
          : 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.'
      )
      setLoading(false)
    } else {
      navigate('/', { replace: true })
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    })

    setLoading(false)
    if (error) {
      setError('Passwort-Reset fehlgeschlagen. Bitte erneut versuchen.')
    } else {
      setResetSent(true)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-surface-main">
      <div className="w-full max-w-sm mx-4">
        <div className="bg-surface-card border border-border-default rounded-xl shadow-sm p-8">
          <div className="text-center mb-8">
            <img src="/js-logo.svg" alt="J.S. Fenster & Türen" className="w-48 mx-auto dark:brightness-200" />
            <p className="text-sm text-text-muted mt-2">Auftragsmanagement</p>
          </div>

          {resetMode ? (
            <form onSubmit={handleResetPassword}>
              <h2 className="text-lg font-semibold text-text-primary mb-4">Passwort zurücksetzen</h2>
              {resetSent ? (
                <div className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 p-3 rounded-lg mb-4">
                  E-Mail zum Zurücksetzen wurde gesendet. Bitte Postfach prüfen.
                </div>
              ) : (
                <>
                  <label className="block text-sm font-medium text-text-secondary mb-1">E-Mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-main text-text-primary focus:outline-none focus:ring-2 focus:ring-[var(--brand)] mb-4"
                    placeholder="name@js-fenster.de"
                    required
                    autoFocus
                  />
                  {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-[var(--btn-primary)] text-white rounded-lg font-medium hover:bg-[var(--btn-primary-hover)] disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {loading ? 'Sende...' : 'Reset-Link senden'}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => { setResetMode(false); setError(null); setResetSent(false) }}
                className="w-full mt-3 text-sm text-text-muted hover:text-text-secondary cursor-pointer"
              >
                Zurück zur Anmeldung
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-text-secondary mb-1">E-Mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-main text-text-primary focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  placeholder="name@js-fenster.de"
                  required
                  autoFocus
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-text-secondary mb-1">Passwort</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-border-default rounded-lg bg-surface-main text-text-primary focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                    placeholder="Passwort"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-500 mb-3">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-[var(--btn-primary)] text-white rounded-lg font-medium hover:bg-[var(--btn-primary-hover)] disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn size={16} />
                    Anmelden
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setResetMode(true); setError(null) }}
                className="w-full mt-3 text-sm text-text-muted hover:text-text-secondary cursor-pointer"
              >
                Passwort vergessen?
              </button>
            </form>
          )}
        </div>
        <p className="text-center text-xs text-text-muted mt-4">J.S. Fenster & Türen GmbH</p>
      </div>
    </div>
  )
}
