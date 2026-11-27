// js/chart.js
document.addEventListener('DOMContentLoaded', () => {
    const chartCanvas = document.getElementById('skillsRadarChart');

    // Safely exit if the radar canvas isn't present on the page
    if (!chartCanvas || typeof Chart === 'undefined') {
        return;
    }

    const ctx = chartCanvas.getContext('2d');

    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: [
                'Tabular ML & Ensembles',
                'Numerical Optimization',
                'Algorithms & DSA',
                'Applied Math',
                'Cybersecurity & CTFs',
                'Software & Git'
            ],
            datasets: [
                {
                    label: 'Current Focus (0–100)',
                    data: [90, 86, 84, 85, 78, 80],
                    fill: true,
                    backgroundColor: 'rgba(6, 182, 212, 0.20)',
                    borderColor: '#06B6D4',
                    borderWidth: 2,
                    pointBackgroundColor: '#8B5CF6',
                    pointBorderColor: '#F8FAFC',
                    pointHoverBackgroundColor: '#F8FAFC',
                    pointHoverBorderColor: '#06B6D4',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                r: {
                    min: 0,
                    max: 100,
                    beginAtZero: true,
                    angleLines: {
                        color: 'rgba(148, 163, 184, 0.14)'
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.14)'
                    },
                    pointLabels: {
                        color: '#CBD5E1',
                        font: {
                            family: 'Inter, system-ui, sans-serif',
                            size: 12,
                            weight: '500'
                        }
                    },
                    ticks: {
                        display: false,
                        stepSize: 20
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#F8FAFC',
                    bodyColor: '#67E8F9',
                    borderColor: 'rgba(6, 182, 212, 0.35)',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false,
                    callbacks: {
                        label: (context) => `Score: ${context.parsed.r} / 100`
                    }
                }
            }
        }
    });
});