import { eventBus, type HtmlessEvent } from './emitter.js';
import { dispatchWebhooks } from '../webhooks/dispatcher.js';

// All events that should trigger webhook delivery
const WEBHOOK_EVENTS: HtmlessEvent[] = [
  'entry.created',
  'entry.published',
  'entry.unpublished',
  'entry.deleted',
  'asset.created',
  'asset.updated',
  'asset.deleted',
  'schema.typeCreated',
  'schema.typeUpdated',
  'schema.typeDeleted',
];

export function wireEventHandlers(): void {
  for (const event of WEBHOOK_EVENTS) {
    eventBus.on(event, (payload) => {
      // Fire-and-forget — don't block the request
      dispatchWebhooks(payload).catch((err) => {
        console.error(`Webhook dispatch error for ${event}:`, err);
      });
    });
  }

  console.log(`Event bus wired: ${WEBHOOK_EVENTS.length} events → webhook dispatch`);
}
