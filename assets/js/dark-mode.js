// assets/js/dark-mode.js
(() => {
  const toggle = document.getElementById('dark-mode-toggle');
  if (!toggle) return;

  const modeText = toggle.querySelector('.mode-text');
  const modeIcon = toggle.querySelector('.mode-icon');

  const applyMode = (isDark) => {
    if (isDark) {
      document.body.classList.add('dark-mode');
      if (modeText) modeText.textContent = 'Whitter';
      if (modeIcon) modeIcon.textContent = '☀️';
    } else {
      document.body.classList.remove('dark-mode');
      if (modeText) modeText.textContent = 'Nigger';
      if (modeIcon) modeIcon.textContent = '🌙';
    }
  };

  const saved = localStorage.getItem('darkMode') === 'true';
  applyMode(saved);

  toggle.addEventListener('click', () => {
    const isNowDark = !document.body.classList.contains('dark-mode');
    applyMode(isNowDark);
    localStorage.setItem('darkMode', isNowDark);
  });
})();