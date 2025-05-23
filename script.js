// --- Configuration ---
// Your Google Sheet "Publish to web" CSV URL
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgMFbI8pivLbRpc2nL2Gyoxw47PmXEVxvUDrjr-t86gj4-J3QM8uV7m8iJN9wxlYo3IY5FQqqUICei/pub?output=csv';

// --- Global Variables ---
let allData = []; // Stores all raw data from the sheet
let filteredData = []; // Stores data after applying filters
let expenseChart; // Chart.js instance

// --- DOM Elements ---
const bodyElement = document.body;
const totalEntriesElem = document.getElementById('totalEntries');
const totalIncomeElem = document.getElementById('totalIncome');
const totalExpensesElem = document.getElementById('totalExpenses');
const expenseChartCanvas = document.getElementById('expenseChart');
const noChartDataMessage = document.getElementById('noChartDataMessage');
const transactionsListContainer = document.getElementById('transactionsList');
const noTransactionsMessage = document.getElementById('noTransactionsMessage');


// Filter elements
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const categoryFilterInput = document.getElementById('categoryFilter');
const typeFilterSelect = document.getElementById('typeFilter');

const applyFiltersBtn = document.getElementById('applyFiltersBtn');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');

// Quick date buttons
const timePeriodButtons = [
    document.getElementById('last7Days'),
    document.getElementById('last30Days'),
    document.getElementById('last90Days'),
    document.getElementById('allTime')
];

// Theme toggle button
const themeToggleButton = document.getElementById('themeToggleButton');

// --- Functions ---

/**
 * Parses CSV text into an array of objects.
 * Assumes first row is headers.
 * @param {string} csvText - The raw CSV string.
 * @returns {Array<Object>} - An array of objects, where each object represents a row.
 */
function parseCSV(csvText) {
    const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== ''); // Split by new line, remove empty lines
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(header => header.trim()); // Headers from the first line

    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const rowObject = {};
        headers.forEach((header, index) => {
            rowObject[header] = values[index] ? values[index].trim() : ''; // Assign value to header
        });
        data.push(rowObject);
    }
    return data;
}

/**
 * Fetches data from the Google Sheet CSV URL.
 */
async function fetchData() {
    try {
        // Add a timestamp to the URL to prevent caching issues
        const response = await fetch(`${GOOGLE_SHEET_CSV_URL}&timestamp=${new Date().getTime()}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        allData = parseCSV(csvText);
        // Sort data by Date in descending order (most recent first)
        allData.sort((a, b) => {
            const dateA = new Date(a.Date + 'T00:00:00');
            const dateB = new Date(b.Date + 'T00:00:00');
            return dateB - dateA;
        });

        console.log("Fetched Data:", allData); // For debugging
        applyFilters(); // Apply initial filters (e.g., "All Time")
    } catch (error) {
        console.error('Error fetching or parsing data:', error);
        // Display error message
        expenseChartCanvas.style.display = 'none';
        noChartDataMessage.textContent = 'Error loading data. Please check your sheet URL and browser console.';
        noChartDataMessage.classList.remove('hidden');

        transactionsListContainer.innerHTML = ''; // Clear list
        noTransactionsMessage.textContent = 'Error loading transactions. Please check your sheet URL.';
        noTransactionsMessage.classList.remove('hidden');

        totalEntriesElem.textContent = 'N/A';
        totalIncomeElem.textContent = '₱N/A';
        totalExpensesElem.textContent = '₱N/A';
    }
}

/**
 * Formats a number as Philippine Peso currency.
 * @param {number} amount - The numeric amount.
 * @returns {string} - Formatted currency string.
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-PH', { // 'en-PH' for Philippines English locale
        style: 'currency',
        currency: 'PHP', // Philippine Peso
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

/**
 * Updates the summary statistics displayed on the dashboard.
 * @param {number} totalCount - Total number of filtered entries.
 * @param {number} income - Total income from filtered entries.
 * @param {number} expenses - Total expenses from filtered entries.
 */
function updateSummary(totalCount, income, expenses) {
    totalEntriesElem.textContent = totalCount;
    totalIncomeElem.textContent = formatCurrency(income);
    totalExpensesElem.textContent = formatCurrency(expenses);
}

/**
 * Filters the data based on current filter input values.
 */
function applyFilters() {
    const startDate = startDateInput.value ? new Date(startDateInput.value + 'T00:00:00') : null;
    const endDate = endDateInput.value ? new Date(endDateInput.value + 'T23:59:59') : null; // End of day
    const categoryFilter = categoryFilterInput.value.toLowerCase();
    const typeFilter = typeFilterSelect.value.toLowerCase();

    filteredData = allData.filter(entry => {
        // Ensure Date is valid before creating Date object
        const entryDate = entry.Date ? new Date(entry.Date + 'T00:00:00') : null;

        const matchesDate = (!startDate || !entryDate || entryDate >= startDate) && (!endDate || !entryDate || entryDate <= endDate);
        const matchesCategory = !categoryFilter || (entry.Category && entry.Category.toLowerCase().includes(categoryFilter));
        const matchesType = !typeFilter || (entry.Type && entry.Type.toLowerCase() === typeFilter);

        return matchesDate && matchesCategory && matchesType;
    });

    // Recalculate summary for all filtered data
    let overallFilteredIncome = 0;
    let overallFilteredExpenses = 0;
    filteredData.forEach(entry => {
        const amount = parseFloat(entry.Amount) || 0;
        if (entry.Type && entry.Type.toLowerCase() === 'income') {
            overallFilteredIncome += amount;
        } else if (entry.Type && entry.Type.toLowerCase() === 'expense') {
            overallFilteredExpenses += amount;
        }
    });
    updateSummary(filteredData.length, overallFilteredIncome, overallFilteredExpenses);

    renderChart(); // Render chart based on filtered data
    renderTransactionsList(); // Render transaction list based on filtered data
}

/**
 * Resets all filter inputs and applies filters.
 */
function resetFilters() {
    startDateInput.value = '';
    endDateInput.value = '';
    categoryFilterInput.value = '';
    typeFilterSelect.value = '';
    setActiveTimePeriodButton('allTime'); // Set "All Time" button as active
    applyFilters();
}

/**
 * Sets the active state for time period buttons.
 * @param {string} activeId - The ID of the button to set as active.
 */
function setActiveTimePeriodButton(activeId) {
    timePeriodButtons.forEach(button => {
        button.classList.remove('active', 'bg-indigo-600', 'hover:bg-indigo-700');
        button.classList.add('bg-gray-700', 'hover:bg-gray-600');
        if (button.id === activeId) {
            button.classList.add('active', 'bg-indigo-600', 'hover:bg-indigo-700');
            button.classList.remove('bg-gray-700', 'hover:bg-gray-600');
        }
    });
}

/**
 * Sets date range for quick filter buttons.
 * @param {number|string} days - Number of days back from today or 'all'.
 */
function setDateRange(days) {
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate()); // End of today
    endDateInput.value = endDate.toISOString().split('T')[0];

    if (days === 'all') {
        startDateInput.value = ''; // Clear start date for all time
    } else {
        const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        startDate.setDate(startDate.getDate() - days);
        startDateInput.value = startDate.toISOString().split('T')[0];
    }
    applyFilters(); // Apply filters immediately for quick buttons
}

/**
 * Renders the expense distribution chart.
 */
function renderChart() {
    const expensesByCategory = {};
    let totalExpenseAmount = 0;

    filteredData.forEach(entry => {
        if (entry.Type && entry.Type.toLowerCase() === 'expense') {
            const category = entry.Category || 'Uncategorized';
            const amount = parseFloat(entry.Amount) || 0;
            expensesByCategory[category] = (expensesByCategory[category] || 0) + amount;
            totalExpenseAmount += amount;
        }
    });

    const chartLabels = Object.keys(expensesByCategory);
    const chartData = Object.values(expensesByCategory);

    if (totalExpenseAmount === 0 || chartLabels.length === 0) {
        if (expenseChart) {
            expenseChart.destroy(); // Destroy old chart if no data
            expenseChart = null; // Reset chart instance
        }
        expenseChartCanvas.style.display = 'none';
        noChartDataMessage.classList.remove('hidden');
        return;
    } else {
        expenseChartCanvas.style.display = 'block';
        noChartDataMessage.classList.add('hidden');
    }

    // Generate vibrant colors dynamically
    const backgroundColors = chartLabels.map((_, i) => {
        const hue = (i * 137.508) % 360; // Use golden angle approximation for distinct hues
        return `hsl(${hue}, 70%, 50%)`;
    });
    const borderColors = backgroundColors.map(color => color.replace('50%)', '40%)')); // Slightly darker border

    const ctx = expenseChartCanvas.getContext('2d');

    if (expenseChart) {
        expenseChart.data.labels = chartLabels;
        expenseChart.data.datasets[0].data = chartData;
        expenseChart.data.datasets[0].backgroundColor = backgroundColors;
        expenseChart.data.datasets[0].borderColor = borderColors;
        // Update legend label color if theme changes
        expenseChart.options.plugins.legend.labels.color = bodyElement.classList.contains('light-mode') ? '#2d3748' : '#e2e8f0';
        expenseChart.update();
    } else {
        expenseChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: chartLabels,
                datasets: [{
                    data: chartData,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Allows flexible sizing
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: bodyElement.classList.contains('light-mode') ? '#2d3748' : '#e2e8f0', // Adjust legend text color based on theme
                            font: {
                                size: 14
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(tooltipItem) {
                                const label = tooltipItem.label || '';
                                const value = tooltipItem.raw || 0;
                                const percentage = ((value / totalExpenseAmount) * 100).toFixed(2);
                                return `${label}: ${formatCurrency(value)} (${percentage}%)`;
                            }
                        }
                    },
                    title: {
                        display: false,
                        text: 'Expense Distribution by Category',
                        color: bodyElement.classList.contains('light-mode') ? '#2d3748' : '#e2e8f0'
                    }
                }
            }
        });
    }
}

/**
 * Renders the list of transactions.
 */
function renderTransactionsList() {
    transactionsListContainer.innerHTML = ''; // Clear existing transactions

    if (filteredData.length === 0) {
        noTransactionsMessage.classList.remove('hidden');
        return;
    } else {
        noTransactionsMessage.classList.add('hidden');
    }

    filteredData.forEach(entry => {
        const amount = parseFloat(entry.Amount) || 0;
        const isExpense = entry.Type && entry.Type.toLowerCase() === 'expense';
        const amountColorClass = isExpense ? 'text-red-400' : 'text-green-400';
        const sign = isExpense ? '-' : '+';

        const transactionCard = document.createElement('div');
        transactionCard.classList.add('transaction-card', 'dark-card', 'p-4', 'rounded-lg', 'flex', 'flex-col', 'sm:flex-row', 'justify-between', 'items-start', 'sm:items-center');

        transactionCard.innerHTML = `
            <div class="mb-2 sm:mb-0">
                <p class="text-lg font-semibold">${entry.Category || 'N/A'}</p>
                <p class="text-sm text-gray-400 transaction-card-label">${entry.Date || 'N/A'}</p>
                <p class="text-sm text-gray-400 transaction-card-label">${entry.Remarks || 'No remarks'}</p>
            </div>
            <div class="text-right sm:text-right">
                <p class="text-lg font-bold ${amountColorClass}">${sign}${formatCurrency(amount)}</p>
                <p class="text-sm text-gray-400 transaction-card-label">${entry.Type || 'N/A'}</p>
            </div>
        `;
        transactionsListContainer.appendChild(transactionCard);
    });
}


/**
 * Toggles between dark and light mode.
 */
function toggleTheme() {
    if (bodyElement.classList.contains('light-mode')) {
        bodyElement.classList.remove('light-mode');
        localStorage.setItem('theme', 'dark');
    } else {
        bodyElement.classList.add('light-mode');
        localStorage.setItem('theme', 'light');
    }
    // Re-render chart to update legend color if theme changes
    if (expenseChart) { // Check if chart exists
        expenseChart.options.plugins.legend.labels.color = bodyElement.classList.contains('light-mode') ? '#2d3748' : '#e2e8f0';
        expenseChart.update();
    }
}

/**
 * Applies saved theme preference on load.
 */
function applySavedTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        bodyElement.classList.add('light-mode');
    } else {
        bodyElement.classList.remove('light-mode'); // Default to dark if no preference or 'dark'
    }
}


// --- Event Listeners ---

// Apply Filters Button
applyFiltersBtn.addEventListener('click', applyFilters);

// Reset Filters Button
resetFiltersBtn.addEventListener('click', resetFilters);

// Quick date buttons
document.getElementById('last7Days').addEventListener('click', () => {
    setActiveTimePeriodButton('last7Days');
    setDateRange(7);
});
document.getElementById('last30Days').addEventListener('click', () => {
    setActiveTimePeriodButton('last30Days');
    setDateRange(30);
});
document.getElementById('last90Days').addEventListener('click', () => {
    setActiveTimePeriodButton('last90Days');
    setDateRange(90);
});
document.getElementById('allTime').addEventListener('click', () => {
    setActiveTimePeriodButton('allTime');
    setDateRange('all');
});

// When custom date inputs change, deactivate quick buttons
startDateInput.addEventListener('change', () => {
    timePeriodButtons.forEach(button => {
        button.classList.remove('active', 'bg-indigo-600', 'hover:bg-indigo-700');
        button.classList.add('bg-gray-700', 'hover:bg-gray-600');
    });
});

endDateInput.addEventListener('change', () => {
    timePeriodButtons.forEach(button => {
        button.classList.remove('active', 'bg-indigo-600', 'hover:bg-indigo-700');
        button.classList.add('bg-gray-700', 'hover:bg-gray-600');
    });
});

// Theme toggle button
themeToggleButton.addEventListener('click', toggleTheme);


// Initial data fetch and theme application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    applySavedTheme(); // Apply theme before fetching data
    fetchData();
});
