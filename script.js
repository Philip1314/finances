document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgMFbI8pivLbRpc2nL2Gyoxw47PmXEVxvUDrjr-t86gj4-J3QM8uV7m8iJN9wxlYo3IY5FQqqUICei/pub?output=csv';
    const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdrDJoOeo264aOn4g2UEe-K-FHpbssBAVmEtOWoW46Q1cwjgg/viewform?usp=header';

    let allFetchedData = []; // Stores all data once fetched

    // --- Utility Functions ---

    /**
     * Parses CSV text into an array of objects.
     * @param {string} csv - The CSV data as a string.
     * @returns {Array<Object>} An array of objects, where each object represents a row.
     */
    function parseCSV(csv) {
        const lines = csv.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) {
            console.warn('CSV Parse Warning: No data lines found.');
            return [];
        }

        const headers = lines[0].split(',').map(header => header.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(value => value.trim());
            // Basic validation for malformed rows
            if (values.length !== headers.length) {
                console.warn('CSV Parse Warning: Skipping malformed row (column mismatch):', lines[i]);
                continue;
            }
            const entry = {};
            headers.forEach((header, index) => {
                entry[header] = values[index];
            });
            data.push(entry);
        }
        return data;
    }

    /**
     * Formats a number as Philippine Peso currency.
     * @param {number|string} amount - The amount to format.
     * @returns {string} The formatted currency string (e.g., "₱ 1,234.56").
     */
    function formatCurrency(amount) {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount)) {
            return '₱ 0.00';
        }
        return `₱ ${numAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    /**
     * Maps 'Type' and 'What kind?' from CSV to a display category and emoji icon.
     * @param {string} type - The transaction type (e.g., 'Gains', 'Expenses').
     * @param {string} whatKind - The specific kind/category (e.g., 'Food', 'Salary').
     * @returns {{category: string, icon: string}} An object with the mapped category name and its icon.
     */
    function mapCategoryAndIcon(type, whatKind) {
        let category = 'Misc';
        let icon = '✨'; // Default icon

        const lowerCaseWhatKind = whatKind ? whatKind.toLowerCase() : '';
        const lowerCaseType = type ? type.toLowerCase() : '';

        if (lowerCaseType === 'gains') {
            category = 'Gain'; // A general category for gains
            switch (lowerCaseWhatKind) {
                case 'salary': icon = '💸'; break;
                case 'allowance': icon = '🎁'; break;
                // Add more specific gain types here if needed
                default: icon = '💰'; break;
            }
        } else if (lowerCaseType === 'expenses') {
            switch (lowerCaseWhatKind) {
                case 'food':
                case 'groceries':
                    category = 'Food'; icon = '🍔'; break;
                case 'medicines': category = 'Medicines'; icon = '💊'; break;
                case 'online shopping': category = 'Shopping'; icon = '🛍️'; break;
                case 'transportation': category = 'Transportation'; icon = '🚌'; break;
                case 'utility bills': category = 'Utility Bills'; icon = '💡'; break;
                // 'Allowance' can also be an expense, map it to Misc if it's an expense
                case 'allowance': category = 'Misc'; icon = '🚶'; break;
                // Add more expense types here if needed
                default: category = 'Misc'; icon = '✨'; break;
            }
        }
        return { category, icon };
    }

    /**
     * Fetches CSV data from the configured URL. Caches data after first fetch.
     * @returns {Promise<Array<Object>>} A promise that resolves with the parsed CSV data.
     */
    async function fetchData() {
        if (allFetchedData.length === 0) { // Only fetch if data isn't already loaded
            try {
                const response = await fetch(CSV_URL);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const csv = await response.text();
                allFetchedData = parseCSV(csv);
                // console.log('Data fetched and parsed successfully:', allFetchedData); // For debugging
            } catch (error) {
                console.error('Error fetching CSV data:', error);
                alert('Failed to load data. Please check your internet connection or the Google Sheet URL.');
                throw new Error('Failed to load data.'); // Propagate error
            }
        }
        return allFetchedData;
    }

    // --- Dashboard Specific Logic (index.html) ---

    /**
     * Populates the dashboard year filter dropdown with unique years from the fetched data.
     */
    function populateDashboardYearFilter() {
        const dashboardYearFilter = document.getElementById('dashboardYearFilter');
        if (!dashboardYearFilter) return;

        // Clear existing options except "All Years"
        dashboardYearFilter.innerHTML = '<option value="">All Years</option>';

        const uniqueYears = new Set();
        allFetchedData.forEach(entry => {
            const date = new Date(entry.Date);
            if (!isNaN(date.getTime())) { // Ensure the date is valid
                uniqueYears.add(date.getFullYear());
            }
        });

        // Add unique years to the dropdown, sorted in descending order
        Array.from(uniqueYears).sort((a, b) => b - a).forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            dashboardYearFilter.appendChild(option);
        });
    }

    /**
     * Updates the dashboard with filtered data, calculates totals, and renders the chart.
     * @param {string|null} selectedMonth - The month to filter by (1-12), or null/empty for all months.
     * @param {string|null} selectedYear - The year to filter by, or null/empty for all years.
     */
    async function updateDashboard(selectedMonth = null, selectedYear = null) {
        if (!document.getElementById('dashboard-page')) return; // Ensure we are on the dashboard page

        try {
            const data = await fetchData(); // Get already fetched data or fetch it

            // Filter data based on selected month and year
            const filteredDashboardData = data.filter(entry => {
                const entryDate = new Date(entry.Date);

                if (isNaN(entryDate.getTime())) {
                    return false; // Skip entries with invalid dates
                }

                let matchMonth = true;
                if (selectedMonth && selectedMonth !== '') {
                    matchMonth = (entryDate.getMonth() + 1) === parseInt(selectedMonth);
                }

                let matchYear = true;
                if (selectedYear && selectedYear !== '') {
                    matchYear = entryDate.getFullYear() === parseInt(selectedYear);
                }

                return matchMonth && matchYear;
            });

            let totalExpensesAmount = 0;
            let totalGainsAmount = 0;

            const expenseCategoriesForChart = {};
            // Initialize chart categories to 0 for consistent display, even if no data
            ['Food', 'Medicines', 'Shopping', 'Transportation', 'Utility Bills', 'Misc'].forEach(cat => {
                expenseCategoriesForChart[cat] = 0;
            });

            // Calculate totals and categorize expenses for the chart
            filteredDashboardData.forEach(entry => {
                const amount = parseFloat(entry.Amount);
                const entryType = entry.Type ? entry.Type.toLowerCase() : '';

                if (isNaN(amount) || !entryType) {
                    return; // Skip malformed entries
                }

                if (entryType === 'expenses') {
                    totalExpensesAmount += amount;
                    const { category } = mapCategoryAndIcon(entry.Type, entry['What kind?']);
                    // Assign to correct category or 'Misc' if not explicitly handled
                    if (expenseCategoriesForChart.hasOwnProperty(category)) {
                        expenseCategoriesForChart[category] += amount;
                    } else {
                        expenseCategoriesForChart.Misc += amount; // Fallback for new/unmapped categories
                    }
                } else if (entryType === 'gains') {
                    totalGainsAmount += amount;
                }
            });

            // --- Update UI Elements on Dashboard ---

            // Net Expense Value
            const netExpenseValueElement = document.getElementById('netExpenseValue');
            if (netExpenseValueElement) {
                netExpenseValueElement.textContent = formatCurrency(totalExpensesAmount);
            }

            // Remaining Balance
            const remainingBalance = totalGainsAmount - totalExpensesAmount;
            const totalIncomeOrBudget = totalGainsAmount; // Assuming gains as the budget
            const remainingBalanceAmountElement = document.getElementById('remainingBalanceAmount');
            if (remainingBalanceAmountElement) {
                remainingBalanceAmountElement.textContent = `${formatCurrency(remainingBalance)} of ${formatCurrency(totalIncomeOrBudget)}`;
            }

            // Remaining Balance Percentage & Progress Circle
            let remainingBalancePercentage = 0;
            if (totalIncomeOrBudget > 0) {
                remainingBalancePercentage = (remainingBalance / totalIncomeOrBudget) * 100;
            }
            const displayPercentage = isNaN(remainingBalancePercentage) ? 0 : Math.round(remainingBalancePercentage);
            const remainingBalancePctElement = document.getElementById('remainingBalancePct');
            if (remainingBalancePctElement) {
                remainingBalancePctElement.textContent = `${displayPercentage}%`;
            }

            // Progress circle animation
            const progressCircle = document.querySelector('.progress-ring-progress');
            if (progressCircle) {
                const radius = 34;
                const circumference = 2 * Math.PI * radius;
                progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;

                let progressOffset;
                let progressColor;

                if (displayPercentage >= 100) {
                    progressOffset = 0; // Full circle
                    progressColor = 'var(--accent-green)';
                } else if (displayPercentage > 0) {
                    progressOffset = circumference - (displayPercentage / 100) * circumference;
                    if (displayPercentage < 25) { // Warning color for low remaining balance
                        progressColor = 'var(--accent-orange)';
                    } else {
                        progressColor = 'var(--accent-green)';
                    }
                } else { // 0 or negative percentage (over budget)
                    progressOffset = circumference; // Circle fully visible
                    progressColor = 'var(--accent-red)';
                }
                progressCircle.style.strokeDashoffset = progressOffset;
                progressCircle.style.stroke = progressColor;
            }

            // Update category percentages in the legend
            const htmlLegendCategories = ['food', 'medicines', 'shopping', 'misc']; // IDs in your HTML legend

            const totalCategoryExpenseForChart = Object.values(expenseCategoriesForChart).reduce((sum, amount) => sum + amount, 0);

            htmlLegendCategories.forEach(catId => {
                const element = document.getElementById(`${catId}Pct`);
                if (element) {
                    // Convert 'food' to 'Food' for lookup in expenseCategoriesForChart
                    const categoryName = catId.charAt(0).toUpperCase() + catId.slice(1);
                    const amount = expenseCategoriesForChart[categoryName] || 0;
                    element.textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((amount / totalCategoryExpenseForChart) * 100) : 0}%`;
                }
            });

            // Update the Chart.js doughnut chart
            const ctx = document.getElementById('expenseChart');
            if (ctx) {
                // Destroy previous chart instance to prevent memory leaks and redraw issues
                if (window.expenseChartInstance) {
                    window.expenseChartInstance.destroy();
                }

                // Define chart colors (ensure these match your CSS variable colors if possible)
                const chartColors = [
                    getComputedStyle(document.documentElement).getPropertyValue('--accent-green').trim(), // Example: Food
                    getComputedStyle(document.documentElement).getPropertyValue('--accent-red').trim(),    // Example: Medicines
                    getComputedStyle(document.documentElement).getPropertyValue('--accent-orange').trim(), // Example: Shopping
                    getComputedStyle(document.documentElement).getPropertyValue('--accent-blue').trim(),   // Example: Misc
                    '#8a2be2', // BlueViolet (e.g., Transportation)
                    '#ff4500', // OrangeRed (e.g., Utility Bills)
                    '#00ced1', // DarkTurquoise
                    '#ffa500'  // Orange
                ];

                const chartLabels = [];
                const chartData = [];
                const activeChartColors = [];
                let colorIndex = 0;

                // Sort categories alphabetically for consistent chart slice order, then filter for non-zero amounts
                const sortedChartCategories = Object.keys(expenseCategoriesForChart).sort();

                sortedChartCategories.forEach(category => {
                    const amount = expenseCategoriesForChart[category] || 0;
                    if (amount > 0) { // Only add categories with actual expenses
                        chartLabels.push(category);
                        chartData.push(amount);
                        activeChartColors.push(chartColors[colorIndex % chartColors.length]);
                        colorIndex++;
                    }
                });

                // Create new chart instance
                window.expenseChartInstance = new Chart(ctx.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: chartLabels,
                        datasets: [{
                            data: chartData,
                            backgroundColor: activeChartColors,
                            borderColor: 'var(--card-bg)', // Border color around slices
                            borderWidth: 4,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '80%', // Makes it a doughnut chart
                        plugins: {
                            legend: { display: false }, // Hide Chart.js built-in legend
                            tooltip: { // Customize tooltips for currency
                                callbacks: {
                                    label: function(context) {
                                        let label = context.label || '';
                                        if (label) { label += ': '; }
                                        if (context.parsed !== null) { label += formatCurrency(context.parsed); }
                                        return label;
                                    }
                                }
                            }
                        }
                    }
                });
            }

        } catch (error) {
            console.error('Error during dashboard update:', error);
            // Fallback UI for errors
            const elementsToUpdate = ['netExpenseValue', 'remainingBalanceAmount', 'remainingBalancePct', 'foodPct', 'medicinesPct', 'shoppingPct', 'miscPct'];
            elementsToUpdate.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    if (id.includes('Pct')) {
                        el.textContent = '0%';
                    } else if (id === 'remainingBalanceAmount') {
                        el.textContent = '₱ Error of ₱ Error';
                    } else {
                        el.textContent = '₱ Error';
                    }
                }
            });
            // Clear or display error on chart canvas
            if (window.expenseChartInstance) {
                window.expenseChartInstance.destroy();
            }
            const canvas = document.getElementById('expenseChart');
            if (canvas) {
                const context = canvas.getContext('2d');
                context.clearRect(0, 0, canvas.width, canvas.height);
                context.fillStyle = 'var(--accent-red)';
                context.font = '14px "Inter", sans-serif';
                context.textAlign = 'center';
                context.fillText('Data Error', canvas.width / 2, canvas.height / 2);
            }
        }
    }

    // --- Transactions Page Specific Logic (transactions.html) ---

    /**
     * Fetches and processes transactions data for the transactions page.
     */
    async function fetchAndProcessTransactions() {
        if (!document.getElementById('transactions-page')) return; // Ensure we are on the transactions page

        try {
            await fetchData(); // Fetch data (or use cached data)

            populateCategoryFilter(); // Populate category filter based on available data

            // Set current month as active and update profile date display
            const today = new Date();
            const currentMonth = today.getMonth() + 1; // 1-indexed month

            const monthButtons = document.querySelectorAll('.month-button');
            monthButtons.forEach(button => {
                if (parseInt(button.dataset.month) === currentMonth) {
                    button.classList.add('active');
                } else {
                    button.classList.remove('active');
                }
            });

            const profileDateDisplay = document.getElementById('profileDateDisplay');
            if (profileDateDisplay) {
                const monthName = today.toLocaleDateString('en-US', { month: 'short' });
                const dayOfMonth = today.getDate();
                profileDateDisplay.innerHTML = `<span>${monthName}</span><span>${dayOfMonth}</span>`;
            }

            renderTransactions(currentMonth); // Initial render for current month

        } catch (error) {
            console.error('Error in fetchAndProcessTransactions:', error);
            const transactionsListDiv = document.getElementById('transactionsList');
            if (transactionsListDiv) {
                transactionsListDiv.innerHTML = '<p style="text-align: center; color: var(--accent-red); padding: 2rem;">Error loading transactions. Please check the data source and your network connection.</p>';
            }
        }
    }

    /**
     * Populates the category filter dropdown on the transactions page.
     */
    function populateCategoryFilter() {
        const categoryFilterDropdown = document.getElementById('categoryFilterDropdown');
        if (!categoryFilterDropdown) return;

        categoryFilterDropdown.innerHTML = '<option value="">All Categories</option>';

        const uniqueCategories = new Set();
        allFetchedData.forEach(entry => {
            if (entry['What kind?'] && entry['What kind?'].trim() !== '') {
                uniqueCategories.add(entry['What kind'].trim());
            }
        });

        // Add 'Gains' and 'Expenses' type filters first if present in data
        const finalCategories = [];
        const hasGains = allFetchedData.some(entry => entry.Type && entry.Type.toLowerCase() === 'gains');
        const hasExpenses = allFetchedData.some(entry => entry.Type && entry.Type.toLowerCase() === 'expenses');

        if (hasGains) finalCategories.push('Gains');
        if (hasExpenses) finalCategories.push('Expenses');

        // Add other unique 'What kind?' categories, sorted alphabetically
        Array.from(uniqueCategories).sort().forEach(cat => {
            const lowerCat = cat.toLowerCase();
            // Prevent adding 'gains' or 'expenses' again if they are already covered by the type filters
            if (lowerCat !== 'gains' && lowerCat !== 'expenses' && !finalCategories.includes(cat)) {
                finalCategories.push(cat);
            }
        });

        finalCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilterDropdown.appendChild(option);
        });
    }

    /**
     * Renders transactions on the transactions page based on applied filters.
     * @param {number|null} selectedMonth - The month to filter by (1-12), or null if using date range.
     * @param {string} selectedCategory - The category to filter by (e.g., 'Food', 'Gains'), or empty for all.
     * @param {string|null} startDate - Start date string (YYYY-MM-DD) for range filtering, or null.
     * @param {string|null} endDate - End date string (YYYY-MM-DD) for range filtering, or null.
     */
    function renderTransactions(selectedMonth, selectedCategory = '', startDate = null, endDate = null) {
        const transactionsListDiv = document.getElementById('transactionsList');
        if (!transactionsListDiv) return;

        let filteredData = allFetchedData.filter(entry => {
            const amount = parseFloat(entry.Amount);
            const date = new Date(entry.Date);
            const entryType = entry.Type ? entry.Type.toLowerCase() : '';
            const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';

            if (isNaN(amount) || isNaN(date.getTime()) || !entryType) {
                return false; // Skip invalid entries
            }

            const entryDate = new Date(entry.Date);
            entryDate.setHours(0, 0, 0, 0); // Normalize date to start of day

            // Month filtering (only applies if date range is NOT active)
            if (selectedMonth !== null && !(startDate || endDate)) {
                if (entryDate.getMonth() + 1 !== selectedMonth) {
                    return false;
                }
            }

            // Category filtering
            if (selectedCategory && selectedCategory !== '') {
                const lowerCaseSelectedCategory = selectedCategory.toLowerCase();
                const actualCategory = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';

                if (lowerCaseSelectedCategory === 'gains') {
                    if (entryType !== 'gains') return false;
                } else if (lowerCaseSelectedCategory === 'expenses') {
                    if (entryType !== 'expenses') return false;
                } else if (actualCategory !== lowerCaseSelectedCategory) {
                    return false;
                }
            }

            // Date range filtering (takes precedence over month filter if active)
            if (startDate && endDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999); // End of day for end date

                if (entryDate < start || entryDate > end) {
                    return false;
                }
            }

            return true;
        });

        // Sort filtered data: by date (desc), then by time (asc)
        filteredData.sort((a, b) => {
            const dateA = new Date(a.Date);
            const dateB = new Date(b.Date);
            // If dates are different, sort by date descending
            if (dateB.getTime() !== dateA.getTime()) {
                return dateB.getTime() - dateA.getTime();
            }
            // If dates are the same, sort by time ascending
            const timeA = a.Time ? a.Time.split(':').map(Number) : [0, 0, 0];
            const timeB = b.Time ? b.Time.split(':').map(Number) : [0, 0, 0];
            if (timeA[0] !== timeB[0]) return timeA[0] - timeB[0];
            if (timeA[1] !== timeB[1]) return timeA[1] - timeB[1];
            return (timeA[2] || 0) - (timeB[2] || 0); // Handle missing seconds gracefully
        });

        transactionsListDiv.innerHTML = ''; // Clear previous transactions

        const groupedTransactions = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        // Group transactions by date
        filteredData.forEach(entry => {
            const entryDate = new Date(entry.Date);
            entryDate.setHours(0, 0, 0, 0);

            let dateHeader;
            if (entryDate.getTime() === today.getTime()) {
                dateHeader = 'Today';
            } else if (entryDate.getTime() === yesterday.getTime()) {
                dateHeader = 'Yesterday';
            } else {
                dateHeader = entryDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            }

            if (!groupedTransactions[dateHeader]) {
                groupedTransactions[dateHeader] = [];
            }
            groupedTransactions[dateHeader].push(entry);
        });

        // Sort date headers for display (Today, Yesterday, then chronological descending)
        const sortedDates = Object.keys(groupedTransactions).sort((a, b) => {
            if (a === 'Today') return -1;
            if (b === 'Today') return 1;
            if (a === 'Yesterday') return -1; // Yesterday comes after Today, before other dates
            if (b === 'Yesterday') return 1;

            const dateA = new Date(a);
            const dateB = new Date(b);
            if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
                return dateB.getTime() - dateA.getTime(); // Sort by date descending
            }
            return 0; // Maintain original order if dates are invalid
        });

        // Render each grouped date's transactions
        sortedDates.forEach(dateHeader => {
            const groupDiv = document.createElement('div');
            groupDiv.classList.add('transaction-group');

            const headerDiv = document.createElement('div');
            headerDiv.classList.add('transaction-date-header');
            headerDiv.textContent = dateHeader;
            groupDiv.appendChild(headerDiv);

            // Sort transactions within each group by time (ascending)
            groupedTransactions[dateHeader].sort((a, b) => {
                const timeA = a.Time ? a.Time.split(':').map(Number) : [0, 0, 0];
                const timeB = b.Time ? b.Time.split(':').map(Number) : [0, 0, 0];
                if (timeA[0] !== timeB[0]) return timeA[0] - timeB[0];
                if (timeA[1] !== timeB[1]) return timeA[1] - timeB[1];
                return (timeA[2] || 0) - (timeB[2] || 0);
            });

            groupedTransactions[dateHeader].forEach(entry => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('transaction-item');

                const categoryIconDiv = document.createElement('div');
                categoryIconDiv.classList.add('transaction-category-icon');

                const { category: mappedCategory, icon: categoryIcon } = mapCategoryAndIcon(entry.Type, entry['What kind?']);

                // Apply category-specific background colors for icons
                if (entry.Type && entry.Type.toLowerCase() === 'gains') {
                     categoryIconDiv.classList.add('category-gain');
                } else {
                    switch (mappedCategory.toLowerCase()) {
                        case 'food': categoryIconDiv.classList.add('category-food'); break;
                        case 'medicines': categoryIconDiv.classList.add('category-medicines'); break;
                        case 'shopping': categoryIconDiv.classList.add('category-shopping'); break;
                        case 'transportation': categoryIconDiv.classList.add('category-transportation'); break;
                        case 'utility bills': categoryIconDiv.classList.add('category-utility-bills'); break;
                        default: categoryIconDiv.classList.add('category-misc'); break;
                    }
                }

                categoryIconDiv.textContent = categoryIcon;
                itemDiv.appendChild(categoryIconDiv);

                const detailsDiv = document.createElement('div');
                detailsDiv.classList.add('transaction-details');

                const nameSpan = document.createElement('span');
                nameSpan.classList.add('transaction-name');
                // Display Description if available, otherwise 'What kind?', otherwise 'N/A'
                nameSpan.textContent = entry.Description && entry.Description.trim() !== '' ? entry.Description : (entry['What kind?'] && entry['What kind?'].trim() !== '' ? entry['What kind?'] : 'N/A');
                detailsDiv.appendChild(nameSpan);

                const timeSpan = document.createElement('span');
                timeSpan.classList.add('transaction-time');
                if (entry.Time) {
                    try {
                        const [hours, minutes] = entry.Time.split(':').map(Number);
                        const tempDate = new Date(); // Use a temp date to format time
                        tempDate.setHours(hours, minutes, 0);
                        timeSpan.textContent = tempDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                    } catch (e) {
                        timeSpan.textContent = entry.Time; // Fallback if parsing fails
                    }
                } else {
                    timeSpan.textContent = '';
                }
                detailsDiv.appendChild(timeSpan);

                itemDiv.appendChild(detailsDiv);

                const amountSpan = document.createElement('span');
                amountSpan.classList.add('transaction-amount');
                amountSpan.textContent = formatCurrency(entry.Amount);
                if (entry.Type && entry.Type.toLowerCase() === 'expenses') {
                    amountSpan.classList.add('expense');
                } else if (entry.Type && entry.Type.toLowerCase() === 'gains') {
                    amountSpan.classList.add('gain');
                }
                itemDiv.appendChild(amountSpan);

                groupDiv.appendChild(itemDiv);
            });
            transactionsListDiv.appendChild(groupDiv);
        });

        // Display message if no transactions found
        if (filteredData.length === 0) {
            transactionsListDiv.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 2rem;">No transactions found for the selected filters.</p>';
        }
    }

    // --- Common Event Listeners (Apply to all pages with fab button) ---

    const fabButton = document.querySelector('.fab-button');
    if (fabButton) {
        fabButton.addEventListener('click', () => {
            window.open(GOOGLE_FORM_URL, '_blank'); // Open Google Form in a new tab
        });
    }

    // --- Initialize Page-Specific Logic ---

    // Dashboard Page (index.html) Initialization
    if (document.getElementById('dashboard-page')) {
        const dashboardFilterButton = document.getElementById('dashboardFilterButton');
        const dashboardFilterOptionsContainer = document.getElementById('dashboardFilterOptionsContainer');
        const dashboardMonthFilter = document.getElementById('dashboardMonthFilter');
        const dashboardYearFilter = document.getElementById('dashboardYearFilter');
        const applyDashboardFilterButton = document.getElementById('applyDashboardFilterButton');
        const clearDashboardFilterButton = document.getElementById('clearDashboardFilterButton');

        // Toggle filter options visibility when filter button is clicked
        if (dashboardFilterButton && dashboardFilterOptionsContainer) {
            dashboardFilterButton.addEventListener('click', () => {
                dashboardFilterOptionsContainer.style.display = dashboardFilterOptionsContainer.style.display === 'flex' ? 'none' : 'flex';
                // Optional: add/remove an 'active' class for CSS transitions
                dashboardFilterOptionsContainer.classList.toggle('active');
            });
        }

        // Initial fetch, populate year filter, and update dashboard for current month/year
        fetchData().then(() => {
            populateDashboardYearFilter();

            // Set default filter values to current month and year
            const today = new Date();
            // Check if value is already set (e.g., if user navigated back and browser remembered selection)
            if (!dashboardMonthFilter.value) {
                dashboardMonthFilter.value = (today.getMonth() + 1).toString();
            }
            if (!dashboardYearFilter.value) {
                dashboardYearFilter.value = today.getFullYear().toString();
            }

            updateDashboard(dashboardMonthFilter.value, dashboardYearFilter.value);
        }).catch(error => {
            console.error("Dashboard initialization failed:", error);
            // updateDashboard's catch block will show error messages on UI
        });


        // Event listener for "Apply" button on dashboard filters
        if (applyDashboardFilterButton) {
            applyDashboardFilterButton.addEventListener('click', () => {
                const selectedMonth = dashboardMonthFilter.value;
                const selectedYear = dashboardYearFilter.value;
                updateDashboard(selectedMonth, selectedYear);
                dashboardFilterOptionsContainer.style.display = 'none'; // Hide filters after applying
                dashboardFilterOptionsContainer.classList.remove('active'); // Remove active class
            });
        }

        // Event listener for "Clear" button on dashboard filters
        if (clearDashboardFilterButton) {
            clearDashboardFilterButton.addEventListener('click', () => {
                dashboardMonthFilter.value = ''; // Clear month selection
                dashboardYearFilter.value = ''; // Clear year selection
                updateDashboard('', ''); // Call without filters to show all data
                dashboardFilterOptionsContainer.style.display = 'none'; // Hide filters after clearing
                dashboardFilterOptionsContainer.classList.remove('active'); // Remove active class
            });
        }

    }
    // Transactions Page (transactions.html) Initialization
    else if (document.getElementById('transactions-page')) {
        let currentMonth = new Date().getMonth() + 1; // Default to current month

        const filterButton = document.getElementById('filterButton'); // From transactions.html
        const filterOptionsContainer = document.getElementById('filterOptionsContainer'); // From transactions.html
        const categoryFilterDropdown = document.getElementById('categoryFilterDropdown'); // From transactions.html
        const startDateInput = document.getElementById('startDateInput'); // From transactions.html
        const endDateInput = document.getElementById('endDateInput'); // From transactions.html
        const applyFiltersButton = document.getElementById('applyFiltersButton'); // From transactions.html
        const clearFiltersButton = document.getElementById('clearFiltersButton'); // From transactions.html
        const monthButtons = document.querySelectorAll('.month-button'); // From transactions.html

        // Toggle filter options visibility for transactions page
        if (filterButton && filterOptionsContainer) {
            filterButton.addEventListener('click', () => {
                filterOptionsContainer.style.display = filterOptionsContainer.style.display === 'flex' ? 'none' : 'flex';
            });
        }

        // Event listener for "Apply" button on transactions filters
        if (applyFiltersButton) {
            applyFiltersButton.addEventListener('click', () => {
                const selectedCategory = categoryFilterDropdown.value;
                const startDate = startDateInput.value;
                const endDate = endDateInput.value;

                // If date range is selected, month filter is ignored for transactions page
                const finalMonth = (startDate || endDate) ? null : currentMonth;

                renderTransactions(finalMonth, selectedCategory, startDate, endDate);
                filterOptionsContainer.style.display = 'none'; // Hide filters after applying
            });
        }

        // Event listener for "Clear" button on transactions filters
        if (clearFiltersButton) {
            clearFiltersButton.addEventListener('click', () => {
                categoryFilterDropdown.value = '';
                startDateInput.value = '';
                endDateInput.value = '';

                // Reset month selection to current month and activate corresponding button
                const today = new Date();
                currentMonth = today.getMonth() + 1;
                monthButtons.forEach(btn => btn.classList.remove('active'));
                const currentMonthBtn = document.querySelector(`.month-button[data-month="${currentMonth}"]`);
                if (currentMonthBtn) {
                    currentMonthBtn.classList.add('active');
                }
                renderTransactions(currentMonth); // Render for current month
                filterOptionsContainer.style.display = 'none';
            });
        }

        // Set initial active month button on transactions page load
        monthButtons.forEach(button => {
            if (parseInt(button.dataset.month) === currentMonth) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });

        // Update profile date display for transactions page
        const profileDateDisplay = document.getElementById('profileDateDisplay');
        if (profileDateDisplay) {
            const today = new Date();
            const monthName = today.toLocaleDateString('en-US', { month: 'short' });
            const dayOfMonth = today.getDate();
            profileDateDisplay.innerHTML = `<span>${monthName}</span><span>${dayOfMonth}</span>`;
        }

        // Event listeners for month buttons on transactions page
        monthButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Deactivate all month buttons
                monthButtons.forEach(btn => btn.classList.remove('active'));
                // Activate clicked button
                this.classList.add('active');
                currentMonth = parseInt(this.dataset.month);
                // Clear other filters when a month button is clicked
                if (startDateInput) startDateInput.value = '';
                if (endDateInput) endDateInput.value = '';
                if (categoryFilterDropdown) categoryFilterDropdown.value = '';
                renderTransactions(currentMonth);
                filterOptionsContainer.style.display = 'none'; // Hide filters
            });
        });

        fetchAndProcessTransactions(); // Start transactions page logic
    }
});
