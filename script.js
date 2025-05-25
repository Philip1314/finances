document.addEventListener('DOMContentLoaded', () => {
    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgMFbI8pivLbRpc2nL2Gyoxw47PmXEVxvUDrjr-t86gj4-J3QM8uV7m8iJN9wxlYo3IY5FQqqUICei/pub?output=csv';
    // ADDED: GOOGLE_FORM_URL was missing from your provided code
    const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdrDJoOeo264aOn4g2UE-K-FHpbssBAVmEtOWoW46Q1cwjgg/viewform?usp=header'; // Ensure this is your correct form URL

    let allFetchedData = []; // To store all data once fetched (used by both dashboard and transactions)

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

        // Fetch data if not already fetched
        if (allFetchedData.length === 0) {
            try {
                const response = await fetch(CSV_URL);
                const csv = await response.text();
                allFetchedData = parseCSV(csv);
            } catch (error) {
                console.error('Error fetching data for dashboard:', error);
                document.getElementById('netExpenseValue').textContent = '₱ Error';
                document.getElementById('remainingBalanceAmount').textContent = '₱ Error';
                return;
            }
        }

        let totalExpensesAmount = 0;
        let totalGainsAmount = 0;

        const expenseCategoriesForChart = { Food: 0, Medicines: 0, Shopping: 0, Misc: 0 };

        allFetchedData.forEach(entry => {
            const amount = parseFloat(entry.Amount);
            const entryType = entry.Type ? entry.Type.toLowerCase() : '';
            const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : ''; // Corrected property name

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
    }

    // --- Transactions Page Specific Logic (transactions.html) ---
    // Renamed allTransactionsData to allFetchedData as it's the same data source now
    // let allTransactionsData = []; // Store all fetched data for consistent filtering

    async function fetchAndProcessTransactions() {
        if (!document.getElementById('transactions-page')) return; // Only run if on transactions page

        try {
            const response = await fetch(CSV_URL);
            const csv = await response.text();
            allFetchedData = parseCSV(csv); // Store raw data in the shared variable

            // Populate category filter dropdown
            populateCategoryFilter();

            // Set current month active and update profile date display
            const today = new Date();
            const currentMonth = today.getMonth() + 1; // 1-indexed

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

            // Initial render of transactions for the current month.
            // This is the point where the transactions page will load data on reload.
            renderTransactions(currentMonth);

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

        categoryFilterDropdown.innerHTML = '<option value="">All Categories</option>';

        const uniqueCategories = new Set();
        allFetchedData.forEach(entry => { // Use allFetchedData here
            if (entry['What kind?']) {
                uniqueCategories.add(entry['What kind?'].trim());
            }
            // Explicitly add "Salary" and "Allowance" if they are specific gain types
            if (entry.Type && entry.Type.toLowerCase() === 'gains' && entry['What kind?'].trim() === 'Salary') {
                uniqueCategories.add('Salary');
            }
            if (entry.Type && entry.Type.toLowerCase() === 'gains' && entry['What kind?'].trim() === 'Allowance') {
                uniqueCategories.add('Allowance');
            }
        });

        const sortedCategories = Array.from(uniqueCategories).sort();
        const finalCategories = [];

        // Add "Gains" and "Expenses" at the top if relevant
        const hasGains = allFetchedData.some(entry => entry.Type && entry.Type.toLowerCase() === 'gains');
        const hasExpenses = allFetchedData.some(entry => entry.Type && entry.Type.toLowerCase() === 'expenses');

        if (hasGains) finalCategories.push('Gains');
        if (hasExpenses) finalCategories.push('Expenses');

        sortedCategories.forEach(cat => {
            const lowerCat = cat.toLowerCase();
            // Avoid adding "Gains" or "Expenses" or specific gain types like "Salary" or "Allowance" again if they are already handled as top-level filters.
            if (lowerCat !== 'gains' && lowerCat !== 'expenses' && lowerCat !== 'salary' && lowerCat !== 'allowance' && !finalCategories.includes(cat)) {
                finalCategories.push(cat);
            }
        });

        // Re-sort the final categories to put 'Gains' and 'Expenses' first, then others alphabetically
        finalCategories.sort((a, b) => {
            if (a === 'Gains') return -1;
            if (b === 'Gains') return 1;
            if (a === 'Expenses') return -1;
            if (b === 'Expenses') return 1;
            return a.localeCompare(b);
        });


        finalCategories.forEach(category => {
            if (category) {
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

        let filteredData = allFetchedData.filter(entry => { // Use allFetchedData here
            const amount = parseFloat(entry.Amount);
            const date = new Date(entry.Date);
            const entryType = entry.Type ? entry.Type.toLowerCase() : '';
            const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : ''; // Corrected property name

            if (isNaN(amount) || isNaN(date.getTime()) || !entryType) { // Use .getTime() for valid date check
                console.warn('Skipping malformed entry:', entry);
                return false;
            }

            const entryDate = new Date(entry.Date);
            entryDate.setHours(0, 0, 0, 0);

            // Month filtering (always apply if a month is specified, UNLESS custom dates are present)
            if (selectedMonth !== null && !(startDate || endDate)) { // Only apply month filter if no custom dates
                if (entryDate.getMonth() + 1 !== selectedMonth) {
                    return false;
                }
            }

            // Category filtering
            if (selectedCategory) {
                const lowerCaseSelectedCategory = selectedCategory.toLowerCase();
                const actualCategory = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';
                const entryCategoryType = entry.Type ? entry.Type.toLowerCase() : '';

                if (lowerCaseSelectedCategory === 'gains') {
                    if (entryCategoryType !== 'gains') return false;
                } else if (lowerCaseSelectedCategory === 'expenses') {
                    if (entryCategoryType !== 'expenses') return false;
                } else if (actualCategory !== lowerCaseSelectedCategory) {
                    return false;
                }
            }

            // Date range filtering
            if (startDate && endDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);

                if (entryDate < start || entryDate > end) {
                    return false;
                }
            }

            return true;
        });

        filteredData.sort((a, b) => new Date(b.Date) - new Date(a.Date)); // Sort by date descending

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
            if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) { // Use .getTime() for valid date check
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

                const { category: mappedCategory, icon: categoryIcon } = mapCategoryAndIcon(entry.Type, entry['What kind?']); // Corrected property name

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
                nameSpan.textContent = entry.Description && entry.Description.trim() !== '' ? entry.Description : (entry['What kind?'] && entry['What kind?'].trim() !== '' ? entry['What kind?'] : 'N/A'); // Corrected property name
                detailsDiv.appendChild(nameSpan);

                const timeSpan = document.createElement('span');
                timeSpan.classList.add('transaction-time');
                // Format time to AM/PM if needed, assuming entry.Time is 'HH:MM:SS' or 'HH:MM'
                if (entry.Time) {
                    try {
                        const [hours, minutes, seconds] = entry.Time.split(':').map(Number);
                        const date = new Date(); // Use a dummy date to format time
                        date.setHours(hours, minutes, seconds || 0);
                        timeSpan.textContent = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
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
        // Transactions page initialization and event listeners moved inside here
        const today = new Date();
        let currentMonth = today.getMonth() + 1; // Default to current month

        const filterButton = document.getElementById('filterButton');
        const filterOptionsContainer = document.getElementById('filterOptionsContainer');
        const categoryFilterDropdown = document.getElementById('categoryFilterDropdown');
        const startDateInput = document.getElementById('startDateInput');
        const endDateInput = document.getElementById('endDateInput');
        const applyFiltersButton = document.getElementById('applyFiltersButton');
        const clearFiltersButton = document.getElementById('clearFiltersButton');
        const monthButtons = document.querySelectorAll('.month-button'); // Also defined here

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
                const startDate = startDateInput.value;
                const endDate = endDateInput.value;

                // Get the currently active month button's month value
                const activeMonthButton = document.querySelector('.month-button.active');
                currentMonth = activeMonthButton ? parseInt(activeMonthButton.dataset.month) : null;

                // If custom dates are selected, override month filter
                const finalMonth = (startDate || endDate) ? null : currentMonth;

                renderTransactions(finalMonth, selectedCategory, startDate, endDate);
                filterOptionsContainer.style.display = 'none'; // Hide filters after applying
            });
        }

        // Clear Filters button click
        if (clearFiltersButton) {
            clearFiltersButton.addEventListener('click', () => {
                categoryFilterDropdown.value = '';
                startDateInput.value = '';
                endDateInput.value = '';

                // Re-activate current month button and re-render
                const today = new Date();
                currentMonth = today.getMonth() + 1;
                monthButtons.forEach(btn => btn.classList.remove('active'));
                const currentMonthBtn = document.querySelector(`.month-button[data-month="${currentMonth}"]`);
                if (currentMonthBtn) {
                    currentMonthBtn.classList.add('active');
                }
                renderTransactions(currentMonth); // Render with only current month filter
                filterOptionsContainer.style.display = 'none'; // Hide filters
            });
        }

        // Set initial active month button (on page load for transactions)
        monthButtons.forEach(button => {
            if (parseInt(button.dataset.month) === currentMonth) {
                button.classList.add('active');
            } else {
                button.classList.remove('active'); // Ensure only current month is active on load
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
