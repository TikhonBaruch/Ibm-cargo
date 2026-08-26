/**
 * Seed clarify_attribute_options + root dependency_edges from code catalogs.
 * Idempotent upsert. Usage: npx tsx scripts/clarify-hints-seed-options.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  COMPOSITION,
  KNIT_WOVEN,
  COLOR,
  FOOTWEAR_UPPER,
  FOOTWEAR_SOLE,
  FOOTWEAR_PURPOSE,
  MATERIAL,
  ELECTRONICS_DEVICE,
  ELECTRONICS_SPECS,
  type ClarifyOption,
} from "../src/lib/ved/clarify-hints";

const prisma = new PrismaClient();

type SeedRow = {
  category: string;
  attrKey: string;
  options: ClarifyOption[];
};

const SEEDS: SeedRow[] = [
  { category: "footwear", attrKey: "upper", options: FOOTWEAR_UPPER },
  { category: "footwear", attrKey: "sole", options: FOOTWEAR_SOLE },
  { category: "footwear", attrKey: "purpose", options: FOOTWEAR_PURPOSE },
  { category: "apparel", attrKey: "composition", options: COMPOSITION },
  { category: "apparel", attrKey: "knit-woven", options: KNIT_WOVEN },
  { category: "apparel", attrKey: "color", options: COLOR },
  { category: "textiles", attrKey: "composition", options: COMPOSITION },
  { category: "electronics", attrKey: "device", options: ELECTRONICS_DEVICE },
  { category: "electronics", attrKey: "specs", options: ELECTRONICS_SPECS },
  { category: "generic", attrKey: "material", options: MATERIAL },
];

const ROOT_EDGES: Array<{ category: string; childAttr: string }> = [
  { category: "footwear", childAttr: "upper" },
  { category: "footwear", childAttr: "sole" },
  { category: "footwear", childAttr: "purpose" },
  { category: "apparel", childAttr: "composition" },
  { category: "apparel", childAttr: "knit-woven" },
  { category: "apparel", childAttr: "color" },
  { category: "electronics", childAttr: "device" },
  { category: "electronics", childAttr: "specs" },
  { category: "generic", childAttr: "kind" },
  { category: "generic", childAttr: "material" },
];

async function main() {
  let options = 0;
  let edges = 0;
  for (const seed of SEEDS) {
    for (const opt of seed.options) {
      if (opt.id === "custom") continue;
      await prisma.clarifyAttributeOption.upsert({
        where: {
          category_attrKey_optionId: {
            category: seed.category,
            attrKey: seed.attrKey,
            optionId: opt.id,
          },
        },
        create: {
          category: seed.category,
          attrKey: seed.attrKey,
          optionId: opt.id,
          label: opt.label,
          searchValue: opt.searchValue,
          weight: 1,
          attrsPatch: opt.attrsPatch ?? undefined,
        },
        update: {
          label: opt.label,
          searchValue: opt.searchValue,
          attrsPatch: opt.attrsPatch ?? undefined,
        },
      });
      options += 1;
    }
  }
  for (const e of ROOT_EDGES) {
    await prisma.clarifyDependencyEdge.upsert({
      where: {
        category_parentAttr_parentValue_childAttr: {
          category: e.category,
          parentAttr: "",
          parentValue: "",
          childAttr: e.childAttr,
        },
      },
      create: {
        category: e.category,
        parentAttr: "",
        parentValue: "",
        childAttr: e.childAttr,
        weight: 1,
      },
      update: {},
    });
    edges += 1;
  }
  console.log(JSON.stringify({ ok: true, options, edges }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
