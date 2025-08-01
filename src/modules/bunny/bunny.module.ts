import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { BunnyService } from '#root/modules/bunny/bunny.service';
import { HttpModule } from '@nestjs/axios';

@Module({
	imports: [
		BullModule.registerQueue({
			name: 'upload',
		}),
		HttpModule,
	],
	providers: [BunnyService],
	exports: [BunnyService],
})
export class BunnyModule {}
