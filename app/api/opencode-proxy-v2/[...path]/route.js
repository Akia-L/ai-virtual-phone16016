// app/api/opencode-proxy-v2/[...path]/route.js

// 改成你实际使用的 OpenCodeGo Base URL，结尾不要加斜杠
const TARGET_BASE = 'https://opencode.ai/zen/go/v1';

function corsHeaders(extra = {}) {
  const headers = new Headers(extra);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  // 允许所有常见请求头，避免预检失败
  headers.set('Access-Control-Allow-Headers', '*');
  return headers;
}

async function getPath(params) {
  const p = await params; // 兼容 Next.js 15
  return (p?.path || []).join('/');
}

export async function GET(req, { params }) {
  const path = await getPath(params);
  const targetUrl = `${TARGET_BASE}/${path}`;

  try {
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Authorization: req.headers.get('authorization') || '',
      },
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
  const bodyText = await req.text(); // 保留原始请求体，避免流式请求体被重复解析

  try {
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        Authorization: req.headers.get('authorization') || '',
        'Content-Type': req.headers.get('content-type') || 'application/json',
      },
      body: bodyText,
    });

    const contentType = upstream.headers.get('content-type') || 'application/json';
    const headers = corsHeaders({ 'Content-Type': contentType });

    // 如果上游返回的是流式数据，直接透传响应体，不要尝试解析
    if (
      contentType.includes('text/event-stream') ||
      contentType.includes('application/x-ndjson') ||
      contentType.includes('text/plain')
    ) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers,
      });
    }

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers,
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

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}
