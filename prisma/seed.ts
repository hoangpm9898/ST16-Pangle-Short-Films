import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedFakeData() {
  try {
    console.log('🌱 Seeding fake data...');

    // Clear existing data (avoid transactions)
    try {
      await prisma.episode.deleteMany({});
      console.log('📺 Cleared existing episodes');
    } catch (error) {
      console.log('⚠️  No episodes to clear or transaction not supported');
    }
    
    try {
      await prisma.shortFilm.deleteMany({});
      console.log('📽️ Cleared existing short films');
    } catch (error) {
      console.log('⚠️  No short films to clear or transaction not supported');
    }

    // Create fake short films
    const fakeShortFilms = [
      {
        shortplayId: 1001,
        fileId: 517, // Match with your video file
        title: 'Arabic Short Film Test',
        desc: 'Test short film for development',
        lang: 'ar',
        voiceLang: 'ar',
        total: 3,
      },
      {
        shortplayId: 1002,
        fileId: 518,
        title: 'English Drama Series',
        desc: 'Another test short film',
        lang: 'en',
        voiceLang: 'en',
        total: 5,
      },
      {
        shortplayId: 1003,
        fileId: 519,
        title: 'Vietnamese Comedy',
        desc: 'Vietnamese comedy short film',
        lang: 'vi',
        voiceLang: 'vi',
        total: 2,
      },
    ];

    // Insert short films
    for (const film of fakeShortFilms) {
      // Check if film already exists
      let createdFilm = await prisma.shortFilm.findUnique({
        where: { fileId: film.fileId },
      });

      if (!createdFilm) {
        createdFilm = await prisma.shortFilm.create({
          data: film,
        });
        console.log(`📽️ Created short film: ${createdFilm.title} (fileId: ${createdFilm.fileId})`);
      } else {
        console.log(`📽️ Short film already exists: ${createdFilm.title} (fileId: ${createdFilm.fileId})`);
      }

      // Create episodes for each film
      for (let i = 1; i <= film.total; i++) {
        const episodeId = `${film.fileId}-ep${i}`;
        
        // Check if episode already exists
        const existingEpisode = await prisma.episode.findUnique({
          where: { episodeId },
        });

        if (!existingEpisode) {
          const episode = await prisma.episode.create({
            data: {
              episodeId,
              index: i,
              name: `Episode ${i}`,
              originStreamLink: film.fileId === 517 
                ? `file:///${process.cwd()}/517_arabic_rv (7).mp4` // Use your local file
                : `https://example.com/video_${film.fileId}_ep${i}.mp4`,
              shortFilmId: createdFilm.id,
            },
          });
          console.log(`📺 Created episode: ${episode.name} for ${createdFilm.title}`);
        } else {
          console.log(`📺 Episode already exists: Episode ${i} for ${createdFilm.title}`);
        }
      }
    }

    console.log('✅ Fake data seeded successfully!');
    
    // Print summary
    const totalFilms = await prisma.shortFilm.count();
    const totalEpisodes = await prisma.episode.count();
    
    console.log(`\n📊 Summary:`);
    console.log(`   Short Films: ${totalFilms}`);
    console.log(`   Episodes: ${totalEpisodes}`);
    console.log(`\n🎬 Ready for testing!`);

  } catch (error) {
    console.error('❌ Error seeding data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  seedFakeData();
}

export { seedFakeData };