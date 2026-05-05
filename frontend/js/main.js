import { initRouter } from './router.js';
import { initChat } from './chat.js';
import { initSkills } from './skills.js';
import { initModels } from './models.js';
import { initSettings, updateConnDot } from './settings.js';
import { initMemory } from './memory.js';
import { initTasks } from './tasks.js';
import { initGateway } from './gateway.js';
import { initAgent } from './agent.js';
import { initCron } from './cron.js';
import { initUsage } from './usage.js';

const loaded = new Set();

async function ensureView(name) {
  if (loaded.has(name)) return;
  loaded.add(name);
  try {
    if (name === 'chat') await initChat();
    else if (name === 'memory') await initMemory();
    else if (name === 'tools') await initSkills();
    else if (name === 'tasks') await initTasks();
    else if (name === 'gateway') await initGateway();
    else if (name === 'agent') await initAgent();
    else if (name === 'cron') await initCron();
    else if (name === 'usage') await initUsage();
    else if (name === 'models') await initModels();
    else if (name === 'settings') await initSettings();
  } catch (e) {
    console.warn('init ' + name + ' failed:', e);
  }
}

(async function bootstrap() {
  try {
    await initSettings();
  } catch (e) {
    console.warn('settings init failed, continuing:', e);
  }
  initRouter(ensureView);
  try {
    await ensureView('chat');
  } catch (e) {
    console.warn('chat init failed:', e);
  }
  try { updateConnDot(); } catch {}
  setInterval(() => { try { updateConnDot(); } catch {} }, 15_000);

  const collapseBtn = document.getElementById('collapseBtn');
  if (collapseBtn) {
    collapseBtn.onclick = () => {
      document.body.classList.toggle('sidebar-collapsed');
      const bar = document.getElementById('historyBar');
      const sb = document.getElementById('sidebar');
      if (bar) bar.style.display = document.body.classList.contains('sidebar-collapsed') ? 'flex' : 'none';
      if (sb && !document.body.classList.contains('sidebar-collapsed')) {
        sb.classList.remove('hidden-sidebar');
      }
    };
  }

  const historyBar = document.getElementById('historyBar');
  if (historyBar) {
    historyBar.onclick = () => {
      document.body.classList.remove('sidebar-collapsed');
      historyBar.style.display = 'none';
      const sb = document.getElementById('sidebar');
      if (sb) sb.classList.remove('hidden-sidebar');
    };
  }

  const themeBtn = document.getElementById('themeToggleBtn');
  const sunIcon = document.getElementById('themeIconSun');
  const moonIcon = document.getElementById('themeIconMoon');
  if (themeBtn && sunIcon && moonIcon) {
    themeBtn.onclick = () => {
      const body = document.body;
      const isDark = body.dataset.theme !== 'light';
      body.dataset.theme = isDark ? 'light' : 'dark';
      sunIcon.style.display = isDark ? 'none' : 'block';
      moonIcon.style.display = isDark ? 'block' : 'none';
    };
  }
})();
