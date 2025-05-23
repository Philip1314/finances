// IMPORTANT: This is the updated Web app URL you provided from your Google Apps Script deployment.
// This URL allows your GitHub Pages site to fetch data from your Google Sheet.
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwDjekBwORIdAoW1wtZ__KjiXx_e46oiqrxT9W9nR7i3xlSFh2sEFv46NJDbs0Z_bJY/exec';

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
    themeIcon: document.getElementById('themeIcon') // Reference to the Material Icon <i> tag
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
    updateThemeIcon(); // Set the correct icon on page load
}

function toggleTheme() {
    if (document.body.classList.contains('light-mode')) {
        document.body.className = 'dark-mode';
        localStorage.setItem('theme', 'dark-mode');
    } else {
        document.body.className = 'light-mode';
        localStorage.setItem('theme', 'light-mode');
    }
    updateThemeIcon(); // Change the icon when theme is toggled
    // Re-render charts to update their colors based on the new theme
    applyFilters();
}

function updateThemeIcon() {
    if (document.body.classList.contains('dark-mode')) {
        elements.themeIcon.textContent = 'light_mode'; // Display sun icon for light mode
        elements.themeToggleBtn.setAttribute('title', 'Switch to Light Mode');
    } else {
        elements.themeIcon.textContent = 'dark_mode'; // Display moon icon for dark mode
        elements.themeToggleBtn.setAttribute('title', 'Switch to Dark Mode');
    }
}
// --- End Theme Toggling Logic ---


async function fetchDataAndRender() {
    try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL);
        if (!response.ok) {
            // Check for specific non-OK status codes if needed for more granular error messages
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
        category: item['What kind?'] // Accessing column with spaces, e.g., "What kind?"
    })).sort((a, b) => b.timestamp - a.timestamp); // Sort by most recent first
}

function parseDateString(dateStr) {
    // Attempt to parse various common date formats provided by Google Forms/Sheets
    const formats = [
        'MM/dd/yyyy', // e.g., 05/23/2025
        'yyyy-MM-dd', // e.g., 2025-05-23
        'MMM dd,yyyy', // e.g., May 23,2025
        'MMM dd, yyyy', // e.g., May 23, 2025 (with space)
        'dd MMM yyyy',  // e.g., 23 May 2025
        'yyyy/MM/dd' // e.g., 2025/05/23
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
    const categories = new new Set();
    transactions.forEach(t => {
        if (t.category) {
            categories.add(t.category);
        }
    });
    elements.categoryFilter.innerHTML = '<option value="">All</option>'; // Always have an "All" option
    Array.from(categories).sort().forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        elements.categoryFilter.appendChild(option);
    });
}

function applyFilters() {
    // Ensure date filters cover the whole day
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
    applyFilters(); // Re-render dashboard with no filters
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

    // Apply class for styling net balance (e.g., red for negative)
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
        window[canvasId + 'ChartInstance'].destroy(); // Destroy previous chart instance to re-render
    }

    const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';

    // Define color palettes for charts based on theme
    const chartColorPalettes = {
        light: {
            expenses: [
                '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCE', '#F7464A', '#46BFBD', '#FDB45C',
                '#A3E4D7', '#F1948A', '#D7BDE2', '#C0392B', '#2ECC71', '#F5B041', '#BB8FCE', '#76D7C4' // More colors
            ],
            gains: [
                '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#795548', '#9E9E9E', '#607D8B',
                '#58D68D', '#AED6F1', '#F4D03F', '#D35400', '#9B59B6', '#1ABC9C', '#EC7063', '#AF7AC5' // More colors
            ],
            tooltipBg: 'rgba(0, 0, 0, 0.8)',
            tooltipText: '#ffffff',
            textColor: '#333'
        },
        dark: {
            expenses: [
                '#9C27B0', '#673AB7', '#2196F3', '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107',
                '#DDA0DD', '#8A2BE2', '#6A5ACD', '#483D8B', '#7B68EE', '#ADFF2F', '#7FFF00', '#DFFF00' // Darker/muted colors
            ],
            gains: [
                '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#795548', '#9E9E9E', '#607D8B',
                '#2E8B57', '#3CB371', '#66CDAA', '#00FA9A', '#7CFC00', '#ADFF2F', '#32CD32', '#00FF7F' // Darker/muted colors
            ],
            tooltipBg: 'rgba(255, 255, 255, 0.9)', // Lighter tooltip in dark mode for contrast
            tooltipText: '#333333',
            textColor: '#E0E0E0'
        }
    };

    const activePalette = currentTheme === 'dark' ? chartColorPalettes.dark : chartColorPalettes.light;
    const backgroundColors = type === 'Expenses' ? activePalette.expenses : activePalette.gains;

    // Dynamically generate colors if more categories than predefined colors
    while (backgroundColors.length < labels.length) {
        backgroundColors.push(getRandomColor());
    }

    window[canvasId + 'ChartInstance'] = new Chart(ctx, {
        type: 'doughnut', // Changed to 'doughnut' for donut chart visualization
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors.slice(0, labels.length),
                hoverOffset: 10 // Slight offset on hover for better interaction
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
                            size: 14 // Larger legend font size for readability
                        }
                    }
                },
                title: {
                    display: true,
                    text: title,
                    color: activePalette.textColor,
                    font: {
                        size: 16 // Larger title font size for prominence
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
                        // Add percentage to tooltip
                        afterLabel: function(context) {
                            const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(2) + '%';
                            return `(${percentage})`;
                        }
                    }
                }
            },
            cutout: '60%', // Makes it a donut chart (60% hole in the center)
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    });
}

function getRandomColor() {
    // Generate a random hex color
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}


function calculateBalanceTrend(transactions) {
    // Sort transactions by date to correctly calculate cumulative balance
    const sortedTransactions = [...transactions].sort((a, b) => a.date - b.date);

    const dailyBalances = {};
    let currentBalance = 0;

    sortedTransactions.forEach(t => {
        // Use a consistent date key for aggregation
        const dateKey = dateFns.format(t.date, 'yyyy-MM-dd');
        if (t.type === 'Gains') {
            currentBalance += t.amount;
        } else if (t.type === 'Expenses') {
            currentBalance -= t.amount;
        }
        // Store the balance for the specific date. If multiple transactions on same day, this will be the end-of-day balance.
        dailyBalances[dateKey] = currentBalance;
    });

    // Get sorted labels (dates) and map them to their corresponding balances
    const labels = Object.keys(dailyBalances).sort();
    const balances = labels.map(label => dailyBalances[label]);

    return { labels, balances };
}

function renderLineChart(canvasId, title, labels, data) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (window[canvasId + 'ChartInstance']) {
        window[canvasId + 'ChartInstance'].destroy(); // Destroy previous chart instance
    }

    const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    const chartStyling = {
        light: {
            textColor: '#333',
            gridColor: 'rgba(0, 0, 0, 0.1)',
            borderColor: '#4CAF50', // Green line
            backgroundColor: 'rgba(76, 175, 80, 0.2)', // Green fill
            tooltipBg: 'rgba(0, 0, 0, 0.8)',
            tooltipText: '#ffffff'
        },
        dark: {
            textColor: '#E0E0E0',
            gridColor: 'rgba(255, 255, 255, 0.15)',
            borderColor: '#8BC34A', // Lighter green line for dark mode
            backgroundColor: 'rgba(139, 195, 74, 0.25)', // Lighter green fill
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
                fill: true, // Fill area under the line
                tension: 0.2, // Smoothness of the line
                pointRadius: 3, // Size of data points
                pointHoverRadius: 5 // Size of data points on hover
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false, // No legend needed for single line
                },
                title: {
                    display: true,
                    text: title,
                    color: activeColors.textColor,
                    font: {
                        size: 16 // Consistent title font size
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
                                label += formatCurrency(context.parsed.y); // Format tooltip value as currency
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
                        tooltipFormat: 'MMM dd,yyyy', // Date format for tooltip
                        displayFormats: {
                            day: 'MMM dd' // Display format on X-axis ticks
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
                        color: activeColors.gridColor // X-axis grid lines color
                    }
                },
                y: {
                    beginAtZero: true, // Start Y-axis from zero
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
                        color: activeColors.gridColor // Y-axis grid lines color
                    }
                }
            }
        }
    });
}


function updateTransactionsList(transactions) {
    elements.transactionsList.innerHTML = ''; // Clear previous list items
    if (transactions.length === 0) {
        elements.noTransactionsMessage.style.display = 'block'; // Show message if no transactions
        return;
    }
    elements.noTransactionsMessage.style.display = 'none'; // Hide message if transactions exist

    transactions.forEach(t => {
        const li = document.createElement('li');
        li.classList.add(t.type === 'Expenses' ? 'expense' : 'gain'); // Add class based on type
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

// Function to format numbers as Philippine Peso currency
function formatCurrency(amount) {
    return amount.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Function to format dates for display
function formatDate(date) {
    if (!date || isNaN(date.getTime())) {
        return 'Invalid Date';
    }
    return dateFns.format(date, 'MMM dd,yyyy'); // e.g., "May 23,2025"
}
