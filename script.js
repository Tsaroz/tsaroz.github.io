// ===== MOBILE NAVIGATION TOGGLE =====
document.addEventListener('DOMContentLoaded', function () {
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');

    if (!navToggle || !navMenu) return;

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

    // Close menu on link click
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

    // ===== FAUCET FILTERING WITH BUTTONS & DROPDOWNS =====
    const coinButtons = document.querySelectorAll('#coinFilters .filter-btn');
    const timerButtons = document.querySelectorAll('#timerFilters .filter-btn');
    const coinSelect = document.getElementById('coinFilterSelect');
    const timerSelect = document.getElementById('timerFilterSelect');
    const allCards = document.querySelectorAll('.faucet-card');

    let activeCoin = 'all';
    let activeTimer = 'all';

    function filterFaucets() {
        allCards.forEach(card => {
            const cardCoins = card.dataset.coins ? card.dataset.coins.split(',') : [];
            const cardTimer = card.dataset.timer || '';

            const coinMatch = activeCoin === 'all' ||
                cardCoins.includes(activeCoin) ||
                (activeCoin !== 'all' && cardCoins.includes('ALL'));

            const timerMatch = activeTimer === 'all' || cardTimer === activeTimer;

            if (coinMatch && timerMatch) {
                card.classList.remove('filtered-out');
            } else {
                card.classList.add('filtered-out');
            }
        });
    }

    // Desktop button handlers
    coinButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            coinButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            activeCoin = this.dataset.filter;
            if (coinSelect) {
                coinSelect.value = activeCoin;
            }
            filterFaucets();
        });
    });

    timerButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            timerButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            activeTimer = this.dataset.filter;
            if (timerSelect) {
                timerSelect.value = activeTimer;
            }
            filterFaucets();
        });
    });

    // Mobile dropdown handlers
    if (coinSelect) {
        coinSelect.addEventListener('change', function () {
            activeCoin = this.value;
            // Update desktop buttons if visible
            coinButtons.forEach(btn => {
                if (btn.dataset.filter === activeCoin) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            filterFaucets();
        });
    }

    if (timerSelect) {
        timerSelect.addEventListener('change', function () {
            activeTimer = this.value;
            // Update desktop buttons if visible
            timerButtons.forEach(btn => {
                if (btn.dataset.filter === activeTimer) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            filterFaucets();
        });
    }

    // Initial filter on load
    filterFaucets();

    // ===== SCROLL TO TOP BUTTON =====
    function createScrollToTop() {
        const scrollToTopBtn = document.createElement('button');
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
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        document.body.appendChild(scrollToTopBtn);

        window.addEventListener('scroll', function () {
            if (window.pageYOffset > 300) {
                scrollToTopBtn.style.display = 'flex';
                scrollToTopBtn.style.alignItems = 'center';
                scrollToTopBtn.style.justifyContent = 'center';
            } else {
                scrollToTopBtn.style.display = 'none';
            }
        });

        scrollToTopBtn.addEventListener('click', function () {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    createScrollToTop();
});
