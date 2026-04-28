'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { authApi, ApiError } from '@/lib/api'

const schema = z.object({ email: z.string().email('Enter a valid email address') })
type Form = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: Form) => {
    setServerError(null)
    try {
      await authApi.forgotPassword(data.email)
      setSent(true)
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Couldn't send reset email. Try again.")
    }
  }

  if (sent) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-success" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Check your inbox</h2>
          <p className="mt-2 text-sm text-[var(--color-text-3)]">
            If that email exists, you'll receive a reset link shortly.
          </p>
          <Link href="/login" className="mt-6 inline-block text-sm font-medium text-accent hover:underline">
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Reset your password</CardTitle>
        <CardDescription>We'll send a reset link to your email address.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {serverError && (
            <div role="alert" className="rounded-lg border border-danger bg-danger-light px-3 py-2.5 text-sm text-danger-text">
              {serverError}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="fp-email">Email address</Label>
            <Input id="fp-email" type="email" autoComplete="email" placeholder="you@company.com"
              error={!!errors.email} {...register('email')} />
            {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
          </div>
          <Button type="submit" variant="primary" className="w-full" loading={isSubmitting}>
            Send reset link
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-[var(--color-text-4)]">
          <Link href="/login" className="font-medium text-accent hover:underline">Back to sign in</Link>
        </p>
      </CardContent>
    </Card>
  )
}
