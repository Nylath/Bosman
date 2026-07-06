import { and, eq } from "drizzle-orm";

import { db } from "../db/client.js";
import { organizations, participants } from "../db/schema.js";

const LOCAL_ORGANIZATION_SLUG = "bosman-local";

export async function ensureLocalOrganization(): Promise<string> {
  await db
    .insert(organizations)
    .values({
      name: "Bosman lokalny",
      slug: LOCAL_ORGANIZATION_SLUG,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: organizations.slug,
      set: {
        name: "Bosman lokalny",
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
    .where(eq(organizations.slug, LOCAL_ORGANIZATION_SLUG))
    .limit(1);

  if (!organization) {
    throw new Error("Nie udało się utworzyć lokalnej organizacji.");
  }

  console.log(
    `Organizacja lokalna gotowa: ${organization.name} (${organization.slug})`,
  );

  return organization.id;
}

export async function ensureLocalParticipant(
  organizationId: string,
): Promise<void> {
  await db
    .insert(participants)
    .values({
      organizationId,
      kind: "local",
      label: "Profil lokalny",
      isActive: true,
    })
    .onConflictDoNothing();

  await db
    .update(participants)
    .set({
      label: "Profil lokalny",
      isActive: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(participants.organizationId, organizationId),
        eq(participants.kind, "local"),
      ),
    );

  const [participant] = await db
    .select({
      id: participants.id,
      label: participants.label,
    })
    .from(participants)
    .where(
      and(
        eq(participants.organizationId, organizationId),
        eq(participants.kind, "local"),
      ),
    )
    .limit(1);

  if (!participant) {
    throw new Error("Nie udało się utworzyć lokalnego profilu użytkownika.");
  }

  console.log(`Profil lokalny gotowy: ${participant.label}`);
}
