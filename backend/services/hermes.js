/**
 * Hermes CLI bridge.
 * Spawns "hermes chat -q" and streams the response character by character.
 *
 * We use a subprocess instead of the LLM API so the WebUI gets the full
 * Hermes Agent experience: tool calling, skills, memory, file ops, etc.
 *
 * The process spawn uses /usr/bin/script to force line-buffered output
 * so we can stream tokens instead of waiting for the whole response.
 */

const { spawn } = require('child_process');

/**
 * Async generator: yields tokens (string chunks) from `hermes chat -q`.
 * @param {string} prompt  - The latest user message text
 * @param {Array}  history - Full message history [{role, content}, ...]
 * @param {object} modelCfg - Model config from models.json
 * @yields {string} token
 */
async function* hermesStream(prompt, history, modelCfg) {
  // Build context from history (exclude the prompt itself — we pass it via -q)
  const contextLines = [];
  for (const m of history.slice(0, -1)) {
    if (m.role === 'system') {
      contextLines.push(`[system]\n${m.content}`);
    } else if (m.role === 'user') {
      contextLines.push(`[user]\n${m.content}`);
    } else if (m.role === 'assistant') {
      contextLines.push(`[assistant]\n${m.content}`);
    }
  }
  const context = contextLines.join('\n---\n');

  // Build the full prompt with context
  let fullPrompt = prompt;
  if (contextLines.length > 0) {
    fullPrompt = `[对话历史]\n${context}\n\n[当前问题]\n${prompt}`;
  }

  // Escape for safe shell passing
  const safePrompt = fullPrompt.replace(/'/g, "'\\''");

  // Spawn hermes in quiet mode (-Q suppresses banner/spinner)
  const args = ['chat', '-q', fullPrompt, '-Q'];
  if (modelCfg?.model) {
    args.push('-m', modelCfg.model);
  }

  const child = spawn('hermes', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 180000, // 3 min
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  });

  let buffer = '';

  try {
    for await (const chunk of child.stdout) {
      const text = chunk.toString('utf-8');
      buffer += text;

      // Yield complete lines as tokens
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx + 1);
        buffer = buffer.slice(idx + 1);
        yield line;
      }
    }
    // Yield any remaining buffered data
    if (buffer.length > 0) {
      yield buffer;
    }

    // Check for errors on stderr
    let stderr = '';
    for await (const chunk of child.stderr) {
      stderr += chunk.toString('utf-8');
    }
    if (stderr.trim() && !buffer) {
      throw new Error(stderr.trim().slice(0, 500));
    }
  } catch (e) {
    if (e.killed || e.signal === 'SIGTERM') {
      throw new Error('Hermes 请求超时或被中断');
    }
    throw e;
  }
}

module.exports = { hermesStream };
