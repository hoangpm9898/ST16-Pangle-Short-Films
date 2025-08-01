import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from '#root/modules/app/app.module';
import { config } from './config';
import { LogLevel, ValidationPipe, VersioningType } from '@nestjs/common';
import { AllExceptionsFilter, HttpErrorFilter, HttpExceptionFilter } from './common/filters';

async function bootstrap() {
	const app = await NestFactory.create(AppModule, {
		logger: config.LOG_LEVEL as LogLevel[],
	});
	app.enableVersioning({
		type: VersioningType.URI,
		defaultVersion: '1',
	});
	app.useGlobalPipes(
		new ValidationPipe({
			transform: true,
			whitelist: true,
		}),
	);
	app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));
	app.useGlobalFilters(new HttpExceptionFilter());
	app.useGlobalFilters(new HttpErrorFilter());

	await app.listen(config.PORT, '0.0.0.0');
}
bootstrap();
