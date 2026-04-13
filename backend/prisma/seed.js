const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding Database...');
  
  const category = await prisma.skillCategory.upsert({
    where: { name: 'Programming Languages' },
    update: {},
    create: { name: 'Programming Languages' }
  });

  const skill1 = await prisma.skill.create({
    data: { name: 'JavaScript', categoryId: category.id }
  });

  const skill2 = await prisma.skill.create({
    data: { name: 'Python', categoryId: category.id }
  });

  console.log('Seeded Skills successfully:\n', skill1.name, skill1.id, '\n', skill2.name, skill2.id);
  process.exit(0);
}

seed();
