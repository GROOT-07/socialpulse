import type { Metadata } from 'next'
import { TeamNotesPage } from '@/components/team/TeamNotesPage'

export const metadata: Metadata = { title: 'Team Notes — Team Hub' }

export default function TeamNotesRoute() {
  return <TeamNotesPage />
}
