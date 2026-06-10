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
  return [...new Set(list.map(v => String(v || '').replace(/\/$/, '')).filter(Boolean))];
}


function normalizeAttachmentIds(value, ...texts) {
  const ids = [];
  if (Array.isArray(value)) ids.push(...value);
  for (const text of texts) {
    const raw = String(text || '');
    for (const match of raw.matchAll(/\b(?:in|out)_[A-Za-z0-9_\-]+\b/g)) ids.push(match[0]);
  }
  return [...new Set(ids.map(id => String(id || '').trim()).filter(Boolean))];
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
    const refs = normalizeAttachmentIds(attachmentIds, prompt, sourcePrompt);
    const sourceText = String(sourcePrompt || prompt || '').trim();
    // Hermes Agent has already reasoned about the prompt before calling this tool.
    // Avoid an extra WebUI prompt-optimization LLM round here so Agent image generation starts faster.
    const optimized = { prompt: text, optimized: false, skill: '' };
    const finalPrompt = text;
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


server.registerTool(
  'webui_video_generate',
  {
    description: 'Generate videos through Hermes WebUI. This tool uses WebUI Model Configuration for the video model, API key, storage, and preview history. When the user asks to create/generate a video, animation, short clip, motion visual, or dynamic scene, call this tool instead of writing curl, Python, HTTP examples, or saying the video API is unavailable. Returns local paths and Markdown preview URLs.',
    inputSchema: {
      prompt: z.string().describe('Video generation prompt from the user intent. Include subject, motion, camera movement, style, scene, duration, and key constraints. Preserve named characters, brands, products, and user constraints exactly.'),
      sourcePrompt: z.string().optional().describe('The user original request before optimization. Defaults to prompt.'),
      attachmentIds: z.array(z.string()).optional().describe('Reference image IDs from the WebUI attachment context. Use these for image-to-video tasks when the user asks to animate or generate a video from an uploaded image.'),
      size: z.string().optional().describe('Video size or aspect ratio, for example 1024x1024 or 16:9. Default: 1024x1024.'),
      seconds: z.number().optional().describe('Duration in seconds. Default: 5.'),
      model: z.string().optional().describe('Optional WebUI video model id. Use auto unless the user explicitly picked a model.'),
      chatId: z.string().optional().describe('Optional current WebUI chat id for saving the result into the conversation.'),
    },
  },
  async ({ prompt, sourcePrompt = '', attachmentIds = [], size = '1024x1024', seconds = 5, model = 'auto', chatId = '' }) => {
    const text = String(prompt || '').trim();
    if (!text) {
      return { content: [{ type: 'text', text: 'Missing prompt.' }], isError: true };
    }
    const sourceText = String(sourcePrompt || prompt || '').trim();
    const { resp, base: webuiApi } = await fetchWebui('/api/images/video/generate', (base) => ({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: text,
        sourcePrompt: sourceText,
        attachmentIds: normalizeAttachmentIds(attachmentIds, prompt, sourcePrompt),
        model: String(model || 'auto'),
        size,
        seconds: Number(seconds || 5),
        chatId: String(chatId || ''),
        publicBase: base,
      }),
      signal: AbortSignal.timeout(15 * 60 * 1000),
    }));
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json.code !== 0) {
      return { content: [{ type: 'text', text: 'WebUI video generation failed: ' + (json.msg || resp.statusText || resp.status) }], isError: true };
    }
    const data = json.data || {};
    const outputs = Array.isArray(data.outputs) ? data.outputs : [];
    const markdown = outputs.map((item, index) => {
      const url = item.publicUrl || item.url || '';
      return url ? '[Generated video ' + (index + 1) + '](' + url + ')' : '';
    }).filter(Boolean).join('\n\n');
    const payload = {
      success: true,
      type: 'webui_video_generate_result',
      markdown,
      videoUrl: outputs[0]?.publicUrl || outputs[0]?.url || '',
      taskId: data.taskId || '',
      status: data.status || '',
      taskStatus: data.taskStatus || data.status || '',
      outputs,
      inputs: Array.isArray(data.inputs) ? data.inputs : [],
      prompt: data.prompt || text,
      sourcePrompt: data.sourcePrompt || sourceText,
      mode: data.mode || 'text-to-video',
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


server.registerTool(
  'webui_markdown_insert_image',
  {
    description: 'Insert a WebUI generated/uploaded image into a Markdown document in the WebUI MD output library. Embeds the image directly as a Base64 data:image URL so the .md file remains self-contained when shared. Use this when the user asks to put an image into a report/document/Markdown file. Do not claim success unless this tool returns success.',
    inputSchema: {
      path: z.string().describe('Target Markdown path relative to the WebUI MD output library, e.g. report.md or folder/report.md.'),
      imageId: z.string().describe('WebUI image id or image URL, e.g. out_xxx, in_xxx, or /api/images/file/out_xxx.'),
      alt: z.string().optional().describe('Image alt text/caption. Default: image.'),
      position: z.string().optional().describe('Insert position. Currently append is supported by WebUI fallback. Default: append.'),
    },
  },
  async ({ path, imageId, alt = 'image', position = 'append' }) => {
    const { resp } = await fetchWebui('/api/chats/tools/markdown/insert-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, imageId, alt, position }),
      signal: AbortSignal.timeout(120 * 1000),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json.code !== 0) {
      return { content: [{ type: 'text', text: 'WebUI markdown insert image failed: ' + (json.msg || resp.statusText || resp.status) }], isError: true };
    }
    return { content: [{ type: 'text', text: JSON.stringify(json.data || {}) }] };
  }
);



server.registerTool(
  'webui_markdown_create',
  {
    description: 'Create and save a Markdown document into the WebUI MD output library and return an Artifact card preview. Use this when the user asks to output, generate, create, save, or write a document, report, note, tutorial, summary, card, article, or any Markdown content. When content references WebUI generated/uploaded images, WebUI embeds those local images as Base64 data:image URLs on save so the .md file is self-contained. The tool writes the file, then returns an artifact tag that the frontend renders as a clickable card.',
    inputSchema: {
      title: z.string().describe('Document title. Used as the card title and default filename. Max 80 chars.'),
      path: z.string().optional().describe('Optional relative file path under the MD output library (e.g. folder/report.md). Defaults to sanitized title + .md.'),
      content: z.string().describe('Full Markdown content of the document. Must include frontmatter and body.'),
    },
  },
  async ({ title, path = '', content }) => {
    const text = String(content || '').trim();
    if (!text) {
      return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'content is required' }) }], isError: true };
    }
    const { resp } = await fetchWebui('/api/chats/tools/markdown/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: String(title || '输出文档').trim().slice(0, 80),
        path: String(path || '').trim(),
        content: text,
      }),
      signal: AbortSignal.timeout(120 * 1000),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json.code !== 0) {
      return { content: [{ type: 'text', text: 'WebUI markdown create failed: ' + (json.msg || resp.statusText || resp.status) }], isError: true };
    }
    return { content: [{ type: 'text', text: JSON.stringify(json.data || {}) }] };
  }
);
server.connect(new StdioServerTransport()).catch((error) => {
  console.error('[hermes-webui-image-mcp]', error);
  process.exit(1);
});
