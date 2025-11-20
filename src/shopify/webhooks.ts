import fetch from 'node-fetch';
import { shopify } from './shopify';
import { InstallationRow, ShopifyWebhookRepo } from '../db';

const REQUIRED_TOPICS = [
  'products/create',
  'products/update',
  'products/delete',
  'inventory_levels/update',
  'app/uninstalled',
  'customers/data_request',
  'customers/redact',
  'shop/redact'
];

function getWebhookBaseUrl(): string {
  const value = process.env.SHOPIFY_WEBHOOK_BASE_URL;
  if (value && value.trim().length > 0) {
    return value.replace(/\/$/, '');
  }
  throw new Error('SHOPIFY_WEBHOOK_BASE_URL environment variable is required for webhook registration');
}

export async function syncShopifyWebhooks(installation: InstallationRow): Promise<void> {
  if (!installation.access_token) {
    throw new Error(`Installation ${installation.id} is missing an access token`);
  }

  const baseUrl = getWebhookBaseUrl();
  const addressUrl = new URL('/webhooks/shopify', baseUrl);
  addressUrl.searchParams.set('installation_id', installation.id);
  const address = addressUrl.toString();

  const headers = {
    'X-Shopify-Access-Token': installation.access_token,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  const apiVersion = shopify.config.apiVersion;
  const shopDomain = installation.shop_domain;

  const existingResponse = await fetch(`https://${shopDomain}/admin/api/${apiVersion}/webhooks.json?limit=250`, {
    headers
  });
  if (!existingResponse.ok) {
    const text = await existingResponse.text();
    throw new Error(`Failed to list webhooks: ${existingResponse.status} ${text}`);
  }

  const existingData = (await existingResponse.json()) as { webhooks?: any[] };
  const existingByTopic = new Map<string, any>();
  for (const webhook of existingData.webhooks ?? []) {
    if (webhook.address === address) {
      existingByTopic.set(String(webhook.topic).toLowerCase(), webhook);
    }
  }

  const registeredTopics = new Set<string>();

  for (const topic of REQUIRED_TOPICS) {
    const topicKey = topic.toLowerCase();
    let webhookId = existingByTopic.get(topicKey)?.id?.toString();

    if (!webhookId) {
      const payload = { webhook: { topic, address, format: 'json' } };
      const createRes = await fetch(`https://${shopDomain}/admin/api/${apiVersion}/webhooks.json`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!createRes.ok) {
        const errorText = await createRes.text();
        throw new Error(`Failed to register webhook for topic ${topic}: ${createRes.status} ${errorText}`);
      }

      const created = (await createRes.json()) as { webhook?: any };
      webhookId = created.webhook?.id ? String(created.webhook.id) : undefined;
    }

    if (webhookId) {
      await ShopifyWebhookRepo.upsert(installation.id, topic, webhookId);
      registeredTopics.add(topic);
    }
  }

  // Cleanup stale records
  const stored = await ShopifyWebhookRepo.listByInstallation(installation.id);
  for (const record of stored) {
    if (!registeredTopics.has(record.topic)) {
      await ShopifyWebhookRepo.delete(record.installation_id, record.topic);
    }
  }
}

