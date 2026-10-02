import "dotenv/config";
import { db } from "../lib/db";
import type { Prisma } from "../lib/generated/prisma/client";

// Development data only. Upserts by slug and never deletes rows.
const products: Prisma.ProductCreateInput[] = [
  {
    slug: "digital-marketing-template",
    name: "Digital Marketing Template",
    shortDescription: "A complete marketing template to plan your campaigns.",
    description:
      "A ready-to-use marketing template covering campaign planning, content calendars, and reporting.",
    priceCents: 4900,
    type: "DIGITAL_PRODUCT",
    category: "Templates",
    image: null,
    digitalFile: "seed/digital-marketing-template.pdf",
    status: "PUBLISHED",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  {
    slug: "facebook-ads-guide",
    name: "Facebook Ads Guide",
    shortDescription: "A step-by-step guide to running your first ad campaign.",
    description:
      "A practical guide that walks through audience targeting, creative, budgets, and measuring results.",
    priceCents: 1900,
    type: "DIGITAL_PRODUCT",
    category: "Guides",
    image: null,
    digitalFile: "seed/facebook-ads-guide.pdf",
    status: "PUBLISHED",
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
  },
  {
    slug: "ads-management",
    name: "Ads Management",
    shortDescription: "We plan, launch, and manage your ad campaigns.",
    description:
      "Abody runs your advertising campaigns end to end, from setup to ongoing optimization and reporting.",
    priceCents: 29900,
    type: "SERVICE",
    category: "Marketing Services",
    image: null,
    digitalFile: null,
    status: "PUBLISHED",
    createdAt: new Date("2026-01-03T00:00:00.000Z"),
  },
  {
    slug: "social-media-resources-draft",
    name: "Social Media Resources",
    shortDescription: "A resource pack that is not published yet.",
    description: "An unpublished item used to check that drafts stay private.",
    priceCents: 2900,
    type: "DIGITAL_PRODUCT",
    category: "Marketing Resources",
    image: null,
    digitalFile: "seed/social-media-resources.zip",
    status: "UNPUBLISHED",
    createdAt: new Date("2026-01-04T00:00:00.000Z"),
  },
];

async function main() {
  for (const product of products) {
    const { slug, ...fields } = product;
    await db.product.upsert({
      where: { slug },
      update: fields,
      create: product,
    });
  }
  const total = await db.product.count();
  console.log(`Seeded ${products.length} products. Product rows: ${total}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
