document.addEventListener('DOMContentLoaded', () => {
    const CSV_URL = 'https://docs.google.com/sheets/d/e/2PACX-1vQgMFbI8pivLbRpc2nL2Gyoxw47PmXEVxvUDrjr-t86gj4-J3QM8uV7m8iJN9wxlYo3IY5FQqqUICei/pub?output=csv';
    const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdrDJoOeo264aOn4g2UE-K-FHpbssBAVmEtOWoW46Q1cwjgg/viewform?usp=header'; // Ensure this is your correct form URL

    let allFetchedData = []; // To store all data once fetched

    function parseCSV(csv) {
        const lines = csv.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) return [];

        const headers = lines[0].split(',').map(header => header.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(value => value.trim());
            // Basic validation: ensure number of values matches headers
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
        // Format to Philippine Peso
        return `₱ ${numAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Function to map category and get icon
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
                case 'transportation': icon = '🚌'; break;
                case 'utility bills': icon = '💡'; break;
                case 'allowance': category = 'Misc'; icon = '🚶'; break; // Changed to Misc
                default: category = 'Misc'; icon = '✨'; break;
            }
        }
        return { category, icon };
    }

    // --- Dashboard Specific Logic (index.html) ---
    async function updateDashboard() {
        if (!document.getElementById('dashboard-page')) return; // Only run if on dashboard page

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

        // Update progress ring
        let progressOffset = 0;
        let progressColor = 'var(--accent-green)'; // Default to green
        const radius = 34; // Radius of the circle
        const circumference = 2 * Math.PI * radius;

        if (displayPercentage >= 100) {
            progressOffset = 0; // Fully green
        } else if (displayPercentage > 0) {
            progressOffset = circumference - (displayPercentage / 100) * circumference;
            if (displayPercentage < 25) {
                progressColor = 'var(--accent-orange)'; // Orange if below 25%
            }
        } else { // 0 or negative percentage
            progressOffset = circumference; // Fully red
            progressColor = 'var(--accent-red)';
        }

        const progressCircle = document.querySelector('.progress-ring-progress');
        if (progressCircle) {
            progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
            progressCircle.style.strokeDashoffset = progressOffset;
            progressCircle.style.stroke = progressColor;
        }

        // Update category percentages and chart
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


        // Chart.js (Doughnut Chart)
        const ctx = document.getElementById('expenseChart');
        if (ctx) {
            // Destroy existing chart instance if it exists to prevent overlap
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
                        borderColor: 'var(--card-bg)', // Match card background
                        borderWidth: 4,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '80%', // Makes it a doughnut
                    plugins: {
                        legend: { display: false }, // Hide legend as percentages are shown in HTML
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.label || '';
                                    if (label) { label += ': '; }
                                    if (context.parsed !== null) {
                                        label += formatCurrency(context.parsed);
                                    }
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

    // Function to fetch data and process for transactions page
    async function fetchAndProcessTransactions() {
        if (!document.getElementById('transactions-page')) return; // Only run if on transactions page

        try {
            const response = await fetch(CSV_URL);
            const csv = await response.text();
            allFetchedData = parseCSV(csv); // Populate global data store
            console.log("Transactions data fetched successfully. Entries:", allFetchedData.length); // Debugging

            // Initialize category filter after data is fetched
            populateCategoryFilter();

            // Set current month active and update profile date display
            const today = new Date();
            const currentMonth = today.getMonth() + 1; // 1-indexed

            const monthButtons = document.querySelectorAll('.month-button');
            monthButtons.forEach(button => {
                if (parseInt(button.dataset.month) === currentMonth) {
                    button.classList.add('active');
                } else {
                    button.classList.remove('active'); // Ensure only current month is active
                }
            });

            const profileDateDisplay = document.getElementById('profileDateDisplay');
            if (profileDateDisplay) {
                const monthName = today.toLocaleDateString('en-US', { month: 'short' });
                const dayOfMonth = today.getDate();
                profileDateDisplay.innerHTML = `<span>${monthName}</span><span>${dayOfMonth}</span>`;
            }

            // IMPORTANT: Initial render of transactions for the current month is NOT done here on page load.
            // It will be triggered by a month button click. This matches the behavior you wanted to revert to.

        } catch (error) {
            console.error('Error fetching or processing transactions data:', error);
            const transactionsListDiv = document.getElementById('transactionsList');
            if (transactionsListDiv) {
                transactionsListDiv.innerHTML = '<p style="text-align: center; color: var(--accent-red); padding: 2rem;">Error loading transactions. Please try again later.</p>';
            }
        }
    }

    function populateCategoryFilter() {
        const categoryFilterDropdown = document.getElementById('categoryFilterDropdown');
        if (!categoryFilterDropdown) return;

        categoryFilterDropdown.innerHTML = '<option value="">All Categories</option>'; // Default option

        const uniqueCategories = new Set();
        allFetchedData.forEach(entry => {
            if (entry['What kind?']) {
                uniqueCategories.add(entry['What kind?'].trim());
            }
        });

        // Convert Set to Array and sort alphabetically
        const sortedCategories = Array.from(uniqueCategories).sort();

        // Custom order: Gains, Expenses, then sorted specific categories
        const finalCategories = [];
        const hasGains = allFetchedData.some(entry => entry.Type && entry.Type.toLowerCase() === 'gains');
        const hasExpenses = allFetchedData.some(entry => entry.Type && entry.Type.toLowerCase() === 'expenses');

        if (hasGains) finalCategories.push('Gains');
        if (hasExpenses) finalCategories.push('Expenses');

        sortedCategories.forEach(cat => {
            const lowerCat = cat.toLowerCase();
            if (lowerCat !== 'gains' && lowerCat !== 'expenses' && !finalCategories.includes(cat)) {
                finalCategories.push(cat);
            }
        });

        finalCategories.forEach(category => {
            if (category) { // Ensure category is not empty string
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categoryFilterDropdown.appendChild(option);
            }
        });
    }

    function renderTransactions(selectedMonth = null, selectedCategory = '', startDate = null, endDate = null) {
        const transactionsListDiv = document.getElementById('transactionsList');
        if (!transactionsListDiv || allFetchedData.length === 0) return; // Ensure data is present

        let filteredData = allFetchedData.filter(entry => {
            const amount = parseFloat(entry.Amount);
            const date = new Date(entry.Date); // Ensure date is valid for filtering
            const entryType = entry.Type ? entry.Type.toLowerCase() : '';
            const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';

            if (isNaN(amount) || isNaN(date.getTime()) || !entryType) {
                console.warn('Skipping malformed entry:', entry);
                return false;
            }

            const entryDate = new Date(entry.Date);
            entryDate.setHours(0, 0, 0, 0); // Normalize to start of day for comparison

            // Month filtering (applied only if no custom dates are selected)
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
                start.setHours(0, 0, 0, 0); // Normalize to start of day
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999); // Normalize to end of day

                if (entryDate < start || entryDate > end) {
                    return false;
                }
            }

            return true; // Keep the entry if all filters pass
        });

        // Sort by date descending (most recent first)
        filteredData.sort((a, b) => new Date(b.Date) - new Date(a.Date));

        transactionsListDiv.innerHTML = ''; // Clear previous entries

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
            if (a === 'Today') return -1; // Today first
            if (b === 'Today') return 1;
            if (a === 'Yesterday') return -1; // Yesterday second
            if (b === 'Yesterday') return 1;
            const dateA = new Date(a);
            const dateB = new Date(b);
            // Fallback for string dates if conversion fails (though should be consistent)
            if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
                return dateB - dateA; // Sort actual dates descending
            }
            return 0; // Maintain original order if date parsing fails for some reason
        });

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
                return timeA[2] - timeB[2]; // Compare seconds as well
            });


            groupedTransactions[dateHeader].forEach(entry => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('transaction-item');

                const categoryIconDiv = document.createElement('div');
                categoryIconDiv.classList.add('transaction-category-icon');

                const { category: mappedCategory, icon: categoryIcon } = mapCategoryAndIcon(entry.Type, entry['What kind?']);

                if (entry.Type && entry.Type.toLowerCase() === 'gains') {
                     categoryIconDiv.classList.add('category-gain');
                } else { // For expenses, add specific color classes
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

    // FAB Button for adding transactions
    const fabButton = document.querySelector('.fab-button');
    if (fabButton) {
        fabButton.addEventListener('click', () => {
            window.open(GOOGLE_FORM_URL, '_blank');
        });
    }

    // Initialize functions based on the current page
    if (document.getElementById('dashboard-page')) {
        updateDashboard(); // Initial dashboard load (all time)
        // No dashboard filter listeners here as they are being removed
    } else if (document.getElementById('transactions-page')) {
        fetchAndProcessTransactions(); // Fetch and process for transactions page

        let currentMonth; // Declare outside to be accessible

        const monthButtons = document.querySelectorAll('.month-button');

        // Event listeners for month buttons
        monthButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Remove 'active' class from all buttons
                monthButtons.forEach(btn => btn.classList.remove('active'));
                // Add 'active' class to the clicked button
                this.classList.add('active');
                currentMonth = parseInt(this.dataset.month); // Get the month number from data-month attribute

                // Clear any custom date range filters when a month is selected
                document.getElementById('startDateInput').value = '';
                document.getElementById('endDateInput').value = '';
                document.getElementById('categoryFilterDropdown').value = ''; // Clear category filter as well

                renderTransactions(currentMonth); // Render transactions for the selected month
                document.getElementById('filterOptionsContainer').style.display = 'none'; // Hide filters after month selection
            });
        });

        // Filter button functionality for transactions page
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

                // Determine which month is active if no custom dates are set
                const activeMonthButton = document.querySelector('.month-button.active');
                const selectedMonthFromButton = activeMonthButton ? parseInt(activeMonthButton.dataset.month) : null;

                // If custom dates are selected, the month filter is ignored
                const finalMonthFilter = (startDate || endDate) ? null : selectedMonthFromButton;

                renderTransactions(finalMonthFilter, selectedCategory, startDate, endDate);
                filterOptionsContainer.style.display = 'none'; // Hide filters after applying
            });
        }

        if (clearFiltersButton) {
            clearFiltersButton.addEventListener('click', () => {
                categoryFilterDropdown.value = ''; // Reset category
                startDateInput.value = ''; // Clear start date
                endDateInput.value = ''; // Clear end date

                // Re-activate current month button and re-render for current month
                const today = new Date();
                const currentMonth = today.getMonth() + 1;
                monthButtons.forEach(btn => btn.classList.remove('active'));
                const currentMonthBtn = document.querySelector(`.month-button[data-month="${currentMonth}"]`);
                if (currentMonthBtn) {
                    currentMonthBtn.classList.add('active');
                }
                renderTransactions(currentMonth); // Re-render for the current month
                filterOptionsContainer.style.display = 'none'; // Hide filters after clearing
            });
        }
    }
});
