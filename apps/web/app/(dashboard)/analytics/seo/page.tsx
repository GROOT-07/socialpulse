import type { Metadata } from 'next'
import { SEOAnalyticsPage } from '@/components/analytics/SEOAnalyticsPage'

export const metadata: Metadata = { title: 'Search & SEO Analytics' }

export default function SEOAnalyticsRoute() {
  return <SEOAnalyticsPage />
}
