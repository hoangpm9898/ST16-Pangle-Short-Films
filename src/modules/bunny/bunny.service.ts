import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { config } from '#root/config';
import { HttpService } from '@nestjs/axios';
import * as path from 'path';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class BunnyService {
	private readonly logger: Logger = new Logger(BunnyService.name);

	constructor(protected readonly httpService: HttpService) {}

	private getUploadUrl(destinationPath: string): string {
		return `https://${config.BUNNY_STORAGE_REGION}/${config.BUNNY_STORAGE_ZONE}/${destinationPath}`;
	}

	getCdnUrl(destinationPath: string): string {
		return `https://cdn.bunny.net/${config.BUNNY_STORAGE_ZONE}/${destinationPath}`;
	}

	async upload(localPath: string, destinationPath: string): Promise<string> {
		const fileStream = fs.createReadStream(localPath);
		const fileName = path.basename(localPath);
		const stats = fs.statSync(localPath);
		const contentLength = stats.size;
		const url = this.getUploadUrl(destinationPath);
		this.logger.log(`Start uploading ${fileName} to Bunny CDN`);
		try {
			const upload = await firstValueFrom(
				this.httpService.put(url, fileStream, {
					headers: {
						AccessKey: config.BUNNY_API_KEY,
						'Content-Type': 'application/octet-stream',
						'Content-Length': contentLength,
					},
					maxBodyLength: Infinity,
					maxContentLength: Infinity,
				}),
			);
			if (upload.status === 201) this.logger.log(`File ${fileName} uploaded successfully to Bunny CDN`);
		} catch (error) {
			this.logger.error(`Failed to upload ${fileName} to Bunny CDN: ${error.message}`);
			throw new Error(`Upload failed: ${error.message}`);
		}
		return url;
	}
}
