import { Test, TestingModule } from '@nestjs/testing';
import { BunnyService } from './bunny.service';

describe('BunnyService', () => {
	let service: BunnyService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [BunnyService],
		}).compile();

		service = module.get<BunnyService>(BunnyService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});
});
