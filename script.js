document.addEventListener('DOMContentLoaded', () => {
    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgMFbI8pivLbRpc2nL2Gyoxw47PmXEVxvUDrjr-t86gj4-J3QM8uV7m8iJN9wxlYo3IY5FQqqUICei/pub?output=csv';
    const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdrDJoOeo264aOn4g2UEe-K-FHpbssBAVmEtOWoW46Q1cwjgg/viewform?usp=header';

    let allFetchedData = []; // To store all data once fetched for both dashboard and transactions

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

    // Function to fetch data (now shared)
    async function fetchData() {
        if (allFetchedData.length === 0) { // Only fetch if data isn't already loaded
            try {
                const response = await fetch(CSV_URL);
                const csv = await response.text();
                allFetchedData = parseCSV(csv);
            } catch (error) {
                console.error('Error fetching CSV data:', error);
                throw new Error('Failed to load data.'); // Propagate error
            }
        }
        return allFetchedData;
    }

    // --- Dashboard Specific Logic (index.html) ---
    // Modified updateDashboard to accept date filters
    async function updateDashboard(startDate = null, endDate = null) {
        if (!document.getElementById('dashboard-page')) return;

        try {
            const data = await fetchData(); // Get already fetched data or fetch it

            let filteredDashboardData = data.filter(entry => {
                const entryDate = new Date(entry.Date);
                entryDate.setHours(0, 0, 0, 0);

                if (isNaN(entryDate.getTime())) {
                    console.warn('Dashboard Filter Warning: Skipping entry with invalid date:', entry);
                    return false;
                }

                let inDateRange = true;
                if (startDate && endDate) {
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999); // End of the day for inclusive range

                    inDateRange = (entryDate >= start && entryDate <= end);
                } else if (startDate) { // Only start date provided
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    inDateRange = (entryDate >= start);
                } else if (endDate) { // Only end date provided
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    inDateRange = (entryDate <= end);
                }

                return inDateRange;
            });


            let totalExpensesAmount = 0;
            let totalGainsAmount = 0;

            const expenseCategoriesForChart = { Food: 0, Medicines: 0, Shopping: 0, Misc: 0, Transportation: 0, 'Utility Bills': 0 };
            // Populate all possible expense categories from mapCategoryAndIcon
            data.forEach(entry => {
                if (entry.Type && entry.Type.toLowerCase() === 'expenses') {
                    const { category } = mapCategoryAndIcon(entry.Type, entry['What kind?']);
                    if (expenseCategoriesForChart[category] === undefined) {
                        expenseCategoriesForChart[category] = 0;
                    }
                }
            });


            filteredDashboardData.forEach(entry => {
                const amount = parseFloat(entry.Amount);
                const entryType = entry.Type ? entry.Type.toLowerCase() : '';
                const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';

                if (isNaN(amount) || !entryType) { // Removed !entryWhatKind check here as Misc handles it
                    console.warn('Dashboard - Skipping malformed entry:', entry);
                    return;
                }

                if (entryType === 'expenses') {
                    totalExpensesAmount += amount;
                    const { category } = mapCategoryAndIcon(entry.Type, entry['What kind?']);
                    if (expenseCategoriesForChart[category] !== undefined) {
                        expenseCategoriesForChart[category] += amount;
                    } else {
                        expenseCategoriesForChart.Misc += amount; // Fallback to Misc if category not explicitly handled
                    }
                } else if (entryType === 'gains') {
                    totalGainsAmount += amount;
                }
            });

            // Update display elements
            document.getElementById('netExpenseValue').textContent = formatCurrency(totalExpensesAmount); // Now shows filtered expenses

            const remainingBalance = totalGainsAmount - totalExpensesAmount;
            const totalIncomeOrBudget = totalGainsAmount;

            document.getElementById('remainingBalanceAmount').textContent = `${formatCurrency(remainingBalance)} of ${formatCurrency(totalIncomeOrBudget)}`;

            let remainingBalancePercentage = 0;
            if (totalIncomeOrBudget > 0) {
                remainingBalancePercentage = (remainingBalance / totalIncomeOrBudget) * 100;
            }
            const displayPercentage = isNaN(remainingBalancePercentage) ? 0 : Math.round(remainingBalancePercentage);
            document.getElementById('remainingBalancePct').textContent = `${displayPercentage}%`;

            // Update progress circle
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

            // Update category percentages for dashboard
            const sortedExpenseCategories = Object.keys(expenseCategoriesForChart).sort();
            const categoryAmounts = sortedExpenseCategories.map(cat => expenseCategoriesForChart[cat]);
            const totalCategoryExpenseForChart = categoryAmounts.reduce((sum, amount) => sum + amount, 0);

            // Dynamically update category percentages based on available IDs
            document.querySelectorAll('[id$="Pct"]').forEach(element => {
                const categoryId = element.id.replace('Pct', '');
                const amount = expenseCategoriesForChart[categoryId];
                if (amount !== undefined) {
                    element.textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((amount / totalCategoryExpenseForChart) * 100) : 0}%`;
                }
            });


            // Update the chart
            const ctx = document.getElementById('expenseChart');
            if (ctx) {
                if (window.expenseChartInstance) {
                    window.expenseChartInstance.destroy();
                }
                const chartColors = [
                    getComputedStyle(document.documentElement).getPropertyValue('--accent-green').trim(),
                    getComputedStyle(document.documentElement).getPropertyValue('--accent-red').trim(),
                    getComputedStyle(document.documentElement).getPropertyValue('--accent-orange').trim(),
                    getComputedStyle(document.documentElement).getPropertyValue('--accent-blue').trim(),
                    // Add more colors if you expect more categories
                    '#8a2be2', // BlueViolet
                    '#ff4500'  // OrangeRed
                ];

                // Filter out categories with 0 amount for chart display if desired
                const chartLabels = [];
                const chartData = [];
                let colorIndex = 0;
                const activeChartColors = [];

                sortedExpenseCategories.forEach(category => {
                    const amount = expenseCategoriesForChart[category];
                    if (amount > 0) {
                        chartLabels.push(category);
                        chartData.push(amount);
                        activeChartColors.push(chartColors[colorIndex % chartColors.length]);
                        colorIndex++;
                    }
                });

                window.expenseChartInstance = new Chart(ctx.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: chartLabels,
                        datasets: [{
                            data: chartData,
                            backgroundColor: activeChartColors,
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
    // allTransactionsData is replaced by allFetchedData, so this global variable is no longer needed
    // let allTransactionsData = [];

    async function fetchAndProcessTransactions() {
        if (!document.getElementById('transactions-page')) return;

        try {
            const data = await fetchData(); // Use the shared fetchData function

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
        allFetchedData.forEach(entry => {
            if (entry['What kind?']) {
                uniqueCategories.add(entry['What kind?'].trim());
            }
            if (entry.Type && entry.Type.toLowerCase() === 'gains' && entry['What kind?'].trim() === 'Salary') {
                uniqueCategories.add('Salary');
            }
            if (entry.Type && entry.Type.toLowerCase() === 'gains' && entry['What kind?'].trim() === 'Allowance') {
                uniqueCategories.add('Allowance');
            }
        });

        const sortedCategories = Array.from(uniqueCategories).sort();
        const finalCategories = [];

        const hasGains = allFetchedData.some(entry => entry.Type && entry.Type.toLowerCase() === 'gains');
        const hasExpenses = allFetchedData.some(entry => entry.Type && entry.Type.toLowerCase() === 'expenses');

        if (hasGains) finalCategories.push('Gains');
        if (hasExpenses) finalCategories.push('Expenses');

        sortedCategories.forEach(cat => {
            const lowerCat = cat.toLowerCase();
            if (lowerCat !== 'gains' && lowerCat !== 'expenses' && lowerCat !== 'salary' && lowerCat !== 'allowance' && !finalCategories.includes(cat)) {
                finalCategories.push(cat);
            }
        });

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

            if (isNaN(amount) || isNaN(date.getTime()) || !entryType) {
                console.warn('Skipping malformed entry:', entry);
                return false;
            }

            const entryDate = new Date(entry.Date);
            entryDate.setHours(0, 0, 0, 0);

            if (selectedMonth !== null && !(startDate || endDate)) {
                if (entryDate.getMonth() + 1 !== selectedMonth) {
                    return false;
                }
            }

            if (selectedCategory) {
                const lowerCaseSelectedCategory = selectedCategory.toLowerCase();
                const actualCategory = entry['What kind?'] ? entry['What kind?'].toLowerCase() : ''; // Corrected property name
                const entryCategoryType = entry.Type ? entry.Type.toLowerCase() : '';

                if (lowerCaseSelectedCategory === 'gains') {
                    if (entryCategoryType !== 'gains') return false;
                } else if (lowerCaseSelectedCategory === 'expenses') {
                    if (entryCategoryType !== 'expenses') return false;
                } else if (actualCategory !== lowerCaseSelectedCategory) {
                    return false;
                }
            }

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
            if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
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
                if (entry.Time) {
                    try {
                        const [hours, minutes, seconds] = entry.Time.split(':').map(Number);
                        const date = new Date();
                        date.setHours(hours, minutes, seconds || 0);
                        timeSpan.textContent = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                    } catch (e) {
                        timeSpan.textContent = entry.Time;
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
        // Get dashboard filter elements
        const dashboardStartDateInput = document.getElementById('dashboardStartDate');
        const dashboardEndDateInput = document.getElementById('dashboardEndDate');
        const applyDashboardFiltersButton = document.getElementById('applyDashboardFilters');
        const clearDashboardFiltersButton = document.getElementById('clearDashboardFilters');

        // Initial render for dashboard (no filters applied by default on load)
        updateDashboard();

        // Event listener for apply dashboard filters
        if (applyDashboardFiltersButton) {
            applyDashboardFiltersButton.addEventListener('click', () => {
                const startDate = dashboardStartDateInput.value;
                const endDate = dashboardEndDateInput.value;
                updateDashboard(startDate, endDate);
            });
        }

        // Event listener for clear dashboard filters
        if (clearDashboardFiltersButton) {
            clearDashboardFiltersButton.addEventListener('click', () => {
                dashboardStartDateInput.value = '';
                dashboardEndDateInput.value = '';
                updateDashboard(); // Call without filters to show all data
            });
        }

    } else if (document.getElementById('transactions-page')) {
        const today = new Date();
        let currentMonth = today.getMonth() + 1;

        const filterButton = document.getElementById('filterButton');
        const filterOptionsContainer = document.getElementById('filterOptionsContainer');
        const categoryFilterDropdown = document.getElementById('categoryFilterDropdown');
        const startDateInput = document.getElementById('startDateInput');
        const endDateInput = document.getElementById('endDateInput');
        const applyFiltersButton = document.getElementById('applyFiltersButton');
        const clearFiltersButton = document.getElementById('clearFiltersButton');
        const monthButtons = document.querySelectorAll('.month-button');

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
                currentMonth = activeMonthButton ? parseInt(activeMonthButton.dataset.month) : null;

                const finalMonth = (startDate || endDate) ? null : currentMonth;

                renderTransactions(finalMonth, selectedCategory, startDate, endDate);
                filterOptionsContainer.style.display = 'none';
            });
        }

        if (clearFiltersButton) {
            clearFiltersButton.addEventListener('click', () => {
                categoryFilterDropdown.value = '';
                startDateInput.value = '';
                endDateInput.value = '';

                const today = new Date();
                currentMonth = today.getMonth() + 1;
                monthButtons.forEach(btn => btn.classList.remove('active'));
                const currentMonthBtn = document.querySelector(`.month-button[data-month="${currentMonth}"]`);
                if (currentMonthBtn) {
                    currentMonthBtn.classList.add('active');
                }
                renderTransactions(currentMonth);
                filterOptionsContainer.style.display = 'none';
            });
        }

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

        monthButtons.forEach(button => {
            button.addEventListener('click', function() {
                monthButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                currentMonth = parseInt(this.dataset.month);
                startDateInput.value = '';
                endDateInput.value = '';
                categoryFilterDropdown.value = '';
                renderTransactions(currentMonth);
                filterOptionsContainer.style.display = 'none';
            });
        });

        fetchAndProcessTransactions();
    }
});
