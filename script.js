document.addEventListener('DOMContentLoaded', function () {
    // ===== MOBILE NAVIGATION TOGGLE =====
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');

    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            const isMenuOpen = navMenu.classList.contains('active');
            navToggle.setAttribute('aria-expanded', isMenuOpen);
            
            const bars = navToggle.querySelectorAll('.bar');
            if (isMenuOpen) {
                bars[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
                bars[1].style.opacity = '0';
                bars[2].style.transform = 'rotate(-45deg) translate(7px, -6px)';
            } else {
                bars[0].style.transform = 'none';
                bars[1].style.opacity = '1';
                bars[2].style.transform = 'none';
            }
        });

        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                navToggle.setAttribute('aria-expanded', 'false');
                const bars = navToggle.querySelectorAll('.bar');
                bars[0].style.transform = 'none';
                bars[1].style.opacity = '1';
                bars[2].style.transform = 'none';
            });
        });
    }

    // ===== FAUCET FILTERING (UNIFIED FOR DESKTOP + MOBILE DROPDOWNS) =====
    const allCards = document.querySelectorAll('.faucet-card');
    let activeCoin = 'all';
    let activeTimer = 'all';

    // Get all select elements (desktop + mobile)
    const coinSelects = [
        document.getElementById('coinFilterSelect'),
        document.getElementById('coinFilterSelectDesktop')
    ].filter(el => el);

    const timerSelects = [
        document.getElementById('timerFilterSelect'),
        document.getElementById('timerFilterSelectDesktop')
    ].filter(el => el);

    function syncSelects(selects, value) {
        selects.forEach(sel => {
            if (sel.value !== value) sel.value = value;
        });
    }

    function filterFaucets() {
        allCards.forEach(card => {
            const cardCoins = card.dataset.coins ? card.dataset.coins.split(',').map(c => c.trim()) : [];
            const cardTimer = (card.dataset.timer || '').trim();

            const coinMatch = activeCoin === 'all' || cardCoins.includes(activeCoin);
            const timerMatch = activeTimer === 'all' || cardTimer === activeTimer;

            if (coinMatch && timerMatch) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    // Attach change listeners to all selects
    coinSelects.forEach(select => {
        select.addEventListener('change', function () {
            activeCoin = this.value;
            syncSelects(coinSelects, activeCoin);
            filterFaucets();
        });
    });

    timerSelects.forEach(select => {
        select.addEventListener('change', function () {
            activeTimer = this.value;
            syncSelects(timerSelects, activeTimer);
            filterFaucets();
        });
    });

    // Initial filter
    filterFaucets();

    // ===== SCROLL TO TOP BUTTON =====
    let scrollToTopBtn = document.getElementById('scrollToTop');
    if (!scrollToTopBtn) {
        scrollToTopBtn = document.createElement('button');
        scrollToTopBtn.innerHTML = '↑';
        scrollToTopBtn.setAttribute('aria-label', 'Scroll to top');
        scrollToTopBtn.id = 'scrollToTop';
        scrollToTopBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--primary);
            color: white;
            border: none;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            font-size: 24px;
            cursor: pointer;
            display: none;
            z-index: 1000;
            transition: all 0.3s ease;
            box-shadow: var(--shadow-lg);
            align-items: center;
            justify-content: center;
        `;
        document.body.appendChild(scrollToTopBtn);
    }

    window.addEventListener('scroll', () => {
        scrollToTopBtn.style.display = window.pageYOffset > 300 ? 'flex' : 'none';
    });

    scrollToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});
