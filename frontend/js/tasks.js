/**
 * Tasks page — manage AI tasks.
 */
import { store, escapeHtml, toast } from './store.js';

const TASKS_KEY = 'tasks';

function loadTasks() {
  return store.get(TASKS_KEY, []);
}

function saveTasks(tasks) {
  store.set(TASKS_KEY, tasks);
}

function renderTaskList(content, filter) {
  const tasks = loadTasks();
  const kw = (filter || '').toLowerCase();
  const filtered = kw
    ? tasks.filter(t => t.title.toLowerCase().includes(kw) || (t.desc || '').toLowerCase().includes(kw))
    : tasks;

  if (filtered.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">□</div>
        <div class="empty-title">${kw ? '没有匹配的任务' : '任务看板'}</div>
        <div class="empty-desc">${kw ? '试试其他关键词' : '创建和管理你的 AI 任务'}</div>
      </div>`;
    return;
  }

  const pending = filtered.filter(t => !t.done);
  const done = filtered.filter(t => t.done);

  content.innerHTML = `
    <div class="tasks-columns">
      <div class="tasks-column">
        <div class="tasks-column-header">进行中 <span class="tasks-count">${pending.length}</span></div>
        <div class="tasks-list">
          ${pending.map(t => renderTaskCard(t)).join('')}
        </div>
      </div>
      <div class="tasks-column">
        <div class="tasks-column-header">已完成 <span class="tasks-count">${done.length}</span></div>
        <div class="tasks-list">
          ${done.length === 0 ? '<div style="padding:16px;color:var(--text-3);font-size:13px">暂无完成的任务</div>' : done.map(t => renderTaskCard(t)).join('')}
        </div>
      </div>
    </div>`;

  // Attach event listeners
  content.querySelectorAll('.task-check').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      const tasks = loadTasks();
      const task = tasks.find(t => t.id === id);
      if (task) {
        task.done = !task.done;
        saveTasks(tasks);
        renderTaskList(content, '');
      }
    });
  });

  content.querySelectorAll('.task-delete').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      if (!confirm('确认删除此任务？')) return;
      const tasks = loadTasks().filter(t => t.id !== id);
      saveTasks(tasks);
      renderTaskList(content, '');
      toast('任务已删除');
    });
  });
}

function renderTaskCard(t) {
  return `
    <div class="task-card ${t.done ? 'task-done' : ''}">
      <div class="task-card-left">
        <div class="task-check ${t.done ? 'checked' : ''}" data-id="${t.id}">
          ${t.done ? '✓' : ''}
        </div>
      </div>
      <div class="task-card-body">
        <div class="task-title">${escapeHtml(t.title)}</div>
        ${t.desc ? `<div class="task-desc">${escapeHtml(t.desc)}</div>` : ''}
        <div class="task-meta">
          <span>${new Date(t.createdAt || Date.now()).toLocaleDateString()}</span>
          ${t.priority ? `<span class="task-priority prio-${t.priority}">${t.priority}</span>` : ''}
        </div>
      </div>
      <button class="task-delete" data-id="${t.id}" title="删除">✕</button>
    </div>`;
}

export async function initTasks() {
  const content = document.getElementById('tasksContent');
  const newBtn = document.getElementById('newTaskBtn');
  if (!content || !newBtn) return;

  // Create new task modal
  function showNewTaskModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.innerHTML = `
      <div class="modal" style="max-width:420px">
        <header class="modal-head">
          <span>新建任务</span>
          <button class="icon-btn close-modal">✕</button>
        </header>
        <div class="modal-body" style="display:grid;gap:12px">
          <div class="form-item">
            <label>任务标题</label>
            <input class="input" id="newTaskTitle" placeholder="输入任务标题" />
          </div>
          <div class="form-item">
            <label>描述（可选）</label>
            <textarea class="input" id="newTaskDesc" rows="3" placeholder="任务描述"></textarea>
          </div>
          <div class="form-item">
            <label>优先级</label>
            <select class="input" id="newTaskPriority">
              <option value="low">低</option>
              <option value="medium" selected>中</option>
              <option value="high">高</option>
            </select>
          </div>
        </div>
        <footer class="modal-foot">
          <button class="btn btn-ghost close-modal">取消</button>
          <button class="btn btn-primary" id="confirmNewTask">创建</button>
        </footer>
      </div>`;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelectorAll('.close-modal').forEach(el => el.addEventListener('click', close));
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    document.getElementById('confirmNewTask').addEventListener('click', () => {
      const title = document.getElementById('newTaskTitle').value.trim();
      if (!title) { toast('请输入任务标题'); return; }
      const tasks = loadTasks();
      tasks.unshift({
        id: 't' + Date.now(),
        title,
        desc: document.getElementById('newTaskDesc').value.trim(),
        priority: document.getElementById('newTaskPriority').value,
        done: false,
        createdAt: Date.now(),
      });
      saveTasks(tasks);
      close();
      renderTaskList(content, '');
      toast('任务已创建');
    });

    document.getElementById('newTaskTitle').focus();
  }

  newBtn.addEventListener('click', showNewTaskModal);
  renderTaskList(content, '');
}
