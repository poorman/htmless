export interface TransformParams {
  w?: number;
  h?: number;
  fit?: string;
  fm?: string;
  q?: number;
}

/**
 * Appends image-transform query params to a base URL.
 *
 * For now this is a pass-through URL builder. Actual server-side
 * transforms (sharp/libvips) will be wired in later.
 */
export function buildTransformUrl(baseUrl: string, params: TransformParams): string {
  const url = new URL(baseUrl, 'http://localhost'); // base is only used for relative URLs
  const isRelative = !baseUrl.startsWith('http');

  if (params.w !== undefined) url.searchParams.set('w', String(params.w));
  if (params.h !== undefined) url.searchParams.set('h', String(params.h));
  if (params.fit) url.searchParams.set('fit', params.fit);
  if (params.fm) url.searchParams.set('fm', params.fm);
  if (params.q !== undefined) url.searchParams.set('q', String(params.q));

  return isRelative ? `${url.pathname}${url.search}` : url.toString();
}
