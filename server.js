'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT               = process.env.PORT || 3000;
const NOTION_API_KEY     = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript' };
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function postToNotion(data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      parent: { database_id: NOTION_DATABASE_ID },
      properties: {
        'Student First Name': { title:      [{ text: { content: data.firstName } }] },
        'Student Last Name':  { rich_text:  [{ text: { content: data.lastName  } }] },
        'Age':                { number:     data.age },
        'Parent Name':        { rich_text:  [{ text: { content: data.parentName    } }] },
        'Parent Email':       { email:      data.parentEmail },
        'Parent Contact':     { phone_number: data.parentContact },
        'Heard From':         { select:     { name: data.heardFrom } }
      }
    });

    const req = https.request({
      hostname: 'api.notion.com',
      path:     '/v1/pages',
      method:   'POST',
      headers: {
        'Authorization':   `Bearer ${NOTION_API_KEY}`,
        'Content-Type':    'application/json',
        'Notion-Version':  '2022-06-28',
        'Content-Length':  Buffer.byteLength(body)
      }
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(raw));
        } else {
          reject(new Error(`Notion API ${res.statusCode}: ${raw}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const server = http.createServer((req, res) => {
  const pathname = req.url.split('?')[0];

  if (req.method === 'GET') {
    const target = (pathname === '/' || pathname === '/index.html')
      ? path.join(__dirname, 'index.html')
      : path.join(__dirname, pathname.slice(1));
    serveFile(res, target);
    return;
  }

  if (req.method === 'POST' && pathname === '/api/submit') {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', async () => {
      try {
        if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
          return sendJson(res, 500, { error: 'Server is missing Notion credentials — contact the administrator.' });
        }
        const data = JSON.parse(raw);
        await postToNotion(data);
        sendJson(res, 200, { success: true });
      } catch (err) {
        console.error('[submit error]', err.message);
        sendJson(res, 500, { error: 'Registration could not be saved. Please try again.' });
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n  Alpha Youth sign-up → http://localhost:${PORT}\n`);
  if (!NOTION_API_KEY)     console.warn('  ⚠  NOTION_API_KEY not set');
  if (!NOTION_DATABASE_ID) console.warn('  ⚠  NOTION_DATABASE_ID not set');
  if (NOTION_API_KEY && NOTION_DATABASE_ID) console.log('  ✓  Notion integration ready');
  console.log('');
});
