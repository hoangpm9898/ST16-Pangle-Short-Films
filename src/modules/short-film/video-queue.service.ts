import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { VideoProcessingService } from './video-processing.service';
import { BunnyService } from '../bunny/bunny.service';
import { PrismaService } from '../prisma/prisma.service';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface VideoProcessingJob {
	fileId: number;
	episodeIndex: number;
	episodeId: string;
	playUrl: string;
	episodeName: string;
	shortFilmId: string;
}

@Injectable()
export class VideoQueueService {
	private readonly logger = new Logger(VideoQueueService.name);

	constructor(
		@InjectQueue('video-processing') private videoQueue: Queue,
		private readonly videoProcessingService: VideoProcessingService,
		private readonly bunnyService: BunnyService,
		private readonly prisma: PrismaService,
	) {}

	async addVideoProcessingJob(jobData: VideoProcessingJob): Promise<void> {
		try {
			await this.videoQueue.add('process-video', jobData, {
				attempts: 3,
				backoff: {
					type: 'exponential',
					delay: 2000,
				},
				removeOnComplete: true,
				removeOnFail: false,
			});
			this.logger.log(`Added video processing job for episode ${jobData.episodeId}`);
		} catch (error) {
			this.logger.error(`Error adding video processing job:`, error.message);
			throw error;
		}
	}

	async processVideoJob(jobData: VideoProcessingJob): Promise<void> {
		try {
			this.logger.log(`Processing video job for episode ${jobData.episodeId}`);
			const fileName = this.videoProcessingService.generateFileName(
				jobData.fileId,
				jobData.episodeIndex,
				0,
			);
			const localFilePath = await this.videoProcessingService.downloadVideoChunksWithRetry(
				jobData.playUrl,
				fileName,
			);
			const isValid = await this.videoProcessingService.validateVideoFile(localFilePath);
			if (!isValid) {
				this.logger.warn(`Invalid video file for episode ${jobData.episodeId}, skipping`);
				await this.videoProcessingService.cleanupTempFile(localFilePath);
				return;
			}
			const hlsOutputPath = await this.convertToHLS(localFilePath, jobData.fileId);
			const hlsFileLink = await this.uploadHLSFiles(hlsOutputPath, jobData.fileId);
			await this.videoProcessingService.cleanupTempFile(localFilePath);
			await this.cleanupHLSFiles(hlsOutputPath);
			if (!jobData.episodeId.includes('test') && !jobData.episodeId.includes('simple')) {
			try {
				await this.prisma.episode.update({
					where: { episodeId: jobData.episodeId },
					data: {
						hlsFileLink,
						updatedAt: new Date(),
					},
				});
				this.logger.log(`Updated episode ${jobData.episodeId} in database with HLS link`);
			} catch (error) {
				this.logger.warn(`Failed to update episode ${jobData.episodeId} in database: ${error.message}`);
			}
		} else {
			this.logger.log(`Skipping database update for test episode: ${jobData.episodeId}`);
		}

			this.logger.log(`Successfully processed video for episode ${jobData.episodeId}`);
		} catch (error) {
			this.logger.error(`Error processing video job for episode ${jobData.episodeId}:`, error.message);
			throw error;
		}
	}

	private async convertToHLS(inputFilePath: string, fileId: number): Promise<string> {
		const outputDir = path.join(process.cwd(), 'tmp', 'hls', fileId.toString());
		try {
			await fs.mkdir(outputDir, { recursive: true });
			const outputPath = path.join(outputDir, 'output.m3u8');
			const segmentPattern = path.join(outputDir, 'segment_%03d.ts');
			return new Promise((resolve, reject) => {
				const ffmpeg = spawn('ffmpeg', [
					'-i',
					inputFilePath,
					'-c:v',
					'copy',
					'-c:a',
					'copy',
					'-f',
					'hls',
					'-hls_time',
					'10',
					'-hls_list_size',
					'0',
					'-hls_segment_filename',
					segmentPattern,
					outputPath,
				]);
				ffmpeg.stdout.on('data', (data) => {
					this.logger.debug(`FFmpeg stdout: ${data}`);
				});
				ffmpeg.stderr.on('data', (data) => {
					this.logger.debug(`FFmpeg stderr: ${data}`);
				});
				ffmpeg.on('close', (code) => {
					if (code === 0) {
						this.logger.log(`FFmpeg conversion completed for fileId ${fileId}`);
						resolve(outputDir);
					} else {
						reject(new Error(`FFmpeg process exited with code ${code}`));
					}
				});
				ffmpeg.on('error', (error) => {
					reject(new Error(`FFmpeg error: ${error.message}`));
				});
			});
		} catch (error) {
			this.logger.error(`Error converting to HLS for fileId ${fileId}:`, error.message);
			throw error;
		}
	}

	private async uploadHLSFiles(hlsOutputPath: string, fileId: number): Promise<string> {
		try {
			const files = await fs.readdir(hlsOutputPath);
			const uploadPromises = [];
			for (const file of files) {
				const localFilePath = path.join(hlsOutputPath, file);
				const remotePath = `${fileId}/file/${file}`;
				uploadPromises.push(this.bunnyService.upload(localFilePath, remotePath));
			}
			await Promise.all(uploadPromises);
			const m3u8RemotePath = `${fileId}/file/output.m3u8`;
			return this.bunnyService.getCdnUrl(m3u8RemotePath);
		} catch (error) {
			this.logger.error(`Error uploading HLS files for fileId ${fileId}:`, error.message);
			throw error;
		}
	}

	private async cleanupHLSFiles(hlsOutputPath: string): Promise<void> {
		try {
			await fs.rm(hlsOutputPath, { recursive: true, force: true });
			this.logger.log(`Cleaned up HLS files: ${hlsOutputPath}`);
		} catch (error) {
			this.logger.warn(`Error cleaning up HLS files ${hlsOutputPath}:`, error.message);
		}
	}
}
