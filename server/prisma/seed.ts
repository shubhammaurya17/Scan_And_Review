import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({ where: { slug: 'restaurant' }, update: {}, create: { name: 'Restaurant', slug: 'restaurant' } }),
    prisma.category.upsert({ where: { slug: 'bakery' }, update: {}, create: { name: 'Bakery', slug: 'bakery' } }),
    prisma.category.upsert({ where: { slug: 'boutique' }, update: {}, create: { name: 'Boutique', slug: 'boutique' } }),
    prisma.category.upsert({ where: { slug: 'salon' }, update: {}, create: { name: 'Salon', slug: 'salon' } }),
    prisma.category.upsert({ where: { slug: 'hotel' }, update: {}, create: { name: 'Hotel', slug: 'hotel' } }),
    prisma.category.upsert({ where: { slug: 'dental-office' }, update: {}, create: { name: 'Dental Office', slug: 'dental-office' } }),
    prisma.category.upsert({ where: { slug: 'auto-repair' }, update: {}, create: { name: 'Auto Repair', slug: 'auto-repair' } }),
    prisma.category.upsert({ where: { slug: 'retail' }, update: {}, create: { name: 'Retail', slug: 'retail' } }),
  ]);

  const restaurantCat = categories[0];
  const bakeryCat = categories[1];
  const salonCat = categories[3];
  const hotelCat = categories[4];

  // Question templates per category
  const questionTemplates = [
    // Restaurant
    { categoryId: restaurantCat.id, text: 'How was the food quality?', sortOrder: 0 },
    { categoryId: restaurantCat.id, text: 'How was the taste?', sortOrder: 1 },
    { categoryId: restaurantCat.id, text: 'How was the service?', sortOrder: 2 },
    { categoryId: restaurantCat.id, text: 'How was the ambience?', sortOrder: 3 },
    { categoryId: restaurantCat.id, text: 'How was your overall experience?', sortOrder: 4 },
    // Bakery
    { categoryId: bakeryCat.id, text: 'How was the taste?', sortOrder: 0 },
    { categoryId: bakeryCat.id, text: 'How was the freshness?', sortOrder: 1 },
    { categoryId: bakeryCat.id, text: 'How was the presentation?', sortOrder: 2 },
    { categoryId: bakeryCat.id, text: 'How was the variety?', sortOrder: 3 },
    { categoryId: bakeryCat.id, text: 'How was your overall experience?', sortOrder: 4 },
    // Salon
    { categoryId: salonCat.id, text: 'How was the service quality?', sortOrder: 0 },
    { categoryId: salonCat.id, text: 'How was the staff?', sortOrder: 1 },
    { categoryId: salonCat.id, text: 'How was the cleanliness?', sortOrder: 2 },
    { categoryId: salonCat.id, text: 'How was the waiting time?', sortOrder: 3 },
    { categoryId: salonCat.id, text: 'How was your overall experience?', sortOrder: 4 },
    // Hotel
    { categoryId: hotelCat.id, text: 'How was the room quality?', sortOrder: 0 },
    { categoryId: hotelCat.id, text: 'How was the cleanliness?', sortOrder: 1 },
    { categoryId: hotelCat.id, text: 'How was the staff?', sortOrder: 2 },
    { categoryId: hotelCat.id, text: 'How was the location?', sortOrder: 3 },
    { categoryId: hotelCat.id, text: 'How was your overall stay?', sortOrder: 4 },
  ];

  for (const qt of questionTemplates) {
    await prisma.questionTemplate.upsert({
      where: { id: `template-${qt.categoryId}-${qt.sortOrder}` },
      update: qt,
      create: { id: `template-${qt.categoryId}-${qt.sortOrder}`, ...qt },
    });
  }

  // Admin user
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

  // Demo business owner
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

  // Demo business
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

  // Demo business questions
  const demoQuestions = [
    'How was the food quality?',
    'How was the taste?',
    'How was the service?',
    'How was the ambience?',
    'How was your overall experience?',
  ];

  for (let i = 0; i < demoQuestions.length; i++) {
    await prisma.businessQuestion.upsert({
      where: { id: `demo-q-${i}` },
      update: { text: demoQuestions[i], sortOrder: i },
      create: {
        id: `demo-q-${i}`,
        businessId: demoBusiness.id,
        text: demoQuestions[i],
        sortOrder: i,
      },
    });
  }

  // Seed demo feedback data
  const demoFeedbackSets = [
    { ratings: [5, 5, 4, 5, 5], comment: 'Loved the biryani! Best Italian food in town.' },
    { ratings: [4, 4, 5, 4, 4], comment: 'Great pasta and friendly staff.' },
    { ratings: [3, 4, 2, 4, 3], comment: 'Food was good but service was slow.' },
    { ratings: [5, 5, 5, 5, 5], comment: 'Perfect evening! Will definitely come back.' },
    { ratings: [2, 3, 3, 3, 3], comment: null },
    { ratings: [4, 5, 4, 3, 4], comment: 'Delicious food, a bit noisy.' },
    { ratings: [1, 2, 1, 3, 2], comment: 'Very disappointing experience. Long wait, cold food.' },
    { ratings: [5, 4, 5, 5, 5], comment: 'Amazing ambience and the tiramisu was to die for!' },
    { ratings: [4, 4, 4, 4, 4], comment: null },
    { ratings: [3, 3, 4, 3, 3], comment: 'Average food but nice decor.' },
    { ratings: [5, 5, 3, 4, 4], comment: 'Best pizza ever but took 45 mins to get our order.' },
    { ratings: [4, 5, 5, 4, 5], comment: 'Our anniversary dinner was wonderful!' },
    { ratings: [2, 2, 4, 3, 2], comment: 'Food was below average today.' },
    { ratings: [5, 4, 4, 5, 5], comment: null },
    { ratings: [3, 3, 3, 3, 3], comment: 'It was okay, nothing special.' },
    { ratings: [4, 5, 4, 4, 4], comment: 'The risotto was amazing!' },
    { ratings: [5, 5, 5, 5, 5], comment: 'Best restaurant in the area. Period.' },
    { ratings: [4, 4, 3, 4, 4], comment: 'Good food, service could be better.' },
    { ratings: [3, 2, 4, 3, 3], comment: 'The portion sizes have gotten smaller.' },
    { ratings: [5, 5, 5, 4, 5], comment: 'Celebrated my birthday here. Wonderful!' },
  ];

  const questionIds = Array.from({ length: 5 }, (_, i) => `demo-q-${i}`);

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
      await prisma.customerResponse.upsert({
        where: { sessionId_questionId: { sessionId, questionId: questionIds[j] } },
        update: { rating: fb.ratings[j] },
        create: {
          sessionId,
          questionId: questionIds[j],
          rating: fb.ratings[j],
          createdAt: date,
        },
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
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
