import app from './server.js';
import db from './db.js';

let dbInitialized = false;

async function handleExpress(request, env, ctx) {
  return new Promise((resolve) => {
    const url = new URL(request.url);

    const req = {
      method: request.method,
      url: url.pathname + url.search,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      headers: Object.fromEntries(request.headers.entries()),
      env: env
    };

    const responseHeaders = new Headers();
    let statusCode = 200;
    let bodySent = false;

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      setHeader(name, value) {
        responseHeaders.set(name, value);
        return this;
      },
      header(name, value) {
        responseHeaders.set(name, value);
        return this;
      },
      json(data) {
        if (bodySent) return;
        bodySent = true;
        responseHeaders.set('Content-Type', 'application/json');
        resolve(new Response(JSON.stringify(data), { status: statusCode, headers: responseHeaders }));
      },
      send(data) {
        if (bodySent) return;
        bodySent = true;
        const contentType = typeof data === 'object' ? 'application/json' : 'text/html; charset=utf-8';
        if (!responseHeaders.has('Content-Type')) {
          responseHeaders.set('Content-Type', contentType);
        }
        const bodyStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
        resolve(new Response(bodyStr, { status: statusCode, headers: responseHeaders }));
      },
      end(data) {
        if (bodySent) return;
        bodySent = true;
        resolve(new Response(data || '', { status: statusCode, headers: responseHeaders }));
      }
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      request.text().then(textBody => {
        try {
          req.body = textBody ? JSON.parse(textBody) : {};
        } catch (e) {
          req.body = textBody;
        }
        app(req, res);
      }).catch(() => {
        req.body = {};
        app(req, res);
      });
    } else {
      req.body = {};
      app(req, res);
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      // Handle root '/' by serving '/index.html' static asset
      if (url.pathname === '/' || url.pathname === '') {
        if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
          const indexReq = new Request(new URL('/index.html', request.url), request);
          const assetRes = await env.ASSETS.fetch(indexReq);
          if (assetRes && assetRes.status < 400) {
            return assetRes;
          }
        }
      }

      // Handle API routes via Express app
      if (url.pathname.startsWith('/api')) {
        if (!dbInitialized) {
          try {
            await db.initDb(env);
            dbInitialized = true;
          } catch (err) {
            console.warn('Worker DB Init Notice:', err.message);
          }
        }
        return await handleExpress(request, env, ctx);
      }

      // Handle static assets (HTML/CSS/JS) via Cloudflare ASSETS binding
      if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
        const assetRes = await env.ASSETS.fetch(request);
        if (assetRes && assetRes.status < 400) {
          return assetRes;
        }
      }

      return await handleExpress(request, env, ctx);
    } catch (err) {
      return new Response(JSON.stringify({
        error: 'Worker Execution Error',
        message: err.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
