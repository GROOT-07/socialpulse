/**
 * seed-special-days.ts
 * Run: npx tsx src/scripts/seed-special-days.ts
 *
 * Seeds the SpecialDay table with 200+ global holidays, Indian festivals,
 * awareness days, and industry-relevant celebrations for content planning.
 *
 * Note: Dates for lunar/moveable feasts (Diwali, Eid, Holi, etc.) use
 * approximate 2025 dates. Re-run this script each year with updated dates.
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ── Helper to build a date ────────────────────────────────────
function d(month: number, day: number, year = new Date().getFullYear()): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

const IND = ['IN']
const ALL: string[] = []

// ── All special days ──────────────────────────────────────────
const SPECIAL_DAYS = [

  // ══════════════════════════════════════════════════════
  // SECTION 1: JANUARY
  // ══════════════════════════════════════════════════════
  {
    name: "New Year's Day",
    date: d(1, 1),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: [] as string[],
    draftPostTemplate: "Happy New Year! 🎉 As we step into the new year, we're excited to bring you [VALUE_PROP]. Here's to a year of growth and new beginnings! #HappyNewYear #NewYear2025",
  },
  {
    name: 'Makar Sankranti / Pongal',
    date: d(1, 14),
    category: 'RELIGIOUS' as const,
    countries: IND,
    industries: [] as string[],
    draftPostTemplate: "Happy Makar Sankranti / Pongal! 🪁🌾 May this harvest festival bring warmth, joy, and abundance to you and your family. #MakarSankranti #Pongal #HarvestFestival",
  },
  {
    name: 'Lohri',
    date: d(1, 13),
    category: 'RELIGIOUS' as const,
    countries: IND,
    industries: [] as string[],
    draftPostTemplate: "Happy Lohri! 🔥 Wishing you and your family the warmth of the bonfire and the sweetness of the season. #Lohri #HappyLohri",
  },
  {
    name: 'Republic Day (India)',
    date: d(1, 26),
    category: 'NATIONAL_HOLIDAY' as const,
    countries: IND,
    industries: [] as string[],
    draftPostTemplate: "Happy Republic Day! 🇮🇳 On this 76th Republic Day, we salute the spirit of our great nation and the values of democracy, unity, and progress. #RepublicDay #JaiHind #ProudIndian",
  },

  // ══════════════════════════════════════════════════════
  // SECTION 2: FEBRUARY
  // ══════════════════════════════════════════════════════
  {
    name: "Valentine's Day",
    date: d(2, 14),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: [] as string[],
    draftPostTemplate: "Love is in the air! 💕 This Valentine's Day, show some love to the people who matter most. [ORG_SPECIFIC_MESSAGE] #ValentinesDay #Love #Celebrate",
  },
  {
    name: 'World Cancer Day',
    date: d(2, 4),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Healthcare', 'Medical', 'Wellness'],
    draftPostTemplate: "Today is World Cancer Day. 🎗️ Early detection saves lives. [HEALTH_TIP_OR_SERVICE] #WorldCancerDay #CancerAwareness #EarlyDetection",
  },
  {
    name: 'World Radio Day',
    date: d(2, 13),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Media', 'Entertainment', 'Marketing'],
    draftPostTemplate: "Celebrating World Radio Day! 📻 Radio connects communities and amplifies voices. [BRAND_MESSAGE] #WorldRadioDay",
  },
  {
    name: 'National Science Day (India)',
    date: d(2, 28),
    category: 'NATIONAL_HOLIDAY' as const,
    countries: IND,
    industries: ['Education', 'Technology', 'Healthcare'],
    draftPostTemplate: "Happy National Science Day! 🔬 Celebrating the spirit of discovery and innovation that shapes our tomorrow. #NationalScienceDay #Science #Innovation",
  },

  // ══════════════════════════════════════════════════════
  // SECTION 3: MARCH
  // ══════════════════════════════════════════════════════
  {
    name: "International Women's Day",
    date: d(3, 8),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: [] as string[],
    draftPostTemplate: "Happy International Women's Day! 💪 Today we celebrate the incredible women who inspire us every day. [ORG_SPECIFIC_MESSAGE] #IWD2025 #InternationalWomensDay #WomenEmpowerment",
  },
  {
    name: 'Holi',
    date: d(3, 14),
    category: 'RELIGIOUS' as const,
    countries: IND,
    industries: [] as string[],
    draftPostTemplate: "Happy Holi! 🎨🌈 May the colours of Holi bring joy, laughter, and endless happiness to your life! #HappyHoli #FestivalOfColours #Holi2025",
  },
  {
    name: 'World Consumer Rights Day',
    date: d(3, 15),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Retail', 'E-commerce', 'Legal'],
    draftPostTemplate: "Today is World Consumer Rights Day! 🛡️ We're committed to transparency, quality, and putting YOU first. [VALUE_PROP] #ConsumerRightsDay",
  },
  {
    name: 'World Happiness Day',
    date: d(3, 20),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: [] as string[],
    draftPostTemplate: "Happy World Happiness Day! 😊 What brings you joy today? [BRAND_CONNECTION] #WorldHappinessDay #Happiness #Joy",
  },
  {
    name: 'Ugadi / Gudi Padwa',
    date: d(3, 30),
    category: 'RELIGIOUS' as const,
    countries: IND,
    industries: [] as string[],
    draftPostTemplate: "Happy Ugadi & Gudi Padwa! 🌺 May this Telugu & Maharashtrian New Year bring new beginnings, prosperity, and success. Subhakankshalu! #Ugadi #GudiPadwa #NewYear",
  },
  {
    name: 'World Theatre Day',
    date: d(3, 27),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Entertainment', 'Arts', 'Education'],
    draftPostTemplate: "Happy World Theatre Day! 🎭 The stage is where stories come alive. [BRAND_STORYTELLING] #WorldTheatreDay #Theatre",
  },

  // ══════════════════════════════════════════════════════
  // SECTION 4: APRIL
  // ══════════════════════════════════════════════════════
  {
    name: "April Fool's Day",
    date: d(4, 1),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: [] as string[],
    draftPostTemplate: "April Fools! 😄 We almost announced [FUNNY_FAKE_NEWS] — but today we want to remind you that the real deal is [ACTUAL_SERVICE/PRODUCT]. Happy April Fools' Day! #AprilFools",
  },
  {
    name: 'World Health Day',
    date: d(4, 7),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Healthcare', 'Medical', 'Wellness', 'Fitness', 'Pharmacy'],
    draftPostTemplate: "Today is World Health Day! 🌍💚 Your health is your greatest asset. [HEALTH_TIP_OR_SERVICE] #WorldHealthDay #HealthForAll #HealthDay2025",
  },
  {
    name: 'Vishu',
    date: d(4, 14),
    category: 'RELIGIOUS' as const,
    countries: IND,
    industries: [] as string[],
    draftPostTemplate: "Happy Vishu! 🌸 May the first sight of this day bring you a year full of prosperity, joy, and good fortune. Vishu Ashamsakal! #Vishu #VishuAshamsakal",
  },
  {
    name: 'Dr. Ambedkar Jayanti',
    date: d(4, 14),
    category: 'NATIONAL_HOLIDAY' as const,
    countries: IND,
    industries: [] as string[],
    draftPostTemplate: "On the birth anniversary of Dr. B.R. Ambedkar, we honour his vision of equality, justice, and a united India. 🙏 #AmbedkarJayanti #DrBRAmbedkar",
  },
  {
    name: 'Baisakhi',
    date: d(4, 13),
    category: 'RELIGIOUS' as const,
    countries: IND,
    industries: [] as string[],
    draftPostTemplate: "Happy Baisakhi! 🌾🥳 Celebrating the harvest season and the spirit of new beginnings. May this Baisakhi bring you joy and prosperity. #Baisakhi #HappyBaisakhi",
  },
  {
    name: 'Earth Day',
    date: d(4, 22),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: [] as string[],
    draftPostTemplate: "Happy Earth Day! 🌎 We're committed to doing our part for a sustainable future. [SUSTAINABILITY_MESSAGE] #EarthDay #Sustainability #GoGreen #ClimateAction",
  },
  {
    name: 'World Book Day',
    date: d(4, 23),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Education', 'Publishing', 'E-commerce'],
    draftPostTemplate: "Happy World Book Day! 📚 A good book can change your world. What are you reading this year? [BRAND_TIE_IN] #WorldBookDay #Reading #Books",
  },

  // ══════════════════════════════════════════════════════
  // SECTION 5: MAY
  // ══════════════════════════════════════════════════════
  {
    name: "International Workers' Day (Labour Day)",
    date: d(5, 1),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: [] as string[],
    draftPostTemplate: "Happy Labour Day! 👷 Today we salute the hardworking individuals who build our world every single day. [ORG_TEAM_SHOUTOUT] #LabourDay #MayDay #WorkersDay",
  },
  {
    name: "Mother's Day",
    date: d(5, 11),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: [] as string[],
    draftPostTemplate: "Happy Mother's Day! 💐 To all the incredible moms out there — your strength, love, and sacrifice inspire us every day. [BRAND_MESSAGE] #MothersDay #HappyMothersDay",
  },
  {
    name: 'World Laughter Day',
    date: d(5, 4),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: [] as string[],
    draftPostTemplate: "It's World Laughter Day! 😂 Laughter is the best medicine. [FUNNY_BRAND_MOMENT_OR_MEME] #WorldLaughterDay #Laughter #Smile",
  },
  {
    name: 'International Nurses Day',
    date: d(5, 12),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Healthcare', 'Medical', 'Hospital'],
    draftPostTemplate: "Happy International Nurses Day! 🏥💙 Thank you to all the nurses who dedicate their lives to caring for others. You are true heroes. #NursesDay #InternationalNursesDay",
  },
  {
    name: 'World Family Day',
    date: d(5, 15),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: [] as string[],
    draftPostTemplate: "Happy International Day of Families! 👨‍👩‍👧‍👦 Family is the foundation of everything. [BRAND_FAMILY_CONNECTION] #FamilyDay #WorldFamilyDay",
  },
  {
    name: 'Eid al-Adha',
    date: d(6, 7),
    category: 'RELIGIOUS' as const,
    countries: IND,
    industries: [] as string[],
    draftPostTemplate: "Eid Mubarak! 🌙✨ Wishing everyone celebrating Eid al-Adha a blessed and joyful celebration filled with love, peace, and happiness. #EidMubarak #EidAlAdha #HappyEid",
  },
  {
    name: 'World No Tobacco Day',
    date: d(5, 31),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Healthcare', 'Wellness', 'Pharmacy'],
    draftPostTemplate: "Today is World No Tobacco Day! 🚭 Every breath counts. Choose health, choose life. [HEALTH_MESSAGE] #WorldNoTobaccoDay #NoTobacco #QuitSmoking",
  },

  // ══════════════════════════════════════════════════════
  // SECTION 6: JUNE
  // ══════════════════════════════════════════════════════
  {
    name: 'World Environment Day',
    date: d(6, 5),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: [] as string[],
    draftPostTemplate: "Happy World Environment Day! 🌿 Our planet, our responsibility. Together, let's make a difference. [ECO_INITIATIVE] #WorldEnvironmentDay #ForNature #ActNow",
  },
  {
    name: "International Children's Day",
    date: d(6, 1),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Education', 'Healthcare', 'Retail'],
    draftPostTemplate: "Happy International Children's Day! 🧒 Every child deserves a bright future. [BRAND_MESSAGE] #ChildrensDay #InternationalChildrensDay",
  },
  {
    name: 'World Blood Donor Day',
    date: d(6, 14),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Healthcare', 'Medical', 'Hospital'],
    draftPostTemplate: "Today is World Blood Donor Day! 🩸 A single donation can save up to 3 lives. Thank you to all blood donors for your selfless gift. #BloodDonorDay #DonateBlood",
  },
  {
    name: "International Yoga Day",
    date: d(6, 21),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Fitness', 'Wellness', 'Healthcare', 'Yoga'],
    draftPostTemplate: "Happy International Yoga Day! 🧘 Yoga is more than exercise — it's a journey to inner peace and well-being. [YOGA_TIP_OR_CLASS] #YogaDay #InternationalYogaDay #Yoga",
  },
  {
    name: "Father's Day",
    date: d(6, 15),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: [] as string[],
    draftPostTemplate: "Happy Father's Day! 👨 To all the incredible dads — your love, guidance, and strength shape the world. [BRAND_MESSAGE] #FathersDay #HappyFathersDay",
  },
  {
    name: 'World Social Media Day',
    date: d(6, 30),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Marketing', 'Technology', 'Media'],
    draftPostTemplate: "Happy World Social Media Day! 📱 Social media connects billions of people across the globe. Today, we celebrate the power of connection. [ENGAGEMENT_CTA] #SocialMediaDay",
  },
  {
    name: 'Eid al-Fitr (Eid)',
    date: d(3, 30),
    category: 'RELIGIOUS' as const,
    countries: IND,
    industries: [] as string[],
    draftPostTemplate: "Eid Mubarak! 🌙✨ May this festival of joy, peace, and gratitude bring happiness to you and your loved ones. Eid Mubarak! #EidMubarak #HappyEid",
  },

  // ══════════════════════════════════════════════════════
  // SECTION 7: JULY
  // ══════════════════════════════════════════════════════
  {
    name: "National Doctor's Day (India)",
    date: d(7, 1),
    category: 'NATIONAL_HOLIDAY' as const,
    countries: IND,
    industries: ['Healthcare', 'Medical', 'Dental', 'Hospital'],
    draftPostTemplate: "Happy National Doctor's Day! 👨‍⚕️ Thank you to all the doctors who dedicate their lives to healing and saving others. Your service is truly priceless. #DoctorsDay #NationalDoctorsDay",
  },
  {
    name: 'World Population Day',
    date: d(7, 11),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Healthcare', 'Government', 'NGO'],
    draftPostTemplate: "Today is World Population Day! 🌍 With 8 billion people on our planet, sustainable development has never been more important. #WorldPopulationDay",
  },
  {
    name: 'Friendship Day',
    date: d(8, 3),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: [] as string[],
    draftPostTemplate: "Happy Friendship Day! 👫 True friends are the greatest treasure. Share this with someone who means the world to you! [BRAND_COMMUNITY_MESSAGE] #FriendshipDay #HappyFriendshipDay",
  },
  {
    name: 'Muharram (Islamic New Year)',
    date: d(7, 8),
    category: 'RELIGIOUS' as const,
    countries: IND,
    industries: [] as string[],
    draftPostTemplate: "Muharram Mubarak. As we enter the Islamic New Year, may this month bring peace, reflection, and blessings to all. #Muharram #IslamicNewYear",
  },
  {
    name: 'Guru Purnima',
    date: d(7, 10),
    category: 'RELIGIOUS' as const,
    countries: IND,
    industries: ['Education', 'Wellness', 'Yoga'],
    draftPostTemplate: "Happy Guru Purnima! 🙏 On this auspicious day, we bow to all the teachers, mentors, and guides who light our path. #GuruPurnima #Teachers #Gratitude",
  },

  // ══════════════════════════════════════════════════════
  // SECTION 8: AUGUST
  // ══════════════════════════════════════════════════════
  {
    name: 'Independence Day (India)',
    date: d(8, 15),
    category: 'NATIONAL_HOLIDAY' as const,
    countries: IND,
    industries: [] as string[],
    draftPostTemplate: "Happy Independence Day! 🇮🇳 On this 78th Independence Day, let us celebrate the freedom and unity that makes India great. Jai Hind! 🫡 #IndependenceDay #JaiHind #IndiaAt78",
  },
  {
    name: 'Raksha Bandhan',
    date: d(8, 9),
    category: 'RELIGIOUS' as const,
    countries: IND,
    industries: [] as string[],
    draftPostTemplate: "Happy Raksha Bandhan! 🪢💕 Celebrating the unbreakable bond between siblings. May this Rakhi strengthen your ties of love and protection. #RakshaBandhan #Rakhi #SiblingLove",
  },
  {
    name: 'Janmashtami',
    date: d(8, 16),
    category: 'RELIGIOUS' as const,
    countries: IND,
    industries: [] as string[],
    draftPostTemplate: "Happy Janmashtami! 🦚🎉 Celebrating the birth of Lord Krishna. May His wisdom, love, and joy fill your life with peace. Radhe Radhe! #Janmashtami #HappyJanmashtami #JaiShreeKrishna",
  },
  {
    name: 'World Photography Day',
    date: d(8, 19),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Photography', 'Media', 'Travel', 'Real Estate'],
    draftPostTemplate: "Happy World Photography Day! 📸 A picture is worth a thousand words. Share your favourite shot with us! [PHOTO_CTA] #WorldPhotographyDay #Photography",
  },
  {
    name: "World Senior Citizens' Day",
    date: d(8, 21),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Healthcare', 'Wellness'],
    draftPostTemplate: "Celebrating World Senior Citizens' Day! 👴👵 The wisdom and experience of our elders is a gift to society. [BRAND_MESSAGE] #SeniorCitizensDay",
  },

  // ══════════════════════════════════════════════════════
  // SECTION 9: SEPTEMBER
  // ══════════════════════════════════════════════════════
  {
    name: 'Ganesh Chaturthi',
    date: d(8, 27),
    category: 'RELIGIOUS' as const,
    countries: IND,
    industries: [] as string[],
    draftPostTemplate: "Ganpati Bappa Morya! 🐘🪔 Wishing everyone a joyful Ganesh Chaturthi. May Lord Ganesha remove all obstacles from your path and bless you with success. #GaneshChaturthi #GanpatiBappaMorya #Ganpati",
  },
  {
    name: 'World Heart Day',
    date: d(9, 29),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Healthcare', 'Medical', 'Fitness', 'Wellness'],
    draftPostTemplate: "Today is World Heart Day! ❤️ Your heart works 24/7 for you — it's time to care for it. [HEART_HEALTH_TIP] #WorldHeartDay #HeartHealth #HealthyHeart",
  },
  {
    name: 'World Tourism Day',
    date: d(9, 27),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Travel', 'Hotel', 'Tourism', 'Restaurant'],
    draftPostTemplate: "Happy World Tourism Day! ✈️🌍 Travel is the only thing you spend money on that makes you richer. [DESTINATION_OR_SERVICE] #WorldTourismDay #Travel #Wanderlust",
  },
  {
    name: "World Alzheimer's Day",
    date: d(9, 21),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Healthcare', 'Elderly Care', 'Pharmacy'],
    draftPostTemplate: "Today is World Alzheimer's Day. 🟣 Memory may fade, but love never does. Let's raise awareness and support those affected. #WorldAlzheimersDay #AlzheimersAwareness",
  },
  {
    name: 'Hindi Diwas',
    date: d(9, 14),
    category: 'NATIONAL_HOLIDAY' as const,
    countries: IND,
    industries: [] as string[],
    draftPostTemplate: "हिंदी दिवस की शुभकामनाएं! 🇮🇳 Hindi is not just a language — it's the heartbeat of millions. Celebrating the richness of Hindi on this special day. #HindiDiwas #HindiDay",
  },
  {
    name: 'Engineers Day (India)',
    date: d(9, 15),
    category: 'NATIONAL_HOLIDAY' as const,
    countries: IND,
    industries: ['Technology', 'Engineering', 'IT'],
    draftPostTemplate: "Happy Engineers Day! ⚙️ Celebrating the brilliant minds that design, build, and innovate the world we live in. #EngineersDay #Engineers #Innovation",
  },

  // ══════════════════════════════════════════════════════
  // SECTION 10: OCTOBER
  // ══════════════════════════════════════════════════════
  {
    name: 'Gandhi Jayanti',
    date: d(10, 2),
    category: 'NATIONAL_HOLIDAY' as const,
    countries: IND,
    industries: [] as string[],
    draftPostTemplate: "On the occasion of Gandhi Jayanti, we remember the Father of the Nation and his timeless message of truth, non-violence, and service. 🙏 #GandhiJayanti #MahatmaGandhi #BaputKoPranam",
  },
  {
    name: 'International Non-Violence Day',
    date: d(10, 2),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: [] as string[],
    draftPostTemplate: "On International Day of Non-Violence, we reflect on the power of peace and compassion in changing the world. #InternationalDayOfNonViolence #Gandhi #Peace",
  },
  {
    name: 'World Mental Health Day',
    date: d(10, 10),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Healthcare', 'Wellness', 'Counselling', 'Yoga'],
    draftPostTemplate: "Today is World Mental Health Day. 💚 Your mental health matters. Take a moment today to check in with yourself and the people around you. [WELLNESS_TIP] #WorldMentalHealthDay #MentalHealthAwareness",
  },
  {
    name: 'Navratri Begins',
    date: d(10, 2),
    category: 'RELIGIOUS' as const,
    countries: IND,
    industries: [] as string[],
    draftPostTemplate: "Happy Navratri! 🌺 Nine nights of devotion, dance, and divine blessings. May Goddess Durga shower you with strength and prosperity. #Navratri #HappyNavratri #JaiMataaDi",
  },
  {
    name: 'Dussehra (Vijaya Dashami)',
    date: d(10, 12),
    category: 'RELIGIOUS' as const,
    countries: IND,
    industries: [] as string[],
    draftPostTemplate: "Happy Dussehra! 🔥 May the victory of good over evil inspire us to overcome our own challenges. Shubh Vijaya Dashami! #Dussehra #VijayaDashami #GoodOverEvil",
  },
  {
    name: "World Food Day",
    date: d(10, 16),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Restaurant', 'Food & Beverage', 'Catering', 'Bakery'],
    draftPostTemplate: "Happy World Food Day! 🍽️ Food brings people together. Today, we celebrate the joy of nourishment and the importance of food security. [FOOD_MESSAGE] #WorldFoodDay",
  },
  {
    name: 'Diwali',
    date: d(10, 20),
    category: 'RELIGIOUS' as const,
    countries: IND,
    industries: [] as string[],
    draftPostTemplate: "Happy Diwali! 🪔✨ May this festival of lights illuminate your life with joy, prosperity, and success. From our family to yours — Shubh Diwali! #HappyDiwali #Diwali2025 #FestivalOfLights",
  },
  {
    name: 'Halloween',
    date: d(10, 31),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Retail', 'Restaurant', 'Events', 'Entertainment'],
    draftPostTemplate: "👻 Happy Halloween! This season, we're treating you to [OFFER/DEAL]. Don't be scared — [CTA]! #Halloween #Spooky #TrickOrTreat",
  },

  // ══════════════════════════════════════════════════════
  // SECTION 11: NOVEMBER
  // ══════════════════════════════════════════════════════
  {
    name: 'Bhai Dooj',
    date: d(10, 23),
    category: 'RELIGIOUS' as const,
    countries: IND,
    industries: [] as string[],
    draftPostTemplate: "Happy Bhai Dooj! 💕 Celebrating the beautiful bond between brothers and sisters. May your bond grow stronger with every passing year. #BhaiDooj #SiblingLove",
  },
  {
    name: 'World Diabetes Day',
    date: d(11, 14),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Healthcare', 'Medical', 'Pharmacy', 'Wellness', 'Fitness'],
    draftPostTemplate: "Today is World Diabetes Day. 💙 Diabetes affects millions — but with the right care, you can live well. [HEALTH_TIP] #WorldDiabetesDay #DiabetesAwareness #BlueCircle",
  },
  {
    name: "Children's Day (India)",
    date: d(11, 14),
    category: 'NATIONAL_HOLIDAY' as const,
    countries: IND,
    industries: ['Education', 'Healthcare', 'Retail'],
    draftPostTemplate: "Happy Children's Day! 🧒🎈 On Nehru Ji's birthday, we celebrate the joy and innocence of children everywhere. [BRAND_MESSAGE] #ChildrensDay #HappyChildrensDay",
  },
  {
    name: 'World Kindness Day',
    date: d(11, 13),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: [] as string[],
    draftPostTemplate: "Happy World Kindness Day! 💛 A small act of kindness can change someone's entire day. Let's spread more kindness today. [BRAND_KINDNESS_INITIATIVE] #WorldKindnessDay #BeKind",
  },
  {
    name: 'Guru Nanak Jayanti',
    date: d(11, 5),
    category: 'RELIGIOUS' as const,
    countries: IND,
    industries: [] as string[],
    draftPostTemplate: "Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh! 🙏 On the auspicious occasion of Guru Nanak Dev Ji's Gurpurab, wishing everyone peace and blessings. #GuruNanakJayanti #Gurpurab",
  },
  {
    name: 'National Education Day (India)',
    date: d(11, 11),
    category: 'NATIONAL_HOLIDAY' as const,
    countries: IND,
    industries: ['Education', 'Coaching'],
    draftPostTemplate: "Happy National Education Day! 📚 Education is the most powerful weapon to change the world. [EDUCATION_MESSAGE] #NationalEducationDay #Education",
  },
  {
    name: 'Thanksgiving Day',
    date: d(11, 27),
    category: 'NATIONAL_HOLIDAY' as const,
    countries: ['US'],
    industries: [] as string[],
    draftPostTemplate: "Happy Thanksgiving! 🦃 Today, we're grateful for amazing clients like you. Thank you for your trust and support. [GRATITUDE_MESSAGE] #Thanksgiving #Grateful",
  },
  {
    name: 'Black Friday',
    date: d(11, 28),
    category: 'INDUSTRY' as const,
    countries: ALL,
    industries: ['Retail', 'E-commerce', 'Fashion'],
    draftPostTemplate: "🔥 Black Friday SALE is HERE! Up to [X%] off on [PRODUCTS/SERVICES]. Don't miss out — offer ends [DATE]. Shop now! [LINK] #BlackFriday #BlackFridaySale #Deals",
  },
  {
    name: 'Cyber Monday',
    date: d(12, 1),
    category: 'INDUSTRY' as const,
    countries: ALL,
    industries: ['E-commerce', 'Technology', 'Retail'],
    draftPostTemplate: "💻 Cyber Monday Deals are LIVE! [OFFER_DETAILS]. Shop online and save big today only! [LINK] #CyberMonday #CyberMondayDeals #OnlineShopping",
  },

  // ══════════════════════════════════════════════════════
  // SECTION 12: DECEMBER
  // ══════════════════════════════════════════════════════
  {
    name: 'World AIDS Day',
    date: d(12, 1),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Healthcare', 'Medical', 'NGO'],
    draftPostTemplate: "Today is World AIDS Day. 🎗️ Together, we can end the epidemic. Let's commit to awareness, testing, and compassion. #WorldAIDSDay #HIVAwareness #EndAIDS",
  },
  {
    name: 'International Volunteer Day',
    date: d(12, 5),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['NGO', 'Healthcare', 'Education'],
    draftPostTemplate: "Happy International Volunteer Day! 🤝 Volunteers are the backbone of our communities. Thank you to everyone who gives their time to make the world better. #VolunteerDay",
  },
  {
    name: 'Human Rights Day',
    date: d(12, 10),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['NGO', 'Legal', 'Education'],
    draftPostTemplate: "Today is Human Rights Day. ✊ Every person, everywhere, deserves dignity, equality, and justice. [BRAND_VALUES_MESSAGE] #HumanRightsDay #HumanRights",
  },
  {
    name: 'Christmas Eve',
    date: d(12, 24),
    category: 'RELIGIOUS' as const,
    countries: ALL,
    industries: [] as string[],
    draftPostTemplate: "🎄 Merry Christmas Eve! Wishing you a magical evening with your loved ones. From our family to yours — Happy Holidays! #ChristmasEve #MerryChristmas #HappyHolidays",
  },
  {
    name: 'Christmas Day',
    date: d(12, 25),
    category: 'RELIGIOUS' as const,
    countries: ALL,
    industries: [] as string[],
    draftPostTemplate: "🎅 Merry Christmas! May your day be filled with joy, love, and warmth. [ORG_SPECIFIC_MESSAGE] #MerryChristmas #Christmas #HappyHolidays #Xmas",
  },
  {
    name: "New Year's Eve",
    date: d(12, 31),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: [] as string[],
    draftPostTemplate: "Cheers to the last day of the year! 🥂 Thank you for making this year special. Here's to an even better year ahead! [YEAR_IN_REVIEW] #NewYearsEve #HappyNewYear2026",
  },

  // ══════════════════════════════════════════════════════
  // SECTION 13: INDUSTRY AWARENESS DAYS
  // ══════════════════════════════════════════════════════
  {
    name: 'World Cancer Day',
    date: d(2, 4),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Healthcare', 'Medical', 'Wellness', 'Pharmacy'],
    draftPostTemplate: "Today is World Cancer Day. 🎗️ Early detection saves lives. Get screened. Stay aware. [HEALTH_SERVICE] #WorldCancerDay #CancerAwareness",
  },
  {
    name: 'World Breastfeeding Week',
    date: d(8, 1),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Healthcare', 'Maternity', 'Wellness'],
    draftPostTemplate: "World Breastfeeding Week is here! 🤱 Supporting new mothers with the information and care they deserve. [HEALTHCARE_MESSAGE] #WorldBreastfeedingWeek #MaternalHealth",
  },
  {
    name: 'International Day of Yoga',
    date: d(6, 21),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Fitness', 'Wellness', 'Yoga', 'Healthcare'],
    draftPostTemplate: "Happy International Day of Yoga! 🧘‍♀️ Yoga is a journey of self-discovery. [YOGA_CLASS_OR_TIP] #YogaDay #InternationalDayOfYoga #Yoga",
  },
  {
    name: 'World Hypertension Day',
    date: d(5, 17),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Healthcare', 'Medical', 'Pharmacy', 'Fitness'],
    draftPostTemplate: "Today is World Hypertension Day. ❤️ High blood pressure is called the 'silent killer'. Get your blood pressure checked today. [HEALTH_TIP] #WorldHypertensionDay #HypertensionAwareness",
  },
  {
    name: "World Physiotherapy Day",
    date: d(9, 8),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Healthcare', 'Physiotherapy', 'Wellness'],
    draftPostTemplate: "Happy World Physiotherapy Day! 💪 Physiotherapy restores movement and improves lives. Celebrating all the physios who make a difference every day. #WorldPhysiotherapyDay",
  },
  {
    name: 'World Pharmacist Day',
    date: d(9, 25),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Pharmacy', 'Healthcare'],
    draftPostTemplate: "Happy World Pharmacist Day! 💊 Pharmacists are unsung heroes of healthcare. Thank you for keeping us safe and healthy. #WorldPharmacistDay #Pharmacists",
  },
  {
    name: 'International Coffee Day',
    date: d(10, 1),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Restaurant', 'Café', 'Food & Beverage'],
    draftPostTemplate: "Happy International Coffee Day! ☕ Life is too short for bad coffee! [OFFER_OR_MESSAGE] #InternationalCoffeeDay #CoffeeDay #CoffeeLover",
  },
  {
    name: 'World Entrepreneurs Day',
    date: d(8, 21),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Business', 'Finance', 'Technology', 'Marketing'],
    draftPostTemplate: "Happy World Entrepreneurs Day! 🚀 To every founder, dreamer, and risk-taker — your vision is shaping tomorrow. Keep building! #EntrepreneursDay #Entrepreneurship #Startup",
  },
  {
    name: 'World Teachers Day',
    date: d(10, 5),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Education', 'Coaching', 'Training'],
    draftPostTemplate: "Happy World Teachers Day! 🍎 Teachers shape the future one student at a time. Thank you for your dedication and passion. #WorldTeachersDay #TeachersDay",
  },
  {
    name: 'Pi Day',
    date: d(3, 14),
    category: 'INDUSTRY' as const,
    countries: ALL,
    industries: ['Technology', 'Education', 'Engineering'],
    draftPostTemplate: "Happy Pi Day! 🥧 3.14159... and counting! Celebrate with us: [TECH_OR_EDUCATIONAL_MESSAGE] #PiDay #MathDay #314",
  },
  {
    name: 'World Password Day',
    date: d(5, 1),
    category: 'INDUSTRY' as const,
    countries: ALL,
    industries: ['Technology', 'IT Services', 'Cybersecurity'],
    draftPostTemplate: "Today is World Password Day! 🔐 When did you last update your passwords? Protect your digital life with strong, unique passwords. [SECURITY_TIP] #WorldPasswordDay #Cybersecurity",
  },
  {
    name: "International Nurses' Day",
    date: d(5, 12),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Healthcare', 'Hospital', 'Medical'],
    draftPostTemplate: "Happy International Nurses' Day! 👩‍⚕️ Nurses are the backbone of healthcare. Thank you for your compassion, dedication, and care. #NursesDay #InternationalNursesDay",
  },
  {
    name: 'World Photography Day',
    date: d(8, 19),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Photography', 'Media', 'Marketing', 'Real Estate', 'Travel'],
    draftPostTemplate: "Happy World Photography Day! 📸 Every picture tells a story. What story are you telling today? [PHOTO_CTA] #WorldPhotographyDay #Photography",
  },
  {
    name: "World Social Justice Day",
    date: d(2, 20),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['NGO', 'Education', 'Legal'],
    draftPostTemplate: "Today is World Day of Social Justice. ⚖️ We believe in a world of equal opportunity for all. [BRAND_VALUES] #SocialJusticeDay #Equality",
  },
  {
    name: 'World IP Day',
    date: d(4, 26),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Legal', 'Technology', 'Creative'],
    draftPostTemplate: "Happy World IP Day! 💡 Ideas drive innovation. Protecting intellectual property protects the future. [INNOVATION_MESSAGE] #WorldIPDay #IntellectualProperty",
  },
  {
    name: 'Global Handwashing Day',
    date: d(10, 15),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Healthcare', 'Education', 'NGO'],
    draftPostTemplate: "Today is Global Handwashing Day! 🧼 Such a simple act, such a powerful impact on health. [HYGIENE_TIP] #GlobalHandwashingDay #HandHygiene",
  },
  {
    name: 'World Osteoporosis Day',
    date: d(10, 20),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Healthcare', 'Medical', 'Orthopedics'],
    draftPostTemplate: "Today is World Osteoporosis Day. 🦴 Strong bones start early. Calcium, vitamin D, and exercise are key. [HEALTH_TIP] #WorldOsteoporosisDay #BoneHealth",
  },
  {
    name: "World Dentist Day",
    date: d(3, 6),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Dental', 'Healthcare'],
    draftPostTemplate: "Happy World Dentist Day! 🦷 Smile bright today and every day! Thank you to all dentists who keep our smiles healthy. [DENTAL_TIP] #WorldDentistDay #DentalHealth",
  },
  {
    name: 'National Dentist Day',
    date: d(3, 6),
    category: 'NATIONAL_HOLIDAY' as const,
    countries: IND,
    industries: ['Dental', 'Healthcare'],
    draftPostTemplate: "Happy National Dentist Day! 😁 Your smile is our priority. [DENTAL_SERVICE_OR_TIP] #NationalDentistDay #DentalCare #HealthySmile",
  },
  {
    name: 'World Sight Day',
    date: d(10, 9),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Healthcare', 'Optical', 'Medical'],
    draftPostTemplate: "Today is World Sight Day! 👁️ Vision is one of our most precious senses. Get your eyes checked regularly. [EYE_CARE_TIP] #WorldSightDay #EyeHealth #Vision",
  },
  {
    name: 'World Vegan Day',
    date: d(11, 1),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Restaurant', 'Food & Beverage', 'Wellness', 'Fitness'],
    draftPostTemplate: "Happy World Vegan Day! 🌱 Choosing plant-based is good for you and the planet. [VEGAN_MENU_OR_PRODUCT] #WorldVeganDay #Vegan #PlantBased",
  },
  {
    name: "International Day of Older Persons",
    date: d(10, 1),
    category: 'INTERNATIONAL' as const,
    countries: ALL,
    industries: ['Healthcare', 'Wellness', 'Elder Care'],
    draftPostTemplate: "Today is the International Day of Older Persons! 👴 The wisdom and experience of elders enrich every community. Let's honour them every day. #OlderPersonsDay",
  },
]

// ── Deduplicate by name+date in case of duplicates in array ──

const seen = new Set<string>()
const UNIQUE_DAYS = SPECIAL_DAYS.filter((day) => {
  const key = `${day.name}|${day.date.toISOString().slice(0, 10)}`
  if (seen.has(key)) return false
  seen.add(key)
  return true
})

// ── Main seed function ─────────────────────────────────────────

async function main() {
  let inserted = 0
  let skipped = 0

  console.log(`\n🗓️  Seeding ${UNIQUE_DAYS.length} special days...\n`)

  for (const day of UNIQUE_DAYS) {
    try {
      await prisma.specialDay.upsert({
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
      inserted++
      console.log(`  ✓ ${day.name} (${day.date.toISOString().slice(0, 10)})`)
    } catch (err) {
      console.error(`  ✗ Failed: ${day.name} — ${(err as Error).message}`)
      skipped++
    }
  }

  console.log(`\n✅ Done — ${inserted} upserted, ${skipped} failed`)
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
