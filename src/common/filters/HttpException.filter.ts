import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponse } from 'src/common/types';
import { config } from 'src/config';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
	private readonly logger = new Logger(HttpExceptionFilter.name);

	catch(exception: HttpException, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<Request>();
		const status = exception.getStatus();

		const apiResponse: any = ApiResponse.Error(status, exception.message);
		if (config.isDev) {
			apiResponse.timestamp = new Date().toISOString();
			apiResponse.path = request.url;
			apiResponse.source = 'HttpExceptionFilter';
			apiResponse.exception = exception;
			this.logger.error(exception);
		}

		response.status(status).json(apiResponse);
	}
}
