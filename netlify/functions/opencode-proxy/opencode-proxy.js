exports.handler = async (event) => {
  // 从请求路径中提取目标路径（如 /models 或 /chat/completions）
  const path = event.path.replace(/^\/api\/opencode-proxy\//, '');
  const targetUrl = `https://opencode.ai/zen/go/v1/${path}`;

  try {
    // 转发请求到 opencode
    const response = await fetch(targetUrl, {
      headers: {
        'Authorization': event.headers.authorization || '',
        'Content-Type': 'application/json',
      },
      method: event.httpMethod,
      body: event.httpMethod === 'POST' ? event.body : undefined,
    });

    const data = await response.json();
    // 返回响应并添加 CORS 头
    return {
      statusCode: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: '代理请求失败' }),
    };
  }
};
