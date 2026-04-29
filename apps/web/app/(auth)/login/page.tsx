'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { authApi, ApiError } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { useOrgStore } from '@/store/org.store'
import { orgsApi } from '@/lib/api'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const { setActiveOrg, setOrgs } = useOrgStore()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: false },
  })

  const onSubmit = async (data: LoginForm) => {
    setServerError(null)
    try {
      const res = await authApi.login(data) as {
        user: { id: string; email: string; role: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'VIEWER'; activeOrgId: string | null }
        tokens: { accessToken: string; refreshToken: string }
      }

      setAuth(res.user, res.tokens)

      // Load orgs and set active
      const orgs = await orgsApi.list() as Array<{ id: string; name: string; slug: string; logoUrl: string | null; brandColor: string | null; industry: string; activePlatforms: string[] }>
      setOrgs(orgs)

      const activeOrgId = res.user.activeOrgId
      const activeOrg = activeOrgId ? orgs.find((o) => o.id === activeOrgId) : orgs[0]
      if (activeOrg) setActiveOrg(activeOrg)

      router.replace('/')
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message)
      } else if (err instanceof Error) {
        setServerError(err.message)
      } else {
        setServerError("Couldn't sign in. Check your connection and retry.")
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>Enter your email and password to continue.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {/* Server error */}
          {serverError && (
            <div
              role="alert"
              className="rounded-lg border border-danger bg-danger-light px-3 py-2.5 text-sm text-danger-text"
            >
              {serverError}
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              error={!!errors.email}
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-danger">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-accent hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                error={!!errors.password}
                className="pr-9"
                {...register('password')}
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-4)] hover:text-[var(--color-text-3)] transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-danger">{errors.password.message}</p>
            )}
          </div>

          {/* Remember me */}
          <div className="flex items-center gap-2">
            <input
              id="rememberMe"
              type="checkbox"
              className="h-4 w-4 rounded border-brand-border-2 accent-[var(--color-accent)]"
              {...register('rememberMe')}
            />
            <Label htmlFor="rememberMe" className="cursor-pointer font-normal">
              Remember me for 90 days
            </Label>
          </div>

          {/* Submit */}
          <Button type="submit" variant="primary" className="w-full" loading={isSubmitting}>
            Sign in
          </Button>
        </form>

        {/* Divider */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-brand-border" />
          </div>
          <div className="relative flex justify-center text-xs text-[var(--color-text-4)]">
            <span className="bg-surface px-2">or</span>
          </div>
        </div>

        {/* Google OAuth placeholder */}
        <Button variant="secondary" className="w-full gap-2" type="button" disabled>
          {/* Google G icon */}
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </Button>

        <p className="mt-5 text-center text-sm text-[var(--color-text-4)]">
          Don't have an account?{' '}
          <Link href="/register" className="font-medium text-accent hover:underline">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
