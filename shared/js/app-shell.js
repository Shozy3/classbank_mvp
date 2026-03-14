(function renderSharedSidebar() {
  const navRoot = document.getElementById('app-nav');
  if (!navRoot) {
    return;
  }

  const activePage = document.body?.dataset?.navActive || '';
  const navItems = [
    { id: 'home', icon: '⌂', label: 'Home', href: '../home/index.html' },
    { id: 'library', icon: '▤', label: 'Library', href: '../library/index.html' },
    { id: 'authoring', icon: '✎', label: 'Authoring', href: '../authoring/index.html' },
    { id: 'practice-setup', icon: '◈', label: 'Practice Setup', href: '../practice-setup/index.html' },
    { id: 'practice-session', icon: '▷', label: 'Practice Session', href: '../practice-session/index.html' },
    { id: 'review-history', icon: '◷', label: 'Review History', href: '../review-history/index.html' },
    { id: 'stats-dashboard', icon: '▦', label: 'Stats Dashboard', href: '../stats-dashboard/index.html' },
  ];

  const linksMarkup = navItems
    .map((item) => {
      const isActive = item.id === activePage;
      return `<a class="nav-link${isActive ? ' active' : ''}" href="${item.href}"${isActive ? ' aria-current="page"' : ''}><span class="nav-link-icon">${item.icon}</span> ${item.label}</a>`;
    })
    .join('');

  navRoot.innerHTML = `
    <div class="nav-logo">Class<span>Bank</span></div>
    <div class="nav-section-label">Workspace</div>
    ${linksMarkup}
  `;
})();
