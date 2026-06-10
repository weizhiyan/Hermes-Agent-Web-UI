(function(global){
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const statusLabel = { ok:'正常', warn:'警告', busy:'运行中', error:'错误', unknown:'未知' };
  const statusClass = status => ['ok','warn','busy','error'].includes(status) ? status : 'unknown';

  function itemCard(item){
    const cls = statusClass(item && item.status);
    return `<div class="diagnostic-card diagnostic-${cls}">
      <div class="diagnostic-card-head"><strong>${esc(item.label || item.key || '检查项')}</strong><span>${esc(statusLabel[cls] || cls)}</span></div>
      <div class="diagnostic-detail">${esc(item.detail || '')}</div>
    </div>`;
  }

  function dirRow(item){
    const ok = item.exists && item.writable;
    return `<tr><td>${esc(item.key)}</td><td title="${esc(item.path)}">${esc(item.path)}</td><td>${item.exists?'存在':'缺失'}</td><td class="${ok?'diag-ok':'diag-warn'}">${item.writable?'可写':'不可写'}</td></tr>`;
  }

  function errorRow(item){
    const ts = item.ts ? new Date(item.ts).toLocaleString('zh-CN') : '--';
    return `<div class="diagnostic-log-line"><span>${esc(ts)}</span><b>${esc(item.level || 'warn')}</b><em>${esc(item.source || item.type || 'system')}</em><strong>${esc(item.title || item.msg || item.error || '')}</strong></div>`;
  }

  function render(data){
    if(!data) return `<div class="empty-state"><span>诊断数据加载中…</span></div>`;
    const health = Array.isArray(data.health) ? data.health : [];
    const dirs = Array.isArray(data.dirs) ? data.dirs : [];
    const recentErrors = data.logs && Array.isArray(data.logs.recentErrors) ? data.logs.recentErrors : [];
    const hermes = data.hermes || {};
    const active = Array.isArray(data.activeHermes) ? data.activeHermes : [];
    return `<div class="diagnostic-view">
      <div class="diagnostic-summary">
        <div><span>平台</span><strong>${esc(data.platform)} / ${esc(data.node)}</strong></div>
        <div><span>Hermes</span><strong>${hermes.cmd ? esc((hermes.cmd || 'hermes') + (hermes.version ? ' ' + hermes.version : '')) : '未检测到'}</strong></div>
        <div><span>子进程</span><strong>${active.length}</strong></div>
        <div><span>日志</span><strong>${Number(data.logs && data.logs.total || 0)}</strong></div>
      </div>
      <div class="diagnostic-grid">${health.map(itemCard).join('')}</div>
      <section class="diagnostic-section"><h3>数据目录</h3><table class="diagnostic-table"><tbody>${dirs.map(dirRow).join('')}</tbody></table></section>
      <section class="diagnostic-section"><h3>最近告警</h3>${recentErrors.length ? recentErrors.slice().reverse().map(errorRow).join('') : '<div class="empty-state"><span>暂无错误或警告日志</span></div>'}</section>
    </div>`;
  }

  global.HermesDiagnostics = { render };
})(window);
