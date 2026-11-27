document.addEventListener('DOMContentLoaded', () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function unfurlSection(section) {
        if (!section) return;
        section.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });

        if (prefersReducedMotion) return;

        section.classList.remove('scroll-unfurling');
        // Force reflow so clicking the same nav item again replays the animation
        void section.offsetWidth;
        section.classList.add('scroll-unfurling');

        window.clearTimeout(section._unfurlTimer);
        section._unfurlTimer = window.setTimeout(() => {
            section.classList.remove('scroll-unfurling');
        }, 650);
    }

    // 1. Intercept internal anchor links (navbar, mobile menu, hero CTAs)
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', (e) => {
            const targetId = anchor.getAttribute('href');
            if (!targetId || targetId === '#') return;

            const targetSection = document.querySelector(targetId);
            if (!targetSection) return;

            e.preventDefault();
            unfurlSection(targetSection);
        });
    });

    // 2. Category Filter Buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    const projectCards = document.querySelectorAll('.project-card');

    filterButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const filter = btn.getAttribute('data-filter');

            filterButtons.forEach((b) => {
                b.classList.remove('active', 'bg-orange-500/15', 'text-orange-400', 'border-orange-500/40');
                b.classList.add('bg-slate-900', 'text-slate-400', 'border-slate-800');
            });

            btn.classList.remove('bg-slate-900', 'text-slate-400', 'border-slate-800');
            btn.classList.add('active', 'bg-orange-500/15', 'text-orange-400', 'border-orange-500/40');

            projectCards.forEach((card) => {
                if (filter === 'all' || card.classList.contains(filter)) {
                    card.classList.remove('hidden');
                } else {
                    card.classList.add('hidden');
                }
            });
        });
    });

    // 3. Mobile Menu Toggle
    const menuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const iconOpen = document.getElementById('menuIconOpen');
    const iconClose = document.getElementById('menuIconClose');

    if (menuBtn && mobileMenu) {
        menuBtn.addEventListener('click', () => {
            const isHidden = mobileMenu.classList.toggle('hidden');
            menuBtn.setAttribute('aria-expanded', String(!isHidden));
            iconOpen?.classList.toggle('hidden', !isHidden);
            iconClose?.classList.toggle('hidden', isHidden);
        });

        document.querySelectorAll('.mobile-nav-link').forEach((link) => {
            link.addEventListener('click', () => {
                mobileMenu.classList.add('hidden');
                menuBtn.setAttribute('aria-expanded', 'false');
                iconOpen?.classList.remove('hidden');
                iconClose?.classList.add('hidden');
            });
        });
    }

    // 4. Mission Scroll Modal
    const modal = document.getElementById('missionModal');
    const closeBtn = document.getElementById('closeModalBtn');
    const modalTitle = document.getElementById('modalTitle');
    const modalRank = document.getElementById('modalRank');
    const modalBrief = document.getElementById('modalBrief');
    const modalStack = document.getElementById('modalStack');

    projectCards.forEach((card) => {
        card.addEventListener('click', () => {
            if (!modal) return;
            modalTitle.textContent = card.getAttribute('data-title') || '';
            modalRank.textContent = card.getAttribute('data-rank') || '';
            modalBrief.textContent = card.getAttribute('data-brief') || '';
            modalStack.textContent = card.getAttribute('data-stack') || '';
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        });
    });

    const hideModal = () => {
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    };

    closeBtn?.addEventListener('click', hideModal);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) hideModal();
    });
});