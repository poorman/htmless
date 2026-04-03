// ─── Extension Manifest Types & Registry ────────────────────────────

export interface ExtensionRoute {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  handler: string;
}

export interface ExtensionHook {
  event: string;
  handler: string;
}

export interface ExtensionField {
  contentTypeKey: string;
  fieldKey: string;
  type: string;
  config: Record<string, unknown>;
}

export interface ExtensionManifest {
  key: string;
  name: string;
  version: string;
  description?: string;
  routes?: ExtensionRoute[];
  hooks?: ExtensionHook[];
  fields?: ExtensionField[];
}

// ─── In-memory registry ─────────────────────────────────────────────

const registry = new Map<string, ExtensionManifest>();

const KEY_RE = /^[a-z0-9_-]{1,64}$/;
const VERSION_RE = /^\d+\.\d+\.\d+$/;

/**
 * Validate and register an extension manifest.
 * Throws on invalid input or duplicate key.
 */
export function loadExtension(manifest: ExtensionManifest): void {
  if (!manifest.key || !KEY_RE.test(manifest.key)) {
    throw new Error(
      `Invalid extension key "${manifest.key}". Must be 1-64 lowercase alphanumeric, hyphens, or underscores.`,
    );
  }

  if (!manifest.name || manifest.name.trim().length === 0) {
    throw new Error('Extension name is required');
  }

  if (!manifest.version || !VERSION_RE.test(manifest.version)) {
    throw new Error(
      `Invalid extension version "${manifest.version}". Must be semver (e.g. 1.0.0).`,
    );
  }

  if (manifest.routes) {
    const validMethods = new Set(['GET', 'POST', 'PATCH', 'DELETE']);
    for (const route of manifest.routes) {
      if (!validMethods.has(route.method)) {
        throw new Error(`Invalid route method "${route.method}" in extension "${manifest.key}"`);
      }
      if (!route.path || !route.handler) {
        throw new Error(`Route path and handler are required in extension "${manifest.key}"`);
      }
    }
  }

  if (manifest.hooks) {
    for (const hook of manifest.hooks) {
      if (!hook.event || !hook.handler) {
        throw new Error(`Hook event and handler are required in extension "${manifest.key}"`);
      }
    }
  }

  if (manifest.fields) {
    for (const field of manifest.fields) {
      if (!field.contentTypeKey || !field.fieldKey || !field.type) {
        throw new Error(
          `Field contentTypeKey, fieldKey, and type are required in extension "${manifest.key}"`,
        );
      }
    }
  }

  registry.set(manifest.key, manifest);
}

/**
 * Return all registered extension manifests.
 */
export function getExtensions(): ExtensionManifest[] {
  return Array.from(registry.values());
}

/**
 * Get a single registered extension by key, or undefined if not found.
 */
export function getExtension(key: string): ExtensionManifest | undefined {
  return registry.get(key);
}

/**
 * Remove a registered extension by key.
 * Returns true if the extension was found and removed, false otherwise.
 */
export function removeExtension(key: string): boolean {
  return registry.delete(key);
}
