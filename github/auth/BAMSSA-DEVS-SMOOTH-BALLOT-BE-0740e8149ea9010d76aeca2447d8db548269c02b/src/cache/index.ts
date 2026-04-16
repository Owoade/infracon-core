import { NODE_ENV, REDIS_URL } from "@env/index"
import Redis from "ioredis"

export const redis_client = NODE_ENV !== "test" ? new Redis(REDIS_URL, {
    tls: {}
}) : new Redis();

export const REDIS_PROVIDER = 'REDIS_PROVIDER'

const RedisProvider = {
    provide: REDIS_PROVIDER,
    useValue: redis_client
}

export default RedisProvider;