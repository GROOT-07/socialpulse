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

const INDUSTRIES = [
  'Healthcare & Medical',
  'Restaurant & Food',
  'Retail & E-commerce',
  'Education',
  'Non-profit & NGO',
  'Real estate',
  'Fitness & Wellness',
  'Beauty & Personal care',
  'Technology',
  'Professional services',
  'Hospitality & Tourism',
  'Finance & Insurance',
  'Other',
]

const registerSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Include at least one uppercase letter')
    .regex(/[0-9]/, 'Include at least one number'),
  orgName: z.string().min(2, 'Organization name must be at least 2 characters').max(80),
  industry: z.string().min(1, 'Select your industry'),
})

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const { setActiveOrg, setOrgs } = useOrgStore()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const passwordValue = watch('password', '')

  const passwordStrength = (() => {
    if (!passwordValue) return 0
    let score = 0
    if (passwordValue.length >= 8)  score++
    if (/[A-Z]/.test(passwordValue)) score++
    if (/[0-9]/.test(passwordValue)) score++
    if (/[^A-Za-z0-9]/.test(passwordValue)) score++
    return score
  })()

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][passwordStrength]
  const strengthColor = ['', 'bg-danger', 'bg-warning', 'bg-info', 'bg-success'][passwordStrength]

  const onSubmit = async (data: RegisterForm) => {
    setServerError(null)
    try {
      const res = await authApi.register(data) as {
        user: { id: string; email: string; role: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'VIEWER'; activeOrgId: string | null }
        org: { id: string; name: string; slug: string; logoUrl: null; brandColor: string | null; industry: string; activePlatforms: string[] }
        tokens: { accessToken: string; refreshToken: string }
      }

      setAuth(res.user, res.tokens)
      setOrgs([res.org])
      setActiveOrg(res.org)

      router.replace('/onboarding')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setServerError('An account with this email already exists.')
      } else if (err instanceof ApiError) {
        setServerError(err.message)
      } else if (err instanceof Error) {
        setServerError(err.message)
      } else {
        setServerError("Couldn't create account. Check your connection and retry.")
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>Set up SocialPulse for your organization in minutes.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {serverError && (
            <div role="alert" className="rounded-lg border border-danger bg-danger-light px-3 py-2.5 text-sm text-danger-text">
              {serverError}
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="reg-email">Work email</Label>
            <Input
              id="reg-email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              error={!!errors.email}
              {...register('email')}
            />
            {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="reg-password">Password</Label>
            <div className="relative">
              <Input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Min. 8 characters"
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
            {/* Strength meter */}
            {passwordValue.length > 0 && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors duration-normal ${
                        i <= passwordStrength ? strengthColor : 'bg-surface-3'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-[var(--color-text-4)]">
                  Password strength:{' '}
                  <span className="font-medium text-[var(--color-text-3)]">{strengthLabel}</span>
                </p>
              </div>
            )}
            {errors.password && <p className="text-xs text-danger">{errors.password.message}</p>}
          </div>

          {/* Org name */}
          <div className="space-y-1.5">
            <Label htmlFor="orgName">Organization name</Label>
            <Input
              id="orgName"
              type="text"
              autoComplete="organization"
              placeholder="Acme Clinic, Joe's Pizza, etc."
              error={!!errors.orgName}
              {...register('orgName')}
            />
            {errors.orgName && <p className="text-xs text-danger">{errors.orgName.message}</p>}
          </div>

          {/* Industry */}
          <div className="space-y-1.5">
            <Label htmlFor="industry">Industry</Label>
            <select
              id="industry"
              className="flex h-9 w-full rounded border border-brand-border-2 bg-surface px-3 text-base text-[var(--color-text)] transition-shadow duration-fast focus-visible:outline-none focus-visible:border-accent focus-visible:shadow-accent"
              {...register('industry')}
            >
              <option value="">Select your industry</option>
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
            {errors.industry && <p className="text-xs text-danger">{errors.industry.message}</p>}
          </div>

          <Button type="submit" variant="primary" className="w-full" loading={isSubmitting}>
            Create account
          </Button>

          <p className="text-center text-xs text-[var(--color-text-4)]">
            By creating an account you agree to our{' '}
            <Link href="/terms" className="text-accent hover:underline">Terms</Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-accent hover:underline">Privacy policy</Link>.
          </p>
        </form>

        <p className="mt-5 text-center text-sm text-[var(--color-text-4)]">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
