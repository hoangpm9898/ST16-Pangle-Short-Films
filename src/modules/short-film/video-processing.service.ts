import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class VideoProcessingService {
	private readonly logger = new Logger(VideoProcessingService.name);
	private readonly tempDir = path.join(process.cwd(), 'tmp', 'videos');

	constructor(private readonly httpService: HttpService) {
		this.ensureTempDir();
	}

	private async ensureTempDir(): Promise<void> {
		try {
			await fs.mkdir(this.tempDir, { recursive: true });
		} catch (error) {
			this.logger.error('Error creating temp directory:', error);
		}
	}

	async downloadVideoChunks(url: string, fileName: string): Promise<string> {
		const filePath = path.join(this.tempDir, fileName);
		try {
			this.logger.log(`Starting download: ${url}`);
			if (url.startsWith('file:///')) {
				const localPath = url.replace('file:///', '');
				this.logger.log(`Copying local file: ${localPath}`);
				await fs.mkdir(this.tempDir, { recursive: true });
				await fs.copyFile(localPath, filePath);
				this.logger.log(`Local file copied successfully: ${filePath}`);
				return filePath;
			}
			const response = await firstValueFrom(
				this.httpService.get(url, {
					responseType: 'stream',
					timeout: 300000,
				}),
			);
			if (!response.data) throw new Error('No data received from URL');
			const writer = fsSync.createWriteStream(filePath);
			let downloadedBytes = 0;
			const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
			response.data.on('data', (chunk: Buffer) => {
				downloadedBytes += chunk.length;
				if (totalBytes > 0) {
					const progress = Math.round((downloadedBytes / totalBytes) * 100);
					this.logger.log(`Download progress: ${progress}%`);
				}
			});
			await new Promise<void>((resolve, reject) => {
				response.data.pipe(writer);
				writer.on('finish', () => resolve());
				writer.on('error', reject);
				response.data.on('error', reject);
			});
			this.logger.log(`Download completed: ${filePath}`);
			return filePath;
		} catch (error) {
			this.logger.error(`Error downloading video from ${url}:`, error.message);
			throw error;
		}
	}

	async downloadVideoChunksWithRetry(url: string, fileName: string, maxRetries: number = 3): Promise<string> {
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				return await this.downloadVideoChunks(url, fileName);
			} catch (error) {
				this.logger.warn(`Download attempt ${attempt} failed for ${url}:`, error.message);
				if (attempt === maxRetries) throw error;
				await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
			}
		}
		throw new Error(`Failed to download video after ${maxRetries} attempts`);
	}

	async cleanupTempFile(filePath: string): Promise<void> {
		try {
			await fs.unlink(filePath);
			this.logger.log(`Cleaned up temp file: ${filePath}`);
		} catch (error) {
			this.logger.warn(`Error cleaning up temp file ${filePath}:`, error.message);
		}
	}

	async validateVideoFile(filePath: string): Promise<boolean> {
		try {
			const stats = await fs.stat(filePath);
			const fileSize = stats.size;
			if (fileSize === 0) {
				this.logger.warn(`Video file is empty: ${filePath}`);
				return false;
			}
			if (fileSize < 1024 * 1024 || fileSize > 500 * 1024 * 1024) {
				this.logger.warn(`Video file size seems unusual: ${fileSize} bytes for ${filePath}`);
				return false;
			}
			return true;
		} catch (error) {
			this.logger.error(`Error validating video file ${filePath}:`, error.message);
			return false;
		}
	}

	generateFileName(shortplayId: number, fileId: number, episodeIndex: number): string {
		const timestamp = Date.now();
		const hash = crypto
			.createHash('md5')
			.update(`${shortplayId}-${fileId}-${episodeIndex}-${timestamp}`)
			.digest('hex')
			.substring(0, 8);
		return `episode_${episodeIndex}_${hash}.mp4`;
	}
}
