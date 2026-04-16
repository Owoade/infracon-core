import { config } from "dotenv";

config();

console.log(process.env)

export const NODE_ENV = process.env.NODE_ENV ?? "development" as "production" | "development" 

export const DATABASE_URL = process.env.DATABASE_URL!;

export const TOKEN_PASSPHRASE = process.env.TOKEN_PASSPHRASE!;

export const REDIS_URL=process.env.REDIS_URL!;

export const QUEUE_REDIS_HOST = process.env.QUEUE_REDIS_HOST!;

export const QUEUE_REDIS_PASSWORD = process.env.QUEUE_REDIS_PASSWORD!;

export const QUEUE_REDIS_PORT = parseInt(process.env.QUEUE_REDIS_PORT!);

export const PLUNK_SECRET_KEY = process.env.PLUNK_SECRET_KEY!;

export const PLUNK_SECRET_KEY_TWO = process.env.PLUNK_SECRET_KEY_TWO!;

export const DATABASE_USER = NODE_ENV === "test" ? process.env.TEST_DATABASE_USER : process.env.DATABASE_USER!;

export const DATABASE_NAME = NODE_ENV === "test" ? process.env.TEST_DATABASE_NAME : process.env.DATABASE_NAME!;

export const DATABASE_PASSWORD = NODE_ENV === "test" ? process.env.TEST_DATABASE_PASSWORD : process.env.DATABASE_PASSWORD!;

export const DATABASE_HOST = NODE_ENV === "test" ? '127.0.0.1' : process.env.DATABASE_HOST!;

export const DATABASE_PORT = NODE_ENV === "test" ? 5432 : parseInt(process.env.DATABASE_PORT)!;

export const POSTGRES_ENCRYPTION_SECRET = process.env.POSTGRES_ENCRYPTION_SECRET as string;

export const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;

export const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY as string;

export const AWS_STORAGE_BUCKET_NAME = process.env.AWS_STORAGE_BUCKET_NAME as string;

export const AWS_STORAGE_BUCKET_REGION = process.env.AWS_STORAGE_BUCKET_REGION as string;

export const VOTER_PLATFORM = process.env.VOTER_PLATFORM as string;

export const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY as string;

export const VOTERS_ENCRYPTION_KEY = process.env.VOTERS_ENCRYPTION_KEY as string;

export const BASE_URL = NODE_ENV === "production" ? "https://www.smoothballot.com" : `https://smooth-two.vercel.app`;

export const WEBMAIL_PASSWORD = process.env.WEBMAIL_PASSWORD as string;

export const MONGODB_URL = process.env.MONGODB_URL;

export const S3_ENDPOINT = process.env.S3_ENDPOINT;

export const CLOUDFLARE_TURNSTILE_SECRET_KEY = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY as string;

export const LOCAL_AUTHENTICATION_KEY = process.env.LOCAL_AUTHENTICATION_KEY as string;

export const ZEPTOMAIL_API_KEY = process.env.ZEPTOMAIL_API_KEY as string;