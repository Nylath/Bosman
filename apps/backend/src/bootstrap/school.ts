import { eq } from "drizzle-orm";

import { db } from "../db/client.js";
import { organizations } from "../db/schema.js";

const SCHOOL_ORGANIZATION_SLUG = "akademia-zeglarstwa-demo";

const SCHOOL_ORGANIZATION_NAME = "Akademia Żeglarstwa Demo";

export async function ensureSchoolOrganization(): Promise<string> {
  await db
    .insert(organizations)
    .values({
      name: SCHOOL_ORGANIZATION_NAME,
      slug: SCHOOL_ORGANIZATION_SLUG,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: organizations.slug,
      set: {
        name: SCHOOL_ORGANIZATION_NAME,
        isActive: true,
        updatedAt: new Date(),
      },
    });

  const [organization] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
    })
    .from(organizations)
    .where(eq(organizations.slug, SCHOOL_ORGANIZATION_SLUG))
    .limit(1);

  if (!organization) {
    throw new Error("Nie udało się utworzyć organizacji szkółki.");
  }

  console.log(
    `Organizacja szkółki gotowa: ${organization.name} (${organization.slug})`,
  );

  return organization.id;
}
