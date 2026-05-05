export function initRouter(onChange) {
  const buttons = document.querySelectorAll('.rail-btn');
  const views = document.querySelectorAll('.view');
  const mobileButtons = document.querySelectorAll('.mobile-nav-btn');
  const sidebar = document.getElementById('sidebar');

  function go(name) {
    buttons.forEach(b => b.classList.toggle('active', b.dataset.view === name));
    mobileButtons.forEach(b => b.classList.toggle('active', b.dataset.view === name));
    views.forEach(v => v.classList.toggle('hidden', v.dataset.view !== name));
    if (sidebar) {
      sidebar.classList.toggle('hidden-sidebar', name !== 'chat');
    }
    onChange?.(name);
  }

  buttons.forEach(b => b.addEventListener('click', () => go(b.dataset.view)));
  mobileButtons.forEach(b => b.addEventListener('click', () => go(b.dataset.view)));
  go('chat');
  return { go };
}
