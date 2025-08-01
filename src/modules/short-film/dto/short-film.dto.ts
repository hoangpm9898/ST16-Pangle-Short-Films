import { IsNumber, IsString, IsOptional, IsArray } from 'class-validator';

export class PangleAuthInfoDto {
	@IsString()
	user_id: string;

	@IsString()
	role_id: string;

	@IsString()
	timestamp: string;

	@IsString()
	sign: string;
}

export class PanglePageInfoDto {
	@IsNumber()
	page: number;

	@IsNumber()
	page_size: number;

	@IsNumber()
	@IsOptional()
	total?: number;

	@IsNumber()
	@IsOptional()
	total_page?: number;
}

export class PangleControllerDto {
	@IsArray()
	@IsString({ each: true })
	lang: string[];
}

export class PangleRequestDto {
	auth_info: PangleAuthInfoDto;
	page_info: PanglePageInfoDto;
	controller: PangleControllerDto;
}

export class EpisodeDto {
	@IsNumber()
	index: number;

	@IsString()
	name: string;

	@IsString()
	play_url: string;
}

export class ShortFilmDto {
	@IsNumber()
	shortplay_id: number;

	@IsNumber()
	file_id: number;

	@IsArray()
	category: Array<{ id: number; name: string }>;

	@IsString()
	@IsOptional()
	cover_image?: string;

	@IsString()
	@IsOptional()
	desc?: string;

	@IsNumber()
	is_test: number;

	@IsString()
	lang: string;

	@IsNumber()
	progress_state: number;

	@IsString()
	title: string;

	@IsString()
	voice_lang: string;

	@IsNumber()
	total: number;
}

export class PangleResponseDto {
	@IsString()
	code: string;

	@IsArray()
	data: ShortFilmDto[];

	@IsString()
	message: string;

	page_info: PanglePageInfoDto;
}

export class DownloadConfigDto {
	@IsNumber()
	file_id: number;

	@IsArray()
	@IsNumber({}, { each: true })
	target_index: number[];
}

export class DownloadRequestDto {
	auth_info: PangleAuthInfoDto;
	controller: {
		download_config: DownloadConfigDto[];
	};
}

export class EpisodeListDto {
	@IsNumber()
	index: number;

	@IsString()
	name: string;

	@IsString()
	play_url: string;
}

export class DownloadResponseDto {
	@IsString()
	code: string;

	@IsArray()
	data: Array<{
		episode_list: EpisodeListDto[];
		file_id: number;
		lang: string;
		shortplay_id: number;
		voice_lang: string;
	}>;

	@IsString()
	message: string;
}
