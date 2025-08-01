import { Test, TestingModule } from '@nestjs/testing';
import { ShortFilmService } from './short-film.service';
import { PangleService } from './pangle.service';
import { VideoProcessingService } from './video-processing.service';
import { BunnyService } from '../bunny/bunny.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ShortFilmService', () => {
	let service: ShortFilmService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ShortFilmService,
				{
					provide: PangleService,
					useValue: {
						fetchAllShortFilms: jest.fn(),
						fetchEpisodes: jest.fn(),
					},
				},
				{
					provide: VideoProcessingService,
					useValue: {
						generateFileName: jest.fn(),
						downloadVideoChunksWithRetry: jest.fn(),
						validateVideoFile: jest.fn(),
						cleanupTempFile: jest.fn(),
					},
				},
				{
					provide: BunnyService,
					useValue: {
						upload: jest.fn(),
					},
				},
				{
					provide: PrismaService,
					useValue: {
						shortFilm: {
							findUnique: jest.fn(),
							create: jest.fn(),
							findMany: jest.fn(),
							count: jest.fn(),
							deleteMany: jest.fn(),
						},
						episode: {
							findUnique: jest.fn(),
							create: jest.fn(),
							update: jest.fn(),
							count: jest.fn(),
							deleteMany: jest.fn(),
						},
					},
				},
			],
		}).compile();

		service = module.get<ShortFilmService>(ShortFilmService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('should get short film count', async () => {
		const mockPrisma = service['prisma'] as jest.Mocked<PrismaService>;
		mockPrisma.shortFilm.count();

		const result = await service.getShortFilmCount();
		expect(result).toBe(5);
	});
});
