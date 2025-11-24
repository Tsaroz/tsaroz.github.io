// poker.js — Theme toggle + Go to Top + Accessibility

document.addEventListener('DOMContentLoaded', () => {
  // === Theme Toggle ===
  const themeToggle = document.getElementById('themeToggle');
  const body = document.body;

  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const currentTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');

  if (currentTheme === 'dark') {
    body.setAttribute('data-theme', 'dark');
    if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
  } else {
    body.removeAttribute('data-theme');
    if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const isDark = body.getAttribute('data-theme') === 'dark';
      if (isDark) {
        body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
      } else {
        body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
      }
    });
  }

  // === Go to Top Button ===
  const goToTop = document.getElementById('goToTop');

  if (goToTop) {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        goToTop.classList.add('show');
      } else {
        goToTop.classList.remove('show');
      }
    };

    const scrollToTop = () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    };

    window.addEventListener('scroll', handleScroll);
    goToTop.addEventListener('click', scrollToTop);

    // Clean up (optional but good practice)
    // Not strictly needed for static site, but safe
  }
});
