/**
 * seed-special-days.ts
 * Run: npx tsx src/scripts/seed-special-days.ts
 *
 * Seeds the SpecialDay table with global holidays, awareness days,
 * and industry-relevant celebrations useful for content planning.
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ── Helper to build a date for the current year ───────────────
function d(month: number, day: number, year = new Date().getFullYear()): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

// ── All special days ──────────────────────────────────────────
const SPECIAL_DAYS = [
  // ── Global Holidays ──────────────────────────────────────────
  {
    name: "New Year's Day",
    date: d(1, 1),
    category: 'INTERNATIONAL' as const,
    countries: [] as string[],
    industries: [] as string[],
    draftPostTemplate: "Happy New Year! 🎉 As we step into [YEAR], we're excited to bring you [VALUE_PROP]. Here's to a year of growth and new beginnings! #NewYear #HappyNewYear",
  },
  {
    name: "Valentine's Day",
    date: d(2, 14),
    category: 'INTERNATIONAL' as const,
    countries: [],
    industries: [],
    draftPostTemplate: "Love is in the air! 💕 This Valentine's Day, show some love to the people who matter most. [ORG_SPECIFIC_MESSAGE] #ValentinesDay #Love",
  },
  {
    name: "International Women's Day",
    date: d(3, 8),
    category: 'INTERNATIONAL' as const,
    countries: [],
    industries: [],
    draftPostTemplate: "Happy International Women's Day! 💪 Today we celebrate the incredible women who inspire us every day. [ORG_SPECIFIC_MESSAGE] #IWD2025 #InternationalWomensDay #WomenEmpowerment",
  },
  {
    name: 'World Health Day',
    date: d(4, 7),
    category: 'INTERNATIONAL' as const,
    countries: [],
    industries: ['Health', 'Wellness', 'Fitness', 'Nutrition'],
    draftPostTemplate: "Today is World Health Day! 🌍💚 Your health is your greatest asset. [HEALTH_TIP_OR_SERVICE] #WorldHealthDay #HealthForAll",
  },
  {
    name: 'Earth Day',
    date: d(4, 22),
    category: 'INTERNATIONAL' as const,
    countries: [],
    industries: [],
    draftPostTemplate: "Happy Earth Day! 🌎 We're committed to doing our part for a sustainable future. [SUSTAINABILITY_MESSAGE] #EarthDay #Sustainability #GoGreen",
  },
  {
    name: "International Children's Day",
    date: d(6, 1),
    category: 'INTERNATIONAL' as const,
    countries: [],
    industries: ['Education', 'Health', 'Retail', 'Food & Beverage'],
    draftPostTemplate: "Happy International Children's Day! 👦👧 Today we celebrate the future — our children. [ORG_SPECIFIC_MESSAGE] #ChildrensDay #HappyChildrensDay",
  },
  {
    name: 'World Environment Day',
    date: d(6, 5),
    category: 'INTERNATIONAL' as const,
    countries: [],
    industries: [],
    draftPostTemplate: "World Environment Day 🌿 reminds us that small actions lead to big change. Here's how we're contributing: [ECO_ACTION] #WorldEnvironmentDay #ForNature",
  },
  {
    name: 'International Yoga Day',
    date: d(6, 21),
    category: 'INTERNATIONAL' as const,
    countries: [],
    industries: ['Health', 'Wellness', 'Fitness'],
    draftPostTemplate: "Happy International Yoga Day! 🧘 Mind, body, and soul in harmony. [YOGA_TIP_OR_CLASS_PROMO] #YogaDay #InternationalYogaDay #Wellness",
  },
  {
    name: 'World Social Media Day',
    date: d(6, 30),
    category: 'INDUSTRY' as const,
    countries: [],
    industries: ['Marketing', 'Technology', 'Media'],
    draftPostTemplate: "Happy World Social Media Day! 📱 Social media has changed how we connect and grow. Here's our story: [BRAND_SOCIAL_JOURNEY] #SMDay #SocialMediaDay",
  },
  {
    name: 'Independence Day (US)',
    date: d(7, 4),
    category: 'NATIONAL_HOLIDAY' as const,
    countries: ['US'],
    industries: [],
    draftPostTemplate: "Happy 4th of July! 🇺🇸 Celebrating freedom and the spirit of America. [ORG_MESSAGE] #4thOfJuly #IndependenceDay #USA",
  },
  {
    name: 'Friendship Day',
    date: d(8, 3),
    category: 'INTERNATIONAL' as const,
    countries: [],
    industries: [],
    draftPostTemplate: "Happy Friendship Day! 🤝 Tag your friends who make every day better! We're grateful for the community that supports us. #FriendshipDay #Friends",
  },
  {
    name: 'World Photography Day',
    date: d(8, 19),
    category: 'INTERNATIONAL' as const,
    countries: [],
    industries: ['Photography', 'Art', 'Media', 'Marketing'],
    draftPostTemplate: "Happy World Photography Day! 📸 A picture is worth a thousand words — here's one of ours: [BRAND_PHOTO] #WorldPhotographyDay #Photography",
  },
  {
    name: 'International Coffee Day',
    date: d(10, 1),
    category: 'INTERNATIONAL' as const,
    countries: [],
    industries: ['Food & Beverage', 'Hospitality', 'Retail'],
    draftPostTemplate: "Happy International Coffee Day! ☕ Life is too short for bad coffee. [COFFEE_PROMO_OR_TIP] #InternationalCoffeeDay #CoffeeLovers",
  },
  {
    name: 'World Mental Health Day',
    date: d(10, 10),
    category: 'INTERNATIONAL' as const,
    countries: [],
    industries: ['Health', 'Wellness', 'Education'],
    draftPostTemplate: "Today is World Mental Health Day 💚 Mental health matters just as much as physical health. [RESOURCE_OR_MESSAGE] #WorldMentalHealthDay #MentalHealthMatters",
  },
  {
    name: 'Halloween',
    date: d(10, 31),
    category: 'INTERNATIONAL' as const,
    countries: [],
    industries: [],
    draftPostTemplate: "👻 Happy Halloween! What's spookier than [INDUSTRY_CHALLENGE]? Nothing! Have a safe and fun Halloween from all of us. #Halloween #TrickOrTreat",
  },
  {
    name: 'Diwali',
    date: d(11, 1),
    category: 'NATIONAL_HOLIDAY' as const,
    countries: ['IN'],
    industries: [],
    draftPostTemplate: "Wishing everyone a joyous Diwali! 🪔 May this festival of lights bring happiness, prosperity, and success to you and your family. #Diwali #FestivalOfLights #HappyDiwali",
  },
  {
    name: 'World Kindness Day',
    date: d(11, 13),
    category: 'INTERNATIONAL' as const,
    countries: [],
    industries: [],
    draftPostTemplate: "Today is World Kindness Day 💛 Small acts of kindness can change someone's entire day. How are you spreading kindness today? #WorldKindnessDay #BeKind",
  },
  {
    name: 'Thanksgiving (US)',
    date: d(11, 28),
    category: 'NATIONAL_HOLIDAY' as const,
    countries: ['US'],
    industries: [],
    draftPostTemplate: "Happy Thanksgiving! 🦃 We're grateful for every single one of you. [GRATITUDE_MESSAGE] #Thanksgiving #Grateful #ThankYou",
  },
  {
    name: 'Black Friday',
    date: d(11, 29),
    category: 'INDUSTRY' as const,
    countries: ['US'],
    industries: ['Retail', 'E-commerce', 'Fashion'],
    draftPostTemplate: "🖤 Black Friday is HERE! Don't miss out on [OFFER_DETAILS]. [CTA_LINK] #BlackFriday #BlackFridayDeals #Sale",
  },
  {
    name: 'Cyber Monday',
    date: d(12, 2),
    category: 'INDUSTRY' as const,
    countries: ['US'],
    industries: ['Retail', 'E-commerce', 'Technology'],
    draftPostTemplate: "💻 Cyber Monday deals are LIVE! [OFFER_DETAILS] — only available for the next 24 hours. [CTA_LINK] #CyberMonday #CyberDeals",
  },
  {
    name: 'Christmas Eve',
    date: d(12, 24),
    category: 'INTERNATIONAL' as const,
    countries: [],
    industries: [],
    draftPostTemplate: "🎄 Merry Christmas Eve! Wishing you a magical evening with your loved ones. From our family to yours — Happy Holidays! #ChristmasEve #MerryChristmas",
  },
  {
    name: 'Christmas Day',
    date: d(12, 25),
    category: 'INTERNATIONAL' as const,
    countries: [],
    industries: [],
    draftPostTemplate: "🎅 Merry Christmas! May your day be filled with joy, love, and warmth. [ORG_SPECIFIC_MESSAGE] #MerryChristmas #Christmas #HappyHolidays",
  },
  {
    name: "New Year's Eve",
    date: d(12, 31),
    category: 'INTERNATIONAL' as const,
    countries: [],
    industries: [],
    draftPostTemplate: "What a year it's been! 🥂 As we count down to [NEXT_YEAR], we're reflecting on [HIGHLIGHTS] and looking forward to [FUTURE_PLANS]. See you on the other side! #NewYearsEve #Goodbye2025",
  },

  // ── Industry-specific days ────────────────────────────────────
  {
    name: 'World Food Day',
    date: d(10, 16),
    category: 'INTERNATIONAL' as const,
    countries: [],
    industries: ['Food & Beverage', 'Restaurant', 'Hospitality', 'Agriculture'],
    draftPostTemplate: "Happy World Food Day! 🍽️ Food is more than sustenance — it's culture, community, and care. [ORG_FOOD_MESSAGE] #WorldFoodDay #FoodForAll",
  },
  {
    name: 'World Tourism Day',
    date: d(9, 27),
    category: 'INTERNATIONAL' as const,
    countries: [],
    industries: ['Tourism', 'Hospitality', 'Travel'],
    draftPostTemplate: "Happy World Tourism Day! ✈️ The world is a book — explore more pages. [DESTINATION_OR_SERVICE_PROMO] #WorldTourismDay #Travel #Explore",
  },
  {
    name: 'World Teachers Day',
    date: d(10, 5),
    category: 'INTERNATIONAL' as const,
    countries: [],
    industries: ['Education'],
    draftPostTemplate: "Happy World Teachers Day! 📚 To every teacher who shapes minds and changes lives — thank you. [ORG_EDUCATION_MESSAGE] #WorldTeachersDay #TeachersDay",
  },
  {
    name: "Doctor's Day",
    date: d(7, 1),
    category: 'INTERNATIONAL' as const,
    countries: [],
    industries: ['Health', 'Medical'],
    draftPostTemplate: "Happy Doctor's Day! 👨‍⚕️ We salute the dedicated professionals who keep us healthy. [HEALTH_MESSAGE] #DoctorsDay #HealthcareHeroes",
  },
  {
    name: 'World Entrepreneurship Day',
    date: d(8, 21),
    category: 'INDUSTRY' as const,
    countries: [],
    industries: ['Business', 'Startup', 'Finance'],
    draftPostTemplate: "Happy World Entrepreneurship Day! 🚀 Every big success started with one brave decision. [FOUNDER_STORY_OR_INSPIRATION] #EntrepreneurshipDay #Entrepreneur",
  },
  {
    name: 'World Social Justice Day',
    date: d(2, 20),
    category: 'INTERNATIONAL' as const,
    countries: [],
    industries: [],
    draftPostTemplate: "Today is World Day of Social Justice 🌍 Equal opportunity and dignity for all. [ORG_VALUES_MESSAGE] #SocialJustice #Equality",
  },
  {
    name: 'Pi Day',
    date: d(3, 14),
    category: 'INDUSTRY' as const,
    countries: [],
    industries: ['Technology', 'Education', 'Science'],
    draftPostTemplate: "Happy Pi Day! 🥧 3.14159… and counting! Fun fact: [INDUSTRY_FUN_FACT] #PiDay #Math #STEM",
  },
  {
    name: 'World Password Day',
    date: d(5, 1),
    category: 'INDUSTRY' as const,
    countries: [],
    industries: ['Technology', 'Cybersecurity', 'Finance'],
    draftPostTemplate: "It's World Password Day! 🔐 Reminder: Use strong, unique passwords and enable 2FA. Stay safe online! [SECURITY_TIP] #WorldPasswordDay #Cybersecurity",
  },
]

// ── Upsert all special days ───────────────────────────────────
async function main(): Promise<void> {
  console.log(`🌱 Seeding ${SPECIAL_DAYS.length} special days…`)

  let inserted = 0
  let updated = 0

  for (const day of SPECIAL_DAYS) {
    const result = await prisma.specialDay.upsert({
      where: { name_date: { name: day.name, date: day.date } },
      update: {
        category: day.category,
        countries: day.countries,
        industries: day.industries,
        draftPostTemplate: day.draftPostTemplate,
      },
      create: {
        name: day.name,
        date: day.date,
        category: day.category,
        countries: day.countries,
        industries: day.industries,
        draftPostTemplate: day.draftPostTemplate,
      },
    })

    if (result.createdAt.getTime() === result.createdAt.getTime()) {
      inserted++
    } else {
      updated++
    }
    console.log(`  ✓ ${day.name} (${day.date.toISOString().slice(0, 10)})`)
  }

  console.log(`\n✅ Done — ${SPECIAL_DAYS.length} special days seeded`)
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
