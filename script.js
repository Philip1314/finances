// IMPORTANT: Use the new "Publish to web" CSV URL you provided.
// This URL directly serves the Google Sheet data as a CSV file.
const DATA_SOURCE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgMFbI8pivLbRpc2nL2Gyoxw47PmXEVxvUDrjr-t86gj4-J3QM8uV7m8iJN9wxlYo3IY5FQqqUICei/pub?gid=1509511408&single=true&output=csv';

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

// --- Theme Toggling Logic (No changes) ---
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
    applyFilters();
}

function updateThemeIcon() {
    if (document.body.classList.contains('dark-mode')) {
        elements.themeIcon.textContent = 'light_mode';
        elements.themeToggleBtn.setAttribute('title', 'Switch to Light Mode');
    } else {
        elements.themeIcon.textContent = 'dark_mode';
        elements.themeToggleBtn.setAttribute('title', 'Switch to Dark Mode');
    }
}
// --- End Theme Toggling Logic ---


// --- CSV Data Fetching and Parsing ---
async function fetchDataAndRender() {
    try {
        const response = await fetch(DATA_SOURCE_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        const parsedData = parseCSV(csvText); // Parse the CSV text
        allTransactions = preprocessData(parsedData);
        populateCategoryFilter(allTransactions);
        applyFilters();
    } catch (error) {
        console.error('Error fetching or parsing data:', error);
        alert('Failed to load financial data. Please check your internet connection or the Google Sheet CSV link.');
    }
}

function parseCSV(csvString) {
    const lines = csvString.split(/\r?\n/).filter(line => line.trim() !== ''); // Split by new line, remove empty lines
    if (lines.length < 2) {
        console.warn('CSV data is empty or only has headers.');
        return [];
    }

    const headers = lines[0].split(',').map(header => header.trim()); // Trim headers
    const dataRows = lines.slice(1);

    return dataRows.map(row => {
        const values = row.split(','); // Simple split by comma
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index] ? values[index].trim() : ''; // Assign value, trim whitespace
        });
        return obj;
    });
}
// --- End CSV Data Fetching and Parsing ---


function preprocessData(data) {
    // Note: CSV doesn't have a "Timestamp" column directly from the form submission,
    // so we'll sort primarily by 'Date' and then by a derived 'time' if possible,
    // or just assume the order provided by the CSV.
    // Assuming 'Timestamp' is actually the form submission timestamp in the spreadsheet,
    // and 'Date' is the date entered by the user. If your CSV only has 'Date',
    // then sorting by 'Date' will be the primary sort key.
    return data.map(item => ({
        // The 'Timestamp' column from Apps Script's automatic addition might not exist in CSV.
        // If it exists, use it. Otherwise, rely on 'Date' for sorting.
        timestamp: item.Timestamp ? new Date(item.Timestamp) : new Date(item.Date), // Use Timestamp if available, else Date
        date: parseDateString(item.Date),
        amount: parseFloat(item.Amount || 0),
        type: item.Type,
        category: item['What kind?'] // Accessing column with spaces
    })).sort((a, b) => b.timestamp - a.timestamp); // Sort by most recent first
}

function parseDateString(dateStr) {
    const formats = [
        'MM/dd/yyyy', // e.g., 05/23/2025 (common from Google Sheets)
        'yyyy-MM-dd', // e.g., 2025-05-23
        'MMM dd,yyyy', // e.g., May 23,2025
        'MMM dd,PPPP', // e.g., May 23, 2025 (date-fns format)
        'dd MMM PPPP',  // e.g., 23 May 2025 (date-fns format)
        'yyyy/MM/dd' // e.g., 2025/05/23
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
    const expensesMap = {};
    transactions.filter(t => t.type === 'Expenses').forEach(t => {
        expensesMap[t.category] = (expensesMap[t.category] || 0) + t.amount;
    });
    renderPieChart('expensesByCategoryChart', 'Expenses by Category', Object.keys(expensesMap), Object.values(expensesMap), 'Expenses');

    const gainsMap = {};
    transactions.filter(t => t.type === 'Gains').forEach(t => {
        gainsMap[t.category] = (gainsMap[t.category] || 0) + t.amount;
    });
    renderPieChart('gainsByCategoryChart', 'Gains by Category', Object.keys(gainsMap), Object.values(gainsMap), 'Gains');

    const balanceData = calculateBalanceTrend(transactions);
    renderLineChart('balanceTrendChart', 'Overall Balance Trend', balanceData.labels, balanceData.balances);
}

function renderPieChart(canvasId, title, labels, data, type) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (window[canvasId + 'ChartInstance']) {
        window[canvasId + 'ChartInstance'].destroy();
    }

    const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';

    const chartColorPalettes = {
        light: {
            expenses: [
                '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCE', '#F7464A', '#46BFBD', '#FDB45C',
                '#A3E4D7', '#F1948A', '#D7BDE2', '#C0392B', '#2ECC71', '#F5B041', '#BB8FCE', '#76D7C4'
            ],
            gains: [
                '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#795548', '#9E9E9E', '#607D8B',
                '#58D68D', '#AED6F1', '#F4D03F', '#D35400', '#9B59B6', '#1ABC9C', '#EC7063', '#AF7AC5'
            ],
            tooltipBg: 'rgba(0, 0, 0, 0.8)',
            tooltipText: '#ffffff',
            textColor: '#333'
        },
        dark: {
            expenses: [
                '#9C27B0', '#673AB7', '#2196F3', '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107',
                '#DDA0DD', '#8A2BE2', '#6A5ACD', '#483D8B', '#7B68EE', '#ADFF2F', '#7FFF00', '#DFFF00'
            ],
            gains: [
                '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#795548', '#9E9E9E', '#607D8B',
                '#2E8B57', '#3CB371', '#66CDAA', '#00FA9A', '#7CFC00', '#ADFF2F', '#32CD32', '#00FF7F'
            ],
            tooltipBg: 'rgba(255, 255, 255, 0.9)',
            tooltipText: '#333333',
            textColor: '#E0E0E0'
        }
    };

    const activePalette = currentTheme === 'dark' ? chartColorPalettes.dark : chartColorPalettes.light;
    const backgroundColors = type === 'Expenses' ? activePalette.expenses : activePalette.gains;

    while (backgroundColors.length < labels.length) {
        backgroundColors.push(getRandomColor());
    }

    window[canvasId + 'ChartInstance'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors.slice(0, labels.length),
                hoverOffset: 10
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
                            size: 14
                        }
                    }
                },
                title: {
                    display: true,
                    text: title,
                    color: activePalette.textColor,
                    font: {
                        size: 16
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
                        },
                        afterLabel: function(context) {
                            const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(2) + '%';
                            return `(${percentage})`;
                        }
                    }
                }
            },
            cutout: '60%',
            animation: {
                animateScale: true,
                animateRotate: true
            }
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
    const chartStyling = {
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

    const activeColors = currentTheme === 'dark' ? chartStyling.dark : chartStyling.light;

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
                tension: 0.2,
                pointRadius: 3,
                pointHoverRadius: 5
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
                        size: 16
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
                        tooltipFormat: 'MMM dd,yyyy',
                        displayFormats: {
                            day: 'MMM dd'
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
                        callback: function(value) {
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
    return amount.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(date) {
    if (!date || isNaN(date.getTime())) {
        return 'Invalid Date';
    }
    return dateFns.format(date, 'MMM dd,yyyy');
}
