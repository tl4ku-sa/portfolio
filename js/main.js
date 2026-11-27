document.addEventListener('DOMContentLoaded', () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scrollOverlay = document.getElementById('scrollOverlay');
    const scrollStage = document.getElementById('scrollStage');
    const activeScrollLabel = document.getElementById('activeScrollLabel');
    const closeScrollBtn = document.getElementById('closeScrollBtn');
    const homeMapBtn = document.getElementById('homeMapBtn');
    const recenterBtn = document.getElementById('recenterBtn');
    const mobileNavBtn = document.getElementById('mobileNavBtn');
    const mobileNavDrawer = document.getElementById('mobileNavDrawer');
    const panels = document.querySelectorAll('.scroll-content-panel');

    const labels = {
        about: 'SCROLL 01 // LEAF OUTPOST & DOSSIER',
        education: 'SCROLL 02 // WITS ACADEMY & MODULES',
        skills: 'SCROLL 03 // CHAKRA DOJO MATRIX',
        awards: 'SCROLL 04 // HALL OF HONOURS',
        projects: 'SCROLL 05 // COMPLETED MISSIONS',
        contact: 'SCROLL 06 // SUMMONING SHRINE'
    };

    function showScrollForLocation(id) {
        if (!scrollOverlay || !scrollStage) return;

        panels.forEach((panel) => {
            panel.classList.toggle('hidden', panel.getAttribute('data-panel') !== id);
        });

        if (activeScrollLabel) {
            activeScrollLabel.textContent = labels[id] || 'SHINOBI SCROLL';
        }

        scrollOverlay.classList.remove('hidden');
        scrollOverlay.scrollTop = 0;

        if (!prefersReducedMotion) {
            scrollStage.classList.remove('scroll-panel-active');
            void scrollStage.offsetWidth;
            scrollStage.classList.add('scroll-panel-active');

            window.clearTimeout(scrollStage._timer);
            scrollStage._timer = window.setTimeout(() => {
                scrollStage.classList.remove('scroll-panel-active');
            }, 780);
        }
    }

    window.openLocationScroll = function (id) {
        mobileNavDrawer?.classList.add('hidden');
        if (window.ShinobiMap && !prefersReducedMotion) {
            window.ShinobiMap.focusLocation(id, () => showScrollForLocation(id));
        } else {
            showScrollForLocation(id);
        }
    };

    function closeScrollToMap() {
        if (!scrollOverlay) return;
        scrollOverlay.classList.add('hidden');
        window.ShinobiMap?.resetView();
    }

    document.querySelectorAll('.loc-pill').forEach((btn) => {
        btn.addEventListener('click', () => {
            const locId = btn.getAttribute('data-loc');
            if (locId) window.openLocationScroll(locId);
        });
    });

    closeScrollBtn?.addEventListener('click', closeScrollToMap);
    homeMapBtn?.addEventListener('click', closeScrollToMap);
    recenterBtn?.addEventListener('click', () => {
        closeScrollToMap();
        window.ShinobiMap?.resetView();
    });

    scrollOverlay?.addEventListener('click', (e) => {
        if (e.target === scrollOverlay) closeScrollToMap();
    });

    mobileNavBtn?.addEventListener('click', () => {
        mobileNavDrawer?.classList.toggle('hidden');
    });

    // Project Category Filters
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
                card.classList.toggle('hidden', filter !== 'all' && !card.classList.contains(filter));
            });
        });
    });

    // Mission Detail Modal
    const modal = document.getElementById('missionModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const modalTitle = document.getElementById('modalTitle');
    const modalRank = document.getElementById('modalRank');
    const modalBrief = document.getElementById('modalBrief');
    const modalStack = document.getElementById('modalStack');

    projectCards.forEach((card) => {
        card.addEventListener('click', (e) => {
            e.stopPropagation();
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

    closeModalBtn?.addEventListener('click', hideModal);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) hideModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (modal && !modal.classList.contains('hidden')) {
                hideModal();
            } else if (scrollOverlay && !scrollOverlay.classList.contains('hidden')) {
                closeScrollToMap();
            }
        }
    });
});