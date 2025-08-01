import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { VideoQueueService, VideoProcessingJob } from './video-queue.service';

@Processor('video-processing')
export class VideoQueueProcessor {
	constructor(private readonly videoQueueService: VideoQueueService) {}

	@Process('process-video')
	async handleVideoProcessing(job: Job<VideoProcessingJob>): Promise<void> {
		try {
			await this.videoQueueService.processVideoJob(job.data);
		} catch (error) {
			throw error;
		}
	}
}
