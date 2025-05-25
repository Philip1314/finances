document.addEventListener('DOMContentLoaded', () => {
    const CSV_URL = 'https://docs.google.com/sheets/d/e/2PACX-1vQgMFbI8pivLbRpc2nL2Gyoxw47PmXEVxvUDrjr-t86gj4-J3QM8uV7m8iJN9wxlYo3IY5FQqqUICei/pub?output=csv';
    const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdrDJoOeo264aOn4g2UEe-K-FHpbssBAVmEtOWoW46Q1cwjgg/viewform?usp=header';

    let allFetchedData = []; // Store all data once fetched for both dashboard and transactions

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
                case 'transportation': icon = '🚌'; break; // Removed category for common ones
                case 'utility bills': icon = '💡'; break; // Removed category for common ones
                case 'allowance': category = 'Misc'; icon = '🚶'; break; // Fixed category for allowance here
                default: category = 'Misc'; icon = '✨'; break;
            }
        }
        return { category, icon };
    }

    // --- Dashboard Specific Logic (index.html) ---
    async function updateDashboard(filterMonth = null, filterYear = null) {
        if (!document.getElementById('dashboard-page')) return;

        // Use allFetchedData directly
        let filteredData = allFetchedData;

        // Apply month and year filters
        if (filterMonth !== null || filterYear !== null) {
            filteredData = filteredData.filter(entry => {
                const date = new Date(entry.Date);
                // Ensure date is valid before processing
                if (isNaN(date.getTime())) return false;

                const entryMonth = date.getMonth() + 1; // 1-indexed
                const entryYear = date.getFullYear();

                const monthMatch = (filterMonth === null || entryMonth === parseInt(filterMonth));
                const yearMatch = (filterYear === null || entryYear === parseInt(filterYear));

                return monthMatch && yearMatch;
            });
        }

        let totalExpensesAmount = 0;
        let totalGainsAmount = 0;

        const expenseCategoriesForChart = { Food: 0, Medicines: 0, Shopping: 0, Misc: 0 };

        filteredData.forEach(entry => {
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
    }

    // Function to populate year dropdown on dashboard
    function populateDashboardYearFilter() {
        const yearFilterDropdown = document.getElementById('dashboardYearFilter');
        if (!yearFilterDropdown || allFetchedData.length === 0) return;

        const years = new Set();
        allFetchedData.forEach(entry => {
            const date = new Date(entry.Date);
            if (!isNaN(date.getTime())) { // Make sure the date is valid
                years.add(date.getFullYear());
            }
        });

        // Clear existing options except "All Years"
        yearFilterDropdown.innerHTML = '<option value="">All Years</option>';

        // Add sorted years
        Array.from(years).sort((a, b) => b - a).forEach(year => { // Sort descending
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearFilterDropdown.appendChild(option);
        });
    }

    // --- Transactions Page Specific Logic (transactions.html) ---

    function populateCategoryFilter() {
        const categoryFilterDropdown = document.getElementById('categoryFilterDropdown');
        if (!categoryFilterDropdown) return;

        categoryFilterDropdown.innerHTML = '<option value="">All Categories</option>';

        const uniqueCategories = new Set();
        allFetchedData.forEach(entry => {
            if (entry['What kind?']) {
                uniqueCategories.add(entry['What kind?'].trim());
            }
        });

        const sortedCategories = Array.from(uniqueCategories).sort();
        const finalCategories = []; // Start with an empty array

        // Add "Gains" and "Expenses" at the very top if they are relevant types
        const hasGains = allFetchedData.some(entry => entry.Type && entry.Type.toLowerCase() === 'gains');
        const hasExpenses = allFetchedData.some(entry => entry.Type && entry.Type.toLowerCase() === 'expenses');

        if (hasGains) finalCategories.push('Gains');
        if (hasExpenses) finalCategories.push('Expenses');


        sortedCategories.forEach(cat => {
            // Add specific categories, excluding the generic 'Gains' or 'Expenses' if they are already added
            // and avoiding duplicates
            const lowerCat = cat.toLowerCase();
            // Check if the specific category is directly "gains" or "expenses" which are already added as top-level
            if (lowerCat !== 'gains' && lowerCat !== 'expenses' && !finalCategories.includes(cat)) {
                finalCategories.push(cat);
            }
        });

        finalCategories.sort((a, b) => {
            // Keep Gains/Expenses at top, then sort alphabetically for others
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


    function renderTransactions(selectedMonth = null, selectedCategory = '', startDate = null, endDate = null) {
        const transactionsListDiv = document.getElementById('transactionsList');
        if (!transactionsListDiv) return;

        let filteredData = allFetchedData.filter(entry => {
            const amount = parseFloat(entry.Amount);
            const date = new Date(entry.Date);
            const entryType = entry.Type ? entry.Type.toLowerCase() : '';
            const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : ''; // Use 'What kind?' here

            if (isNaN(amount) || isNaN(date.getTime()) || !entryType) { // Check for valid date
                console.warn('Skipping malformed entry:', entry);
                return false;
            }

            const entryDate = new Date(entry.Date);
            entryDate.setHours(0, 0, 0, 0);

            // Month filtering (applied only if no custom dates)
            if (selectedMonth !== null && !(startDate || endDate)) {
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
            // Handle cases where date conversion might fail for 'Today'/'Yesterday' strings
            if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
                return dateB - dateA;
            }
            return 0; // Maintain original order if dates are not valid
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
                // Compare hours, then minutes, then seconds
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

    // --- Initial Data Fetch (for both pages) ---
    async function fetchAllDataAndInitialize() {
        try {
            const response = await fetch(CSV_URL);
            const csv = await response.text();
            allFetchedData = parseCSV(csv); // Populate global data store

            if (document.getElementById('dashboard-page')) {
                populateDashboardYearFilter(); // Populate years for dashboard
                updateDashboard(); // Initial dashboard render (all time)
            } else if (document.getElementById('transactions-page')) {
                // Initialize transaction page elements and render current month's transactions
                const today = new Date();
                const currentMonth = today.getMonth() + 1; // 1-indexed

                const monthButtons = document.querySelectorAll('.month-button');
                monthButtons.forEach(button => {
                    if (parseInt(button.dataset.month) === currentMonth) {
                        button.classList.add('active');
                    }
                });

                const profileDateDisplay = document.getElementById('profileDateDisplay');
                if (profileDateDisplay) {
                    const monthName = today.toLocaleDateString('en-US', { month: 'short' });
                    const dayOfMonth = today.getDate();
                    profileDateDisplay.innerHTML = `<span>${monthName}</span><span>${dayOfMonth}</span>`;
                }

                populateCategoryFilter(); // Populate category filter for transactions page
                renderTransactions(currentMonth); // Initial render with current month
            }
        } catch (error) {
            console.error('Error fetching all data:', error);
            // Handle global error if data cannot be fetched at all
            if (document.getElementById('netExpenseValue')) document.getElementById('netExpenseValue').textContent = '₱ Error';
            if (document.getElementById('remainingBalanceAmount')) document.getElementById('remainingBalanceAmount').textContent = '₱ Error';
            const transactionsListDiv = document.getElementById('transactionsList');
            if (transactionsListDiv) {
                transactionsListDiv.innerHTML = '<p style="text-align: center; color: var(--accent-red); padding: 2rem;">Error loading data. Please check the data source.</p>';
            }
        }
    }


    // --- Common Logic & Event Listeners ---

    const fabButton = document.querySelector('.fab-button');
    if (fabButton) {
        fabButton.addEventListener('click', () => {
            window.open(GOOGLE_FORM_URL, '_blank');
        });
    }

    // Initialize all data fetch on DOMContentLoaded
    fetchAllDataAndInitialize();


    // Dashboard Filter Listeners
    if (document.getElementById('dashboard-page')) {
        const dashboardFilterButton = document.getElementById('dashboardFilterButton');
        const dashboardFilterOptionsContainer = document.getElementById('dashboardFilterOptionsContainer');
        const dashboardMonthFilter = document.getElementById('dashboardMonthFilter');
        const dashboardYearFilter = document.getElementById('dashboardYearFilter');
        const applyDashboardFilterButton = document.getElementById('applyDashboardFilterButton');
        const clearDashboardFilterButton = document.getElementById('clearDashboardFilterButton');

        // Toggle filter options visibility
        if (dashboardFilterButton) {
            dashboardFilterButton.addEventListener('click', () => {
                dashboardFilterOptionsContainer.style.display = dashboardFilterOptionsContainer.style.display === 'flex' ? 'none' : 'flex';
            });
        }

        // Apply Dashboard Filters
        if (applyDashboardFilterButton) {
            applyDashboardFilterButton.addEventListener('click', () => {
                const selectedMonth = dashboardMonthFilter.value === "" ? null : dashboardMonthFilter.value;
                const selectedYear = dashboardYearFilter.value === "" ? null : dashboardYearFilter.value;
                updateDashboard(selectedMonth, selectedYear);
                dashboardFilterOptionsContainer.style.display = 'none'; // Hide after applying
            });
        }

        // Clear Dashboard Filters
        if (clearDashboardFilterButton) {
            clearDashboardFilterButton.addEventListener('click', () => {
                dashboardMonthFilter.value = ''; // Reset to "All Months"
                dashboardYearFilter.value = '';  // Reset to "All Years"
                updateDashboard(null, null); // Render all time
                dashboardFilterOptionsContainer.style.display = 'none'; // Hide after clearing
            });
        }
    }

    // Transactions Page Listeners
    if (document.getElementById('transactions-page')) {
        let currentMonth; // Declare outside to be accessible

        const monthButtons = document.querySelectorAll('.month-button');

        // Transactions page filter elements
        const filterButton = document.getElementById('filterButton');
        const filterOptionsContainer = document.getElementById('filterOptionsContainer');
        const categoryFilterDropdown = document.getElementById('categoryFilterDropdown');
        const startDateInput = document.getElementById('startDateInput');
        const endDateInput = document.getElementById('endDateInput');
        const applyFiltersButton = document.getElementById('applyFiltersButton');
        const clearFiltersButton = document.getElementById('clearFiltersButton');

        if (filterButton) {
            filterButton.addEventListener('click', () => {
                filterOptionsContainer.style.display = filterOptionsContainer.style.display === 'flex' ? 'none' : 'flex';
            });
        }

        if (applyFiltersButton) {
            applyFiltersButton.addEventListener('click', () => {
                const selectedCategory = categoryFilterDropdown.value;
                const startDate = startDateInput.value;
                const endDate = endDateInput.value;

                const activeMonthButton = document.querySelector('.month-button.active');
                // If a month button is active, use its value, otherwise null
                const selectedMonthFromButton = activeMonthButton ? parseInt(activeMonthButton.dataset.month) : null;

                // If custom dates are selected, override month filter
                const finalMonthFilter = (startDate || endDate) ? null : selectedMonthFromButton;

                renderTransactions(finalMonthFilter, selectedCategory, startDate, endDate);
                filterOptionsContainer.style.display = 'none';
            });
        }

        if (clearFiltersButton) {
            clearFiltersButton.addEventListener('click', () => {
                categoryFilterDropdown.value = '';
                startDateInput.value = '';
                endDateInput.value = '';

                const today = new Date();
                currentMonth = today.getMonth() + 1; // Reset to current month
                monthButtons.forEach(btn => btn.classList.remove('active'));
                const currentMonthBtn = document.querySelector(`.month-button[data-month="${currentMonth}"]`);
                if (currentMonthBtn) {
                    currentMonthBtn.classList.add('active');
                }
                renderTransactions(currentMonth); // Render with only current month filter
                filterOptionsContainer.style.display = 'none';
            });
        }

        monthButtons.forEach(button => {
            button.addEventListener('click', function() {
                monthButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                currentMonth = parseInt(this.dataset.month);
                startDateInput.value = ''; // Clear custom date filters
                endDateInput.value = '';    // Clear custom date filters
                categoryFilterDropdown.value = ''; // Clear category filter too
                renderTransactions(currentMonth);
                filterOptionsContainer.style.display = 'none'; // Hide filters after month selection
            });
        });

        // The initial rendering of transactions on page load is now handled within fetchAllDataAndInitialize
    }
});
