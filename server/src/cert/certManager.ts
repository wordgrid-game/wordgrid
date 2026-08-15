import acme from 'acme-client';
import fs from 'node:fs';
import path from 'node:path';
import { createLogger } from '../logging';

const logger = createLogger('CertManager');

const CERT_DIR = path.resolve(process.cwd(), 'certs');
const CERT_PATH = path.join(CERT_DIR, 'fullchain.pem');
const KEY_PATH = path.join(CERT_DIR, 'privkey.pem');
const ACCOUNT_KEY_PATH = path.join(CERT_DIR, 'account.pem');

export interface CertConfig {
  certPath: string;
  keyPath: string;
}

/**
 * Ensures valid SSL/TLS certificates exist, generating or renewing via Netlify DNS-01 challenge if needed.
 * @returns Resolves to CertConfig if certificates are available, or null if in development/non-TLS mode.
 */
export async function ensureValidCertificate(): Promise<CertConfig | null> {
  const isProd = process.env.NODE_ENV === 'production';
  const enableTls = process.env.ENABLE_TLS === 'true' || isProd;

  if (!enableTls) {
    logger.info('TLS disabled or dev environment; skipping automatic cert generation.');
    return null;
  }

  if (fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH)) {
    try {
      const certContent = fs.readFileSync(CERT_PATH, 'utf8');
      const certInfo = acme.crypto.readCertificateInfo(certContent);
      const daysLeft = (certInfo.notAfter.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

      if (daysLeft > 30) {
        logger.info(`Existing SSL certificate is valid for ${Math.round(daysLeft)} more days.`);
        return { certPath: CERT_PATH, keyPath: KEY_PATH };
      }

      logger.info(`Certificate expiring in ${Math.round(daysLeft)} days. Renewing now...`);
    } catch (err: any) {
      logger.warn(`Failed to inspect existing cert: ${err.message}. Generating new cert...`);
    }
  }

  logger.info('Obtaining new Let\'s Encrypt SSL cert via Netlify DNS-01 challenge...');
  return await generateNetlifyDnsCert();
}

/**
 * Executes Let's Encrypt ACME DNS-01 challenge using Netlify DNS API
 */
async function generateNetlifyDnsCert(): Promise<CertConfig> {
  const netlifyToken = process.env.NETLIFY_AUTH_TOKEN;
  const domain = process.env.DOMAIN_NAME || 'wordgrid-api.proplayer919.dev';
  const email = process.env.ACME_EMAIL || 'admin@proplayer919.dev';
  const zoneName = process.env.NETLIFY_ZONE_NAME || 'proplayer919.dev';

  if (!netlifyToken) {
    throw new Error(
      'NETLIFY_AUTH_TOKEN environment variable is required to create DNS TXT records.'
    );
  }

  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true });
  }

  // Load existing ACME account key or create & persist a new one
  let accountKey: Buffer | string;
  if (fs.existsSync(ACCOUNT_KEY_PATH)) {
    logger.info('Loading existing ACME account key from certs/account.pem...');
    accountKey = fs.readFileSync(ACCOUNT_KEY_PATH);
  } else {
    logger.info('Generating new ACME account key and persisting to certs/account.pem...');
    accountKey = await acme.crypto.createPrivateKey();
    fs.writeFileSync(ACCOUNT_KEY_PATH, accountKey.toString());
  }

  const client = new acme.Client({
    directoryUrl: acme.directory.letsencrypt.production,
    accountKey,
  });

  logger.info(`Checking/Registering ACME account for ${email}...`);
  await client.createAccount({
    termsOfServiceAgreed: true,
    contact: [`mailto:${email}`],
  });

  const [accountPrivateKey, csr] = await acme.crypto.createCsr({
    commonName: domain,
  });

  logger.info(`Finding Netlify DNS Zone for ${zoneName}...`);
  const zonesRes = await fetch('https://api.netlify.com/api/v1/dns_zones', {
    headers: { Authorization: `Bearer ${netlifyToken}` },
  });

  if (!zonesRes.ok) {
    throw new Error(`Failed to fetch Netlify DNS zones: status ${zonesRes.status}`);
  }

  const zones = (await zonesRes.json()) as any[];
  const zone = zones.find((z: any) => z.name === zoneName);

  if (!zone) {
    throw new Error(`Netlify DNS zone '${zoneName}' not found in your Netlify account.`);
  }

  let createdRecordId: string | null = null;

  const certPem = await client.auto({
    csr,
    email,
    termsOfServiceAgreed: true,
    challengeCreateFn: async (authz, challenge, keyAuthorization) => {
      if (challenge.type === 'dns-01') {
        const subDomain = domain.replace(`.${zoneName}`, '');
        const recordHost = `_acme-challenge.${subDomain}`;

        logger.info(`Creating Netlify TXT record '${recordHost}' = '${keyAuthorization}'`);

        const createRes = await fetch(
          `https://api.netlify.com/api/v1/dns_zones/${zone.id}/dns_records`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${netlifyToken}`,
            },
            body: JSON.stringify({
              type: 'TXT',
              hostname: recordHost,
              value: keyAuthorization,
              ttl: 60,
            }),
          }
        );

        if (!createRes.ok) {
          throw new Error(`Failed to create TXT record on Netlify DNS: status ${createRes.status}`);
        }

        const record = (await createRes.json()) as any;
        createdRecordId = record.id;

        logger.info('Waiting 15 seconds for Netlify DNS propagation...');
        await new Promise((r) => setTimeout(r, 15000));
      }
    },
    challengeRemoveFn: async (authz, challenge) => {
      if (challenge.type === 'dns-01' && createdRecordId) {
        logger.info(`Cleaning up Netlify TXT record ID: ${createdRecordId}`);
        await fetch(
          `https://api.netlify.com/api/v1/dns_zones/${zone.id}/dns_records/${createdRecordId}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${netlifyToken}` },
          }
        );
      }
    },
  });

  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true });
  }

  fs.writeFileSync(CERT_PATH, certPem.toString());
  fs.writeFileSync(KEY_PATH, accountPrivateKey.toString());

  logger.info(`SSL Certificate successfully written to ${CERT_PATH}`);
  return { certPath: CERT_PATH, keyPath: KEY_PATH };
}
