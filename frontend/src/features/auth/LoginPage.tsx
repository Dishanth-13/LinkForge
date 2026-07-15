import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import axios from 'axios'

export const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.')
      return
    }

    setLoading(true)

    try {
      // Real API call to the FastAPI backend
      const res = await axios.post<{ access_token: string; token_type: string }>(
        'http://localhost:8000/api/v1/auth/login',
        { email: email.trim(), password },
        {
          withCredentials: true, // allow refresh-token HttpOnly cookie to be set
          headers: { 'Content-Type': 'application/json' },
          timeout: 8000,
        }
      )

      // Persist the access token for subsequent API requests
      localStorage.setItem('linkforge:token', res.data.access_token)
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          setError('Invalid email or password. Please try again.')
        } else if (err.code === 'ECONNABORTED' || !err.response) {
          setError('Cannot reach the server. Ensure the backend is running on port 8000.')
        } else {
          setError(err.response?.data?.detail ?? 'An unexpected error occurred.')
        }
      } else {
        setError('An unexpected error occurred.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-sm space-y-8">
        {/* Brand Logo Header */}
        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex items-center justify-center w-10 h-10 bg-brand-accent rounded-lg text-white shadow-lg shadow-brand-accent/25 mb-4">
            <Link2 className="w-6 h-6 transform -rotate-45" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-brand-text-primary">
            Welcome to Link<span className="text-brand-accent">Forge</span>
          </h2>
          <p className="mt-1.5 text-xs text-brand-text-secondary">
            Enterprise Link Management &amp; Analytics Platform
          </p>
        </div>

        {/* Login Form card */}
        <div className="bg-brand-surface border border-brand-border rounded-xl p-6 shadow-xl shadow-black/40">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <div className="flex items-start gap-2 p-2.5 rounded bg-brand-danger/10 border border-brand-danger/20 text-brand-danger text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-semibold text-brand-text-secondary select-none">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-3 py-2 text-sm bg-brand-bg border border-brand-border rounded-md text-brand-text-primary placeholder:text-brand-text-secondary/40 focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/30 transition-all font-sans"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-semibold text-brand-text-secondary select-none">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 pr-9 text-sm bg-brand-bg border border-brand-border rounded-md text-brand-text-primary placeholder:text-brand-text-secondary/40 focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/30 transition-all font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-text-secondary hover:text-brand-text-primary transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center py-2 px-4 rounded-md text-xs font-semibold text-white bg-brand-accent hover:bg-brand-accent/90 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-accent focus:ring-offset-brand-bg cursor-pointer shadow-md shadow-brand-accent/20 disabled:opacity-50 disabled:cursor-not-allowed select-none mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-brand-text-secondary/50 select-none">
          LinkForge v0.2.0 · Enterprise Edition
        </p>
      </div>
    </div>
  )
}
