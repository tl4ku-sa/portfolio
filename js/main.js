// js/main.js
document.addEventListener('DOMContentLoaded', () => {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const projectCards = document.querySelectorAll('.project-card');

    if (!filterButtons.length || !projectCards.length) {
        return;
    }

    const activeClasses = ['bg-cyan-500/10', 'text-cyan-400', 'border-cyan-500/30'];
    const inactiveClasses = ['bg-slate-900', 'text-slate-400', 'border-slate-800'];

    function setActiveButton(selectedButton) {
        filterButtons.forEach((button) => {
            const isSelected = button === selectedButton;
            button.setAttribute('aria-pressed', String(isSelected));
            button.classList.remove(...activeClasses, ...inactiveClasses);

            if (isSelected) {
                button.classList.add(...activeClasses);
            } else {
                button.classList.add(...inactiveClasses);
            }
        });
    }

    function filterProjects(category) {
        projectCards.forEach((card) => {
            const shouldShow = category === 'all' || card.classList.contains(category);
            card.classList.toggle('hidden', !shouldShow);
        });
    }

    // Initialize default filter state on load
    const initialActive = document.querySelector('.filter-btn.active') || filterButtons[0];
    if (initialActive) {
        setActiveButton(initialActive);
        filterProjects(initialActive.dataset.filter || 'all');
    }

    filterButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const category = button.dataset.filter || 'all';
            setActiveButton(button);
            filterProjects(category);
        });
    });
});