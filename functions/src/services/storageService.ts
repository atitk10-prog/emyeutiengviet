import * as fs from 'fs';
import * as path from 'path';

// Root persistent storage path (independent of web/dist and ephemeral builds)
const PERSISTENT_STORAGE_DIR = path.resolve(__dirname, '../../../persistent_storage/audio');
// Web mirror directory (for instant client playback on localhost:3000 / localhost:5000)
const WEB_PUBLIC_UPLOADS_DIR = path.resolve(__dirname, '../../../web/public/audio/uploads');

export interface StoredAudioResult {
  storagePath: string;
  audioUrl: string;
  sizeBytes: number;
}

export class StorageService {
  private static ensureDirs(): void {
    if (!fs.existsSync(PERSISTENT_STORAGE_DIR)) {
      fs.mkdirSync(PERSISTENT_STORAGE_DIR, { recursive: true });
    }
    if (!fs.existsSync(WEB_PUBLIC_UPLOADS_DIR)) {
      fs.mkdirSync(WEB_PUBLIC_UPLOADS_DIR, { recursive: true });
    }
  }

  /**
   * Save an audio buffer to persistent storage and mirror to web public uploads.
   */
  public static async saveAudioBuffer(
    fileName: string,
    buffer: Buffer
  ): Promise<StoredAudioResult> {
    this.ensureDirs();

    // 1. Write to persistent storage
    const persistentFilePath = path.join(PERSISTENT_STORAGE_DIR, fileName);
    fs.writeFileSync(persistentFilePath, buffer);

    // 2. Mirror to web public directory for zero-latency streaming
    const webFilePath = path.join(WEB_PUBLIC_UPLOADS_DIR, fileName);
    fs.writeFileSync(webFilePath, buffer);

    const storagePath = `audio/uploads/${fileName}`;
    const audioUrl = `/audio/uploads/${fileName}`;

    return {
      storagePath,
      audioUrl,
      sizeBytes: buffer.length
    };
  }

  /**
   * Delete an audio file from persistent storage and web mirror.
   */
  public static async deleteAudioFile(storagePath: string): Promise<boolean> {
    const baseName = path.basename(storagePath);
    let deleted = false;

    const persistentFilePath = path.join(PERSISTENT_STORAGE_DIR, baseName);
    if (fs.existsSync(persistentFilePath)) {
      fs.unlinkSync(persistentFilePath);
      deleted = true;
    }

    const webFilePath = path.join(WEB_PUBLIC_UPLOADS_DIR, baseName);
    if (fs.existsSync(webFilePath)) {
      fs.unlinkSync(webFilePath);
      deleted = true;
    }

    return deleted;
  }

  /**
   * Sync all files from persistent storage to web public uploads (called on emulator start or build).
   */
  public static syncAllToWeb(): void {
    this.ensureDirs();
    if (!fs.existsSync(PERSISTENT_STORAGE_DIR)) return;

    const files = fs.readdirSync(PERSISTENT_STORAGE_DIR);
    for (const file of files) {
      const src = path.join(PERSISTENT_STORAGE_DIR, file);
      const dst = path.join(WEB_PUBLIC_UPLOADS_DIR, file);
      if (fs.existsSync(src) && !fs.existsSync(dst)) {
        fs.copyFileSync(src, dst);
      }
    }
  }

  /**
   * Backup persistent storage directory into an emulator backup directory.
   */
  public static exportAudioBackup(targetBackupDir: string): void {
    this.ensureDirs();
    const destDir = path.join(targetBackupDir, 'audio_storage');
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    if (fs.existsSync(PERSISTENT_STORAGE_DIR)) {
      const files = fs.readdirSync(PERSISTENT_STORAGE_DIR);
      for (const file of files) {
        fs.copyFileSync(
          path.join(PERSISTENT_STORAGE_DIR, file),
          path.join(destDir, file)
        );
      }
    }
  }

  /**
   * Restore persistent storage from a backup directory.
   */
  public static importAudioBackup(sourceBackupDir: string): void {
    const srcDir = path.join(sourceBackupDir, 'audio_storage');
    if (!fs.existsSync(srcDir)) return;

    this.ensureDirs();
    const files = fs.readdirSync(srcDir);
    for (const file of files) {
      fs.copyFileSync(
        path.join(srcDir, file),
        path.join(PERSISTENT_STORAGE_DIR, file)
      );
      fs.copyFileSync(
        path.join(srcDir, file),
        path.join(WEB_PUBLIC_UPLOADS_DIR, file)
      );
    }
  }
}
