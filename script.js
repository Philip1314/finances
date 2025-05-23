// --- Configuration ---
// Your Google Sheet "Publish to web" CSV URL
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgMFbI8pivLbRpc2nL2Gyoxw47PmXEVxvUDrjr-t86gj4-J3QM8uV7m8iJN9wxlYo3IY5FQqqUICei/pub?output=csv';

// --- Global Variables ---
let allData = []; // Stores all raw data from the sheet
let filteredData = []; // Stores data after applying filters
let currentPage = 1;
const rowsPerPage = 10; // Number of entries per page

// --- DOM Elements ---
const dataTableBody = document.getElementById('dataTableBody');
const totalEntriesElem = document.getElementById('totalEntries');
const totalIncomeElem = document.getElementById('totalIncome');
const totalExpensesElem = document.getElementById('totalExpenses');

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

// Pagination elements
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const currentPageSpan = document.getElementById('currentPage');
const totalPagesSpan = document.getElementById('totalPages');

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
        console.log("Fetched Data:", allData); // For debugging
        applyFilters(); // Apply initial filters (e.g., "All Time")
    } catch (error) {
        console.error('Error fetching or parsing data:', error);
        dataTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-red-500">Error loading data. Please check your sheet URL and permissions.</td></tr>`;
        totalEntriesElem.textContent = 'N/A';
        totalIncomeElem.textContent = '$N/A';
        totalExpensesElem.textContent = '$N/A';
    }
}

/**
 * Formats a number as currency.
 * @param {number} amount - The numeric amount.
 * @returns {string} - Formatted currency string.
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

/**
 * Renders the data table for the current page.
 */
function renderTable() {
    dataTableBody.innerHTML = ''; // Clear existing rows

    if (filteredData.length === 0) {
        dataTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-gray-500">No entries found for the selected filters.</td></tr>`;
        updatePaginationControls();
        updateSummary(0, 0, 0); // Reset summary
        return;
    }

    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedData = filteredData.slice(start, end);

    let currentTotalIncome = 0;
    let currentTotalExpenses = 0;

    paginatedData.forEach(entry => {
        const row = document.createElement('tr');
        row.classList.add('dark-table-row');

        // Parse amount as float for calculations
        const amount = parseFloat(entry.Amount) || 0;

        // Determine text color based on Type (Income/Expense)
        let amountTextColorClass = '';
        if (entry.Type && entry.Type.toLowerCase() === 'income') {
            amountTextColorClass = 'text-green-400';
            currentTotalIncome += amount;
        } else if (entry.Type && entry.Type.toLowerCase() === 'expense') {
            amountTextColorClass = 'text-red-400';
            currentTotalExpenses += amount;
        }

        row.innerHTML = `
            <td class="py-2 px-4" data-label="Timestamp">${entry.Timestamp}</td>
            <td class="py-2 px-4" data-label="Date">${entry.Date}</td>
            <td class="py-2 px-4" data-label="Category">${entry.Category}</td>
            <td class="py-2 px-4" data-label="Type">${entry.Type}</td>
            <td class="py-2 px-4 ${amountTextColorClass}" data-label="Amount">${formatCurrency(amount)}</td>
            <td class="py-2 px-4" data-label="Remarks">${entry.Remarks}</td>
        `;
        dataTableBody.appendChild(row);
    });

    updatePaginationControls();
    updateSummary(filteredData.length, currentTotalIncome, currentTotalExpenses); // Summary for *filtered* data
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
        const entryDate = new Date(entry.Date + 'T00:00:00'); // Assuming 'Date' is in YYYY-MM-DD format

        const matchesDate = (!startDate || entryDate >= startDate) && (!endDate || entryDate <= endDate);
        const matchesCategory = !categoryFilter || entry.Category.toLowerCase().includes(categoryFilter);
        const matchesType = !typeFilter || entry.Type.toLowerCase() === typeFilter;

        return matchesDate && matchesCategory && matchesType;
    });

    // Recalculate summary for all filtered data (not just current page)
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

    currentPage = 1; // Reset to first page after applying filters
    renderTable();
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
 * @param {number} days - Number of days back from today.
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
 * Updates pagination button states and text.
 */
function updatePaginationControls() {
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    currentPageSpan.textContent = currentPage;
    totalPagesSpan.textContent = totalPages === 0 ? 1 : totalPages; // Ensure at least 1 page shown

    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
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

// Pagination buttons
prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
    }
});

nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderTable();
    }
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


// Initial data fetch when the page loads
document.addEventListener('DOMContentLoaded', fetchData);
