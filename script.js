document.addEventListener('DOMContentLoaded', () => {
    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS6QS-O5TLQmVn8WMeyfSVmLfJPtL11TwmnZn4NVgklXKFRbJwK5A7jiPYU1srHVDxUDvI8KIXBqnNx/pub?output=csv';
    const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSe4-6PXN21Zrnexp8bUbdU5IhaokIEoUKwsFeRU0yYzllcPJA/viewform?usp=header';

    function parseCSV(csv) {
        const lines = csv.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) return [];

        const headers = lines[0].split(',').map(header => header.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(value => value.trim());
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

    function formatCurrency(amount) {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount)) {
            return '₱ 0.00';
        }
        return `₱ ${numAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    function mapCategoryAndIcon(type, whatKind) {
        let category = 'Misc';
        let icon = '✨';

        const lowerCaseWhatKind = whatKind ? whatKind.toLowerCase() : '';
        const lowerCaseType = type ? type.toLowerCase() : '';

        if (lowerCaseType === 'gains') {
            category = 'Gain';
            switch (lowerCaseWhatKind) {
                case 'salary': icon = '💸'; break;
                case 'allowance': icon = '🎁'; break;
                default: icon = '💰'; break;
            }
        } else if (lowerCaseType === 'expenses') {
            switch (lowerCaseWhatKind) {
                case 'food': case 'groceries': category = 'Food'; icon = '🍔'; break;
                case 'medicines': category = 'Medicines'; icon = '💊'; break;
                case 'online shopping': category = 'Shopping'; icon = '🛍️'; break;
                case 'transportation': category = 'Transportation'; icon = '🚌'; break;
                case 'utility bills': category = 'Utility Bills'; icon = '💡'; break;
                case 'allowance': category = 'Misc'; icon = '🚶'; break;
                default: category = 'Misc'; icon = '✨'; break;
            }
        }
        return { category, icon };
    }

    // --- Dashboard Specific Logic (index.html) ---
    async function updateDashboard() {
        if (!document.getElementById('dashboard-page')) return;

        try {
            const response = await fetch(CSV_URL);
            const csv = await response.text();
            const data = parseCSV(csv);

            let totalExpensesAmount = 0;
            let totalGainsAmount = 0;

            const expenseCategoriesForChart = { Food: 0, Medicines: 0, Shopping: 0, Misc: 0 };

            data.forEach(entry => {
                const amount = parseFloat(entry.Amount);
                const entryType = entry.Type ? entry.Type.toLowerCase() : '';
                const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';

                if (isNaN(amount) || !entryType || !entryWhatKind) {
                    console.warn('Dashboard - Skipping malformed entry:', entry);
                    return;
                }

                if (entryType === 'expenses') {
                    totalExpensesAmount += amount;
                    if (entryWhatKind === 'food' || entryWhatKind === 'groceries') {
                        expenseCategoriesForChart.Food += amount;
                    } else if (entryWhatKind === 'medicines') {
                        expenseCategoriesForChart.Medicines += amount;
                    } else if (entryWhatKind === 'online shopping') {
                        expenseCategoriesForChart.Shopping += amount;
                    } else {
                        expenseCategoriesForChart.Misc += amount;
                    }
                } else if (entryType === 'gains') {
                    totalGainsAmount += amount;
                }
            });

            const netExpenseForDisplay = totalExpensesAmount;
            document.getElementById('netExpenseValue').textContent = formatCurrency(netExpenseForDisplay);

            const remainingBalance = totalGainsAmount - totalExpensesAmount;
            const totalIncomeOrBudget = totalGainsAmount;

            document.getElementById('remainingBalanceAmount').textContent = `${formatCurrency(remainingBalance)} of ${formatCurrency(totalIncomeOrBudget)}`;

            let remainingBalancePercentage = 0;
            if (totalIncomeOrBudget > 0) {
                remainingBalancePercentage = (remainingBalance / totalIncomeOrBudget) * 100;
            }
            const displayPercentage = isNaN(remainingBalancePercentage) ? 0 : Math.round(remainingBalancePercentage);
            document.getElementById('remainingBalancePct').textContent = `${displayPercentage}%`;

            let progressOffset = 0;
            let progressColor = 'var(--accent-green)';
            const radius = 34;
            const circumference = 2 * Math.PI * radius;

            if (displayPercentage >= 100) {
                progressOffset = 0;
            } else if (displayPercentage > 0) {
                progressOffset = circumference - (displayPercentage / 100) * circumference;
                if (displayPercentage < 25) {
                    progressColor = 'var(--accent-orange)';
                }
            } else {
                progressOffset = circumference;
                progressColor = 'var(--accent-red)';
            }

            const progressCircle = document.querySelector('.progress-ring-progress');
            if (progressCircle) {
                progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
                progressCircle.style.strokeDashoffset = progressOffset;
                progressCircle.style.stroke = progressColor;
            }

            const categoryNames = ['Food', 'Medicines', 'Shopping', 'Misc'];
            const categoryAmounts = [
                expenseCategoriesForChart.Food,
                expenseCategoriesForChart.Medicines,
                expenseCategoriesForChart.Shopping,
                expenseCategoriesForChart.Misc,
            ];
            const totalCategoryExpenseForChart = categoryAmounts.reduce((sum, amount) => sum + amount, 0);

            document.getElementById('foodPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Food / totalCategoryExpenseForChart) * 100) : 0}%`;
            document.getElementById('medicinesPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Medicines / totalCategoryExpenseForChart) * 100) : 0}%`;
            document.getElementById('shoppingPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Shopping / totalCategoryExpenseForChart) * 100) : 0}%`;
            document.getElementById('miscPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Misc / totalCategoryExpenseForChart) * 100) : 0}%`;


            const ctx = document.getElementById('expenseChart');
            if (ctx) {
                if (window.expenseChartInstance) {
                    window.expenseChartInstance.destroy();
                }
                const chartColors = [
                    getComputedStyle(document.documentElement).getPropertyValue('--accent-green').trim(),
                    getComputedStyle(document.documentElement).getPropertyValue('--accent-red').trim(),
                    getComputedStyle(document.documentElement).getPropertyValue('--accent-orange').trim(),
                    getComputedStyle(document.documentElement).getPropertyValue('--accent-blue').trim()
                ];
                window.expenseChartInstance = new Chart(ctx.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: categoryNames,
                        datasets: [{
                            data: categoryAmounts,
                            backgroundColor: chartColors,
                            borderColor: 'var(--card-bg)',
                            borderWidth: 4,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '80%',
                        plugins: {
                            legend: { display: false },
                            tooltip: {
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
            console.error('Error fetching or processing CSV for dashboard:', error);
            if (document.getElementById('netExpenseValue')) document.getElementById('netExpenseValue').textContent = '₱ Error';
            if (document.getElementById('remainingBalanceAmount')) document.getElementById('remainingBalanceAmount').textContent = '₱ Error';
        }
    }

    // --- Transactions Page Specific Logic (transactions.html) ---
    let allTransactionsData = []; // Store all fetched data for consistent filtering

    async function fetchAndProcessTransactions() {
        try {
            const response = await fetch(CSV_URL);
            const csv = await response.text();
            allTransactionsData = parseCSV(csv); // Store raw data

            // Populate category filter dropdown
            populateCategoryFilter();
            // Initial render with current month
            const today = new Date();
            const currentMonth = today.getMonth() + 1;
            renderTransactions(currentMonth); // Initial render with current month
        } catch (error) {
            console.error('Error fetching or processing CSV for transactions:', error);
            const transactionsListDiv = document.getElementById('transactionsList');
            if (transactionsListDiv) {
                transactionsListDiv.innerHTML = '<p style="text-align: center; color: var(--accent-red); padding: 2rem;">Error loading transactions. Please check the data source.</p>';
            }
        }
    }

    function populateCategoryFilter() {
        const categoryFilterDropdown = document.getElementById('categoryFilterDropdown');
        if (!categoryFilterDropdown) return;

        // Clear existing options except "All Categories"
        categoryFilterDropdown.innerHTML = '<option value="">All Categories</option>';

        const uniqueCategories = new Set();
        allTransactionsData.forEach(entry => {
            if (entry['What kind?']) {
                uniqueCategories.add(entry['What kind?'].trim());
            }
            if (entry.Type && entry.Type.toLowerCase() === 'gains' && entry['What kind?'].trim() === 'Salary') {
                uniqueCategories.add('Salary'); // Explicitly add Salary for gains
            }
            if (entry.Type && entry.Type.toLowerCase() === 'gains' && entry['What kind?'].trim() === 'Allowance') {
                uniqueCategories.add('Allowance'); // Explicitly add Allowance for gains
            }
        });

        // Sort categories alphabetically, add "Gains" to the top
        const sortedCategories = Array.from(uniqueCategories).sort();
        const finalCategories = ['Gains']; // Start with Gains
        sortedCategories.forEach(cat => {
            // Avoid adding "Salary" or "Allowance" separately if "Gains" handles them broadly
            // Or add specific ones like 'Food', 'Medicines', 'Shopping', etc.
            if (!['salary', 'allowance'].includes(cat.toLowerCase())) {
                finalCategories.push(cat);
            }
        });

        // Add a specific 'Expenses' category if not already implicitly covered by 'Food', 'Medicines', etc.
        // This makes filtering more robust if 'Type' is needed explicitly.
        if (!finalCategories.includes('Expenses')) {
             finalCategories.splice(1, 0, 'Expenses'); // Add 'Expenses' after 'Gains'
        }


        // Re-populate options, keeping 'All Categories' at the top
        finalCategories.forEach(category => {
            if (category) { // Ensure no empty categories are added
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categoryFilterDropdown.appendChild(option);
            }
        });
    }


    function renderTransactions(selectedMonth, selectedCategory = '', startDate = null, endDate = null) {
        const transactionsListDiv = document.getElementById('transactionsList');
        if (!transactionsListDiv) return;

        let filteredData = allTransactionsData.filter(entry => {
            const amount = parseFloat(entry.Amount);
            const date = new Date(entry.Date);
            const entryType = entry.Type ? entry.Type.toLowerCase() : '';
            const entryWhatKind = entry['What kind'] ? entry['What kind'].toLowerCase() : ''; // Use 'What kind' here

            if (isNaN(amount) || isNaN(date) || !entryType) {
                console.warn('Skipping malformed entry:', entry);
                return false;
            }

            const entryDate = new Date(entry.Date);
            entryDate.setHours(0, 0, 0, 0);

            // Month filtering (always apply if a month button is active)
            if (selectedMonth && entryDate.getMonth() + 1 !== selectedMonth) {
                return false;
            }

            // Category filtering
            if (selectedCategory) {
                const lowerCaseSelectedCategory = selectedCategory.toLowerCase();
                const actualCategory = entry['What kind'] ? entry['What kind'].toLowerCase() : '';
                const entryCategoryType = entry.Type ? entry.Type.toLowerCase() : ''; // 'gains' or 'expenses'

                if (lowerCaseSelectedCategory === 'gains') {
                    if (entryCategoryType !== 'gains') return false;
                } else if (lowerCaseSelectedCategory === 'expenses') {
                    if (entryCategoryType !== 'expenses') return false;
                } else if (actualCategory !== lowerCaseSelectedCategory) {
                     // Specific category match, e.g., 'food', 'medicines'
                    return false;
                }
            }


            // Date range filtering
            if (startDate && endDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999); // End of the day

                if (entryDate < start || entryDate > end) {
                    return false;
                }
            }

            return true;
        });

        filteredData.sort((a, b) => new Date(b.Date) - new Date(a.Date));

        transactionsListDiv.innerHTML = '';

        const groupedTransactions = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

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

        const sortedDates = Object.keys(groupedTransactions).sort((a, b) => {
            if (a === 'Today') return -1;
            if (b === 'Today') return 1;
            if (a === 'Yesterday') return -1;
            if (b === 'Yesterday') return 1;
            const dateA = new Date(a);
            const dateB = new Date(b);
            if (!isNaN(dateA) && !isNaN(dateB)) {
                return dateB - dateA;
            }
            return 0;
        });

        sortedDates.forEach(dateHeader => {
            const groupDiv = document.createElement('div');
            groupDiv.classList.add('transaction-group');

            const headerDiv = document.createElement('div');
            headerDiv.classList.add('transaction-date-header');
            headerDiv.textContent = dateHeader;
            groupDiv.appendChild(headerDiv);

            groupedTransactions[dateHeader].sort((a, b) => {
                const timeA = a.Time ? a.Time.split(':').map(Number) : [0, 0, 0];
                const timeB = b.Time ? b.Time.split(':').map(Number) : [0, 0, 0];
                if (timeA[0] !== timeB[0]) return timeA[0] - timeB[0];
                if (timeA[1] !== timeB[1]) return timeA[1] - timeB[1];
                return timeA[2] - timeB[2];
            });

            groupedTransactions[dateHeader].forEach(entry => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('transaction-item');

                const categoryIconDiv = document.createElement('div');
                categoryIconDiv.classList.add('transaction-category-icon');

                const { category: mappedCategory, icon: categoryIcon } = mapCategoryAndIcon(entry.Type, entry['What kind?']);

                if (entry.Type && entry.Type.toLowerCase() === 'gains') {
                     categoryIconDiv.classList.add('category-gain');
                } else {
                    switch (mappedCategory.toLowerCase()) {
                        case 'food': categoryIconDiv.classList.add('category-food'); break;
                        case 'medicines': categoryIconDiv.classList.add('category-medicines'); break;
                        case 'shopping': categoryIconDiv.classList.add('category-shopping'); break;
                        default: categoryIconDiv.classList.add('category-misc'); break;
                    }
                }

                categoryIconDiv.textContent = categoryIcon;
                itemDiv.appendChild(categoryIconDiv);

                const detailsDiv = document.createElement('div');
                detailsDiv.classList.add('transaction-details');

                const nameSpan = document.createElement('span');
                nameSpan.classList.add('transaction-name');
                nameSpan.textContent = entry.Description && entry.Description.trim() !== '' ? entry.Description : (entry['What kind?'] && entry['What kind?'].trim() !== '' ? entry['What kind?'] : 'N/A');
                detailsDiv.appendChild(nameSpan);

                const timeSpan = document.createElement('span');
                timeSpan.classList.add('transaction-time');
                timeSpan.textContent = entry.Time || '';
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

        if (filteredData.length === 0) {
            transactionsListDiv.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 2rem;">No transactions found for the selected filters.</p>';
        }
    }

    // --- Common Logic & Event Listeners ---

    const fabButton = document.querySelector('.fab-button');
    if (fabButton) {
        fabButton.addEventListener('click', () => {
            window.open(GOOGLE_FORM_URL, '_blank');
        });
    }

    if (document.getElementById('dashboard-page')) {
        updateDashboard();
    } else if (document.getElementById('transactions-page')) {
        const today = new Date();
        let currentMonth = today.getMonth() + 1; // Default to current month

        // Get filter elements
        const filterButton = document.getElementById('filterButton');
        const filterOptionsContainer = document.getElementById('filterOptionsContainer');
        const categoryFilterDropdown = document.getElementById('categoryFilterDropdown');
        const startDateInput = document.getElementById('startDateInput');
        const endDateInput = document.getElementById('endDateInput');
        const applyFiltersButton = document.getElementById('applyFiltersButton');
        const clearFiltersButton = document.getElementById('clearFiltersButton');

        // Event listener for main Filter button (toggle visibility)
        if (filterButton) {
            filterButton.addEventListener('click', () => {
                filterOptionsContainer.style.display = filterOptionsContainer.style.display === 'flex' ? 'none' : 'flex';
            });
        }

        // Apply Filters button click
        if (applyFiltersButton) {
            applyFiltersButton.addEventListener('click', () => {
                const selectedCategory = categoryFilterDropdown.value;
                const startDate = startDateInput.value; // Will be empty string if not set
                const endDate = endDateInput.value; // Will be empty string if not set

                // Get the currently active month button's month value
                const activeMonthButton = document.querySelector('.month-button.active');
                currentMonth = activeMonthButton ? parseInt(activeMonthButton.dataset.month) : null; // Use null if no specific month is active (e.g., custom date filter takes precedence)

                // If custom dates are selected, override month filter
                const finalMonth = (startDate || endDate) ? null : currentMonth; // If dates are present, don't filter by month

                renderTransactions(finalMonth, selectedCategory, startDate, endDate);
                filterOptionsContainer.style.display = 'none'; // Hide filters after applying
            });
        }

        // Clear Filters button click
        if (clearFiltersButton) {
            clearFiltersButton.addEventListener('click', () => {
                categoryFilterDropdown.value = ''; // Reset dropdown
                startDateInput.value = ''; // Clear date inputs
                endDateInput.value = ''; // Clear date inputs

                // Re-activate current month button and re-render
                const today = new Date();
                currentMonth = today.getMonth() + 1;
                const monthButtons = document.querySelectorAll('.month-button');
                monthButtons.forEach(btn => btn.classList.remove('active'));
                const currentMonthBtn = document.querySelector(`.month-button[data-month="${currentMonth}"]`);
                if (currentMonthBtn) {
                    currentMonthBtn.classList.add('active');
                }
                renderTransactions(currentMonth); // Render with only current month filter
                filterOptionsContainer.style.display = 'none'; // Hide filters
            });
        }


        // Set initial active month button
        const monthButtons = document.querySelectorAll('.month-button');
        monthButtons.forEach(button => {
            if (parseInt(button.dataset.month) === currentMonth) {
                button.classList.add('active');
            }
        });

        // Set date in profile icon on transactions page
        const profileDateDisplay = document.getElementById('profileDateDisplay');
        if (profileDateDisplay) {
            const monthName = today.toLocaleDateString('en-US', { month: 'short' });
            const dayOfMonth = today.getDate();
            profileDateDisplay.innerHTML = `<span>${monthName}</span><span>${dayOfMonth}</span>`;
        }

        // Add event listeners for month buttons
        monthButtons.forEach(button => {
            button.addEventListener('click', function() {
                monthButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                currentMonth = parseInt(this.dataset.month); // Update currentMonth
                // Clear custom date filters when a month is selected
                startDateInput.value = '';
                endDateInput.value = '';
                categoryFilterDropdown.value = ''; // Clear category filter too
                renderTransactions(currentMonth);
                filterOptionsContainer.style.display = 'none'; // Hide filters after month selection
            });
        });

        // Initial data fetch and render for transactions page
        fetchAndProcessTransactions();
    }
});
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
