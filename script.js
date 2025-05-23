// IMPORTANT: Replace this with the Web app URL you got from Google Apps Script deployment
const GOOGLE_APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE'; // e.g., 'https://script.google.com/macros/s/AKfycb.../exec'

let allTransactions = [];
let expensesByCategoryChart;
let gainsByCategoryChart;
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
    themeToggleBtn: document.getElementById('themeToggle') // New: Theme toggle button
};

document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme based on user's preference or saved setting
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
        document.body.className = savedTheme; // Apply saved theme
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.className = 'dark-mode'; // Apply system dark mode if preferred
    } else {
        document.body.className = 'light-mode'; // Default to light mode
    }
    updateThemeToggleButtonText();
}

function toggleTheme() {
    if (document.body.classList.contains('light-mode')) {
        document.body.className = 'dark-mode';
        localStorage.setItem('theme', 'dark-mode');
    } else {
        document.body.className = 'light-mode';
        localStorage.setItem('theme', 'light-mode');
    }
    updateThemeToggleButtonText();
    // Re-render charts to update their colors
    applyFilters();
}

function updateThemeToggleButtonText() {
    if (document.body.classList.contains('dark-mode')) {
        elements.themeToggleBtn.textContent = 'Switch to Light Mode';
    } else {
        elements.themeToggleBtn.textContent = 'Switch to Dark Mode';
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
        timestamp: new Date(item.Timestamp), // Google Form's timestamp
        date: parseDateString(item.Date), // Assuming 'Date' column is a proper date format
        amount: parseFloat(item.Amount || 0),
        type: item.Type,
        category: item['What kind?'] // Accessing column with spaces
    })).sort((a, b) => b.timestamp - a.timestamp); // Sort by most recent first
}

function parseDateString(dateStr) {
    // Attempt to parse various common date formats
    const formats = [
        'MM/dd/yyyy', // 05/23/2025
        'yyyy-MM-dd', // 2025-05-23
        'MMM dd, yyyy', // May 23, 2025
        'dd MMM yyyy' // 23 May 2025
    ];
    for (const format of formats) {
        const parsed = dateFns.parse(dateStr, format, new Date());
        if (!isNaN(parsed.getTime())) { // Check if parsed date is valid
            return parsed;
        }
    }
    // Fallback if none of the above work, try JavaScript's default Date constructor
    const fallbackDate = new Date(dateStr);
    if (!isNaN(fallbackDate.getTime())) {
        return fallbackDate;
    }
    console.warn('Could not parse date:', dateStr);
    return new Date(0); // Return a default invalid date (epoch)
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

    // Apply class for styling net balance
    elements.netBalanceSpan.classList.remove('negative');
    if (netBalance < 0) {
        elements.netBalanceSpan.classList.add('negative');
    }
}

function updateCharts(transactions) {
    // Expenses by Category
    const expensesMap = {};
    transactions.filter(t => t.type === 'Expenses').forEach(t => {
        expensesMap[t.category] = (expensesMap[t.category] || 0) + t.amount;
    });
    renderPieChart('expensesByCategoryChart', 'Expenses by Category', Object.keys(expensesMap), Object.values(expensesMap), 'Expenses');

    // Gains by Category
    const gainsMap = {};
    transactions.filter(t => t.type === 'Gains').forEach(t => {
        gainsMap[t.category] = (gainsMap[t.category] || 0) + t.amount;
    });
    renderPieChart('gainsByCategoryChart', 'Gains by Category', Object.keys(gainsMap), Object.values(gainsMap), 'Gains');

    // Balance Trend
    const balanceData = calculateBalanceTrend(transactions);
    renderLineChart('balanceTrendChart', 'Overall Balance Trend', balanceData.labels, balanceData.balances);
}

function renderPieChart(canvasId, title, labels, data, type) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (window[canvasId + 'ChartInstance']) {
        window[canvasId + 'ChartInstance'].destroy(); // Destroy previous instance
    }

    const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';

    // Define colors based on theme
    const darkColors = {
        expenses: ['#9C27B0', '#673AB7', '#2196F3', '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107'], // Purples, blues, greens, yellows
        gains: ['#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#795548', '#9E9E9E', '#607D8B'], // Greens, yellows, oranges, browns, grays
        tooltipBg: 'rgba(0, 0, 0, 0.8)',
        tooltipText: '#ffffff'
    };
    const lightColors = {
        expenses: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCE', '#F7464A', '#46BFBD', '#FDB45C'],
        gains: ['#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#795548', '#9E9E9E', '#607D8B'],
        tooltipBg: 'rgba(0, 0, 0, 0.8)',
        tooltipText: '#ffffff'
    };

    const selectedColors = currentTheme === 'dark' ? darkColors : lightColors;
    const backgroundColors = type === 'Expenses' ? selectedColors.expenses : selectedColors.gains;
    const textColor = currentTheme === 'dark' ? '#E0E0E0' : '#333'; // Text color for labels/title

    window[canvasId + 'ChartInstance'] = new Chart(ctx, {
        type: 'doughnut',
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
                        color: textColor // Legend text color
                    }
                },
                title: {
                    display: true,
                    text: title,
                    color: textColor // Title text color
                },
                tooltip: {
                    backgroundColor: selectedColors.tooltipBg,
                    titleColor: selectedColors.tooltipText,
                    bodyColor: selectedColors.tooltipText
                }
            }
        }
    });
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
    const textColor = currentTheme === 'dark' ? '#E0E0E0' : '#333';
    const gridColor = currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'; // Lighter grid for dark mode
    const borderColor = currentTheme === 'dark' ? '#8BC34A' : '#4CAF50'; // Green line, slightly different for dark
    const backgroundColor = currentTheme === 'dark' ? 'rgba(139, 195, 74, 0.2)' : 'rgba(76, 175, 80, 0.2)'; // Fill color

    window[canvasId + 'ChartInstance'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Net Balance',
                data: data,
                borderColor: borderColor,
                backgroundColor: backgroundColor,
                fill: true,
                tension: 0.1
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
                    color: textColor
                },
                tooltip: {
                    backgroundColor: currentTheme === 'dark' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff'
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        tooltipFormat: 'MMM dd, yyyy'
                    },
                    title: {
                        display: true,
                        text: 'Date',
                        color: textColor
                    },
                    ticks: {
                        color: textColor // X-axis tick labels
                    },
                    grid: {
                        color: gridColor // X-axis grid lines
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Balance',
                        color: textColor
                    },
                    ticks: {
                        color: textColor // Y-axis tick labels
                    },
                    grid: {
                        color: gridColor // Y-axis grid lines
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
                <strong>${formatDate(t.date)}</strong>
                <span style="font-size: 0.9em; color: var(--item-text-color);">(${t.category})</span>
            </div>
            <span class="amount">${formatCurrency(t.amount)}</span>
        `;
        elements.transactionsList.appendChild(li);
    });
}

function formatCurrency(amount) {
    return amount.toLocaleString('en-US', { style: 'currency', currency: 'PHP' }); // Use PHP currency
}

function formatDate(date) {
    if (!date || isNaN(date.getTime())) {
        return 'Invalid Date';
    }
    return dateFns.format(date, 'MMM dd, yyyy');
}
