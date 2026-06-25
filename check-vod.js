const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();
prisma.video.findMany({
  orderBy: { createdAt: 'desc' },
  take: 3,
  select: { id: true, title: true, videoUrl: true, vodVideoId: true }
}).then(v => {
  console.log(JSON.stringify(v, null, 2));
  prisma.$disconnect();
});
