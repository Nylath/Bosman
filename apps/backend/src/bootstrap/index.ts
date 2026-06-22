import { config } from "../config.js";

import {
  ensureLocalOrganization,
  ensureLocalParticipant,
} from "./local.js";

import {
  ensureSchoolOrganization,
} from "./school.js";

export async function bootstrapApplication(): Promise<void> {
  if (config.appMode === "LOCAL") {
    const organizationId =
      await ensureLocalOrganization();

    await ensureLocalParticipant(organizationId);

    return;
  }

  if (config.appMode === "SCHOOL") {
    await ensureSchoolOrganization();
  }
}