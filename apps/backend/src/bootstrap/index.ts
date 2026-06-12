import { config } from "../config.js";

import {
  ensureLocalOrganization,
  ensureLocalParticipant,
} from "./local.js";

export async function bootstrapApplication(): Promise<void> {
  if (config.appMode === "LOCAL") {
    const organizationId = await ensureLocalOrganization();
    await ensureLocalParticipant(organizationId);
  }
}