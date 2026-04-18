import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const STORAGE_ROOT = path.resolve(process.cwd(), 'storage');
const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB chunks for large files

interface UploadedChunk {
  chunkIndex: number;
  size: number;
  path: string;
}

interface StoredFile {
  fileId: string;
  originalName: string;
  mimeType: string;
  totalSize: number;
  encryptionLevel: number;
  chunks: UploadedChunk[];
  createdAt: string;
  userId: string;
  storagePath: string;
}

class LocalStorage {
  private initialized = false;

  constructor() {
    this.init();
  }

  /**
   * Initialize storage directories
   */
  private async init() {
    try {
      await fs.mkdir(STORAGE_ROOT, { recursive: true });
      await fs.mkdir(path.join(STORAGE_ROOT, 'files'), { recursive: true });
      await fs.mkdir(path.join(STORAGE_ROOT, 'chunks'), { recursive: true });
      await fs.mkdir(path.join(STORAGE_ROOT, 'temp'), { recursive: true });
      
      this.initialized = true;
      console.log(`\n💾 LOCAL STORAGE:`);
      console.log(`  ✓ Storage root: ${STORAGE_ROOT}`);
      console.log(`  ✓ Directories initialized`);
      console.log('');
    } catch (error: any) {
      console.error('Failed to initialize local storage:', error.message);
      throw error;
    }
  }

  /**
   * Ensure storage is initialized
   */
  private async ensureInit() {
    if (!this.initialized) {
      await this.init();
    }
  }

  /**
   * Generate unique file ID
   */
  private generateFileId(): string {
    return `local_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Get storage path for a file
   */
  private getFilePath(fileId: string): string {
    // Organize files in subdirectories by first 2 chars of fileId for better performance
    const subdir = fileId.substring(0, 2);
    return path.join(STORAGE_ROOT, 'files', subdir, fileId);
  }

  /**
   * Get chunk path
   */
  private getChunkPath(fileId: string, chunkIndex: number): string {
    const subdir = fileId.substring(0, 2);
    return path.join(STORAGE_ROOT, 'chunks', subdir, `${fileId}_chunk_${chunkIndex}`);
  }

  /**
   * Upload file to local storage
   */
  async uploadFile(
    fileBuffer: Buffer,
    filename: string,
    mimeType: string,
    userId: string,
    encryptionLevel: number = 0
  ): Promise<StoredFile> {
    await this.ensureInit();

    const fileId = this.generateFileId();
    const fileSizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);
    
    console.log(`\n📦 FILE UPLOAD: ${filename}`);
    console.log(`   Size: ${fileSizeMB} MB`);
    console.log(`   MIME: ${mimeType}`);
    console.log(`   User: ${userId}`);
    console.log(`   File ID: ${fileId}`);

    const chunks: UploadedChunk[] = [];

    // For small files (< 20MB), store as single file
    if (fileBuffer.length <= CHUNK_SIZE) {
      const filePath = this.getFilePath(fileId);
      const fileDir = path.dirname(filePath);
      
      await fs.mkdir(fileDir, { recursive: true });
      await fs.writeFile(filePath, fileBuffer);
      
      console.log(`   ✅ Stored as single file: ${filePath}`);
      
      return {
        fileId,
        originalName: filename,
        mimeType,
        totalSize: fileBuffer.length,
        encryptionLevel,
        chunks: [{
          chunkIndex: 0,
          size: fileBuffer.length,
          path: filePath,
        }],
        createdAt: new Date().toISOString(),
        userId,
        storagePath: filePath,
      };
    }

    // For large files, split into chunks
    const chunkCount = Math.ceil(fileBuffer.length / CHUNK_SIZE);
    console.log(`   Splitting into ${chunkCount} chunks...`);

    for (let i = 0; i < chunkCount; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, fileBuffer.length);
      const chunk = fileBuffer.slice(start, end);
      
      const chunkPath = this.getChunkPath(fileId, i);
      const chunkDir = path.dirname(chunkPath);
      
      await fs.mkdir(chunkDir, { recursive: true });
      await fs.writeFile(chunkPath, chunk);
      
      chunks.push({
        chunkIndex: i,
        size: chunk.length,
        path: chunkPath,
      });
      
      console.log(`   ✓ Chunk ${i + 1}/${chunkCount} saved (${(chunk.length / 1024 / 1024).toFixed(2)} MB)`);
    }

    console.log(`\n✅ FILE UPLOADED SUCCESSFULLY!`);
    console.log(`   ${filename} → ${chunks.length} chunks`);

    return {
      fileId,
      originalName: filename,
      mimeType,
      totalSize: fileBuffer.length,
      encryptionLevel,
      chunks,
      createdAt: new Date().toISOString(),
      userId,
      storagePath: chunks.length === 1 ? chunks[0].path : '',
    };
  }

  /**
   * Download file from local storage
   */
  async downloadFile(fileId: string, chunks: UploadedChunk[]): Promise<Buffer> {
    await this.ensureInit();

    console.log(`  ⬇️ Downloading ${chunks.length} chunks for ${fileId}...`);

    // Single file
    if (chunks.length === 1) {
      const filePath = this.getFilePath(fileId);
      try {
        const buffer = await fs.readFile(filePath);
        console.log(`  ✅ File loaded: ${buffer.length} bytes`);
        return buffer;
      } catch (error: any) {
        console.error(`  ❌ Failed to read file: ${error.message}`);
        throw new Error(`File not found: ${fileId}`);
      }
    }

    // Multiple chunks - reassemble
    const chunkBuffers: Buffer[] = [];
    
    for (const chunk of chunks) {
      try {
        const chunkPath = this.getChunkPath(fileId, chunk.chunkIndex);
        const buffer = await fs.readFile(chunkPath);
        chunkBuffers[chunk.chunkIndex] = buffer;
        console.log(`  ✓ Chunk ${chunk.chunkIndex + 1}/${chunks.length} loaded`);
      } catch (error: any) {
        console.error(`  ❌ Failed to read chunk ${chunk.chunkIndex}: ${error.message}`);
        throw new Error(`Chunk ${chunk.chunkIndex} not found for file ${fileId}`);
      }
    }

    const totalSize = chunkBuffers.reduce((sum, b) => sum + b.length, 0);
    console.log(`  ✅ File reassembled: ${totalSize} bytes`);
    
    return Buffer.concat(chunkBuffers);
  }

  /**
   * Delete file from local storage
   */
  async deleteFile(fileId: string, chunks: UploadedChunk[]): Promise<void> {
    await this.ensureInit();

    console.log(`  🗑️ Deleting file ${fileId}...`);

    // Delete single file
    if (chunks.length === 1) {
      const filePath = this.getFilePath(fileId);
      try {
        await fs.unlink(filePath);
        console.log(`  ✓ File deleted: ${filePath}`);
      } catch (error: any) {
        console.warn(`  ⚠️ Failed to delete file: ${error.message}`);
      }
      return;
    }

    // Delete chunks
    for (const chunk of chunks) {
      try {
        const chunkPath = this.getChunkPath(fileId, chunk.chunkIndex);
        await fs.unlink(chunkPath);
        console.log(`  ✓ Chunk ${chunk.chunkIndex} deleted`);
      } catch (error: any) {
        console.warn(`  ⚠️ Failed to delete chunk ${chunk.chunkIndex}: ${error.message}`);
      }
    }

    console.log(`  ✅ File deleted: ${fileId}`);
  }

  /**
   * Get storage statistics
   */
  async getStats() {
    await this.ensureInit();

    try {
      const filesDir = path.join(STORAGE_ROOT, 'files');
      const chunksDir = path.join(STORAGE_ROOT, 'chunks');

      const getDirectorySize = async (dir: string): Promise<number> => {
        let size = 0;
        try {
          const files = await fs.readdir(dir, { withFileTypes: true, recursive: true });
          for (const file of files) {
            if (file.isFile()) {
              const filePath = path.join(file.path || dir, file.name);
              const stats = await fs.stat(filePath);
              size += stats.size;
            }
          }
        } catch {
          // Directory might not exist yet
        }
        return size;
      };

      const [filesSize, chunksSize] = await Promise.all([
        getDirectorySize(filesDir),
        getDirectorySize(chunksDir),
      ]);

      const totalSize = filesSize + chunksSize;
      const totalSizeGB = (totalSize / 1024 / 1024 / 1024).toFixed(2);

      return {
        totalSize,
        totalSizeGB,
        filesSize,
        chunksSize,
        storageRoot: STORAGE_ROOT,
      };
    } catch (error: any) {
      console.error('Failed to get storage stats:', error.message);
      return {
        totalSize: 0,
        totalSizeGB: '0.00',
        filesSize: 0,
        chunksSize: 0,
        storageRoot: STORAGE_ROOT,
      };
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(fileId: string, chunks: UploadedChunk[]): Promise<boolean> {
    await this.ensureInit();

    if (chunks.length === 1) {
      const filePath = this.getFilePath(fileId);
      try {
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    }

    // Check all chunks exist
    for (const chunk of chunks) {
      const chunkPath = this.getChunkPath(fileId, chunk.chunkIndex);
      try {
        await fs.access(chunkPath);
      } catch {
        return false;
      }
    }

    return true;
  }
}

export const localStorage = new LocalStorage();
