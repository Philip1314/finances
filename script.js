// IMPORTANT: Replace this with the Web app URL you got from Google Apps Script deployment
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz_sJb-XK4B0goS0YdWeOknMWhWj2_uPX_k4MoxgyTMWXo7deU2bF0Zg6pMNJjB0b2_k/exec';

let allTransactions = [];
let expensesByCategoryChart; // Keep these for clarity if you want specific control
let gainsByCategoryChart;   // over their Chart.js instances.
let balanceTrendChart;

const elements = {
    startDate: document.getElementById('startDate'),
    endDate: document.getElementById('endDate'),
    typeFilter: document.getElementById('typeFilter'),
    categoryFilter: document.getElementById('categoryFilter'),
    applyFiltersBtn: document.getElementById('applyFilters'),
    clearFiltersBtn: document.getElementById('clearFilters'),
    totalExpensesSpan: document.getElementById('totalExpenses'),
    totalGainsSpan: document.getElementById('totalGains'),
    netBalanceSpan: document.getElementById('netBalance'),
    transactionsList: document.getElementById('transactionsList'),
    noTransactionsMessage: document.getElementById('noTransactionsMessage'),
    themeToggleBtn: document.getElementById('themeToggle'),
    themeIcon: document.getElementById('themeIcon')
};

document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    elements.themeToggleBtn.addEventListener('click', toggleTheme);

    fetchDataAndRender();
    elements.applyFiltersBtn.addEventListener('click', applyFilters);
    elements.clearFiltersBtn.addEventListener('click', clearFilters);
});

// --- Theme Toggling Logic ---
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.body.className = savedTheme;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.className = 'dark-mode';
    } else {
        document.body.className = 'light-mode';
    }
    updateThemeIcon();
}

function toggleTheme() {
    if (document.body.classList.contains('light-mode')) {
        document.body.className = 'dark-mode';
        localStorage.setItem('theme', 'dark-mode');
    } else {
        document.body.className = 'light-mode';
        localStorage.setItem('theme', 'light-mode');
    }
    updateThemeIcon();
    // Re-render charts to update their colors and scales
    applyFilters();
}

function updateThemeIcon() {
    if (document.body.classList.contains('dark-mode')) {
        elements.themeIcon.textContent = 'light_mode'; // Sun icon for light mode
        elements.themeToggleBtn.setAttribute('title', 'Switch to Light Mode');
    } else {
        elements.themeIcon.textContent = 'dark_mode'; // Moon icon for dark mode
        elements.themeToggleBtn.setAttribute('title', 'Switch to Dark Mode');
    }
}
// --- End Theme Toggling Logic ---


async function fetchDataAndRender() {
    try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        allTransactions = preprocessData(data.data);
        populateCategoryFilter(allTransactions);
        applyFilters(); // Apply initial filters (which means no filters initially)
    } catch (error) {
        console.error('Error fetching data:', error);
        alert('Failed to load financial data. Please check your internet connection or Google Apps Script deployment.');
    }
}

function preprocessData(data) {
    return data.map(item => ({
        timestamp: new Date(item.Timestamp),
        date: parseDateString(item.Date),
        amount: parseFloat(item.Amount || 0),
        type: item.Type,
        category: item['What kind?']
    })).sort((a, b) => b.timestamp - a.timestamp);
}

function parseDateString(dateStr) {
    const formats = [
        'MM/dd/yyyy',
        'yyyy-MM-dd',
        'MMM dd,PPPP', // Using PPPP for full year, like "May 23, 2025"
        'dd MMM PPPP'  // Using PPPP for full year, like "23 May 2025"
    ];
    for (const format of formats) {
        const parsed = dateFns.parse(dateStr, format, new Date());
        if (!isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    const fallbackDate = new Date(dateStr);
    if (!isNaN(fallbackDate.getTime())) {
        return fallbackDate;
    }
    console.warn('Could not parse date:', dateStr);
    return new Date(0);
}


function populateCategoryFilter(transactions) {
    const categories = new Set();
    transactions.forEach(t => {
        if (t.category) {
            categories.add(t.category);
        }
    });
    elements.categoryFilter.innerHTML = '<option value="">All</option>';
    Array.from(categories).sort().forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        elements.categoryFilter.appendChild(option);
    });
}

function applyFilters() {
    const startDate = elements.startDate.value ? dateFns.startOfDay(new Date(elements.startDate.value)) : null;
    const endDate = elements.endDate.value ? dateFns.endOfDay(new Date(elements.endDate.value)) : null;
    const typeFilter = elements.typeFilter.value;
    const categoryFilter = elements.categoryFilter.value;

    const filteredTransactions = allTransactions.filter(t => {
        const transactionDate = t.date;

        if (startDate && transactionDate < startDate) return false;
        if (endDate && transactionDate > endDate) return false;
        if (typeFilter && t.type !== typeFilter) return false;
        if (categoryFilter && t.category !== categoryFilter) return false;
        return true;
    });

    renderDashboard(filteredTransactions);
}

function clearFilters() {
    elements.startDate.value = '';
    elements.endDate.value = '';
    elements.typeFilter.value = '';
    elements.categoryFilter.value = '';
    applyFilters();
}

function renderDashboard(transactions) {
    updateSummary(transactions);
    updateCharts(transactions);
    updateTransactionsList(transactions);
}

function updateSummary(transactions) {
    let totalExpenses = 0;
    let totalGains = 0;

    transactions.forEach(t => {
        if (t.type === 'Expenses') {
            totalExpenses += t.amount;
        } else if (t.type === 'Gains') {
            totalGains += t.amount;
        }
    });

    const netBalance = totalGains - totalExpenses;

    elements.totalExpensesSpan.textContent = formatCurrency(totalExpenses);
    elements.totalGainsSpan.textContent = formatCurrency(totalGains);
    elements.netBalanceSpan.textContent = formatCurrency(netBalance);

    elements.netBalanceSpan.classList.remove('negative');
    if (netBalance < 0) {
        elements.netBalanceSpan.classList.add('negative');
    }
}

function updateCharts(transactions) {
    // Expenses by Category (Donut Chart)
    const expensesMap = {};
    transactions.filter(t => t.type === 'Expenses').forEach(t => {
        expensesMap[t.category] = (expensesMap[t.category] || 0) + t.amount;
    });
    renderPieChart('expensesByCategoryChart', 'Expenses by Category', Object.keys(expensesMap), Object.values(expensesMap), 'Expenses');

    // Gains by Category (Donut Chart)
    const gainsMap = {};
    transactions.filter(t => t.type === 'Gains').forEach(t => {
        gainsMap[t.category] = (gainsMap[t.category] || 0) + t.amount;
    });
    renderPieChart('gainsByCategoryChart', 'Gains by Category', Object.keys(gainsMap), Object.values(gainsMap), 'Gains');

    // Balance Trend (Line Chart)
    const balanceData = calculateBalanceTrend(transactions);
    renderLineChart('balanceTrendChart', 'Overall Balance Trend', balanceData.labels, balanceData.balances);
}

function renderPieChart(canvasId, title, labels, data, type) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (window[canvasId + 'ChartInstance']) {
        window[canvasId + 'ChartInstance'].destroy();
    }

    const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';

    const chartColors = {
        light: {
            expensesPalette: [
                '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCE', '#F7464A', '#46BFBD', '#FDB45C'
            ],
            gainsPalette: [
                '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#795548', '#9E9E9E', '#607D8B'
            ],
            tooltipBg: 'rgba(0, 0, 0, 0.8)',
            tooltipText: '#ffffff',
            textColor: '#333'
        },
        dark: {
            expensesPalette: [
                '#9C27B0', '#673AB7', '#2196F3', '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107'
            ],
            gainsPalette: [
                '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#795548', '#9E9E9E', '#607D8B'
            ],
            tooltipBg: 'rgba(255, 255, 255, 0.9)',
            tooltipText: '#333333',
            textColor: '#E0E0E0'
        }
    };

    const activePalette = currentTheme === 'dark' ? chartColors.dark : chartColors.light;
    const backgroundColors = type === 'Expenses' ? activePalette.expensesPalette : activePalette.gainsPalette;

    // Dynamically generate colors if more categories than predefined colors
    while (backgroundColors.length < labels.length) {
        backgroundColors.push(getRandomColor());
    }

    window[canvasId + 'ChartInstance'] = new Chart(ctx, {
        type: 'doughnut', // Changed to 'doughnut' for donut chart
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors.slice(0, labels.length)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: activePalette.textColor,
                        font: {
                            size: 14 // Larger legend font size
                        }
                    }
                },
                title: {
                    display: true,
                    text: title,
                    color: activePalette.textColor,
                    font: {
                        size: 16 // Larger title font size
                    }
                },
                tooltip: {
                    backgroundColor: activePalette.tooltipBg,
                    titleColor: activePalette.tooltipText,
                    bodyColor: activePalette.tooltipText,
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += formatCurrency(context.parsed);
                            }
                            return label;
                        }
                    }
                }
            },
            cutout: '60%' // Makes it a donut chart (60% hole in the center)
        }
    });
}

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}


function calculateBalanceTrend(transactions) {
    const sortedTransactions = [...transactions].sort((a, b) => a.date - b.date);

    const dailyBalances = {};
    let currentBalance = 0;

    sortedTransactions.forEach(t => {
        const dateKey = dateFns.format(t.date, 'yyyy-MM-dd');
        if (t.type === 'Gains') {
            currentBalance += t.amount;
        } else if (t.type === 'Expenses') {
            currentBalance -= t.amount;
        }
        dailyBalances[dateKey] = currentBalance;
    });

    const labels = Object.keys(dailyBalances).sort();
    const balances = labels.map(label => dailyBalances[label]);

    return { labels, balances };
}

function renderLineChart(canvasId, title, labels, data) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (window[canvasId + 'ChartInstance']) {
        window[canvasId + 'ChartInstance'].destroy();
    }

    const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    const chartColors = {
        light: {
            textColor: '#333',
            gridColor: 'rgba(0, 0, 0, 0.1)',
            borderColor: '#4CAF50',
            backgroundColor: 'rgba(76, 175, 80, 0.2)',
            tooltipBg: 'rgba(0, 0, 0, 0.8)',
            tooltipText: '#ffffff'
        },
        dark: {
            textColor: '#E0E0E0',
            gridColor: 'rgba(255, 255, 255, 0.15)',
            borderColor: '#8BC34A',
            backgroundColor: 'rgba(139, 195, 74, 0.25)',
            tooltipBg: 'rgba(255, 255, 255, 0.9)',
            tooltipText: '#333333'
        }
    };

    const activeColors = currentTheme === 'dark' ? chartColors.dark : chartColors.light;

    window[canvasId + 'ChartInstance'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Net Balance',
                data: data,
                borderColor: activeColors.borderColor,
                backgroundColor: activeColors.backgroundColor,
                fill: true,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
                title: {
                    display: true,
                    text: title,
                    color: activeColors.textColor,
                    font: {
                        size: 16 // Larger title font size
                    }
                },
                tooltip: {
                    backgroundColor: activeColors.tooltipBg,
                    titleColor: activeColors.tooltipText,
                    bodyColor: activeColors.tooltipText,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += formatCurrency(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        tooltipFormat: 'MMM dd,PPPP', // Consistent date format for tooltip
                        displayFormats: {
                            day: 'MMM dd' // Display format on axis
                        }
                    },
                    title: {
                        display: true,
                        text: 'Date',
                        color: activeColors.textColor,
                        font: {
                            size: 14
                        }
                    },
                    ticks: {
                        color: activeColors.textColor,
                        font: {
                            size: 12
                        }
                    },
                    grid: {
                        color: activeColors.gridColor
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Balance',
                        color: activeColors.textColor,
                        font: {
                            size: 14
                        }
                    },
                    ticks: {
                        color: activeColors.textColor,
                        callback: function(value) { // Format Y-axis labels as currency
                            return formatCurrency(value);
                        },
                        font: {
                            size: 12
                        }
                    },
                    grid: {
                        color: activeColors.gridColor
                    }
                }
            }
        }
    });
}


function updateTransactionsList(transactions) {
    elements.transactionsList.innerHTML = '';
    if (transactions.length === 0) {
        elements.noTransactionsMessage.style.display = 'block';
        return;
    }
    elements.noTransactionsMessage.style.display = 'none';

    transactions.forEach(t => {
        const li = document.createElement('li');
        li.classList.add(t.type === 'Expenses' ? 'expense' : 'gain');
        li.innerHTML = `
            <div>
                <strong style="color: var(--text-color);">${formatDate(t.date)}</strong>
                <span style="font-size: 0.9em; color: var(--item-text-color);">${t.category ? `(${t.category})` : ''}</span>
            </div>
            <span class="amount">${formatCurrency(t.amount)}</span>
        `;
        elements.transactionsList.appendChild(li);
    });
}

function formatCurrency(amount) {
    // Format as Philippine Peso (PHP)
    return amount.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(date) {
    if (!date || isNaN(date.getTime())) {
        return 'Invalid Date';
    }
    return dateFns.format(date, 'MMM dd,PPPP'); // Using PPPP for full year, e.g., "May 23, 2025"
}
