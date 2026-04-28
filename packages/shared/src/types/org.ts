export type Platform = 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE' | 'WHATSAPP' | 'GOOGLE'

export interface Org {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  brandColor: string | null
  industry: string
  city: string | null
  country: string | null
  activePlatforms: Platform[]
  ownerId: string
  createdAt: string
}

export interface CreateOrgBody {
  name: string
  industry: string
  city?: string
  country?: string
  brandColor?: string
}

export interface UpdateOrgBody extends Partial<CreateOrgBody> {
  logoUrl?: string
  activePlatforms?: Platform[]
  timezone?: string
}
