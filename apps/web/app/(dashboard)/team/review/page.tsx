import type { Metadata } from 'next'
import { ContentReviewPage } from '@/components/team/ContentReviewPage'

export const metadata: Metadata = { title: 'Content Review — Team Hub' }

export default function ContentReviewRoute() {
  return <ContentReviewPage />
}
