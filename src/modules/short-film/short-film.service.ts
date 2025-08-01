import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PangleService } from './pangle.service';
import { VideoQueueService } from './video-queue.service';
import { PrismaService } from '../prisma/prisma.service';

export interface Episode {
	episodeId: string;
	index: number;
	name: string;
	origin_stream_link: string;
	hls_file_link?: string;
}

export interface ShortFilm {
	shortplay_id: number;
	file_id: number;
	title: string;
	desc?: string;
	lang: string;
	voice_lang: string;
	total: number;
	episodes: Episode[];
	createdAt: Date;
	updatedAt: Date;
}

@Injectable()
export class ShortFilmService {
	private readonly logger = new Logger(ShortFilmService.name);

	constructor(
		private readonly pangleService: PangleService,
		private readonly prisma: PrismaService,
		private readonly videoQueueService: VideoQueueService,
	) {}

	@Cron(CronExpression.EVERY_HOUR)
	async syncShortFilms(): Promise<void> {
		this.logger.log('Starting scheduled sync of short films');
		try {
			const shortFilms = await this.pangleService.fetchAllShortFilms();
			for (const film of shortFilms) await this.processShortFilm(film);
			this.logger.log(`Sync completed. Processed ${shortFilms.length} short films`);
		} catch (error) {
			this.logger.error('Error during scheduled sync:', error.message);
		}
	}

	async processShortFilm(filmData: any): Promise<void> {
		try {
			const shortplayId = filmData.shortplay_id;
			const fileId = filmData.file_id;
			this.logger.log(`Processing short film: ${fileId} (${filmData.title})`);
			const existingFilm = await this.prisma.shortFilm.findUnique({
				where: { fileId },
				include: { episodes: true },
			});
			if (existingFilm) {
				this.logger.log(`Short film ${fileId} already exists in database, skipping`);
				return;
			}
			const episodesData = await this.pangleService.fetchEpisodes(fileId);
			if (episodesData.code !== '100' || !episodesData.data.length) {
				this.logger.warn(`No episodes found for short film ${fileId}`);
				return;
			}
			const shortFilm = await this.prisma.shortFilm.create({
				data: {
					shortplayId,
					fileId,
					title: filmData.title,
					desc: filmData.desc,
					lang: filmData.lang,
					voiceLang: filmData.voice_lang,
					total: filmData.total,
				},
			});
			for (const episodeData of episodesData.data[0].episode_list)
				await this.processEpisode(shortFilm.id, fileId, episodeData);
			this.logger.log(`Successfully processed short film ${fileId}`);
		} catch (error) {
			this.logger.error(`Error processing short film ${filmData.file_id}:`, error.message);
		}
	}

	private async processEpisode(shortFilmId: string, fileId: number, episodeData: any): Promise<void> {
		try {
			const episodeId = `ep${episodeData.index}`;
			const playUrl = episodeData.play_url;
			this.logger.log(`Processing episode ${episodeId} for fileId ${fileId}`);
			const existingEpisode = await this.prisma.episode.findUnique({
				where: { episodeId },
			});
			if (existingEpisode?.hlsFileLink) {
				this.logger.log(`Episode ${episodeId} already processed, skipping`);
				return;
			}
			if (!existingEpisode) {
				await this.prisma.episode.create({
					data: {
						episodeId,
						index: episodeData.index,
						name: episodeData.name,
						originStreamLink: playUrl,
						shortFilmId,
					},
				});
			}
			await this.videoQueueService.addVideoProcessingJob({
				fileId,
				episodeIndex: episodeData.index,
				episodeId,
				playUrl,
				episodeName: episodeData.name,
				shortFilmId,
			});
			this.logger.log(`Added episode ${episodeId} to video processing queue`);
		} catch (error) {
			this.logger.error(`Error processing episode ${episodeData.index} for fileId ${fileId}:`, error.message);
		}
	}

	async getShortFilm(fileId: number): Promise<ShortFilm | null> {
		try {
			const film = await this.prisma.shortFilm.findFirst({
				where: { fileId },
				include: { episodes: true },
			});
			if (!film) return null;
			return {
				shortplay_id: film.shortplayId,
				file_id: film.fileId,
				title: film.title,
				desc: film.desc,
				lang: film.lang,
				voice_lang: film.voiceLang,
				total: film.total,
				episodes: film.episodes.map((ep) => ({
					episodeId: ep.episodeId,
					index: ep.index,
					name: ep.name,
					origin_stream_link: ep.originStreamLink,
					hls_file_link: ep.hlsFileLink,
				})),
				createdAt: film.createdAt,
				updatedAt: film.updatedAt,
			};
		} catch (error) {
			this.logger.error(`Error getting short film ${fileId}:`, error.message);
			return null;
		}
	}

	async getShortFilmCount(): Promise<number> {
		try {
			return await this.prisma.shortFilm.count();
		} catch (error) {
			this.logger.error('Error getting short film count:', error.message);
			return 0;
		}
	}
}
