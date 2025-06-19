document.addEventListener('DOMContentLoaded', () => {
    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS6QS-O5TLQmVn8WMeyfSVmLfJPtL11TwmnZn4NVgklXKFRbJwK5A7jiPYU1srHVDxUDvI8KIXBqnNx/pub?output=csv';
    const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSe4-6PXN21Zrnexp8bUbdU5IhaokIEoUKwsFeRU0yYzllcPJA/viewform?usp=header';

    // --- Pagination Globals ---
    const ITEMS_PER_PAGE = 15;
    let currentTransactionsPage = 1;
    let currentSavingsPage = 1;
    let allTransactionsData = []; // Store all fetched data for consistent filtering and pagination
    let allSavingsDataGlobal = []; // Store all fetched savings data for pagination

    /**
     * Parses a CSV string into an array of objects.
     * @param {string} csv - The CSV data as a string.
     * @returns {Array<Object>} An array of objects, where each object represents a row.
     */
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

    /**
     * Formats a number as a currency string (Philippine Peso).
     * @param {number|string} amount - The amount to format.
     * @returns {string} The formatted currency string.
     */
    function formatCurrency(amount) {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount)) {
            return '₱ 0.00';
        }
        return `₱ ${numAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    /**
     * Maps a transaction entry to a display category and icon.
     * @param {Object} entry - The transaction entry object.
     * @returns {{category: string, icon: string}} An object containing the category name and its corresponding emoji icon.
     */
    function mapCategoryAndIcon(entry) {
        let category = 'Misc';
        let icon = '✨';

        const lowerCaseWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';
        const lowerCaseType = entry.Type ? entry.Type.toLowerCase() : '';

        if (lowerCaseType === 'gains') {
            category = 'Gain';
            switch (lowerCaseWhatKind) {
                case 'salary': icon = '💸'; break;
                case 'allowance': icon = '🎁'; break;
                case 'savings contribution':
                case 'savings':
                    icon = '💰'; break; // Could be a savings deposit or withdrawal indicator
                default: icon = '💰'; break;
            }
        } else if (lowerCaseType === 'expenses') {
            switch (lowerCaseWhatKind) {
                case 'food': case 'groceries': category = 'Food'; icon = '🍔'; break;
                case 'medicines': category = 'Medicines'; icon = '💊'; break;
                case 'online shopping': category = 'Shopping'; icon = '🛍️'; break;
                case 'transportation': category = 'Transportation'; icon = '🚌'; break;
                case 'utility bills': category = 'Utility Bills'; icon = '💡'; break;
                case 'savings':
                    icon = '📉'; // Icon indicating expenditure towards savings
                    break;
                default: category = 'Misc'; icon = '✨'; break;
            }
        }
        return { category, icon };
    }

    // --- Dark Mode Toggle ---
    const nightModeToggle = document.getElementById('nightModeToggle');
    const body = document.body;
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        body.classList.add(savedTheme);
    } else {
        body.classList.add('light-mode');
    }

    if (nightModeToggle) {
        nightModeToggle.addEventListener('click', () => {
            if (body.classList.contains('light-mode')) {
                body.classList.remove('light-mode');
                body.classList.add('dark-mode');
                localStorage.setItem('theme', 'dark-mode');
            } else {
                body.classList.remove('dark-mode');
                body.classList.add('light-mode');
                localStorage.setItem('theme', 'light-mode');
            }
            // For dashboard, re-apply filters that might be set to update chart colors
            if (document.getElementById('dashboard-page')) {
                const filterMonthSelect = document.getElementById('filterMonth');
                const filterYearSelect = document.getElementById('filterYear');
                const selectedMonth = filterMonthSelect ? filterMonthSelect.value : 'All';
                const selectedYear = filterYearSelect ? filterYearSelect.value : 'All';
                updateDashboard(selectedMonth, selectedYear);
            }
        });
    }

    // --- Hamburger Menu Logic ---
    const mainMenuButton = document.getElementById('mainMenuButton');
    const mainMenuSidebar = document.getElementById('mainMenuSidebar');
    const closeSidebarButton = document.getElementById('closeSidebarButton');
    if (mainMenuButton && mainMenuSidebar && closeSidebarButton) {
        mainMenuButton.addEventListener('click', () => mainMenuSidebar.classList.add('open'));
        closeSidebarButton.addEventListener('click', () => mainMenuSidebar.classList.remove('open'));
        document.addEventListener('click', (event) => {
            if (mainMenuSidebar.classList.contains('open') &&
                !mainMenuSidebar.contains(event.target) &&
                !mainMenuButton.contains(event.target)) {
                mainMenuSidebar.classList.remove('open');
            }
        });
    }

    /**
     * Updates the dashboard view with filtered data and renders charts/summaries.
     * This function now always calculates total savings from ALL transactions.
     * @param {string} filterMonth - The month to filter by ('All' or 1-12).
     * @param {string} filterYear - The year to filter by ('All' or specific year).
     */
    async function updateDashboard(filterMonth = 'All', filterYear = 'All') {
        if (!document.getElementById('dashboard-page')) return;
        try {
            const response = await fetch(CSV_URL);
            const csv = await response.text();
            allTransactionsData = parseCSV(csv); // Store all data globally

            // Populate year filter dropdown
            const years = new Set();
            allTransactionsData.forEach(entry => {
                const entryDate = new Date(entry.Date);
                if (!isNaN(entryDate.getFullYear())) {
                    years.add(entryDate.getFullYear());
                }
            });
            const sortedYears = Array.from(years).sort((a, b) => b - a); // Descending order
            const filterYearSelect = document.getElementById('filterYear');
            if (filterYearSelect) {
                filterYearSelect.innerHTML = '<option value="All">All Years</option>';
                sortedYears.forEach(year => {
                    const option = document.createElement('option');
                    option.value = year;
                    option.textContent = year;
                    filterYearSelect.appendChild(option);
                });
                // Set the selected year if it was previously filtered
                if (filterYear !== 'All') {
                    filterYearSelect.value = filterYear;
                }
            }
            // Set the selected month if it was previously filtered
            const filterMonthSelect = document.getElementById('filterMonth');
            if (filterMonthSelect && filterMonth !== 'All') {
                filterMonthSelect.value = filterMonth;
            }

            // Calculate total savings from ALL transactions (not filtered by month/year)
            let totalSavingsAmountOverall = 0;
            allTransactionsData.forEach(entry => {
                const amount = parseFloat(entry.Amount);
                const entryType = entry.Type ? entry.Type.toLowerCase() : '';
                const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';

                if (isNaN(amount) || !entryType) {
                    console.warn('Savings Calculation - Skipping malformed entry:', entry);
                    return;
                }

                if (entryType === 'expenses' && entryWhatKind === 'savings') {
                    // Money spent on "savings" increases totalSavingsAmountOverall (money moved INTO savings)
                    totalSavingsAmountOverall += amount;
                } else if (entryType === 'gains' && (entryWhatKind === 'savings contribution' || entryWhatKind === 'savings')) {
                    // Money gained from "savings contribution" decreases totalSavingsAmountOverall (money moved OUT of general funds, into savings)
                    totalSavingsAmountOverall -= amount;
                }
            });

            // Update savings display on dashboard
            const savingsAmountSpan = document.getElementById('savingsAmount');
            if (savingsAmountSpan) {
                savingsAmountSpan.dataset.actualAmount = totalSavingsAmountOverall;
                // If it was unmasked before, re-mask it by default on page load or filter change
                const maskSavingsButton = document.getElementById('maskSavingsButton');
                if (maskSavingsButton && maskSavingsButton.textContent === 'Mask') {
                     savingsAmountSpan.textContent = formatCurrency(totalSavingsAmountOverall);
                } else {
                     savingsAmountSpan.textContent = '₱ ●●●,●●●.●●'; // Masked display
                }
            }


            // Calculations for the Expense Breakdown chart (filtered by month/year)
            let totalExpensesAmountFiltered = 0;
            let totalGainsAmountFiltered = 0;
            const expenseCategoriesForChart = { Food: 0, Medicines: 0, Shopping: 0, Misc: 0 };

            const filteredDashboardData = allTransactionsData.filter(entry => {
                const entryDate = new Date(entry.Date);
                if (isNaN(entryDate.getTime())) return false;

                const entryMonth = entryDate.getMonth() + 1;
                const entryYear = entryDate.getFullYear();

                const matchesMonth = (filterMonth === 'All' || entryMonth === parseInt(filterMonth));
                const matchesYear = (filterYear === 'All' || entryYear === parseInt(filterYear));

                return matchesMonth && matchesYear;
            });

            filteredDashboardData.forEach(entry => {
                const amount = parseFloat(entry.Amount);
                const entryType = entry.Type ? entry.Type.toLowerCase() : '';
                const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';

                if (isNaN(amount) || !entryType) return; // Skip malformed entries

                if (entryType === 'expenses') {
                    totalExpensesAmountFiltered += amount;
                    if (entryWhatKind === 'food' || entryWhatKind === 'groceries') expenseCategoriesForChart.Food += amount;
                    else if (entryWhatKind === 'medicines') expenseCategoriesForChart.Medicines += amount;
                    else if (entryWhatKind === 'online shopping') expenseCategoriesForChart.Shopping += amount;
                    else expenseCategoriesForChart.Misc += amount;
                } else if (entryType === 'gains') {
                    totalGainsAmountFiltered += amount;
                }
            });

            document.getElementById('netExpenseValue').textContent = formatCurrency(totalExpensesAmountFiltered);
            const remainingBalance = totalGainsAmountFiltered - totalExpensesAmountFiltered;
            const totalIncomeOrBudget = totalGainsAmountFiltered; // Assuming total gains is the budget for the period
            document.getElementById('remainingBalanceAmount').textContent = `${formatCurrency(remainingBalance)} of ${formatCurrency(totalIncomeOrBudget)}`;

            let remainingBalancePercentage = totalIncomeOrBudget > 0 ? (remainingBalance / totalIncomeOrBudget) * 100 : 0;
            const displayPercentage = isNaN(remainingBalancePercentage) ? 0 : Math.round(remainingBalancePercentage);
            document.getElementById('remainingBalancePct').textContent = `${displayPercentage}%`;

            let progressOffset = 0;
            let progressColor = 'var(--accent-green)';
            const radius = 34;
            const circumference = 2 * Math.PI * radius;

            if (displayPercentage >= 100) progressOffset = 0;
            else if (displayPercentage > 0) {
                progressOffset = circumference - (displayPercentage / 100) * circumference;
                if (displayPercentage < 25) progressColor = 'var(--accent-red)';
                else if (displayPercentage < 50) progressColor = 'var(--accent-orange)';
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

            const categoryNames = Object.keys(expenseCategoriesForChart).filter(cat => expenseCategoriesForChart[cat] > 0);
            const categoryAmounts = categoryNames.map(cat => expenseCategoriesForChart[cat]);
            const totalCategoryExpenseForChart = categoryAmounts.reduce((sum, amount) => sum + amount, 0);

            document.getElementById('foodPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Food / totalCategoryExpenseForChart) * 100) : 0}%`;
            document.getElementById('medicinesPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Medicines / totalCategoryExpenseForChart) * 100) : 0}%`;
            document.getElementById('shoppingPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Shopping / totalCategoryExpenseForChart) * 100) : 0}%`;
            document.getElementById('miscPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Misc / totalCategoryExpenseForChart) * 100) : 0}%`;

            const ctx = document.getElementById('expenseChart');
            if (ctx) {
                if (window.expenseChartInstance) window.expenseChartInstance.destroy();

                const categoryColorMap = {
                    'Food': getComputedStyle(document.documentElement).getPropertyValue('--accent-green').trim(),
                    'Medicines': getComputedStyle(document.documentElement).getPropertyValue('--accent-red').trim(),
                    'Shopping': getComputedStyle(document.documentElement).getPropertyValue('--accent-orange').trim(),
                    'Misc': getComputedStyle(document.documentElement).getPropertyValue('--accent-blue').trim(),
                };
                const chartBackgroundColors = categoryNames.map(cat => categoryColorMap[cat] || 'gray');

                window.expenseChartInstance = new Chart(ctx.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: categoryNames,
                        datasets: [{
                            data: categoryAmounts,
                            backgroundColor: chartBackgroundColors,
                            borderColor: 'var(--card-bg)',
                            borderWidth: 4,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '80%',
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                callbacks: {
                                    label: (c) => `${c.label}: ${formatCurrency(c.parsed)}`
                                }
                            }
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error fetching or processing CSV for dashboard:', error);
            // Display a user-friendly error message on the dashboard if data fails to load
            document.getElementById('netExpenseValue').textContent = '₱ Error';
            document.getElementById('remainingBalanceAmount').textContent = 'Data Error';
            document.getElementById('remainingBalancePct').textContent = 'ERR%';
            const expenseChartContainer = document.querySelector('.chart-container');
            if (expenseChartContainer) {
                expenseChartContainer.innerHTML = '<p style="text-align: center; color: var(--accent-red);">Failed to load expense data. Please try again later.</p>';
            }
        }
    }


    // --- Transaction Page Logic (transactions.html) ---
    // This logic assumes a 'transactions-page' ID on the body or a container element
    if (document.getElementById('transactions-page')) {
        const transactionListDiv = document.getElementById('transactionList');
        const prevPageButton = document.getElementById('prevPage');
        const nextPageButton = document.getElementById('nextPage');
        const currentPageSpan = document.getElementById('currentPage');
        const totalPagesSpan = document.getElementById('totalPages');

        const openFilterModalButton = document.getElementById('openFilterModal');
        const filterModal = document.getElementById('filterModal');
        const closeFilterModalButton = document.getElementById('closeFilterModal');
        const applyFilterButton = document.getElementById('applyFilterButton');
        const resetFiltersButton = document.getElementById('resetFiltersButton');
        const categoryFilterDropdown = document.getElementById('categoryFilter');
        const typeFilterDropdown = document.getElementById('typeFilter');
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        const searchInput = document.getElementById('searchInput'); // New search input
        const filterOptionsContainer = document.getElementById('filterOptionsContainer'); // For transaction page

        let filteredTransactionsData = []; // Data after search and category/type filters
        let currentMonthTransactions = []; // Data for the currently selected month/year filter

        // Setup filter modal interactions
        if (openFilterModalButton && filterModal && closeFilterModalButton) {
            openFilterModalButton.addEventListener('click', () => filterModal.classList.add('show'));
            closeFilterModalButton.addEventListener('click', () => filterModal.classList.remove('show'));
            filterModal.addEventListener('click', (event) => {
                if (event.target === filterModal) { // Close when clicking outside content
                    filterModal.classList.remove('show');
                }
            });
        }

        /**
         * Renders the transactions list for the current page.
         * @param {Array<Object>} dataToRender - The array of transaction objects to display.
         */
        function displayTransactions(dataToRender) {
            if (!transactionListDiv) return;
            transactionListDiv.innerHTML = ''; // Clear previous transactions
            const startIndex = (currentTransactionsPage - 1) * ITEMS_PER_PAGE;
            const endIndex = startIndex + ITEMS_PER_PAGE;
            const transactionsToDisplay = dataToRender.slice(startIndex, endIndex);

            if (transactionsToDisplay.length === 0) {
                transactionListDiv.innerHTML = '<p style="text-align: center; color: var(--text-light);">No transactions found for the selected filters.</p>';
                currentPageSpan.textContent = '0';
                totalPagesSpan.textContent = '0';
                prevPageButton.disabled = true;
                nextPageButton.disabled = true;
                return;
            }

            transactionsToDisplay.forEach(entry => {
                const transactionItem = document.createElement('div');
                transactionItem.classList.add('transaction-item');

                const { category, icon } = mapCategoryAndIcon(entry);
                const amountClass = entry.Type && entry.Type.toLowerCase() === 'gains' ? 'amount-gain' : 'amount-expense';

                // Format date for display
                const transactionDate = new Date(entry.Date);
                const formattedDate = !isNaN(transactionDate.getTime()) ? transactionDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';

                transactionItem.innerHTML = `
                    <div class="transaction-details">
                        <span class="category-icon">${icon}</span>
                        <div class="transaction-info">
                            <div class="transaction-name">${entry.Name || 'N/A'}</div>
                            <div class="transaction-category-date">${category} &bull; ${formattedDate}</div>
                        </div>
                    </div>
                    <div class="transaction-amount ${amountClass}">
                        ${formatCurrency(entry.Amount)}
                    </div>
                `;
                transactionListDiv.appendChild(transactionItem);
            });
            updatePaginationControls(dataToRender.length);
        }

        /**
         * Updates pagination buttons and page number display.
         * @param {number} totalItems - Total number of items in the filtered list.
         */
        function updatePaginationControls(totalItems) {
            const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
            currentPageSpan.textContent = currentTransactionsPage;
            totalPagesSpan.textContent = totalPages;

            prevPageButton.disabled = currentTransactionsPage === 1;
            nextPageButton.disabled = currentTransactionsPage === totalPages || totalPages === 0;
        }

        /**
         * Applies filters (category, type, date range, search) to the allTransactionsData.
         * @param {number|string} selectedMonth - The month to filter by (1-12 or 'All').
         * @returns {Array<Object>} The filtered and sorted array of transactions.
         */
        function applyAllFilters(selectedMonth) {
            let data = [...allTransactionsData]; // Start with all data

            // 1. Filter by Month (from months-nav buttons)
            if (selectedMonth !== 'All') {
                data = data.filter(entry => {
                    const entryDate = new Date(entry.Date);
                    return entryDate.getMonth() + 1 === parseInt(selectedMonth);
                });
            }

            // 2. Filter by Category (from modal)
            const selectedCategory = categoryFilterDropdown.value;
            if (selectedCategory && selectedCategory !== 'All') {
                data = data.filter(entry => {
                    const { category } = mapCategoryAndIcon(entry);
                    return category.toLowerCase() === selectedCategory.toLowerCase();
                });
            }

            // 3. Filter by Type (from modal)
            const selectedType = typeFilterDropdown.value;
            if (selectedType && selectedType !== 'All') {
                data = data.filter(entry => (entry.Type ? entry.Type.toLowerCase() : '') === selectedType.toLowerCase());
            }

            // 4. Filter by Date Range (from modal)
            const startDate = startDateInput.value ? new Date(startDateInput.value) : null;
            const endDate = endDateInput.value ? new Date(endDateInput.value) : null;

            if (startDate || endDate) {
                data = data.filter(entry => {
                    const entryDate = new Date(entry.Date);
                    if (isNaN(entryDate.getTime())) return false; // Skip invalid dates

                    const isAfterStart = startDate ? entryDate >= startDate : true;
                    // For end date, consider the end of the day
                    const isBeforeEnd = endDate ? entryDate <= new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999) : true;

                    return isAfterStart && isBeforeEnd;
                });
            }

            // 5. Filter by Search Query
            const searchQuery = searchInput.value.toLowerCase().trim();
            if (searchQuery) {
                data = data.filter(entry => {
                    return (entry.Name && entry.Name.toLowerCase().includes(searchQuery)) ||
                           (entry.Description && entry.Description.toLowerCase().includes(searchQuery)) ||
                           (entry['What kind?'] && entry['What kind?'].toLowerCase().includes(searchQuery));
                });
            }

            // Sort by Date (newest first)
            data.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());

            return data;
        }


        /**
         * Renders transactions based on the selected month and current filters.
         * This is the main render function for the transactions page.
         * @param {number|string} selectedMonth - The month to filter transactions by (1-12 or 'All').
         */
        async function renderTransactions(selectedMonth = 'All') {
            try {
                const response = await fetch(CSV_URL);
                const csv = await response.text();
                allTransactionsData = parseCSV(csv); // Update global data

                // Populate Category and Type filters dynamically
                const categories = new Set();
                const types = new Set();
                allTransactionsData.forEach(entry => {
                    const { category } = mapCategoryAndIcon(entry);
                    if (category) categories.add(category);
                    if (entry.Type) types.add(entry.Type);
                });

                if (categoryFilterDropdown) {
                    categoryFilterDropdown.innerHTML = '<option value="All">All Categories</option>';
                    Array.from(categories).sort().forEach(cat => {
                        const option = document.createElement('option');
                        option.value = cat;
                        option.textContent = cat;
                        categoryFilterDropdown.appendChild(option);
                    });
                }
                if (typeFilterDropdown) {
                    typeFilterDropdown.innerHTML = '<option value="All">All Types</option>';
                    Array.from(types).sort().forEach(type => {
                        const option = document.createElement('option');
                        option.value = type;
                        option.textContent = type;
                        typeFilterDropdown.appendChild(option);
                    });
                }

                currentMonthTransactions = applyAllFilters(selectedMonth); // Apply all filters including search
                currentTransactionsPage = 1; // Reset to first page after applying filters
                displayTransactions(currentMonthTransactions);
            } catch (error) {
                console.error('Error fetching or processing CSV for transactions:', error);
                if (transactionListDiv) {
                    transactionListDiv.innerHTML = '<p style="text-align: center; color: var(--accent-red);">Failed to load transactions. Please try again later.</p>';
                }
            }
        }

        // Event Listeners for Pagination
        if (prevPageButton) prevPageButton.addEventListener('click', () => {
            if (currentTransactionsPage > 1) {
                currentTransactionsPage--;
                displayTransactions(currentMonthTransactions);
            }
        });

        if (nextPageButton) nextPageButton.addEventListener('click', () => {
            const totalPages = Math.ceil(currentMonthTransactions.length / ITEMS_PER_PAGE);
            if (currentTransactionsPage < totalPages) {
                currentTransactionsPage++;
                displayTransactions(currentMonthTransactions);
            }
        });

        // Event listeners for filter modal buttons
        if (applyFilterButton) {
            applyFilterButton.addEventListener('click', () => {
                const currentMonthBtn = document.querySelector('#transactions-page .months-nav .month-button.active');
                const selectedMonth = currentMonthBtn ? parseInt(currentMonthBtn.dataset.month) : 'All';
                renderTransactions(selectedMonth); // Re-render with applied filters
                filterModal.classList.remove('show');
            });
        }

        if (resetFiltersButton) {
            resetFiltersButton.addEventListener('click', () => {
                currentTransactionsPage = 1; // Reset page
                categoryFilterDropdown.value = ''; startDateInput.value = ''; endDateInput.value = '';
                // Also reset search input
                searchInput.value = '';
                typeFilterDropdown.value = ''; // Reset type filter

                const today = new Date(); const currentMonth = today.getMonth() + 1;
                const monthButtons = document.querySelectorAll('#transactions-page .months-nav .month-button');
                monthButtons.forEach(btn => btn.classList.remove('active'));
                const currentMonthBtn = document.querySelector(`#transactions-page .months-nav .month-button[data-month=\"${currentMonth}\"]`);
                if (currentMonthBtn) currentMonthBtn.classList.add('active');
                renderTransactions(currentMonth);
                if(filterOptionsContainer) filterOptionsContainer.style.display = 'none';
            });
        }
        // Event listener for search input (real-time filtering)
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const currentMonthBtn = document.querySelector('#transactions-page .months-nav .month-button.active');
                const selectedMonth = currentMonthBtn ? parseInt(currentMonthBtn.dataset.month) : 'All';
                renderTransactions(selectedMonth);
            });
        }

        // Initial render for transactions page
        const transactionsMonthButtons = document.querySelectorAll('#transactions-page .months-nav .month-button');
        if (transactionsMonthButtons.length > 0) {
            const today = new Date();
            const currentMonth = today.getMonth() + 1;
            const currentMonthBtn = document.querySelector(`#transactions-page .months-nav .month-button[data-month=\"${currentMonth}\"]`);
            if (currentMonthBtn) currentMonthBtn.classList.add('active');
            renderTransactions(currentMonth);
        } else {
            renderTransactions('All'); // Fallback if no month buttons exist
        }

        // Handle month button clicks on transactions page
        transactionsMonthButtons.forEach(button => {
            button.addEventListener('click', function() {
                currentTransactionsPage = 1; // Reset page
                transactionsMonthButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                const selectedMonth = parseInt(this.dataset.month);
                // Clear other filters when a month is selected, but not search
                categoryFilterDropdown.value = ''; startDateInput.value = ''; endDateInput.value = ''; typeFilterDropdown.value = '';
                renderTransactions(selectedMonth);
                if(filterOptionsContainer) filterOptionsContainer.style.display = 'none';
            });
        });

    } else if (document.getElementById('savings-page')) {
        // --- Savings Page Logic (savings.html) ---
        const savingsListDiv = document.getElementById('savingsList');
        const totalSavingsDisplay = document.getElementById('totalSavingsDisplay');
        const savingsPrevPageButton = document.getElementById('savingsPrevPage');
        const savingsNextPageButton = document.getElementById('savingsNextPage');
        const savingsCurrentPageSpan = document.getElementById('savingsCurrentPage');
        const savingsTotalPagesSpan = document.getElementById('savingsTotalPages');

        /**
         * Updates the savings page with fetched data.
         */
        async function updateSavingsPage() {
            try {
                const response = await fetch(CSV_URL);
                const csv = await response.text();
                allSavingsDataGlobal = parseCSV(csv); // Store all data globally

                let totalSavings = 0;
                const savingsEntries = [];

                allSavingsDataGlobal.forEach(entry => {
                    const amount = parseFloat(entry.Amount);
                    const type = entry.Type ? entry.Type.toLowerCase() : '';
                    const whatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';

                    if (isNaN(amount)) return;

                    if (type === 'expenses' && whatKind === 'savings') {
                        // Money moved INTO savings (expense from general funds)
                        totalSavings += amount;
                        savingsEntries.push({ ...entry, displayType: 'deposit', displayAmount: amount });
                    } else if (type === 'gains' && (whatKind === 'savings contribution' || whatKind === 'savings')) {
                        // Money moved OUT OF savings (gain to general funds)
                        totalSavings -= amount;
                        savingsEntries.push({ ...entry, displayType: 'withdrawal', displayAmount: amount });
                    }
                });

                // Sort savings entries by date, newest first
                savingsEntries.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());

                displaySavingsTransactions(savingsEntries);
                totalSavingsDisplay.textContent = formatCurrency(totalSavings);

            } catch (error) {
                console.error('Error fetching or processing CSV for savings:', error);
                if (totalSavingsDisplay) {
                    totalSavingsDisplay.textContent = '₱ Error';
                }
                if (savingsListDiv) {
                    savingsListDiv.innerHTML = '<p style="text-align: center; color: var(--accent-red);">Failed to load savings data. Please try again later.</p>';
                }
            }
        }

        /**
         * Displays a paginated list of savings transactions.
         * @param {Array<Object>} dataToRender - The array of savings transaction objects to display.
         */
        function displaySavingsTransactions(dataToRender) {
            if (!savingsListDiv) return;
            savingsListDiv.innerHTML = ''; // Clear previous transactions
            const startIndex = (currentSavingsPage - 1) * ITEMS_PER_PAGE;
            const endIndex = startIndex + ITEMS_PER_PAGE;
            const transactionsToDisplay = dataToRender.slice(startIndex, endIndex);

            if (transactionsToDisplay.length === 0) {
                savingsListDiv.innerHTML = '<p style="text-align: center; color: var(--text-light);">No savings transactions found.</p>';
                savingsCurrentPageSpan.textContent = '0';
                savingsTotalPagesSpan.textContent = '0';
                savingsPrevPageButton.disabled = true;
                savingsNextPageButton.disabled = true;
                return;
            }

            transactionsToDisplay.forEach(entry => {
                const savingsItem = document.createElement('div');
                savingsItem.classList.add('transaction-item'); // Re-use transaction-item style

                const amountClass = entry.displayType === 'deposit' ? 'amount-gain' : 'amount-expense';
                const icon = entry.displayType === 'deposit' ? '⬆️' : '⬇️'; // Up arrow for deposit, down for withdrawal

                const transactionDate = new Date(entry.Date);
                const formattedDate = !isNaN(transactionDate.getTime()) ? transactionDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';

                savingsItem.innerHTML = `
                    <div class="transaction-details">
                        <span class="category-icon">${icon}</span>
                        <div class="transaction-info">
                            <div class="transaction-name">${entry.Name || 'Savings Transaction'}</div>
                            <div class="transaction-category-date">${entry.displayType === 'deposit' ? 'Deposit' : 'Withdrawal'} &bull; ${formattedDate}</div>
                        </div>
                    </div>
                    <div class="transaction-amount ${amountClass}">
                        ${formatCurrency(entry.displayAmount)}
                    </div>
                `;
                savingsListDiv.appendChild(savingsItem);
            });
            updateSavingsPaginationControls(dataToRender.length);
        }

        /**
         * Updates savings pagination buttons and page number display.
         * @param {number} totalItems - Total number of items in the savings list.
         */
        function updateSavingsPaginationControls(totalItems) {
            const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
            savingsCurrentPageSpan.textContent = currentSavingsPage;
            savingsTotalPagesSpan.textContent = totalPages;

            savingsPrevPageButton.disabled = currentSavingsPage === 1;
            savingsNextPageButton.disabled = currentSavingsPage === totalPages || totalPages === 0;
        }

        // Event Listeners for Savings Pagination
        if (savingsPrevPageButton) savingsPrevPageButton.addEventListener('click', () => {
            if (currentSavingsPage > 1) {
                currentSavingsPage--;
                displaySavingsTransactions(allSavingsDataGlobal.filter(entry => {
                    const type = entry.Type ? entry.Type.toLowerCase() : '';
                    const whatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';
                    return (type === 'expenses' && whatKind === 'savings') || (type === 'gains' && (whatKind === 'savings contribution' || whatKind === 'savings'));
                }).sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime()));
            }
        });

        if (savingsNextPageButton) savingsNextPageButton.addEventListener('click', () => {
            const totalPages = Math.ceil(allSavingsDataGlobal.filter(entry => {
                const type = entry.Type ? entry.Type.toLowerCase() : '';
                const whatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';
                return (type === 'expenses' && whatKind === 'savings') || (type === 'gains' && (whatKind === 'savings contribution' || whatKind === 'savings'));
            }).length / ITEMS_PER_PAGE);
            if (currentSavingsPage < totalPages) {
                currentSavingsPage++;
                displaySavingsTransactions(allSavingsDataGlobal.filter(entry => {
                    const type = entry.Type ? entry.Type.toLowerCase() : '';
                    const whatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';
                    return (type === 'expenses' && whatKind === 'savings') || (type === 'gains' && (whatKind === 'savings contribution' || whatKind === 'savings'));
                }).sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime()));
            }
        });

        updateSavingsPage(); // Initial fetch and render for savings page

    }

    // --- Calculator Logic ---
    const calculatorModal = document.getElementById('calculatorModal');
    const openCalculatorButton = document.getElementById('openCalculatorButton');
    const calculatorInput = document.getElementById('calculatorInput');
    const calculatorButtons = document.querySelector('.calculator-buttons');

    let currentInput = '0';
    let operator = null;
    let firstOperand = null;
    let waitingForSecondOperand = false;

    function resetCalculator() {
        currentInput = '0';
        operator = null;
        firstOperand = null;
        waitingForSecondOperand = false;
        calculatorInput.value = currentInput;
    }

    function updateDisplay() {
        calculatorInput.value = currentInput;
    }

    function inputDigit(digit) {
        if (waitingForSecondOperand) {
            currentInput = digit;
            waitingForSecondOperand = false;
        } else {
            currentInput = currentInput === '0' ? digit : currentInput + digit;
        }
        updateDisplay();
    }

    function inputDecimal(dot) {
        if (!currentInput.includes(dot)) {
            currentInput += dot;
        }
        updateDisplay();
    }

    function handleOperator(nextOperator) {
        const inputValue = parseFloat(currentInput);

        if (operator && waitingForSecondOperand) {
            operator = nextOperator;
            return;
        }

        if (firstOperand === null) {
            firstOperand = inputValue;
        } else if (operator) {
            const result = performCalculation[operator](firstOperand, inputValue);
            currentInput = String(result);
            firstOperand = result;
        }

        waitingForSecondOperand = true;
        operator = nextOperator;
        updateDisplay();
    }

    const performCalculation = {
        '/': (firstOperand, secondOperand) => firstOperand / secondOperand,
        '*': (firstOperand, secondOperand) => firstOperand * secondOperand,
        '+': (firstOperand, secondOperand) => firstOperand + secondOperand,
        '-': (firstOperand, secondOperand) => firstOperand - secondOperand,
        '=': (firstOperand, secondOperand) => secondOperand // For equals, just display the second operand after operation
    };


    if (openCalculatorButton && calculatorModal && calculatorButtons) {
        openCalculatorButton.addEventListener('click', () => {
            calculatorModal.classList.add('show');
            resetCalculator();
        });

        // Close calculator when clicking outside the content (or on background)
        calculatorModal.addEventListener('click', (event) => {
            if (event.target === calculatorModal) {
                calculatorModal.classList.remove('show');
            }
        });

        calculatorButtons.addEventListener('click', (event) => {
            const { target } = event;
            if (!target.matches('button')) {
                return;
            }

            if (target.classList.contains('digit')) {
                inputDigit(target.textContent);
                return;
            }

            if (target.classList.contains('decimal')) {
                inputDecimal(target.textContent);
                return;
            }

            if (target.classList.contains('operator')) {
                handleOperator(target.dataset.action);
                return;
            }

            if (target.dataset.action === 'clear') {
                resetCalculator();
                return;
            }

            if (target.dataset.action === 'backspace') {
                currentInput = currentInput.slice(0, -1) || '0';
                updateDisplay();
                return;
            }

            if (target.dataset.action === 'calculate') {
                if (operator && firstOperand !== null) {
                    const inputValue = parseFloat(currentInput);
                    currentInput = String(performCalculation[operator](firstOperand, inputValue));
                    firstOperand = null;
                    operator = null;
                    waitingForSecondOperand = false;
                    updateDisplay();
                }
                return;
            }
        });
    }

    // --- Google Form Link (Add New Transaction Button) ---
    const openFormButton = document.getElementById('openFormButton');
    if (openFormButton) {
        openFormButton.addEventListener('click', () => {
            window.open(GOOGLE_FORM_URL, '_blank');
        });
    }

    // --- Mask/Unmask Savings Amount ---
    const maskSavingsButton = document.getElementById('maskSavingsButton');
    const savingsAmountSpan = document.getElementById('savingsAmount');
    if (maskSavingsButton && savingsAmountSpan) {
        maskSavingsButton.addEventListener('click', () => {
            const actualAmount = parseFloat(savingsAmountSpan.dataset.actualAmount);
            if (maskSavingsButton.textContent === 'Show') {
                savingsAmountSpan.textContent = formatCurrency(actualAmount);
                maskSavingsButton.textContent = 'Mask';
            } else {
                savingsAmountSpan.textContent = '₱ ●●●,●●●.●●';
                maskSavingsButton.textContent = 'Show';
            }
        });
    }

    // Initial dashboard update (for dashboard.html)
    // This part should run only if on the dashboard page and there are month navigation buttons
    const dashboardMonthButtons = document.querySelectorAll('#dashboard-page .months-nav .month-button');
    if (document.getElementById('dashboard-page') && dashboardMonthButtons.length > 0) {
        const today = new Date();
        const currentMonth = today.getMonth() + 1; // getMonth() is 0-indexed
        const currentMonthBtn = document.querySelector(`.months-nav .month-button[data-month=\"${currentMonth}\"]`);
        if (currentMonthBtn) {
            currentMonthBtn.classList.add('active'); // Set current month as active
        }
        updateDashboard(currentMonth.toString()); // Initial load with current month
    } else if (document.getElementById('dashboard-page')) {
        updateDashboard(); // Fallback for initial dashboard load if no month buttons or if on dashboard
    }

    // Attach event listeners to month buttons for dashboard
    if (document.getElementById('dashboard-page')) {
        const monthButtons = document.querySelectorAll('.months-nav .month-button');
        const filterChartButton = document.getElementById('filterChartButton');
        const filterModal = document.getElementById('filterModal'); // Assuming dashboard also has a filter modal for chart
        const closeFilterModalButton = document.getElementById('closeFilterModal');
        const applyChartFilterButton = document.getElementById('applyChartFilterButton');
        const resetChartFiltersButton = document.getElementById('resetChartFiltersButton');
        const filterMonthSelect = document.getElementById('filterMonth'); // Month dropdown in filter modal
        const filterYearSelect = document.getElementById('filterYear'); // Year dropdown in filter modal

        if (filterChartButton && filterModal && closeFilterModalButton) {
            filterChartButton.addEventListener('click', () => filterModal.classList.add('show'));
            closeFilterModalButton.addEventListener('click', () => filterModal.classList.remove('show'));
            filterModal.addEventListener('click', (event) => {
                if (event.target === filterModal) {
                    filterModal.classList.remove('show');
                }
            });
        }

        if (applyChartFilterButton) {
            applyChartFilterButton.addEventListener('click', () => {
                const selectedMonth = filterMonthSelect.value;
                const selectedYear = filterYearSelect.value;
                updateDashboard(selectedMonth, selectedYear);
                filterModal.classList.remove('show');
                // Remove active state from month buttons when custom filter is applied
                monthButtons.forEach(btn => btn.classList.remove('active'));
            });
        }
        if (resetChartFiltersButton) {
            resetChartFiltersButton.addEventListener('click', () => {
                filterMonthSelect.value = 'All';
                filterYearSelect.value = 'All';
                updateDashboard('All', 'All');
                filterModal.classList.remove('show');
                // Set current month as active again after resetting filters
                const today = new Date(); const currentMonth = today.getMonth() + 1;
                monthButtons.forEach(btn => btn.classList.remove('active'));
                const currentMonthBtn = document.querySelector(`.months-nav .month-button[data-month=\"${currentMonth}\"]`);
                if (currentMonthBtn) currentMonthBtn.classList.add('active');
            });
        }
        monthButtons.forEach(button => {
            button.addEventListener('click', function() {
                monthButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                const selectedMonth = parseInt(this.dataset.month);
                // Clear month and year filter dropdowns when a month button is selected
                if(filterMonthSelect) filterMonthSelect.value = 'All';
                if(filterYearSelect) filterYearSelect.value = 'All';
                updateDashboard(selectedMonth.toString(), 'All');
            });
        });
    }

    // General logic for opening Google Form when relevant FAB is clicked (for all pages with it)
    if (document.getElementById('openFormButton')) {
        document.getElementById('openFormButton').addEventListener('click', () => {
            window.open(GOOGLE_FORM_URL, '_blank');
        });
    }

    // General logic for handling month navigation buttons for transactions page (if it exists)
    if (document.getElementById('transactions-page')) {
        const monthButtons = document.querySelectorAll('#transactions-page .months-nav .month-button');
        const resetTransactionFiltersButton = document.getElementById('resetFiltersButton'); // This is for transaction page filters
        const categoryFilterDropdown = document.getElementById('categoryFilter');
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        const filterOptionsContainer = document.getElementById('filterOptionsContainer'); // For transaction page

        if (resetTransactionFiltersButton) {
            resetTransactionFiltersButton.addEventListener('click', () => {
                currentTransactionsPage = 1; // Reset page
                categoryFilterDropdown.value = ''; startDateInput.value = ''; endDateInput.value = '';
                const today = new Date(); const currentMonth = today.getMonth() + 1;
                monthButtons.forEach(btn => btn.classList.remove('active'));
                const currentMonthBtn = document.querySelector(`#transactions-page .months-nav .month-button[data-month=\"${currentMonth}\"]`);
                if (currentMonthBtn) currentMonthBtn.classList.add('active');
                renderTransactions(currentMonth);
                if(filterOptionsContainer) filterOptionsContainer.style.display = 'none';
            });
        }
        monthButtons.forEach(button => {
            button.addEventListener('click', function() {
                currentTransactionsPage = 1; // Reset page
                monthButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                const selectedMonth = parseInt(this.dataset.month);
                // Clear other filters when a month is selected
                categoryFilterDropdown.value = ''; startDateInput.value = ''; endDateInput.value = '';
                renderTransactions(selectedMonth);
                if(filterOptionsContainer) filterOptionsContainer.style.display = 'none';
            });
        });
        fetchAndProcessTransactions(); // Initial fetch and render
    } else if (document.getElementById('savings-page')) {
        updateSavingsPage();
    }
});
