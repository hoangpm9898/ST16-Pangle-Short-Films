import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import { config } from '#root/config';
import { PangleRequestDto, PangleResponseDto, DownloadRequestDto, DownloadResponseDto } from './dto/short-film.dto';

@Injectable()
export class PangleService {
	private readonly logger = new Logger(PangleService.name);

	constructor(private readonly httpService: HttpService) {}

	private generateSign(authInfo: any): string {
		const secret = config.PANGLE_SECRET;
		return crypto.createHmac('sha256', secret).update(JSON.stringify(authInfo)).digest('hex');
	}

	private createAuthInfo(): any {
		const authInfo = {
			user_id: config.PANGLE_USER_ID,
			role_id: config.PANGLE_ROLE_ID,
			timestamp: Math.floor(Date.now() / 1000).toString(),
		};
		return {
			...authInfo,
			sign: this.generateSign(authInfo),
		};
	}

	async fetchShortFilms(
		page: number = 1,
		pageSize: number = 1000,
		lang: string[] = ['zh_hant'],
	): Promise<PangleResponseDto> {
		try {
			const requestData: PangleRequestDto = {
				auth_info: this.createAuthInfo(),
				page_info: {
					page,
					page_size: pageSize,
				},
				controller: {
					lang,
				},
			};
			this.logger.log(`Fetching short films from page ${page}`);
			const response = await firstValueFrom(
				this.httpService.post<PangleResponseDto>(
					`${config.PANGLE_API_URL}/bytedrama/open/api/sp/file/list`,
					requestData,
					{
						headers: {
							Accept: '*/*',
							'Accept-Encoding': 'gzip, deflate, br',
							Connection: 'Keep-Alive',
							'Content-Type': 'application/json',
							'User-Agent': 'okhttp/4.12.0',
						},
					},
				),
			);
			this.logger.log(`Successfully fetched ${response.data.data.length} short films from page ${page}`);
			return response.data;
		} catch (error) {
			this.logger.error(`Error fetching short films from page ${page}:`, error.message);
			throw error;
		}
	}

	async fetchAllShortFilms(lang: string[] = ['zh_hant']): Promise<any[]> {
		const allShortFilms = [];
		let page = 1;
		let hasMorePages = true;
		while (hasMorePages) {
			try {
				const response = await this.fetchShortFilms(page, 1000, lang);
				if (response.code === '100' && response.data.length > 0) {
					allShortFilms.push(...response.data);
					this.logger.log(`Fetched page ${page}, total so far: ${allShortFilms.length}`);
					if (response.page_info && response.page_info.total_page > page) page++;
					else hasMorePages = false;
				} else hasMorePages = false;
			} catch (error) {
				this.logger.error(`Error fetching page ${page}:`, error.message);
				break;
			}
		}
		this.logger.log(`Total short films fetched: ${allShortFilms.length}`);
		return allShortFilms;
	}

	async fetchEpisodes(
		fileId: number,
		targetIndexes: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
	): Promise<DownloadResponseDto> {
		try {
			const requestData: DownloadRequestDto = {
				auth_info: this.createAuthInfo(),
				controller: {
					download_config: [
						{
							file_id: fileId,
							target_index: targetIndexes,
						},
					],
				},
			};
			this.logger.log(`Fetching episodes for file_id: ${fileId}`);
			const response = await firstValueFrom(
				this.httpService.post<DownloadResponseDto>(
					`${config.PANGLE_API_URL}/bytedrama/open/api/sp/file/download`,
					requestData,
					{
						headers: {
							Accept: '*/*',
							'Accept-Encoding': 'gzip, deflate, br',
							Connection: 'Keep-Alive',
							'Content-Type': 'application/json',
							'User-Agent': 'okhttp/4.12.0',
						},
					},
				),
			);
			this.logger.log(`Successfully fetched episodes for file_id: ${fileId}`);
			return response.data;
		} catch (error) {
			this.logger.error(`Error fetching episodes for file_id ${fileId}:`, error.message);
			throw error;
		}
	}
}
