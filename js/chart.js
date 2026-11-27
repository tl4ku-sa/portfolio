// js/chart.js - Jutsu / Technical Radar Chart Configuration
document.addEventListener('DOMContentLoaded', () => {
    const ctx = document.getElementById('skillsRadarChart');
    if (!ctx) return;

    const isMobile = window.innerWidth < 640;

    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: [
                'Tabular ML & Ensembles',
                'Applied Math & Proofs',
                'Numerical Optimization',
                'Algorithms & Data Structs',
                'Systems & Java Dev',
                'Cybersecurity & CTF'
            ],
            datasets: [{
                label: 'Jutsu Mastery Level',
                data: [92, 88, 86, 90, 85, 88],
                backgroundColor: 'rgba(249, 115, 22, 0.22)',
                borderColor: '#F97316',
                borderWidth: 2,
                pointBackgroundColor: '#22D3EE',
                pointBorderColor: '#080B12',
                pointHoverBackgroundColor: '#FFFFFF',
                pointHoverBorderColor: '#F97316',
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: isMobile ? 1 : 1.15,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(13, 18, 31, 0.95)',
                    titleColor: '#F97316',
                    bodyColor: '#E2E8F0',
                    borderColor: 'rgba(249, 115, 22, 0.4)',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false
                }
            },
            scales: {
                r: {
                    angleLines: {
                        color: 'rgba(241, 245, 249, 0.12)'
                    },
                    grid: {
                        color: 'rgba(241, 245, 249, 0.08)'
                    },
                    pointLabels: {
                        color: '#94A3B8',
                        font: {
                            family: 'Space Grotesk, sans-serif',
                            size: isMobile ? 10 : 11,
                            weight: '600'
                        }
                    },
                    ticks: {
                        display: false,
                        stepSize: 20
                    },
                    min: 0,
                    max: 100
                }
            }
        }
    });
});