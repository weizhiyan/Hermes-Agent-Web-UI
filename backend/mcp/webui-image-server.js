#!/usr/bin/env node
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const z = require('zod/v4');
const path = require('path');
process.chdir(path.join(__dirname, '..'));

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

async function optimizePromptThroughWebui({ prompt, sourcePrompt = '', refs = [], model = 'auto' } = {}) {
  const text = String(prompt || '').trim();
  if (!text) return { prompt: text, optimized: false, skill: '' };
  try {
    const { resp } = await fetchWebui('/api/images/optimize-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: text,
        userPrompt: String(sourcePrompt || text).trim(),
        attachments: refs.map((id) => ({ name: id, kind: 'input' })),
        model: String(model || 'auto'),
        profileName: 'HermesAgent',
        profilePrompt: '',
      }),
      signal: AbortSignal.timeout(3 * 60 * 1000),
    });
    const json = await resp.json().catch(() => ({}));
    const data = resp.ok && json.code === 0 ? json.data : null;
    const optimizedPrompt = String(data?.prompt || '').trim();
    if (!optimizedPrompt) return { prompt: text, optimized: false, skill: '' };
    return { prompt: optimizedPrompt, optimized: true, skill: String(data?.skill || 'webui-image-rules') };
  } catch (_) {
    return { prompt: text, optimized: false, skill: '' };
  }
}

const server = new McpServer({ name: 'hermes-webui-image', version: '0.1.0' });

server.registerTool(
  'webui_image_generate',
  {
    description: 'Generate or edit images through Hermes WebUI. This is the preferred/default image generation tool inside WebUI and it uses WebUI Model Configuration for image model, API key, storage, prompt optimization, and preview history. Do not use or ask the user to configure Hermes native image_gen/FAL_KEY/OPENAI_API_KEY for WebUI image tasks. When the user asks to create/generate/draw/edit an image, call this tool instead of writing curl, Python, HTTP examples, or telling the user to wait for an API. Pass attachmentIds when the user provided reference images. Returns local paths and Markdown preview URLs.',
    inputSchema: {
      prompt: z.string().describe('Image generation prompt from the user intent. Include subject, style, composition, colors, and details. Preserve named characters, brands, products, and user constraints exactly. WebUI will read its configured image model/API key and run its built-in prompt optimizer before final generation.'),
      sourcePrompt: z.string().optional().describe('The user original request before optimization. Defaults to prompt.'),
      attachmentIds: z.array(z.string()).optional().describe('Reference image IDs from the WebUI attachment context. Use these for image-to-image/editing tasks.'),
      size: z.string().optional().describe('Image size, for example 1024x1024. Default: 1024x1024.'),
      model: z.string().optional().describe('Optional WebUI image model id. Use auto unless the user explicitly picked a model.'),
      chatId: z.string().optional().describe('Optional current WebUI chat id for saving the result into the conversation.'),
    },
  },
  async ({ prompt, sourcePrompt = '', attachmentIds = [], size = '1024x1024', model = 'auto', chatId = '' }) => {
    const text = String(prompt || '').trim();
    if (!text) {
      return { content: [{ type: 'text', text: 'Missing prompt.' }], isError: true };
    }
    const refs = Array.isArray(attachmentIds) ? attachmentIds.map(id => String(id || '').trim()).filter(Boolean) : [];
    const sourceText = String(sourcePrompt || prompt || '').trim();
    const optimized = await optimizePromptThroughWebui({ prompt: text, sourcePrompt: sourceText, refs, model });
    const finalPrompt = optimized.prompt || text;
    const { resp, base: webuiApi } = await fetchWebui('/api/images/generate', (base) => ({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: finalPrompt,
        sourcePrompt: sourceText,
        optimizedByAgent: optimized.optimized,
        attachmentIds: refs,
        model: String(model || 'auto'),
        size,
        chatId: String(chatId || ''),
        publicBase: base,
      }),
      signal: AbortSignal.timeout(10 * 60 * 1000),
    }));
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json.code !== 0) {
      return { content: [{ type: 'text', text: 'WebUI image generation failed: ' + (json.msg || resp.statusText || resp.status) }], isError: true };
    }
    const data = json.data || {};
    const outputs = Array.isArray(data.outputs) ? data.outputs : [];
    const markdown = outputs.map((img, index) => {
      const url = img.publicUrl || img.url || '';
      return url ? '![Generated image ' + (index + 1) + '](' + url + ')' : '';
    }).filter(Boolean).join('\n\n');
    const payload = {
      success: true,
      type: 'webui_image_generate_result',
      markdown,
      imageUrl: outputs[0]?.publicUrl || outputs[0]?.url || '',
      outputs,
      inputs: Array.isArray(data.inputs) ? data.inputs : [],
      prompt: data.prompt || finalPrompt || text,
      sourcePrompt: data.sourcePrompt || sourceText,
      optimizedByAgent: !!data.optimizedByAgent || !!optimized.optimized,
      mode: data.mode || (refs.length ? 'image-to-image' : 'text-to-image'),
      model: data.model || 'auto',
      provider: data.provider || '',
      content: data.content || markdown,
    };
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(payload),
      }],
    };
  }
);

server.connect(new StdioServerTransport()).catch((error) => {
  console.error('[hermes-webui-image-mcp]', error);
  process.exit(1);
});
