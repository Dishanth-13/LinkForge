import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { Card } from '../../shared/ui/Card'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'
import { useToast } from '../../shared/ui/Toast'
import { getApiErrorDetail, isApiError } from '../../shared/lib/api'
import { useAuth } from './AuthContext'
import { registerSchema, type RegisterFormValues } from './authSchemas'

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  required?: boolean
}

const Field: React.FC<FieldProps> = ({ label, error, required, className, ...props }) => (
  <div className="space-y-1.5">
    <label htmlFor={props.id} className="text-xs font-semibold text-brand-text-secondary select-none">
      {label} {required && <span className="text-brand-danger">*</span>}
    </label>
    <input
      {...props}
      className={className ?? 'w-full px-3 py-2 text-sm bg-brand-bg border border-brand-border rounded-md text-brand-text-primary placeholder:text-brand-text-secondary/40 focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/30 transition-all font-sans'}
    />
    {error && <p className="text-[11px] text-brand-danger">{error}</p>}
  </div>
)

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate()
  const { register: registerWorkspace } = useAuth()
  const { toast } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: '',
      org_name: '',
      email: '',
      password: '',
      confirm_password: '',
    },
  })

  const onSubmit = async (values: RegisterFormValues) => {
    setSubmitting(true)
    try {
      const res = await registerWorkspace({
        full_name: values.full_name,
        org_name: values.org_name,
        email: values.email.trim(),
        password: values.password,
      })

      if (res.access_token) {
        toast('Workspace created and signed in successfully.', 'success')
        navigate('/dashboard', { replace: true })
        return
      }

      toast('Workspace created successfully. Please sign in.', 'success')
      navigate('/login', { replace: true })
    } catch (error: unknown) {
      if (isApiError(error)) {
        if (error.response?.status === 409) {
          toast('An account with that email already exists.', 'error')
        } else if (error.response?.status === 400) {
          toast(getApiErrorDetail(error, 'Unable to create workspace.'), 'error')
        } else if (error.code === 'ECONNABORTED' || !error.response) {
          toast('Cannot reach the server. Ensure the backend is running on port 8000.', 'error')
        } else {
          toast(getApiErrorDetail(error, 'Unable to create workspace.'), 'error')
        }
      } else {
        toast('An unexpected error occurred.', 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex items-center justify-center w-10 h-10 bg-brand-accent rounded-lg text-white shadow-lg shadow-brand-accent/25 mb-4">
            <Link2 className="w-6 h-6 transform -rotate-45" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-brand-text-primary">
            Create your Link<span className="text-brand-accent">Forge</span> workspace
          </h2>
          <p className="mt-1.5 text-xs text-brand-text-secondary">
            Enterprise Link Management &amp; Analytics Platform
          </p>
        </div>

        <Card className="bg-brand-surface border border-brand-border rounded-xl p-6 shadow-xl shadow-black/40">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2 p-2.5 rounded bg-brand-accent/10 border border-brand-accent/20 text-brand-text-secondary text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-brand-accent" />
                <span>Full name is collected for your workspace profile and can be used later for display purposes.</span>
              </div>
            </div>

            <Field
              id="full_name"
              label="Full Name"
              required
              type="text"
              autoComplete="name"
              placeholder="Jane Doe"
              error={errors.full_name?.message}
              {...register('full_name')}
            />

            <Field
              id="org_name"
              label="Organization Name"
              required
              type="text"
              autoComplete="organization"
              placeholder="Acme Corporation"
              error={errors.org_name?.message}
              {...register('org_name')}
            />

            <Field
              id="email"
              label="Email address"
              required
              type="email"
              autoComplete="email"
              placeholder="name@company.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-semibold text-brand-text-secondary select-none">
                Password <span className="text-brand-danger">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Create a strong password"
                  className="w-full px-3 py-2 pr-9 text-sm bg-brand-bg border border-brand-border rounded-md text-brand-text-primary placeholder:text-brand-text-secondary/40 focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/30 transition-all font-sans"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-text-secondary hover:text-brand-text-primary transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password?.message && <p className="text-[11px] text-brand-danger">{errors.password.message}</p>}
            </div>

            <Field
              id="confirm_password"
              label="Confirm Password"
              required
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              error={errors.confirm_password?.message}
              {...register('confirm_password')}
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center py-2 px-4 rounded-md text-xs font-semibold text-white bg-brand-accent hover:bg-brand-accent/90 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-accent focus:ring-offset-brand-bg cursor-pointer shadow-md shadow-brand-accent/20 disabled:opacity-50 disabled:cursor-not-allowed select-none mt-2"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  Creating workspace…
                </span>
              ) : (
                'Create Workspace'
              )}
            </button>
          </form>
        </Card>

        <div className="space-y-2 text-center">
          <p className="text-[11px] text-brand-text-secondary/50 select-none">
            Already have a workspace?
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-accent hover:text-brand-accent/80 transition-colors"
          >
            Sign in →
          </Link>
        </div>

        <p className="text-center text-[11px] text-brand-text-secondary/50 select-none">
          LinkForge v0.2.0 · Enterprise Edition
        </p>
      </div>
    </div>
  )
}
