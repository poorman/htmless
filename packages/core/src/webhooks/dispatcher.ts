import { createHmac } from 'crypto';
import { prisma } from '../db.js';
import type { EventPayload } from '../events/emitter.js';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [0, 30_000, 30_000]; // immediate, +30s, +30s

export interface WebhookPayload {
  eventId: string;
  eventType: string;
  occurredAt: string;
  data: Record<string, unknown>;
}

function signPayload(body: string, timestamp: string, secret: string): string {
  const message = `${timestamp}.${body}`;
  return `sha256=${createHmac('sha256', secret).update(message).digest('hex')}`;
}

async function deliverWebhook(
  webhookId: string,
  url: string,
  signingSecret: string,
  payload: WebhookPayload,
  attempt: number,
): Promise<{ success: boolean; statusCode?: number; responseTime?: number; error?: string }> {
  const body = JSON.stringify(payload);
  const timestamp = new Date().toISOString();
  const signature = signPayload(body, timestamp, signingSecret);

  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-HTMLess-Event-Id': payload.eventId,
        'X-HTMLess-Timestamp': timestamp,
        'X-HTMLess-Signature': signature,
        'User-Agent': 'HTMLess-Webhook/1.0',
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseTime = Date.now() - start;
    const success = res.status >= 200 && res.status < 300;

    // Log delivery attempt
    await prisma.webhookDelivery.create({
      data: {
        webhookId,
        eventType: payload.eventType,
        payload: payload as object,
        statusCode: res.status,
        responseTime,
        attempt,
        success,
        error: success ? null : `HTTP ${res.status}`,
      },
    });

    return { success, statusCode: res.status, responseTime };
  } catch (err) {
    const responseTime = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';

    await prisma.webhookDelivery.create({
      data: {
        webhookId,
        eventType: payload.eventType,
        payload: payload as object,
        statusCode: null,
        responseTime,
        attempt,
        success: false,
        error: errorMsg,
      },
    });

    return { success: false, error: errorMsg };
  }
}

export async function dispatchWebhooks(event: EventPayload): Promise<void> {
  // Find webhooks subscribed to this event in this space
  const webhooks = await prisma.webhook.findMany({
    where: {
      spaceId: event.spaceId,
      active: true,
    },
  });

  // Filter webhooks that subscribe to this event type
  const matching = webhooks.filter((wh) => {
    const events = wh.events as string[];
    return events.includes(event.eventType) || events.includes('*');
  });

  if (matching.length === 0) return;

  const payload: WebhookPayload = {
    eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    data: event.data,
  };

  for (const webhook of matching) {
    // Attempt delivery with retries
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 1) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[attempt - 1]));
      }

      const result = await deliverWebhook(
        webhook.id,
        webhook.url,
        webhook.signingSecret,
        payload,
        attempt,
      );

      if (result.success) {
        break; // Done, no more retries
      }

      if (attempt === MAX_RETRIES) {
        console.error(
          `Webhook delivery failed after ${MAX_RETRIES} attempts: ${webhook.url} for ${event.eventType}`,
        );
      }
    }
  }
}
