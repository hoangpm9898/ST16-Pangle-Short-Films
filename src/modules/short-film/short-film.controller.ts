import { Controller, Get, Param, Post, HttpCode, HttpStatus, Logger, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ShortFilmService, ShortFilm } from './short-film.service';

@ApiTags('Short Films')
@Controller('api/short-films')
export class ShortFilmController {
	private readonly logger = new Logger(ShortFilmController.name);

	constructor(private readonly shortFilmService: ShortFilmService) {}

	@Get(':fileId')
	async getShortFilm(@Param('fileId') fileId: string): Promise<ShortFilm | { error: string }> {
		try {
			const film = await this.shortFilmService.getShortFilm(parseInt(fileId, 10));

			if (!film) {
				return { error: 'Short film not found' };
			}

			return film;
		} catch (error) {
			this.logger.error(`Error getting short film ${fileId}:`, error.message);
			return { error: 'Internal server error' };
		}
	}
}
