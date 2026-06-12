import { config } from "../config.js";

import { LocalAssetStorage } from "./local-storage.js";
import type { AssetStorage } from "./storage.js";

function createAssetStorage(): AssetStorage {
  switch (config.assetStorage) {
    case "local":
      return new LocalAssetStorage(config.assetDirectory);
  }
}

export const assetStorage = createAssetStorage();
