(() => {
  'use strict';
  const refresh = document.getElementById('darpe-nav-refresh');
  if (!refresh) return;
  refresh.onclick = () => {
    const existing = document.getElementById('mobile-refresh');
    if (existing) { if (!existing.disabled) existing.click(); }
    else window.location.reload();
  };
})();
