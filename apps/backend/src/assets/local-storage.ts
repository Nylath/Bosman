import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AssetStorage } from "./storage.js";

function normalizeAssetPath(assetPath: string): string {
  const candidate = assetPath.trim().replaceAll("\\", "/");

  if (!candidate) {
    throw new Error("Ścieżka grafiki nie może być pusta.");
  }

  if (candidate.startsWith("/")) {
    throw new Error("Ścieżka grafiki nie może być bezwzględna.");
  }

  if (candidate.split("/").includes("..")) {
    throw new Error("Ścieżka grafiki nie może wychodzić poza katalog zasobów.");
  }

  const normalizedPath = path.posix.normalize(candidate);

  if (
    normalizedPath === "." ||
    normalizedPath.startsWith("../")
  ) {
    throw new Error("Nieprawidłowa ścieżka grafiki.");
  }

  return normalizedPath;
}

function encodeUrlPath(assetPath: string): string {
  return assetPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export class LocalAssetStorage implements AssetStorage {
  public constructor(
    private readonly rootDirectory: string,
    private readonly publicBasePath = "/assets",
  ) {}

  public async save(file: Buffer, filename: string): Promise<string> {
    const assetPath = normalizeAssetPath(filename);
    const targetPath = this.resolveAssetPath(assetPath);

    await mkdir(path.dirname(targetPath), {
      recursive: true,
    });

    await writeFile(targetPath, file);

    return assetPath;
  }

  public async remove(assetPath: string): Promise<void> {
    const targetPath = this.resolveAssetPath(assetPath);

    await rm(targetPath, {
      force: true,
    });
  }

  public getPublicUrl(assetPath: string): string {
    const normalizedPath = normalizeAssetPath(assetPath);

    return `${this.publicBasePath}/${encodeUrlPath(normalizedPath)}`;
  }

  private resolveAssetPath(assetPath: string): string {
    const normalizedPath = normalizeAssetPath(assetPath);

    const resolvedRoot = path.resolve(this.rootDirectory);

    const resolvedTarget = path.resolve(
      resolvedRoot,
      ...normalizedPath.split("/"),
    );

    if (
      resolvedTarget !== resolvedRoot &&
      !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)
    ) {
      throw new Error("Ścieżka grafiki wychodzi poza katalog zasobów.");
    }

    return resolvedTarget;
  }
}
