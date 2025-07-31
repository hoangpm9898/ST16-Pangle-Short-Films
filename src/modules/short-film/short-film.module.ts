import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { ShortFilmController } from './short-film.controller';
import { ShortFilmService } from './short-film.service';
import { PangleService } from './pangle.service';
import { VideoProcessingService } from './video-processing.service';
import { VideoQueueService } from './video-queue.service';
import { VideoQueueProcessor } from './video-queue.processor';
import { BunnyModule } from '../bunny/bunny.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
	imports: [
		HttpModule.register({
			timeout: 30000,
			maxRedirects: 5,
		}),
		BullModule.registerQueue({
			name: 'video-processing',
			defaultJobOptions: {
				removeOnComplete: true,
				removeOnFail: false,
			},
		}),
		BunnyModule,
		PrismaModule,
	],
	controllers: [ShortFilmController],
	providers: [ShortFilmService, PangleService, VideoProcessingService, VideoQueueService, VideoQueueProcessor],
	exports: [ShortFilmService, VideoQueueService],
})
export class ShortFilmModule {}
