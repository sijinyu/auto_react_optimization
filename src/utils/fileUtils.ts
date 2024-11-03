import { glob } from "glob";
import * as fs from "fs/promises";
import * as path from "path";

// 1. 파일 찾기 관련
export async function findFiles(
  dir: string,
  extensions: string[] = [".jsx", ".tsx", ".js", ".ts"]
): Promise<string[]> {
  try {
    const pattern = `${dir}/**/*{${extensions.join(",")}}`;
    const files = await glob(pattern, {
      ignore: [
        "**/node_modules/**",
        "**/dist/**",
        "**/build/**",
        "**/*.test.*",
        "**/*.spec.*",
      ],
      nodir: true,
    });
    return files;
  } catch (error) {
    console.error("Error finding files:", error);
    throw new Error(`Failed to find files in directory: ${dir}`);
  }
}

// 2. 파일 읽기 관련
export async function readFileContent(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    throw new Error(`Failed to read file: ${filePath}`);
  }
}

// 3. 파일 필터링
export function isReactFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const validExtensions = [".jsx", ".tsx", ".js", ".ts"];

  if (!validExtensions.includes(ext)) {
    return false;
  }

  // test 파일 제외
  if (filePath.includes(".test.") || filePath.includes(".spec.")) {
    return false;
  }

  return true;
}

// 4. 파일 처리 배치
export async function processFilesInBatch<T>(
  files: string[],
  processor: (filePath: string, content: string) => Promise<T>,
  batchSize: number = 10
): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const batchPromises = batch.map(async (filePath) => {
      const content = await readFileContent(filePath);
      return processor(filePath, content);
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

// 5. 캐시 관리
interface FileCache {
  content: string;
  lastModified: number;
}

export class FileCacheManager {
  private cache: Map<string, FileCache> = new Map();

  async getFileContent(filePath: string): Promise<string> {
    try {
      const stats = await fs.stat(filePath);
      const lastModified = stats.mtimeMs;

      const cached = this.cache.get(filePath);
      if (cached && cached.lastModified === lastModified) {
        return cached.content;
      }

      const content = await readFileContent(filePath);
      this.cache.set(filePath, { content, lastModified });

      return content;
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      throw new Error(`Failed to get file content: ${filePath}`);
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// 6. 에러 처리
export class FileProcessingError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = "FileProcessingError";
  }
}

// 7. 경로 유틸리티
export function normalizeFilePath(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, "/");
}

export function getRelativePath(from: string, to: string): string {
  return path.relative(from, to).replace(/\\/g, "/");
}
