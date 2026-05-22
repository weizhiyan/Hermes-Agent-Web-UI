#!/usr/bin/env node
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const z = require('zod/v4');

const fs = require('fs');

function candidateWebuiApis() {
  const explicit = String(process.env.WEBUI_API || '').trim();
  const list = [];
  if (explicit) list.push(explicit);
  list.push('http://127.0.0.1:3381');
  try {
    const resolv = fs.readFileSync('/etc/resolv.conf', 'utf8');
    const match = resolv.match(/^nameserver\s+([^\s]+)/m);
    if (match && match[1]) list.push('http://' + match[1] + ':3381');
  } catch (_) {}
  return [...new Set(list.map(v => String(v || '').replace(/\/$/, '')).filter(Boolean))];
}

async function fetchWebui(path, init) {
  let lastError = null;
  for (const base of candidateWebuiApis()) {
    try {
      const requestInit = typeof init === 'function' ? init(base) : init;
      const resp = await fetch(base + path, requestInit);
      return { resp, base };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('WebUI API unavailable');
}

const server = new McpServer({ name: 'hermes-webui-image', version: '0.1.0' });

server.registerTool(
  'webui_image_generate',
  {
    description: 'Generate images directly through the Hermes WebUI image model configuration. When the user asks to create/generate/draw an image, call this tool instead of writing curl, Python, HTTP examples, or telling the user to wait for an API. Returns local paths and preview URLs.',
    inputSchema: {
      prompt: z.string().describe('Image generation prompt. Include subject, style, composition, colors, and details.'),
      size: z.string().optional().describe('Image size, for example 1024x1024. Default: 1024x1024.'),
    },
  },
  async ({ prompt, size = '1024x1024' }) => {
    const text = String(prompt || '').trim();
    if (!text) {
      return { content: [{ type: 'text', text: 'Missing prompt.' }], isError: true };
    }
    const { resp, base: webuiApi } = await fetchWebui('/api/images/generate', (base) => ({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: text, sourcePrompt: text, optimizedByAgent: false, model: 'auto', size, publicBase: base }),
      signal: AbortSignal.timeout(10 * 60 * 1000),
    }));
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json.code !== 0) {
      return { content: [{ type: 'text', text: 'WebUI image generation failed: ' + (json.msg || resp.statusText || resp.status) }], isError: true };
    }
    const data = json.data || {};
    const outputs = data.outputs || [];
    const blocks = outputs.map((img, index) => [
      'Image ' + (index + 1),
      'Local path: ' + (img.path || ''),
      'Preview URL: ' + (img.publicUrl || img.url || ''),
      img.publicUrl ? 'Markdown: ![generated image ' + (index + 1) + '](' + img.publicUrl + ')' : '',
    ].filter(Boolean).join('\n'));
    return {
      content: [{
        type: 'text',
        text: ['WebUI image generation completed.', 'Model: ' + (data.model || 'auto'), 'Prompt: ' + (data.prompt || text), '', ...blocks].join('\n'),
      }],
    };
  }
);

server.connect(new StdioServerTransport()).catch((error) => {
  console.error('[hermes-webui-image-mcp]', error);
  process.exit(1);
});
