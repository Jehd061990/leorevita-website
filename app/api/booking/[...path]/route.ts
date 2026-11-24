import { NextRequest, NextResponse } from 'next/server';

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxyBookingRequest(request: NextRequest, context: RouteContext) {
  const apiBase = process.env.DOYBIZ_API_URL?.replace(/\/+$/, '');
  if (!apiBase) {
    return NextResponse.json({ success: false, message: 'DoyBiz booking is not configured yet.' }, { status: 503 });
  }

  const { path } = await context.params;
  const suffix = path.map((part) => encodeURIComponent(part)).join('/');
  const target = new URL(apiBase + '/public/' + suffix);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value));
  if (!target.searchParams.has('tenant') && process.env.DOYBIZ_TENANT_SLUG) {
    target.searchParams.set('tenant', process.env.DOYBIZ_TENANT_SLUG);
  }

  const headers = new Headers({ accept: 'application/json' });
  const contentType = request.headers.get('content-type');
  const cookie = request.headers.get('cookie');
  if (contentType) headers.set('content-type', contentType);
  if (cookie) headers.set('cookie', cookie);

  try {
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: 'no-store',
      redirect: 'manual',
    });

    const responseHeaders = new Headers();
    const upstreamType = upstream.headers.get('content-type');
    const setCookie = upstream.headers.get('set-cookie');
    if (upstreamType) responseHeaders.set('content-type', upstreamType);
    if (setCookie) responseHeaders.set('set-cookie', setCookie);
    responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return NextResponse.json({ success: false, message: 'Unable to reach the DoyBiz booking service. Please try again.' }, { status: 502 });
  }
}

export const GET = proxyBookingRequest;
export const POST = proxyBookingRequest;
