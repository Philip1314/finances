document.addEventListener('DOMContentLoaded', () => {
    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS6QS-O5TLQmVn8WMeyfSVmLfJPtL11TwmnZn4NVgklXKFRbJwK5A7jiPYU1srHVDxUDvI8KIXBqnNx/pub?output=csv';
    const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSe4-6PXN21Zrnexp8bUbdU5IhaokIEoUKwsFeRU0yYzllcPJA/viewform?usp=header';

    // --- Pagination Globals ---
    const ITEMS_PER_PAGE = 15;
    let currentTransactionsPage = 1;
    let currentSavingsPage = 1;
    let currentDashboardTransactionsPage = 1; // New pagination for dashboard transactions
    let allTransactionsData = []; // Store all fetched data for consistent filtering and pagination
    let allSavingsDataGlobal = []; // Store all fetched savings data for pagination (might be redundant after refactor)
    let totalSavingsAmountGlobal = 0; // NEW: Global variable for cumulative savings

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
        const lowerCaseType = type ? type.Type.toLowerCase() : '';

        if (lowerCaseType === 'gains') {
            category = 'Gain';
            switch (lowerCaseWhatKind) {
                case 'salary': icon = '💸'; break;
                case 'allowance': icon = '🎁'; break;
                case 'savings contribution':
                case 'savings': // Also handle "savings" as a gain type
                    icon = '💰'; break;
                default: icon = '💰'; break;
            }
        } else if (lowerCaseType === 'expenses') {
            switch (lowerCaseWhatKind) {
                case 'food': case 'groceries': category = 'Food'; icon = '🍔'; break;
                case 'medicines': category = 'Medicines'; icon = '💊'; break;
                case 'online shopping': category = '🛍️'; break; // Changed to icon only
                case 'transportation': icon = '🚌'; break;
                case 'utility bills': category = 'Utility Bills'; icon = '💡'; break;
                case 'savings': // Handle "savings" as an expense type for deductions
                    icon = '📉'; // A distinct icon for savings deductions
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
            // Re-render dashboard/transactions to apply new colors based on current filters
            if (document.getElementById('dashboard-page')) {
                const currentMonth = document.getElementById('filterMonth').value;
                const currentYear = document.getElementById('filterYear').value;
                updateDashboardChartAndSummary(currentMonth, currentYear);
                displayDashboardTransactions(currentMonth, currentYear);
                // No need to call calculateAndDisplayTotalSavings here as it doesn't depend on theme
            } else if (document.getElementById('transactions-page')) {
                const activeMonthBtn = document.querySelector('.months-nav .month-button.active');
                const currentSelMonth = activeMonthBtn ? parseInt(activeMonthBtn.dataset.month) : null;
                renderTransactions(currentSelMonth, document.getElementById('categoryFilterDropdown').value, document.getElementById('startDateInput').value, document.getElementById('endDateInput').value);
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

    // --- NEW: Function to calculate and display total savings globally ---
    async function calculateAndDisplayTotalSavings() {
        if (allTransactionsData.length === 0) { // Ensure data is loaded
            try {
                const response = await fetch(CSV_URL);
                const csv = await response.text();
                allTransactionsData = parseCSV(csv);
            } catch (error) {
                console.error('Error fetching CSV for total savings:', error);
                return;
            }
        }

        totalSavingsAmountGlobal = 0; // Reset for recalculation

        allTransactionsData.forEach(entry => {
            const amount = parseFloat(entry.Amount);
            const entryType = entry.Type ? entry.Type.toLowerCase() : '';
            const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';

            if (isNaN(amount) || !entryType) {
                return;
            }

            // If 'expenses' and 'savings' -> money moved TO savings (add to total)
            if (entryType === 'expenses' && entryWhatKind === 'savings') {
                totalSavingsAmountGlobal += amount;
            }
            // If 'gains' and 'savings contribution' or 'savings' -> money moved FROM savings (deduct from total)
            else if (entryType === 'gains' && (entryWhatKind === 'savings contribution' || entryWhatKind === 'savings')) {
                totalSavingsAmountGlobal -= amount;
            }
        });

        const savingsAmountSpan = document.getElementById('savingsAmount');
        if (savingsAmountSpan) {
            savingsAmountSpan.dataset.actualAmount = totalSavingsAmountGlobal;
            // Set to masked value initially, or directly display if already unmasked
            const maskSavingsButton = document.getElementById('maskSavingsButton');
            if (maskSavingsButton && maskSavingsButton.textContent === 'Show') {
                savingsAmountSpan.textContent = '₱ ●●●,●●●.●●';
            } else {
                savingsAmountSpan.textContent = formatCurrency(totalSavingsAmountGlobal);
            }
        }
        const totalSavingsAmountSpan = document.getElementById('totalSavingsAmount'); // For savings.html
        if (totalSavingsAmountSpan) {
            totalSavingsAmountSpan.textContent = formatCurrency(totalSavingsAmountGlobal);
        }
    }


    // --- Dashboard Specific Logic (index.html) ---
    // Renamed for clarity: now only updates chart and summary cards based on filters
    async function updateDashboardChartAndSummary(filterMonth = 'All', filterYear = 'All') {
        if (!document.getElementById('dashboard-page')) return;
        try {
            // Data fetch is now handled globally or by calling calculateAndDisplayTotalSavings / fetchAndProcessTransactions
            if (allTransactionsData.length === 0) {
                 const response = await fetch(CSV_URL);
                 const csv = await response.text();
                 allTransactionsData = parseCSV(csv);
            }

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


            let totalExpensesAmount = 0;
            let totalGainsAmount = 0;
            const expenseCategoriesForChart = { Food: 0, Medicines: 0, Shopping: 0, Misc: 0 };

            allTransactionsData.forEach(entry => {
                const amount = parseFloat(entry.Amount);
                const entryType = entry.Type ? entry.Type.toLowerCase() : '';
                const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';

                const entryDate = new Date(entry.Date);
                if (isNaN(amount) || !entryType || isNaN(entryDate)) {
                    console.warn('Dashboard - Skipping malformed entry:', entry);
                    return;
                }

                const entryMonth = entryDate.getMonth() + 1; // 1-indexed month
                const entryYear = entryDate.getFullYear();

                const matchesMonth = (filterMonth === 'All' || entryMonth === parseInt(filterMonth));
                const matchesYear = (filterYear === 'All' || entryYear === parseInt(filterYear));

                if (!matchesMonth || !matchesYear) {
                    return; // Skip if it doesn't match the selected filters
                }

                if (entryType === 'expenses') {
                    totalExpensesAmount += amount;
                    // Accumulate for categories based on 'What kind?'
                    if (entryWhatKind === 'food' || entryWhatKind === 'groceries') expenseCategoriesForChart.Food += amount;
                    else if (entryWhatKind === 'medicines') expenseCategoriesForChart.Medicines += amount;
                    else if (entryWhatKind === 'online shopping') expenseCategoriesForChart.Shopping += amount;
                    else expenseCategoriesForChart.Misc += amount; // All other expenses go to Misc

                } else if (entryType === 'gains') {
                    totalGainsAmount += amount;
                }
            });

            document.getElementById('netExpenseValue').textContent = formatCurrency(totalExpensesAmount);
            const remainingBalance = totalGainsAmount - totalExpensesAmount;
            const totalIncomeOrBudget = totalGainsAmount;
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

            // Filter out categories with 0 amounts for chart and legend display
            const categoryNames = Object.keys(expenseCategoriesForChart).filter(cat => expenseCategoriesForChart[cat] > 0);
            const categoryAmounts = categoryNames.map(cat => expenseCategoriesForChart[cat]);
            const totalCategoryExpenseForChart = categoryAmounts.reduce((sum, amount) => sum + amount, 0);

            // Dynamically update legend percentages based on *filtered* total
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
                        responsive: true, maintainAspectRatio: false, cutout: '80%',
                        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.label}: ${formatCurrency(c.parsed)}` } } }
                    }
                });
            }
            // The savingsAmount span is now updated by calculateAndDisplayTotalSavings()
        } catch (error) {
            console.error('Error fetching or processing CSV for dashboard:', error);
            // Handle errors gracefully
        }
    }

    // NEW: Function to display transactions on the dashboard page
    async function displayDashboardTransactions(filterMonth = 'All', filterYear = 'All', page = 1) {
        const dashboardTransactionsListDiv = document.getElementById('dashboardTransactionsList');
        const dashboardTransactionsPaginationDiv = document.getElementById('dashboardTransactionsPagination');
        const currentDashboardMonthNameSpan = document.getElementById('currentDashboardMonthName');

        if (!dashboardTransactionsListDiv || !dashboardTransactionsPaginationDiv) return;

        if (allTransactionsData.length === 0) { // Ensure data is loaded
            try {
                const response = await fetch(CSV_URL);
                const csv = await response.text();
                allTransactionsData = parseCSV(csv);
            } catch (error) {
                console.error('Error fetching CSV for dashboard transactions:', error);
                dashboardTransactionsListDiv.innerHTML = '<p style="text-align: center; color: var(--accent-red); padding: 2rem;">Error loading transactions.</p>';
                return;
            }
        }

        let filteredData = allTransactionsData.filter(entry => {
            const entryDate = new Date(entry.Date);
            if (isNaN(entryDate)) return false;

            const entryMonth = entryDate.getMonth() + 1;
            const entryYear = entryDate.getFullYear();

            const matchesMonth = (filterMonth === 'All' || entryMonth === parseInt(filterMonth));
            const matchesYear = (filterYear === 'All' || entryYear === parseInt(filterYear));

            return matchesMonth && matchesYear;
        });

        // Filter out "savings" entries from this list display
        filteredData = filteredData.filter(entry => {
            const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';
            return !(entryWhatKind === 'savings' || entryWhatKind === 'savings contribution');
        });


        filteredData.sort((a, b) => new Date(b.Date) - new Date(a.Date)); // Sort by date desc

        const totalItems = filteredData.length;
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

        currentDashboardTransactionsPage = page; // Set current page for dashboard transactions

        if (currentDashboardTransactionsPage > totalPages && totalPages > 0) currentDashboardTransactionsPage = totalPages;
        if (currentDashboardTransactionsPage < 1 && totalPages > 0) currentDashboardTransactionsPage = 1;
        else if (totalPages === 0) currentDashboardTransactionsPage = 1;

        const startIndex = (currentDashboardTransactionsPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const paginatedData = filteredData.slice(startIndex, endIndex);

        dashboardTransactionsListDiv.innerHTML = ''; // Clear previous items

        const groupedTransactions = {};
        const today = new Date();
        today.setHours(0,0,0,0);
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        paginatedData.forEach(entry => {
            const entryDate = new Date(entry.Date);
            entryDate.setHours(0,0,0,0);
            let dateHeader;

            if (entryDate.getTime() === today.getTime()) dateHeader = 'Today';
            else if (entryDate.getTime() === yesterday.getTime()) dateHeader = 'Yesterday';
            else dateHeader = entryDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

            if (!groupedTransactions[dateHeader]) groupedTransactions[dateHeader] = [];
            groupedTransactions[dateHeader].push(entry);
        });

        Object.keys(groupedTransactions).sort((a,b) => {
            const dateA = a === 'Today' ? today : (a === 'Yesterday' ? yesterday : new Date(a));
            const dateB = b === 'Today' ? today : (b === 'Yesterday' ? yesterday : new Date(b));
            return dateB.getTime() - dateA.getTime();
        }).forEach(dateHeader => {
            const groupDiv = document.createElement('div');
            groupDiv.classList.add('transaction-group');

            const dateHeaderDiv = document.createElement('div');
            dateHeaderDiv.classList.add('transaction-date-header');
            dateHeaderDiv.textContent = dateHeader;
            groupDiv.appendChild(dateHeaderDiv);

            groupedTransactions[dateHeader].forEach(entry => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('transaction-item');

                const { category, icon } = mapCategoryAndIcon(entry, entry['What kind?']);
                const iconDiv = document.createElement('div');
                iconDiv.classList.add('transaction-category-icon');
                iconDiv.classList.add(`category-${category.toLowerCase().replace(/\s/g, '-')}`); // Add class for styling
                iconDiv.textContent = icon;
                itemDiv.appendChild(iconDiv);

                const detailsDiv = document.createElement('div');
                detailsDiv.classList.add('transaction-details');

                const nameSpan = document.createElement('span');
                nameSpan.classList.add('transaction-name');
                nameSpan.textContent = entry.Name || entry['What kind?'] || category;
                detailsDiv.appendChild(nameSpan);

                const timeSpan = document.createElement('span');
                timeSpan.classList.add('transaction-time');
                timeSpan.textContent = entry.Time || '';
                detailsDiv.appendChild(timeSpan);
                itemDiv.appendChild(detailsDiv);

                const amountSpan = document.createElement('span');
                amountSpan.classList.add('transaction-amount');
                amountSpan.textContent = formatCurrency(entry.Amount);
                if (entry.Type.toLowerCase() === 'expenses') amountSpan.classList.add('expense');
                else if (entry.Type.toLowerCase() === 'gains') amountSpan.classList.add('gain');
                itemDiv.appendChild(amountSpan);

                groupDiv.appendChild(itemDiv);
            });
            dashboardTransactionsListDiv.appendChild(groupDiv);
        });

        if (paginatedData.length === 0) {
            dashboardTransactionsListDiv.innerHTML = `<p style="text-align: center; color: var(--text-light); padding: 2rem;">No transactions found for ${totalItems > 0 ? 'this page.' : 'the selected filters.'}</p>`;
        }

        setupPaginationControls(dashboardTransactionsPaginationDiv, totalPages, currentDashboardTransactionsPage, (newPage) => {
            currentDashboardTransactionsPage = newPage;
            // Get current filter values to pass them again for dashboard transactions
            const currentMonth = document.getElementById('filterMonth').value;
            const currentYear = document.getElementById('filterYear').value;
            displayDashboardTransactions(currentMonth, currentYear, newPage);
        });

        // Update the month name in the section header
        if (currentDashboardMonthNameSpan) {
            if (filterMonth === 'All') {
                currentDashboardMonthNameSpan.textContent = 'All Months';
            } else {
                const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                currentDashboardMonthNameSpan.textContent = monthNames[parseInt(filterMonth) - 1];
            }
        }
    }


    const maskSavingsButton = document.getElementById('maskSavingsButton');
    if (maskSavingsButton) {
        maskSavingsButton.addEventListener('click', () => {
            const savingsAmountSpan = document.getElementById('savingsAmount');
            if (savingsAmountSpan) {
                if (savingsAmountSpan.textContent.includes('●')) {
                    savingsAmountSpan.textContent = formatCurrency(savingsAmountSpan.dataset.actualAmount || 0);
                    maskSavingsButton.textContent = 'Mask';
                } else {
                    savingsAmountSpan.textContent = '₱ ●●●,●●●.●●'; // Adjusted mask
                    maskSavingsButton.textContent = 'Show';
                }
            }
        });
    }

    // --- Filter Modal Pop-up Logic (for Dashboard Chart) ---
    const filterChartButton = document.getElementById('filterChartButton');
    const filterModalOverlay = document.getElementById('filterModalOverlay');
    const closeFilterModalButton = document.getElementById('closeFilterModalButton');
    const filterMonthSelect = document.getElementById('filterMonth'); // This is for the modal
    const filterYearSelect = document.getElementById('filterYear');   // This is for the modal
    const applyChartFilterButton = document.getElementById('applyChartFilter');

    if (filterChartButton && filterModalOverlay && closeFilterModalButton && filterMonthSelect && filterYearSelect && applyChartFilterButton) {
        filterChartButton.addEventListener('click', () => {
            filterModalOverlay.classList.add('active');
        });

        closeFilterModalButton.addEventListener('click', () => {
            filterModalOverlay.classList.remove('active');
        });

        // Close modal if clicked outside
        filterModalOverlay.addEventListener('click', (event) => {
            if (event.target === filterModalOverlay) {
                filterModalOverlay.classList.remove('active');
            }
        });

        applyChartFilterButton.addEventListener('click', () => {
            const selectedMonth = filterMonthSelect.value;
            const selectedYear = filterYearSelect.value;
            updateDashboardChartAndSummary(selectedMonth, selectedYear); // Update chart with filters
            displayDashboardTransactions(selectedMonth, selectedYear); // Update dashboard transactions with filters
            filterModalOverlay.classList.remove('active'); // Close modal
        });
    }


    // --- Generic Pagination Setup ---
    function setupPaginationControls(containerElement, totalPages, currentPage, onPageChangeCallback) {
        containerElement.innerHTML = ''; // Clear existing controls
        if (totalPages <= 1) return;

        const createButton = (text, page, isDisabled = false, isActive = false, isEllipsis = false) => {
            const button = document.createElement(isEllipsis ? 'span' : 'button');
            button.textContent = text;
            if (!isEllipsis) {
                button.disabled = isDisabled;
                if (isActive) button.classList.add('active');
                button.addEventListener('click', () => {
                    if (!isDisabled) onPageChangeCallback(page);
                });
            } else {
                button.style.padding = '8px 12px'; // Match button padding
                button.style.color = 'var(--text-light)';
            }
            return button;
        };

        // Previous Button
        containerElement.appendChild(createButton('Previous', currentPage - 1, currentPage === 1));

        // Page Number Buttons (with ellipsis for many pages)
        const maxPagesToShow = 5; // Max number of direct page buttons
        if (totalPages <= maxPagesToShow + 2) { // Show all if not too many
            for (let i = 1; i <= totalPages; i++) {
                containerElement.appendChild(createButton(String(i), i, false, i === currentPage));
            }
        } else { // Show ellipsis
            let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
            let endPage = Math.min(totalPages, currentPage + Math.floor(maxPagesToShow / 2));

            if (startPage === 1) endPage = Math.min(totalPages, maxPagesToShow);
            if (endPage === totalPages) startPage = Math.max(1, totalPages - maxPagesToShow + 1);

            if (startPage > 1) {
                containerElement.appendChild(createButton('1', 1));
                if (startPage > 2) containerElement.appendChild(createButton('...', -1, true, false, true));
            }

            for (let i = startPage; i <= endPage; i++) {
                containerElement.appendChild(createButton(String(i), i, false, i === currentPage));
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) containerElement.appendChild(createButton('...', -1, true, false, true));
                containerElement.appendChild(createButton(String(totalPages), totalPages));
            }
        }

        // Next Button
        containerElement.appendChild(createButton('Next', currentPage + 1, currentPage === totalPages));
    }


    // --- Transactions Page Specific Logic (transactions.html) ---
    async function fetchAndProcessTransactions() {
        if (!document.getElementById('transactions-page')) return;
        try {
            const response = await fetch(CSV_URL);
            const csv = await response.text();
            allTransactionsData = parseCSV(csv); // Store all data globally

            populateCategoryFilter(); // Populate category filter for transactions page

            const initialMonth = new Date().getMonth() + 1; // Set default to current month
            // Set initial active month button
            const monthButtons = document.querySelectorAll('.months-nav .month-button');
            monthButtons.forEach(button => {
                button.classList.remove('active');
                if (parseInt(button.dataset.month) === initialMonth) {
                    button.classList.add('active');
                }
            });
            currentTransactionsPage = 1; // Reset page for initial load
            renderTransactions(initialMonth); // Initial render with current month
        } catch (error) {
            console.error('Error fetching or processing CSV for transactions:', error);
            const transactionsListDiv = document.getElementById('transactionsList');
            if (transactionsListDiv) transactionsListDiv.innerHTML = '<p style="text-align: center; color: var(--accent-red); padding: 2rem;">Error loading transactions.</p>';
        }
    }

    function populateCategoryFilter() {
        const categoryFilterDropdown = document.getElementById('categoryFilterDropdown');
        if (!categoryFilterDropdown) return;

        categoryFilterDropdown.innerHTML = '<option value="">All Categories</option>';
        const uniqueCategories = new Set();
        allTransactionsData.forEach(entry => {
            if (entry['What kind?']) uniqueCategories.add(entry['What kind?'].trim());
            if (entry.Type) uniqueCategories.add(entry.Type.trim()); // Add "Gains" and "Expenses" as main types
        });

        const sortedCategories = Array.from(uniqueCategories).sort();

        // Prioritize "Gains" and "Expenses" at the top
        const prioritized = [];
        if (sortedCategories.includes('Gains')) {
            prioritized.push('Gains');
            sortedCategories.splice(sortedCategories.indexOf('Gains'), 1);
        }
        if (sortedCategories.includes('Expenses')) {
            prioritized.push('Expenses');
            sortedCategories.splice(sortedCategories.indexOf('Expenses'), 1);
        }
        // Filter out "savings" and "savings contribution" from the transaction category filter
        // as they are handled differently for the transaction list display.
        prioritized.push(...sortedCategories.filter(cat => !['savings', 'savings contribution'].includes(cat.toLowerCase())));

        prioritized.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilterDropdown.appendChild(option);
        });
    }


    function renderTransactions(month = null, categoryFilter = '', startDate = '', endDate = '') {
        const transactionsListDiv = document.getElementById('transactionsList');
        const paginationControlsDiv = document.getElementById('transactionsPagination');
        if (!transactionsListDiv || !paginationControlsDiv) return;

        let filteredData = allTransactionsData.filter(entry => {
            const entryDate = new Date(entry.Date);
            if (isNaN(entryDate)) return false;

            const entryMonth = entryDate.getMonth() + 1;
            const entryYear = entryDate.getFullYear();
            const currentYear = new Date().getFullYear(); // Assume current year if not explicitly filtered

            // Month filter
            const matchesMonth = (month === null || month === 'All' || entryMonth === parseInt(month));

            // Year filter (from general filter dropdown, not month buttons)
            const yearFilterSelect = document.getElementById('filterYear'); // Re-using global filterYear for transactions
            const selectedYear = yearFilterSelect ? yearFilterSelect.value : 'All';
            const matchesYear = (selectedYear === 'All' || entryYear === parseInt(selectedYear));


            // Category filter
            const matchesCategory = (categoryFilter === '' ||
                entry.Type.toLowerCase() === categoryFilter.toLowerCase() ||
                (entry['What kind?'] && entry['What kind?'].toLowerCase() === categoryFilter.toLowerCase())
            );

            // Date range filter
            let matchesDateRange = true;
            if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999); // Include end date fully
                if (entryDate < start || entryDate > end) matchesDateRange = false;
            } else if (startDate) {
                const start = new Date(startDate);
                if (entryDate < start) matchesDateRange = false;
            } else if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                if (entryDate > end) matchesDateRange = false;
            }

            // Exclude savings entries from the main transaction list display
            const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';
            const isSavingsEntry = (entryWhatKind === 'savings' || entryWhatKind === 'savings contribution');


            return matchesMonth && matchesYear && matchesCategory && matchesDateRange && !isSavingsEntry;
        });

        filteredData.sort((a, b) => new Date(b.Date) - new Date(a.Date)); // Sort by date desc

        const totalItems = filteredData.length;
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

        if (currentTransactionsPage > totalPages && totalPages > 0) currentTransactionsPage = totalPages;
        if (currentTransactionsPage < 1 && totalPages > 0) currentTransactionsPage = 1;
        else if (totalPages === 0) currentTransactionsPage = 1;

        const startIndex = (currentTransactionsPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const paginatedData = filteredData.slice(startIndex, endIndex);

        transactionsListDiv.innerHTML = ''; // Clear previous items

        const groupedTransactions = {};
        const today = new Date();
        today.setHours(0,0,0,0);
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        paginatedData.forEach(entry => {
            const entryDate = new Date(entry.Date);
            entryDate.setHours(0,0,0,0);
            let dateHeader;

            if (entryDate.getTime() === today.getTime()) dateHeader = 'Today';
            else if (entryDate.getTime() === yesterday.getTime()) dateHeader = 'Yesterday';
            else dateHeader = entryDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

            if (!groupedTransactions[dateHeader]) groupedTransactions[dateHeader] = [];
            groupedTransactions[dateHeader].push(entry);
        });

        Object.keys(groupedTransactions).sort((a,b) => {
            const dateA = a === 'Today' ? today : (a === 'Yesterday' ? yesterday : new Date(a));
            const dateB = b === 'Today' ? today : (b === 'Yesterday' ? yesterday : new Date(b));
            return dateB.getTime() - dateA.getTime();
        }).forEach(dateHeader => {
            const groupDiv = document.createElement('div');
            groupDiv.classList.add('transaction-group');

            const dateHeaderDiv = document.createElement('div');
            dateHeaderDiv.classList.add('transaction-date-header');
            dateHeaderDiv.textContent = dateHeader;
            groupDiv.appendChild(dateHeaderDiv);

            groupedTransactions[dateHeader].forEach(entry => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('transaction-item');

                const { category, icon } = mapCategoryAndIcon(entry, entry['What kind?']);
                const iconDiv = document.createElement('div');
                iconDiv.classList.add('transaction-category-icon');
                iconDiv.classList.add(`category-${category.toLowerCase().replace(/\s/g, '-')}`); // Add class for styling
                iconDiv.textContent = icon;
                itemDiv.appendChild(iconDiv);

                const detailsDiv = document.createElement('div');
                detailsDiv.classList.add('transaction-details');

                const nameSpan = document.createElement('span');
                nameSpan.classList.add('transaction-name');
                nameSpan.textContent = entry.Name || entry['What kind?'] || category;
                detailsDiv.appendChild(nameSpan);

                const timeSpan = document.createElement('span');
                timeSpan.classList.add('transaction-time');
                timeSpan.textContent = entry.Time || '';
                detailsDiv.appendChild(timeSpan);
                itemDiv.appendChild(detailsDiv);

                const amountSpan = document.createElement('span');
                amountSpan.classList.add('transaction-amount');
                amountSpan.textContent = formatCurrency(entry.Amount);
                if (entry.Type.toLowerCase() === 'expenses') amountSpan.classList.add('expense');
                else if (entry.Type.toLowerCase() === 'gains') amountSpan.classList.add('gain');
                itemDiv.appendChild(amountSpan);

                groupDiv.appendChild(itemDiv);
            });
            transactionsListDiv.appendChild(groupDiv);
        });

        if (paginatedData.length === 0) {
            transactionsListDiv.innerHTML = `<p style="text-align: center; color: var(--text-light); padding: 2rem;">No transactions found for ${totalItems > 0 ? 'this page.' : 'the selected filters.'}</p>`;
        }

        setupPaginationControls(paginationControlsDiv, totalPages, currentTransactionsPage, (newPage) => {
            currentTransactionsPage = newPage;
            // Get current filter values to pass them again
            const currentCat = document.getElementById('categoryFilterDropdown').value;
            const currentStart = document.getElementById('startDateInput').value;
            const currentEnd = document.getElementById('endDateInput').value;
            const activeMonthBtn = document.querySelector('.months-nav .month-button.active');
            const currentSelMonth = activeMonthBtn ? parseInt(activeMonthBtn.dataset.month) : null;
            const finalMonthToPass = (currentStart || currentEnd) ? null : currentSelMonth; // If date range, ignore month button
            renderTransactions(finalMonthToPass, currentCat, currentStart, currentEnd);
        });
    }

    // --- Savings Page Specific Logic (savings.html) ---
    async function updateSavingsPage() {
        if (!document.getElementById('savings-page')) return;
        try {
            const response = await fetch(CSV_URL);
            const csv = await response.text();
            allTransactionsData = parseCSV(csv); // Store all data globally
            allSavingsDataGlobal = allTransactionsData.filter(entry => {
                const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';
                return (entryWhatKind === 'savings' || entryWhatKind === 'savings contribution');
            });
            calculateAndDisplayTotalSavings(); // Update the total savings display
            renderSavingsEntries(); // Render the individual savings entries
        } catch (error) {
            console.error('Error fetching or processing CSV for savings page:', error);
            const savingsListDiv = document.getElementById('savingsTransactionsList');
            if (savingsListDiv) savingsListDiv.innerHTML = '<p style="text-align: center; color: var(--accent-red); padding: 2rem;">Error loading savings data.</p>';
        }
    }

    function renderSavingsEntries() {
        const savingsListDiv = document.getElementById('savingsTransactionsList');
        const paginationControlsDiv = document.getElementById('savingsPagination');
        if (!savingsListDiv || !paginationControlsDiv) return;

        // allSavingsDataGlobal is already filtered and stored in allSavingsDataGlobal
        const sortedSavingsData = [...allSavingsDataGlobal].sort((a, b) => new Date(b.Date) - new Date(a.Date));

        const totalItems = sortedSavingsData.length;
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

        if (currentSavingsPage > totalPages && totalPages > 0) currentSavingsPage = totalPages;
        if (currentSavingsPage < 1 && totalPages > 0) currentSavingsPage = 1;
        else if (totalPages === 0) currentSavingsPage = 1;

        const startIndex = (currentSavingsPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const paginatedData = sortedSavingsData.slice(startIndex, endIndex);

        savingsListDiv.innerHTML = ''; // Clear previous items

        // Grouping and rendering logic (similar to renderTransactions)
        const groupedTransactions = {};
        const today = new Date();
        today.setHours(0,0,0,0);
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        paginatedData.forEach(entry => {
            const entryDate = new Date(entry.Date);
            entryDate.setHours(0,0,0,0);
            let dateHeader;

            if (entryDate.getTime() === today.getTime()) dateHeader = 'Today';
            else if (entryDate.getTime() === yesterday.getTime()) dateHeader = 'Yesterday';
            else dateHeader = entryDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

            if (!groupedTransactions[dateHeader]) groupedTransactions[dateHeader] = [];
            groupedTransactions[dateHeader].push(entry);
        });

        Object.keys(groupedTransactions).sort((a,b) => {
            const dateA = a === 'Today' ? today : (a === 'Yesterday' ? yesterday : new Date(a));
            const dateB = b === 'Today' ? today : (b === 'Yesterday' ? yesterday : new Date(b));
            return dateB.getTime() - dateA.getTime();
        }).forEach(dateHeader => {
            const groupDiv = document.createElement('div');
            groupDiv.classList.add('transaction-group');

            const dateHeaderDiv = document.createElement('div');
            dateHeaderDiv.classList.add('transaction-date-header');
            dateHeaderDiv.textContent = dateHeader;
            groupDiv.appendChild(dateHeaderDiv);

            groupedTransactions[dateHeader].forEach(entry => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('transaction-item');

                const { category, icon } = mapCategoryAndIcon(entry, entry['What kind?']);
                const iconDiv = document.createElement('div');
                iconDiv.classList.add('transaction-category-icon');
                // Use a generic savings class or specific gain/expense class
                if (entry.Type.toLowerCase() === 'gains') {
                    iconDiv.classList.add('category-gain');
                } else if (entry.Type.toLowerCase() === 'expenses') {
                    iconDiv.classList.add('category-savings-deduction'); // New class for savings expenses
                }
                iconDiv.textContent = icon;
                itemDiv.appendChild(iconDiv);

                const detailsDiv = document.createElement('div');
                detailsDiv.classList.add('transaction-details');

                const nameSpan = document.createElement('span');
                nameSpan.classList.add('transaction-name');
                nameSpan.textContent = entry.Name || (entry['What kind?'] && entry.Type.toLowerCase() === 'expenses' ? 'Savings Deduction' : 'Savings Contribution');
                detailsDiv.appendChild(nameSpan);

                const timeSpan = document.createElement('span');
                timeSpan.classList.add('transaction-time');
                timeSpan.textContent = entry.Time || '';
                detailsDiv.appendChild(timeSpan);
                itemDiv.appendChild(detailsDiv);

                const amountSpan = document.createElement('span');
                amountSpan.classList.add('transaction-amount');
                amountSpan.textContent = formatCurrency(entry.Amount);
                if (entry.Type.toLowerCase() === 'expenses') amountSpan.classList.add('expense'); // Should be positive for savings increases
                else if (entry.Type.toLowerCase() === 'gains') amountSpan.classList.add('gain'); // Should be negative for savings withdrawals
                itemDiv.appendChild(amountSpan);

                groupDiv.appendChild(itemDiv);
            });
            savingsListDiv.appendChild(groupDiv);
        });

        if (paginatedData.length === 0) {
            savingsListDiv.innerHTML = `<p style="text-align: center; color: var(--text-light); padding: 2rem;">No savings contributions or withdrawals ${totalItems > 0 ? 'on this page.' : 'found.'}</p>`;
        }

        setupPaginationControls(paginationControlsDiv, totalPages, currentSavingsPage, (newPage) => {
            currentSavingsPage = newPage;
            renderSavingsEntries();
        });
    }

    // --- Calculator Logic ---
    const calculatorOverlay = document.getElementById('calculatorOverlay');
    const calculatorDisplay = document.getElementById('calculatorDisplay');
    const calculatorButtons = document.querySelector('.calculator-buttons');
    const closeCalculatorButton = document.getElementById('closeCalculatorButton');
    const openCalculatorFab = document.getElementById('openCalculatorFab');

    let currentInput = '0';
    let firstOperand = null;
    let operator = null;
    let waitingForSecondOperand = false;

    function updateDisplay() {
        if(calculatorDisplay) calculatorDisplay.value = currentInput;
    }

    function resetCalculator() {
        currentInput = '0';
        firstOperand = null;
        operator = null;
        waitingForSecondOperand = false;
    }

    function inputDigit(digit) {
        if (currentInput === 'Error') currentInput = '0'; // Clear error on new input
        if (waitingForSecondOperand) {
            currentInput = digit;
            waitingForSecondOperand = false;
        } else {
            currentInput = currentInput === '0' ? digit : currentInput + digit;
        }
        updateDisplay();
    }

    function inputDecimal(dot) {
        if (waitingForSecondOperand) {
            currentInput = '0.';
            waitingForSecondOperand = false;
            updateDisplay();
            return;
        }
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

        if (firstOperand === null && !isNaN(inputValue)) {
            firstOperand = inputValue;
        } else if (operator) {
            const result = performCalculation[operator](firstOperand, inputValue);
            if (result === 'Error') {
                currentInput = 'Error';
                firstOperand = null;
                operator = null;
            } else {
                currentInput = String(parseFloat(result.toFixed(7))); // Limit decimal places
                firstOperand = parseFloat(currentInput);
            }
        }
        waitingForSecondOperand = true;
        operator = nextOperator;
        updateDisplay();
    }

    const performCalculation = {
        '/': (firstOperand, secondOperand) => secondOperand === 0 ? 'Error' : firstOperand / secondOperand,
        '*': (firstOperand, secondOperand) => firstOperand * secondOperand,
        '+': (firstOperand, secondOperand) => firstOperand + secondOperand,
        '-': (firstOperand, secondOperand) => firstOperand - secondOperand,
        '=': (firstOperand, secondOperand) => secondOperand // '=' just displays the second operand if no operator was pending
    };


    if (calculatorButtons) {
        calculatorButtons.addEventListener('click', (event) => {
            const { target } = event;
            if (!target.matches('button')) return;

            const action = target.dataset.action;

            if (target.classList.contains('operator')) {
                handleOperator(action);
                return;
            }

            if (target.classList.contains('decimal')) {
                inputDecimal('.');
                return;
            }

            if (action === 'clear') {
                resetCalculator();
                updateDisplay();
                return;
            }

            if (action === 'backspace') {
                if (currentInput === 'Error') {
                    resetCalculator();
                } else {
                    currentInput = currentInput.length > 1 ? currentInput.slice(0, -1) : '0';
                }
                updateDisplay();
                return;
            }

            if (action === 'calculate') {
                if (operator === null || firstOperand === null) return; // Do nothing if no calculation pending
                const inputValue = parseFloat(currentInput);
                if (isNaN(inputValue) && currentInput !== 'Error') { // Handle cases where currentInput might not be a number
                    currentInput = 'Error';
                    firstOperand = null;
                    operator = null;
                } else {
                    const result = performCalculation[operator](firstOperand, inputValue);
                    if (result === 'Error') {
                        currentInput = 'Error';
                        firstOperand = null;
                        operator = null;
                    } else {
                        currentInput = String(parseFloat(result.toFixed(7)));
                        firstOperand = parseFloat(currentInput); // Store result as firstOperand for chaining operations
                    }
                }
                operator = null; // Clear operator after calculation
                waitingForSecondOperand = true; // Ready for new operation
                updateDisplay();
                return;
            }

            // Default: It's a digit
            if (target.classList.contains('digit')) {
                inputDigit(target.textContent);
            }
        });
    }

    if (openCalculatorFab) {
        openCalculatorFab.addEventListener('click', () => {
            calculatorOverlay.classList.add('active');
            resetCalculator();
            updateDisplay();
        });
    }

    if (closeCalculatorButton) {
        closeCalculatorButton.addEventListener('click', () => {
            calculatorOverlay.classList.remove('active');
        });
    }

    // Main DOMContentLoaded logic
    document.addEventListener('DOMContentLoaded', () => {
        // Common initialization for all pages (e.g., menu, night mode)
        // ... (already present) ...

        if (document.getElementById('dashboard-page')) {
            const today = new Date();
            const currentMonth = today.getMonth() + 1;
            const currentYear = today.getFullYear();

            // Set initial filter values for the dashboard's modal filters
            const filterMonthSelect = document.getElementById('filterMonth');
            const filterYearSelect = document.getElementById('filterYear');
            if (filterMonthSelect) filterMonthSelect.value = currentMonth;
            if (filterYearSelect) filterYearSelect.value = currentYear;

            // Initialize month navigation for dashboard
            const monthButtonsContainer = document.querySelector('#dashboard-page .months-nav'); // Select the correct month nav
            if (monthButtonsContainer) {
                const monthButtons = monthButtonsContainer.querySelectorAll('.month-button');
                monthButtons.forEach(btn => {
                    btn.classList.remove('active');
                    if (parseInt(btn.dataset.month) === currentMonth) {
                        btn.classList.add('active');
                    }
                });

                // Add event listeners for month buttons on dashboard
                monthButtons.forEach(button => {
                    button.addEventListener('click', function() {
                        currentDashboardTransactionsPage = 1; // Reset pagination when month changes
                        monthButtons.forEach(btn => btn.classList.remove('active'));
                        this.classList.add('active');
                        const selectedMonth = parseInt(this.dataset.month);
                        const selectedYear = filterYearSelect ? filterYearSelect.value : 'All'; // Get year from dropdown
                        updateDashboardChartAndSummary(selectedMonth, selectedYear);
                        displayDashboardTransactions(selectedMonth, selectedYear);
                    });
                });
            }


            // Initial load for dashboard
            updateDashboardChartAndSummary(currentMonth, currentYear);
            displayDashboardTransactions(currentMonth, currentYear);
            calculateAndDisplayTotalSavings(); // Load total savings separately
        } else if (document.getElementById('transactions-page')) {
            fetchAndProcessTransactions(); // Original logic for transactions page
            const categoryFilterDropdown = document.getElementById('categoryFilterDropdown');
            const startDateInput = document.getElementById('startDateInput');
            const endDateInput = document.getElementById('endDateInput');
            const applyFilterButton = document.getElementById('applyFilterButton');
            const clearFiltersButton = document.getElementById('clearFiltersButton');
            const filterOptionsContainer = document.getElementById('filterOptionsContainer');
            const openFilterModalButton = document.getElementById('openFilterModalButton');
            const closeFilterOptionsButton = document.getElementById('closeFilterOptionsButton');

            if (openFilterModalButton) {
                openFilterModalButton.addEventListener('click', () => {
                    if(filterOptionsContainer) filterOptionsContainer.style.display = 'block';
                });
            }
            if (closeFilterOptionsButton) {
                closeFilterOptionsButton.addEventListener('click', () => {
                    if(filterOptionsContainer) filterOptionsContainer.style.display = 'none';
                });
            }

            if (applyFilterButton) {
                applyFilterButton.addEventListener('click', () => {
                    currentTransactionsPage = 1; // Reset page
                    const selectedCategory = categoryFilterDropdown.value;
                    const selectedStartDate = startDateInput.value;
                    const selectedEndDate = endDateInput.value;
                    // Determine month filter: if date range is used, month filter from buttons is ignored.
                    const activeMonthBtn = document.querySelector('.months-nav .month-button.active');
                    const currentSelMonth = activeMonthBtn ? parseInt(activeMonthBtn.dataset.month) : null;
                    const finalMonthToPass = (selectedStartDate || selectedEndDate) ? null : currentSelMonth;

                    renderTransactions(finalMonthToPass, selectedCategory, selectedStartDate, selectedEndDate);
                    if(filterOptionsContainer) filterOptionsContainer.style.display = 'none';
                });
            }

            if (clearFiltersButton) {
                clearFiltersButton.addEventListener('click', () => {
                    currentTransactionsPage = 1; // Reset page
                    categoryFilterDropdown.value = ''; startDateInput.value = ''; endDateInput.value = '';
                    const today = new Date(); const currentMonth = today.getMonth() + 1;
                    monthButtons.forEach(btn => btn.classList.remove('active'));
                    const currentMonthBtn = document.querySelector(`.months-nav .month-button[data-month="${currentMonth}"]`);
                    if (currentMonthBtn) currentMonthBtn.classList.add('active');
                    renderTransactions(currentMonth);
                    if(filterOptionsContainer) filterOptionsContainer.style.display = 'none';
                });
            }
            const monthButtons = document.querySelectorAll('.months-nav .month-button');
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
});
