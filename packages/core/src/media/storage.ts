import { mkdirSync, existsSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';

// ─── Interface ──────────────────────────────────────────────────────

export interface StorageProvider {
  upload(key: string, buffer: Buffer, mimeType: string): Promise<void>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}

// ─── Local filesystem provider ──────────────────────────────────────

export class LocalStorageProvider implements StorageProvider {
  private readonly baseDir: string;

  constructor(baseDir = './uploads') {
    this.baseDir = baseDir;
  }

  async upload(key: string, buffer: Buffer, _mimeType: string): Promise<void> {
    const filePath = join(this.baseDir, key);
    const dir = dirname(filePath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(filePath, buffer);
  }

  async delete(key: string): Promise<void> {
    const filePath = join(this.baseDir, key);

    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  getUrl(key: string): string {
    return `/media/${key}`;
  }

  /** Resolve a storage key to an absolute path on disk. */
  resolve(key: string): string {
    return join(this.baseDir, key);
  }
}

// ─── Factory ────────────────────────────────────────────────────────

let _provider: StorageProvider | undefined;

export function getStorageProvider(): StorageProvider {
  if (!_provider) {
    _provider = new LocalStorageProvider();
  }
  return _provider;
}
