import { createRequire } from 'module';
import { config } from './config.js';

const require = createRequire(import.meta.url);
const IORedis = require('ioredis');

export const redis: import('ioredis').Redis = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});
