import 'dotenv/config';
import z from 'zod';
import { parseEnv, port } from 'znv';

const createConfigFromEnvironment = (environment: NodeJS.ProcessEnv) => {
	const config = parseEnv(environment, {
		NODE_ENV: z.enum(['development', 'production']).default('development'),
		LOG_LEVEL: z
			.enum(['fatal', 'error', 'warn', 'log', 'debug', 'verbose'])
			.array()
			.default(['fatal', 'error', 'warn', 'log', 'debug']),
		PORT: port().default(3000),
		// Database
		DATABASE_URL: z.string().default('mongodb://localhost:27017/pangle_short_films'),
		// Redis
		REDIS_HOST: z.string().default('localhost'),
		REDIS_PORT: port().default(6379),
		// Pangle API
		PANGLE_USER_ID: z.string().optional(),
		PANGLE_ROLE_ID: z.string().optional(),
		PANGLE_SECRET: z.string().optional(),
		PANGLE_API_URL: z.string().default('https://api.pangle.com'),
		// BunnyCDN
		BUNNY_API_KEY: z.string().optional(),
		BUNNY_STORAGE_ZONE: z.string().default('st16b'),
		BUNNY_STORAGE_REGION: z.string().default('storage.bunnycdn.com'),
	});

	return {
		...config,
		isDev: process.env.NODE_ENV === 'development',
		isProd: process.env.NODE_ENV === 'production',
	};
};

export const config = createConfigFromEnvironment(process.env);
