import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Categories (10 total) ───────────────────────────────────────────
  const categories = await Promise.all([
    prisma.category.upsert({ where: { slug: 'restaurant' }, update: {}, create: { name: 'Restaurant', slug: 'restaurant' } }),
    prisma.category.upsert({ where: { slug: 'bakery' }, update: {}, create: { name: 'Bakery', slug: 'bakery' } }),
    prisma.category.upsert({ where: { slug: 'boutique' }, update: {}, create: { name: 'Boutique', slug: 'boutique' } }),
    prisma.category.upsert({ where: { slug: 'salon' }, update: {}, create: { name: 'Salon', slug: 'salon' } }),
    prisma.category.upsert({ where: { slug: 'hotel' }, update: {}, create: { name: 'Hotel', slug: 'hotel' } }),
    prisma.category.upsert({ where: { slug: 'dental-office' }, update: {}, create: { name: 'Dental Office', slug: 'dental-office' } }),
    prisma.category.upsert({ where: { slug: 'auto-repair' }, update: {}, create: { name: 'Auto Repair', slug: 'auto-repair' } }),
    prisma.category.upsert({ where: { slug: 'retail' }, update: {}, create: { name: 'Retail', slug: 'retail' } }),
    prisma.category.upsert({ where: { slug: 'physiotherapy' }, update: {}, create: { name: 'Physiotherapy', slug: 'physiotherapy' } }),
    prisma.category.upsert({ where: { slug: 'gym' }, update: {}, create: { name: 'Gym', slug: 'gym' } }),
  ]);

  const [
    restaurantCat, bakeryCat, boutiqueCat, salonCat, hotelCat,
    dentalCat, autoCat, retailCat, physioCat, gymCat,
  ] = categories;

  // ─── Question Templates (5 per category, mixed types) ────────────────
  // Each template: { categoryId, text, sortOrder, type, options?, placeholder? }
  const questionTemplates: Array<{
    categoryId: string;
    text: string;
    sortOrder: number;
    type: string;
    options?: string;
    placeholder?: string;
  }> = [
    // ── Restaurant ──
    { categoryId: restaurantCat.id, text: 'How would you rate your overall dining experience?', sortOrder: 0, type: 'STAR_RATING' },
    { categoryId: restaurantCat.id, text: 'What stood out?', sortOrder: 1, type: 'MULTI_CHOICE', options: JSON.stringify(['Flavorful food', 'Fresh ingredients', 'Good portions', 'Quick service', 'Friendly staff', 'Nice ambience']) },
    { categoryId: restaurantCat.id, text: 'What best describes the service?', sortOrder: 2, type: 'SINGLE_CHOICE', options: JSON.stringify(['Attentive and prompt', 'Friendly but slow', 'Average', 'Could be better']) },
    { categoryId: restaurantCat.id, text: 'How was the wait time?', sortOrder: 3, type: 'SINGLE_CHOICE', options: JSON.stringify(['No wait', 'Short wait', 'Reasonable', 'Too long']) },
    { categoryId: restaurantCat.id, text: 'Anything specific you\'d like to mention?', sortOrder: 4, type: 'TEXT', placeholder: 'A dish you loved, something the staff did...' },

    // ── Bakery ──
    { categoryId: bakeryCat.id, text: 'How would you rate your visit?', sortOrder: 0, type: 'STAR_RATING' },
    { categoryId: bakeryCat.id, text: 'What stood out?', sortOrder: 1, type: 'MULTI_CHOICE', options: JSON.stringify(['Fresh baked goods', 'Great taste', 'Nice variety', 'Beautiful presentation', 'Good prices', 'Friendly staff']) },
    { categoryId: bakeryCat.id, text: 'How was the freshness?', sortOrder: 2, type: 'SINGLE_CHOICE', options: JSON.stringify(['Very fresh', 'Mostly fresh', 'Average', 'Not fresh enough']) },
    { categoryId: bakeryCat.id, text: 'How was the selection?', sortOrder: 3, type: 'SINGLE_CHOICE', options: JSON.stringify(['Wide variety', 'Good enough', 'Limited', 'Very limited']) },
    { categoryId: bakeryCat.id, text: 'Anything specific?', sortOrder: 4, type: 'TEXT', placeholder: 'A pastry you loved, a recommendation...' },

    // ── Boutique ──
    { categoryId: boutiqueCat.id, text: 'How would you rate your shopping experience?', sortOrder: 0, type: 'STAR_RATING' },
    { categoryId: boutiqueCat.id, text: 'What stood out?', sortOrder: 1, type: 'MULTI_CHOICE', options: JSON.stringify(['Unique products', 'Quality items', 'Helpful staff', 'Well-organized store', 'Good prices', 'Nice atmosphere']) },
    { categoryId: boutiqueCat.id, text: 'How was the staff assistance?', sortOrder: 2, type: 'SINGLE_CHOICE', options: JSON.stringify(['Very helpful', 'Helpful when asked', 'Not very helpful', 'No assistance needed']) },
    { categoryId: boutiqueCat.id, text: 'How was the pricing?', sortOrder: 3, type: 'SINGLE_CHOICE', options: JSON.stringify(['Great value', 'Reasonable', 'A bit pricey', 'Overpriced']) },
    { categoryId: boutiqueCat.id, text: 'Anything else?', sortOrder: 4, type: 'TEXT', placeholder: 'A product you liked, something about the store...' },

    // ── Salon ──
    { categoryId: salonCat.id, text: 'How would you rate your visit?', sortOrder: 0, type: 'STAR_RATING' },
    { categoryId: salonCat.id, text: 'What stood out?', sortOrder: 1, type: 'MULTI_CHOICE', options: JSON.stringify(['Stylist skill', 'Listened to what I wanted', 'Clean environment', 'Friendly staff', 'Good value', 'Relaxing atmosphere']) },
    { categoryId: salonCat.id, text: 'How does the result compare to what you asked for?', sortOrder: 2, type: 'SINGLE_CHOICE', options: JSON.stringify(['Exactly what I wanted', 'Close enough', 'Not quite right', 'Very different']) },
    { categoryId: salonCat.id, text: 'How was the appointment timing?', sortOrder: 3, type: 'SINGLE_CHOICE', options: JSON.stringify(['On time', 'Slight delay', 'Significant wait']) },
    { categoryId: salonCat.id, text: 'Anything specific?', sortOrder: 4, type: 'TEXT', placeholder: 'Your stylist, a technique you liked...' },

    // ── Hotel ──
    { categoryId: hotelCat.id, text: 'How would you rate your stay?', sortOrder: 0, type: 'STAR_RATING' },
    { categoryId: hotelCat.id, text: 'What stood out?', sortOrder: 1, type: 'MULTI_CHOICE', options: JSON.stringify(['Clean room', 'Comfortable bed', 'Helpful staff', 'Good breakfast', 'Great location', 'Nice amenities']) },
    { categoryId: hotelCat.id, text: 'How was the check-in experience?', sortOrder: 2, type: 'SINGLE_CHOICE', options: JSON.stringify(['Quick and smooth', 'Reasonable', 'A bit slow', 'Frustrating']) },
    { categoryId: hotelCat.id, text: 'How was the room cleanliness?', sortOrder: 3, type: 'SINGLE_CHOICE', options: JSON.stringify(['Spotless', 'Clean', 'Acceptable', 'Needs improvement']) },
    { categoryId: hotelCat.id, text: 'Anything else about your stay?', sortOrder: 4, type: 'TEXT', placeholder: 'Something about the room, staff, or location...' },

    // ── Dental Office ──
    { categoryId: dentalCat.id, text: 'How would you rate your visit?', sortOrder: 0, type: 'STAR_RATING' },
    { categoryId: dentalCat.id, text: 'What stood out?', sortOrder: 1, type: 'MULTI_CHOICE', options: JSON.stringify(['Clear explanation of treatment', 'Gentle approach', 'Dentist listened', 'Clean facility', 'Friendly staff', 'Minimal wait']) },
    { categoryId: dentalCat.id, text: 'How well did the dentist explain the procedure?', sortOrder: 2, type: 'SINGLE_CHOICE', options: JSON.stringify(['Very clearly', 'Mostly clear', 'Could be better', 'Not explained']) },
    { categoryId: dentalCat.id, text: 'How comfortable was the treatment?', sortOrder: 3, type: 'SINGLE_CHOICE', options: JSON.stringify(['Very comfortable', 'Manageable', 'A bit uncomfortable', 'Painful']) },
    { categoryId: dentalCat.id, text: 'Anything else?', sortOrder: 4, type: 'TEXT', placeholder: 'Something about the treatment, staff, or facility...' },

    // ── Auto Repair ──
    { categoryId: autoCat.id, text: 'How would you rate the service?', sortOrder: 0, type: 'STAR_RATING' },
    { categoryId: autoCat.id, text: 'What stood out?', sortOrder: 1, type: 'MULTI_CHOICE', options: JSON.stringify(['Clear explanation of work needed', 'Fair pricing', 'Quick turnaround', 'Honest assessment', 'Friendly staff', 'Good communication']) },
    { categoryId: autoCat.id, text: 'How was the pricing transparency?', sortOrder: 2, type: 'SINGLE_CHOICE', options: JSON.stringify(['Very transparent', 'Mostly clear', 'Some surprises', 'Not transparent']) },
    { categoryId: autoCat.id, text: 'How was the turnaround time?', sortOrder: 3, type: 'SINGLE_CHOICE', options: JSON.stringify(['Faster than expected', 'On time', 'A bit slow', 'Much slower than promised']) },
    { categoryId: autoCat.id, text: 'Anything specific?', sortOrder: 4, type: 'TEXT', placeholder: 'The repair, how they communicated, pricing...' },

    // ── Retail ──
    { categoryId: retailCat.id, text: 'How would you rate your shopping experience?', sortOrder: 0, type: 'STAR_RATING' },
    { categoryId: retailCat.id, text: 'What stood out?', sortOrder: 1, type: 'MULTI_CHOICE', options: JSON.stringify(['Good product selection', 'Quality products', 'Helpful staff', 'Well-organized store', 'Competitive prices', 'Easy checkout']) },
    { categoryId: retailCat.id, text: 'How was the staff assistance?', sortOrder: 2, type: 'SINGLE_CHOICE', options: JSON.stringify(['Very helpful', 'Helpful when asked', 'Hard to find help', 'Not helpful']) },
    { categoryId: retailCat.id, text: 'How was the checkout experience?', sortOrder: 3, type: 'SINGLE_CHOICE', options: JSON.stringify(['Quick and easy', 'Reasonable wait', 'Long queue', 'Frustrating']) },
    { categoryId: retailCat.id, text: 'Anything else?', sortOrder: 4, type: 'TEXT', placeholder: 'A product, staff member, or store experience...' },

    // ── Physiotherapy ──
    { categoryId: physioCat.id, text: 'How would you rate your session?', sortOrder: 0, type: 'STAR_RATING' },
    { categoryId: physioCat.id, text: 'What was most helpful?', sortOrder: 1, type: 'MULTI_CHOICE', options: JSON.stringify(['Therapist listened', 'Treatment approach', 'Exercise guidance', 'Clear explanation', 'Personal attention', 'Comfortable environment']) },
    { categoryId: physioCat.id, text: 'How was the therapist\'s communication?', sortOrder: 2, type: 'SINGLE_CHOICE', options: JSON.stringify(['Very clear', 'Mostly clear', 'Could be better', 'Unclear']) },
    { categoryId: physioCat.id, text: 'How was the appointment timing?', sortOrder: 3, type: 'SINGLE_CHOICE', options: JSON.stringify(['On time', 'Slight delay', 'Significant wait']) },
    { categoryId: physioCat.id, text: 'Anything specific about your session?', sortOrder: 4, type: 'TEXT', placeholder: 'Something about the treatment, exercises, or therapist...' },

    // ── Gym ──
    { categoryId: gymCat.id, text: 'How would you rate this gym?', sortOrder: 0, type: 'STAR_RATING' },
    { categoryId: gymCat.id, text: 'What stood out?', sortOrder: 1, type: 'MULTI_CHOICE', options: JSON.stringify(['Good equipment', 'Helpful trainers', 'Clean facility', 'Good variety of classes', 'Spacious', 'Flexible timings']) },
    { categoryId: gymCat.id, text: 'How is the equipment condition?', sortOrder: 2, type: 'SINGLE_CHOICE', options: JSON.stringify(['Excellent', 'Good', 'Average', 'Needs maintenance']) },
    { categoryId: gymCat.id, text: 'How crowded is it usually?', sortOrder: 3, type: 'SINGLE_CHOICE', options: JSON.stringify(['Plenty of space', 'Manageable', 'A bit crowded', 'Very crowded']) },
    { categoryId: gymCat.id, text: 'Anything else?', sortOrder: 4, type: 'TEXT', placeholder: 'A trainer, class, or facility detail...' },
  ];

  for (const qt of questionTemplates) {
    await prisma.questionTemplate.upsert({
      where: { id: `template-${qt.categoryId}-${qt.sortOrder}` },
      update: qt,
      create: { id: `template-${qt.categoryId}-${qt.sortOrder}`, ...qt },
    });
  }

  // ─── Insight Templates (10 per category) ─────────────────────────────
  const insightTemplatesByCategory: Record<string, string[]> = {
    Restaurant: ['Flavorful food', 'Fresh ingredients', 'Generous portions', 'Welcoming staff', 'Cozy ambience', 'Quick service', 'Beautiful presentation', 'Good value for money', 'Clean dining area', 'Great for dine-in'],
    Bakery: ['Fresh-baked goods', 'Beautiful pastries', 'Great coffee pairing', 'Unique flavors', 'Fair prices', 'Warm atmosphere', 'Friendly counter service', 'Good variety', 'Perfect sweetness', 'Nice for takeaway'],
    Boutique: ['Unique finds', 'Quality craftsmanship', 'Helpful styling advice', 'Well-curated selection', 'Welcoming atmosphere', 'Fair pricing', 'Beautiful store layout', 'Personal attention', 'Gift-worthy items', 'Easy exchange policy'],
    Salon: ['Skilled stylist', 'Listened carefully', 'Relaxing atmosphere', 'Clean and hygienic', 'On-time appointment', 'Friendly team', 'Good product recommendations', 'Fair pricing', 'Happy with my haircut', 'Walk-in friendly'],
    Hotel: ['Comfortable bed', 'Spotless room', 'Helpful front desk', 'Great breakfast buffet', 'Quiet room', 'Nice amenities', 'Good location for sightseeing', 'Smooth check-in', 'Beautiful decor', 'Responsive room service'],
    'Dental Office': ['Gentle approach', 'Clear explanations', 'Minimal wait time', 'Friendly dental staff', 'Clean facility', 'Pain-free cleaning', 'Good follow-up care', 'Modern equipment', 'Calming environment', 'Thorough dental exam'],
    'Auto Repair': ['Honest assessment', 'Fair pricing', 'Quick turnaround', 'Clear communication', 'Quality parts used', 'Trustworthy mechanics', 'Convenient drop-off', 'Detailed invoice', 'Problem fixed right', 'Courtesy service updates'],
    Retail: ['Wide selection', 'Quality products', 'Helpful floor staff', 'Clean store', 'Quick checkout', 'Good deals', 'Well-organized aisles', 'Easy to find items', 'Fair return policy', 'Friendly greeting'],
    Physiotherapy: ['Effective treatment plan', 'Therapist listened', 'Clear exercise guidance', 'Personal attention', 'Noticeable improvement', 'Professional approach', 'Comfortable treatment room', 'Flexible scheduling', 'Thorough initial assessment', 'Encouraging attitude'],
    Gym: ['Great equipment variety', 'Knowledgeable trainers', 'Clean locker rooms', 'Good class variety', 'Spacious workout area', 'Flexible membership hours', 'Friendly gym community', 'Fair membership price', 'Well-maintained machines', 'Good ventilation'],
  };

  const toSlug = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  for (const cat of categories) {
    const labels = insightTemplatesByCategory[cat.name];
    if (!labels) continue;
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      await prisma.insightTemplate.upsert({
        where: { id: `insight-tpl-${cat.id}-${i}` },
        update: { label, slug: toSlug(label), sortOrder: i, categoryId: cat.id },
        create: {
          id: `insight-tpl-${cat.id}-${i}`,
          categoryId: cat.id,
          label,
          slug: toSlug(label),
          sortOrder: i,
        },
      });
    }
  }

  // ─── Admin User ──────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@reputeai.com' },
    update: {},
    create: {
      email: 'admin@reputeai.com',
      passwordHash: adminHash,
      name: 'ReputeAI Admin',
      role: 'ADMIN',
    },
  });

  // ─── Demo Business Owner ────────────────────────────────────────────
  const demoHash = await bcrypt.hash('demo123', 12);
  const demoOwner = await prisma.user.upsert({
    where: { email: 'demo@reputeai.com' },
    update: {},
    create: {
      email: 'demo@reputeai.com',
      passwordHash: demoHash,
      name: 'Demo Owner',
      role: 'BUSINESS_OWNER',
    },
  });

  // ─── Demo Business ──────────────────────────────────────────────────
  const demoBusiness = await prisma.business.upsert({
    where: { slug: 'bellas-kitchen' },
    update: {},
    create: {
      name: "Bella's Italian Kitchen",
      slug: 'bellas-kitchen',
      description: 'Authentic Italian cuisine in the heart of the city. Family recipes passed down through generations.',
      categoryId: restaurantCat.id,
      address: '123 Main Street, Downtown',
      phone: '+1-555-0123',
      website: 'https://bellaskitchen.example.com',
      googleReviewUrl: 'https://search.google.com/local/writereview?placeid=PLACEHOLDER',
      isDemo: true,
      isActive: true,
    },
  });

  // Link demo owner to demo business
  await prisma.businessMember.upsert({
    where: { userId_businessId: { userId: demoOwner.id, businessId: demoBusiness.id } },
    update: {},
    create: {
      userId: demoOwner.id,
      businessId: demoBusiness.id,
      role: 'OWNER',
    },
  });

  // ─── Demo Business Questions (restaurant templates) ─────────────────
  // Mirror the restaurant question templates with type/options/placeholder
  const demoQDefs = [
    { id: 'demo-q-0', text: 'How would you rate your overall dining experience?', sortOrder: 0, type: 'STAR_RATING' as const, options: null, placeholder: null },
    { id: 'demo-q-1', text: 'What stood out?', sortOrder: 1, type: 'MULTI_CHOICE' as const, options: JSON.stringify(['Flavorful food', 'Fresh ingredients', 'Good portions', 'Quick service', 'Friendly staff', 'Nice ambience']), placeholder: null },
    { id: 'demo-q-2', text: 'What best describes the service?', sortOrder: 2, type: 'SINGLE_CHOICE' as const, options: JSON.stringify(['Attentive and prompt', 'Friendly but slow', 'Average', 'Could be better']), placeholder: null },
    { id: 'demo-q-3', text: 'How was the wait time?', sortOrder: 3, type: 'SINGLE_CHOICE' as const, options: JSON.stringify(['No wait', 'Short wait', 'Reasonable', 'Too long']), placeholder: null },
    { id: 'demo-q-4', text: 'Anything specific you\'d like to mention?', sortOrder: 4, type: 'TEXT' as const, options: null, placeholder: 'A dish you loved, something the staff did...' },
  ];

  for (const q of demoQDefs) {
    await prisma.businessQuestion.upsert({
      where: { id: q.id },
      update: { text: q.text, sortOrder: q.sortOrder, type: q.type, options: q.options, placeholder: q.placeholder },
      create: {
        id: q.id,
        businessId: demoBusiness.id,
        text: q.text,
        sortOrder: q.sortOrder,
        type: q.type,
        options: q.options,
        placeholder: q.placeholder,
      },
    });
  }

  // ─── Demo Business Insights (cloned from Restaurant templates) ──────
  const restaurantInsights = insightTemplatesByCategory['Restaurant'];
  for (let i = 0; i < restaurantInsights.length; i++) {
    const label = restaurantInsights[i];
    await prisma.businessInsight.upsert({
      where: { id: `demo-insight-${i}` },
      update: { label, slug: toSlug(label), sortOrder: i, businessId: demoBusiness.id },
      create: {
        id: `demo-insight-${i}`,
        businessId: demoBusiness.id,
        label,
        slug: toSlug(label),
        sortOrder: i,
        isCustom: false,
      },
    });
  }

  // ─── Demo Feedback Data ─────────────────────────────────────────────
  // Each set has responses for 5 questions:
  //   q0 (STAR_RATING): { rating }
  //   q1 (MULTI_CHOICE): { answer: JSON string[] of selected chips }
  //   q2 (SINGLE_CHOICE): { answer: selected option }
  //   q3 (SINGLE_CHOICE): { answer: selected option }
  //   q4 (TEXT): { answer: free text }
  const demoFeedbackSets = [
    {
      responses: [
        { rating: 5 },
        { answer: JSON.stringify(['Flavorful food', 'Fresh ingredients', 'Nice ambience']) },
        { answer: 'Attentive and prompt' },
        { answer: 'No wait' },
        { answer: 'Loved the biryani! Best Italian food in town.' },
      ],
      comment: 'Loved the biryani! Best Italian food in town.',
    },
    {
      responses: [
        { rating: 4 },
        { answer: JSON.stringify(['Flavorful food', 'Friendly staff']) },
        { answer: 'Attentive and prompt' },
        { answer: 'Short wait' },
        { answer: 'Great pasta and friendly staff.' },
      ],
      comment: 'Great pasta and friendly staff.',
    },
    {
      responses: [
        { rating: 3 },
        { answer: JSON.stringify(['Good portions']) },
        { answer: 'Friendly but slow' },
        { answer: 'Too long' },
        { answer: 'Food was good but service was slow.' },
      ],
      comment: 'Food was good but service was slow.',
    },
    {
      responses: [
        { rating: 5 },
        { answer: JSON.stringify(['Flavorful food', 'Fresh ingredients', 'Friendly staff', 'Nice ambience']) },
        { answer: 'Attentive and prompt' },
        { answer: 'No wait' },
        { answer: 'Perfect evening! Will definitely come back.' },
      ],
      comment: 'Perfect evening! Will definitely come back.',
    },
    {
      responses: [
        { rating: 3 },
        { answer: JSON.stringify(['Good portions']) },
        { answer: 'Average' },
        { answer: 'Reasonable' },
        { answer: '' },
      ],
      comment: null,
    },
    {
      responses: [
        { rating: 4 },
        { answer: JSON.stringify(['Flavorful food', 'Fresh ingredients']) },
        { answer: 'Attentive and prompt' },
        { answer: 'Short wait' },
        { answer: 'Delicious food, a bit noisy.' },
      ],
      comment: 'Delicious food, a bit noisy.',
    },
    {
      responses: [
        { rating: 2 },
        { answer: JSON.stringify([]) },
        { answer: 'Could be better' },
        { answer: 'Too long' },
        { answer: 'Very disappointing experience. Long wait, cold food.' },
      ],
      comment: 'Very disappointing experience. Long wait, cold food.',
    },
    {
      responses: [
        { rating: 5 },
        { answer: JSON.stringify(['Flavorful food', 'Nice ambience', 'Friendly staff']) },
        { answer: 'Attentive and prompt' },
        { answer: 'No wait' },
        { answer: 'Amazing ambience and the tiramisu was to die for!' },
      ],
      comment: 'Amazing ambience and the tiramisu was to die for!',
    },
    {
      responses: [
        { rating: 4 },
        { answer: JSON.stringify(['Flavorful food', 'Good portions']) },
        { answer: 'Friendly but slow' },
        { answer: 'Reasonable' },
        { answer: '' },
      ],
      comment: null,
    },
    {
      responses: [
        { rating: 3 },
        { answer: JSON.stringify(['Nice ambience']) },
        { answer: 'Average' },
        { answer: 'Reasonable' },
        { answer: 'Average food but nice decor.' },
      ],
      comment: 'Average food but nice decor.',
    },
    {
      responses: [
        { rating: 4 },
        { answer: JSON.stringify(['Flavorful food', 'Fresh ingredients']) },
        { answer: 'Friendly but slow' },
        { answer: 'Too long' },
        { answer: 'Best pizza ever but took 45 mins to get our order.' },
      ],
      comment: 'Best pizza ever but took 45 mins to get our order.',
    },
    {
      responses: [
        { rating: 5 },
        { answer: JSON.stringify(['Flavorful food', 'Friendly staff', 'Nice ambience']) },
        { answer: 'Attentive and prompt' },
        { answer: 'Short wait' },
        { answer: 'Our anniversary dinner was wonderful!' },
      ],
      comment: 'Our anniversary dinner was wonderful!',
    },
    {
      responses: [
        { rating: 2 },
        { answer: JSON.stringify([]) },
        { answer: 'Could be better' },
        { answer: 'Reasonable' },
        { answer: 'Food was below average today.' },
      ],
      comment: 'Food was below average today.',
    },
    {
      responses: [
        { rating: 5 },
        { answer: JSON.stringify(['Flavorful food', 'Quick service', 'Nice ambience']) },
        { answer: 'Attentive and prompt' },
        { answer: 'No wait' },
        { answer: '' },
      ],
      comment: null,
    },
    {
      responses: [
        { rating: 3 },
        { answer: JSON.stringify(['Good portions']) },
        { answer: 'Average' },
        { answer: 'Reasonable' },
        { answer: 'It was okay, nothing special.' },
      ],
      comment: 'It was okay, nothing special.',
    },
    {
      responses: [
        { rating: 4 },
        { answer: JSON.stringify(['Flavorful food', 'Fresh ingredients', 'Friendly staff']) },
        { answer: 'Attentive and prompt' },
        { answer: 'Short wait' },
        { answer: 'The risotto was amazing!' },
      ],
      comment: 'The risotto was amazing!',
    },
    {
      responses: [
        { rating: 5 },
        { answer: JSON.stringify(['Flavorful food', 'Fresh ingredients', 'Good portions', 'Quick service', 'Friendly staff', 'Nice ambience']) },
        { answer: 'Attentive and prompt' },
        { answer: 'No wait' },
        { answer: 'Best restaurant in the area. Period.' },
      ],
      comment: 'Best restaurant in the area. Period.',
    },
    {
      responses: [
        { rating: 4 },
        { answer: JSON.stringify(['Flavorful food', 'Good portions']) },
        { answer: 'Friendly but slow' },
        { answer: 'Short wait' },
        { answer: 'Good food, service could be better.' },
      ],
      comment: 'Good food, service could be better.',
    },
    {
      responses: [
        { rating: 3 },
        { answer: JSON.stringify(['Fresh ingredients']) },
        { answer: 'Average' },
        { answer: 'Reasonable' },
        { answer: 'The portion sizes have gotten smaller.' },
      ],
      comment: 'The portion sizes have gotten smaller.',
    },
    {
      responses: [
        { rating: 5 },
        { answer: JSON.stringify(['Flavorful food', 'Friendly staff', 'Nice ambience']) },
        { answer: 'Attentive and prompt' },
        { answer: 'No wait' },
        { answer: 'Celebrated my birthday here. Wonderful!' },
      ],
      comment: 'Celebrated my birthday here. Wonderful!',
    },
  ];

  const questionIds = demoQDefs.map((q) => q.id);
  const questionTypes = demoQDefs.map((q) => q.type);

  for (let i = 0; i < demoFeedbackSets.length; i++) {
    const fb = demoFeedbackSets[i];
    const sessionId = `demo-session-${i}`;
    const date = new Date();
    date.setDate(date.getDate() - (demoFeedbackSets.length - i)); // Spread over days

    await prisma.reviewSession.upsert({
      where: { id: sessionId },
      update: {},
      create: {
        id: sessionId,
        businessId: demoBusiness.id,
        sessionToken: `demo-token-${i}`,
        status: 'HANDED_OFF',
        completedAt: date,
        createdAt: date,
      },
    });

    for (let j = 0; j < 5; j++) {
      const resp = fb.responses[j];
      const qType = questionTypes[j];

      const data: Record<string, unknown> = {
        sessionId,
        questionId: questionIds[j],
        createdAt: date,
      };

      if (qType === 'STAR_RATING') {
        data.rating = (resp as { rating: number }).rating;
      } else {
        data.answer = (resp as { answer: string }).answer;
      }

      await prisma.customerResponse.upsert({
        where: { sessionId_questionId: { sessionId, questionId: questionIds[j] } },
        update: qType === 'STAR_RATING' ? { rating: data.rating as number } : { answer: data.answer as string },
        create: data,
      });
    }

    if (fb.comment) {
      await prisma.customerFeedback.upsert({
        where: { sessionId },
        update: { comment: fb.comment },
        create: { sessionId, comment: fb.comment, createdAt: date },
      });
    }

    // Funnel events
    for (const eventType of ['SESSION_STARTED', 'RATING_COMPLETED', 'DRAFTS_GENERATED', 'DRAFT_SELECTED', 'GOOGLE_HANDOFF']) {
      await prisma.funnelEvent.create({
        data: {
          businessId: demoBusiness.id,
          sessionId,
          eventType,
          createdAt: date,
        },
      });
    }
  }

  console.log('✅ Database seeded successfully!');
  console.log(`   📧 Admin: admin@reputeai.com / admin123`);
  console.log(`   📧 Demo Owner: demo@reputeai.com / demo123`);
  console.log(`   🏪 Demo Business: Bella's Italian Kitchen (bellas-kitchen)`);
  console.log(`   📝 ${demoFeedbackSets.length} demo feedback entries created`);
  console.log(`   📂 10 categories with 5 mixed-type question templates each`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
