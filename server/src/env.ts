import path from 'node:path';

export const API_PORT = Number(process.env.API_PORT) || 443;

export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://wordgrid-mongo:27017/wordgrid';
export const REDIS_HOST = process.env.REDIS_HOST || 'wordgrid-redis';
export const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;

export const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';
export const TOKEN_EXPIRATION = '24h' as const;

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const ENABLE_TLS = process.env.ENABLE_TLS === 'true' || NODE_ENV === 'production';

export const CERT_DIR = process.env.CERT_DIR || path.resolve(process.cwd(), 'certs');
export const CERT_PATH = process.env.CERT_PATH || path.join(CERT_DIR, 'fullchain.pem');
export const KEY_PATH = process.env.KEY_PATH || path.join(CERT_DIR, 'privkey.pem');
export const ACCOUNT_KEY_PATH = process.env.ACCOUNT_KEY_PATH || path.join(CERT_DIR, 'account.pem');

export const NETLIFY_AUTH_TOKEN = process.env.NETLIFY_AUTH_TOKEN || '';
export const NETLIFY_ZONE_NAME = process.env.NETLIFY_ZONE_NAME || 'proplayer919.dev';
export const DOMAIN_NAME = process.env.DOMAIN_NAME || 'wordgrid-api.proplayer919.dev';
export const ACME_EMAIL = process.env.ACME_EMAIL || 'acme@proplayer919.dev';
