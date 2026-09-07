// app/api/opencode-proxy-v2/[...path]/route.js

const TARGET_BASE = 'https://opencode.ai/zen/go/v1';

export const maxDuration = 26;

function corsHeaders(extra = {}) {
  const headers = new Headers(extra);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', '*');
  return headers;
}

async function getPath(params) {
  const p = await params;
  return (p?.path || []).join('/');
}

// 生成一个简单的随机会话 ID
function generateSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function GET(req, { params }) {
  const path = await getPath(params);
  const targetUrl = `${TARGET_BASE}/${path}`;

  try {
    // 复制客户端所有请求头
    const headers = new Headers(req.headers);
    // 确保有 x-opencode-session
    if (!headers.has('x-opencode-session')) {
      headers.set('x-opencode-session', generateSessionId());
    }

    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers,
    });

    const body = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'application/json';

    return new Response(body, {
      status: upstream.status,
      headers: corsHeaders({ 'Content-Type': contentType }),
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: '代理请求失败', detail: String(error) }),
      {
        status: 500,
        headers: corsHeaders({ 'Content-Type': 'application/json' }),
      }
    );
  }
}

export async function POST(req, { params }) {
  const path = await getPath(params);
  const targetUrl = `${TARGET_BASE}/${path}`;

  const bodyTextRaw = await req.text();
  let body;
  try {
    body = JSON.parse(bodyTextRaw);
  } catch (e) {
    body = bodyTextRaw;
  }

  // 删除上游不支持的采样参数
  if (body && typeof body === 'object') {
    delete body.min_p;
    delete body.logit_bias;
  }

  const bodyText = typeof body === 'string' ? body : JSON.stringify(body);

  // 复制客户端所有请求头
  const headers = new Headers(req.headers);
  // 确保有 x-opencode-session
  if (!headers.has('x-opencode-session')) {
    headers.set('x-opencode-session', generateSessionId());
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: bodyText,
      signal: controller.signal,
    });

    const contentType = upstream.headers.get('content-type') || 'application/json';
    const responseHeaders = corsHeaders({ 'Content-Type': contentType });

    if (
      contentType.includes('text/event-stream') ||
      contentType.includes('application/x-ndjson') ||
      contentType.includes('text/plain')
    ) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
      });
    }

    const data = await upstream.text();
    return new Response(data, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: '代理请求失败', detail: String(error) }),
      {
        status: 500,
        headers: corsHeaders({ 'Content-Type': 'application/json' }),
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}
