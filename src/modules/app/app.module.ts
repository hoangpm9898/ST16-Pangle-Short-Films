import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { ShortFilmModule } from '#root/modules/short-film/short-film.module';
import {PrismaModule} from "#root/modules/prisma/prisma.module";

@Module({
	imports: [ScheduleModule.forRoot(), PrismaModule, ShortFilmModule],
	controllers: [AppController],
})
export class AppModule {}
