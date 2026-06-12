export interface AssetStorage {
  save(file: Buffer, filename: string): Promise<string>;

  remove(assetPath: string): Promise<void>;

  getPublicUrl(assetPath: string): string;
}
