document.addEventListener('DOMContentLoaded', () => {
    // Corrected CSV URL from previous interactions
    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgMFbI8pivLbRpc2nL2Gyoxw47PmXEVxvUDrjr-t86gj4-J3QM8uV7m8iJN9wxlYo3IY5FQqqUICei/pub?output=csv';

    function parseCSV(csv) {
        const lines = csv.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) return [];

        const headers = lines[0].split(',').map(header => header.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(value => value.trim());
            // Basic check for column mismatch to prevent errors
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
        // Format as Philippine Peso
        return `₱ ${numAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Function to map category and get appropriate icon
    function mapCategoryAndIcon(type, whatKind) {
        let category = 'Misc';
        let icon = '✨'; // Default icon

        const lowerCaseWhatKind = whatKind ? whatKind.toLowerCase() : '';
        const lowerCaseType = type ? type.toLowerCase() : '';

        if (lowerCaseType === 'gains') {
            category = 'Gain';
            switch (lowerCaseWhatKind) {
                case 'salary':
                    icon = '💸';
                    break;
                case 'allowance':
                    icon = '🎁';
                    break;
                // Add more gain categories if needed
                default:
                    icon = '💰'; // Default for other gains
                    break;
            }
        } else if (lowerCaseType === 'expenses') {
            switch (lowerCaseWhatKind) {
                case 'food':
                case 'groceries':
                    category = 'Food';
                    icon = '🍔';
                    break;
                case 'medicines':
                    category = 'Medicines';
                    icon = '💊';
                    break;
                case 'online shopping':
                    category = 'Shopping';
                    icon = '🛍️';
                    break;
                case 'transportation':
                    category = 'Transportation';
                    icon = '🚌';
                    break;
                case 'utility bills':
                    category = 'Utility Bills';
                    icon = '💡';
                    break;
                case 'allowance': // Could be expense if allowance is used for a general category
                    category = 'Misc';
                    icon = '🚶';
                    break;
                // Add more expense categories if needed
                default:
                    category = 'Misc';
                    icon = '✨';
                    break;
            }
        }
        return { category, icon };
    }

    // --- Dashboard Specific Logic (index.html) ---
    async function updateDashboard() {
        try {
            const response = await fetch(CSV_URL);
            const csv = await response.text();
            const data = parseCSV(csv);

            let totalExpensesAmount = 0;
            let totalGainsAmount = 0;

            // Initialize categories for the donut chart
            const expenseCategoriesForChart = {
                Food: 0,
                Medicines: 0,
                Shopping: 0,
                Misc: 0,
            };

            data.forEach(entry => {
                const amount = parseFloat(entry.Amount);
                const entryType = entry.Type ? entry.Type.toLowerCase() : '';
                const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';

                // Skip entries with invalid amount or missing type/whatKind
                if (isNaN(amount) || !entryType || !entryWhatKind) {
                    console.warn('Dashboard - Skipping malformed entry:', entry);
                    return;
                }

                if (entryType === 'expenses') {
                    totalExpensesAmount += amount;
                    // Distribute expenses into categories for the chart
                    if (entryWhatKind === 'food' || entryWhatKind === 'groceries') {
                        expenseCategoriesForChart.Food += amount;
                    } else if (entryWhatKind === 'medicines') {
                        expenseCategoriesForChart.Medicines += amount;
                    } else if (entryWhatKind === 'online shopping') {
                        expenseCategoriesForChart.Shopping += amount;
                    } else {
                        expenseCategoriesForChart.Misc += amount; // Catch-all for other expenses
                    }
                } else if (entryType === 'gains') {
                    totalGainsAmount += amount;
                }
            });

            // Update Net Expense display
            const netExpenseForDisplay = totalExpensesAmount;
            document.getElementById('netExpenseValue').textContent = formatCurrency(netExpenseForDisplay);

            // Update Remaining Balance display
            const remainingBalance = totalGainsAmount - totalExpensesAmount;
            const totalIncomeOrBudget = totalGainsAmount; // Assuming gains represent the budget/income

            document.getElementById('remainingBalanceAmount').textContent = `${formatCurrency(remainingBalance)} of ${formatCurrency(totalIncomeOrBudget)}`;

            // Calculate and update Remaining Balance Percentage
            let remainingBalancePercentage = 0;
            if (totalIncomeOrBudget > 0) {
                remainingBalancePercentage = (remainingBalance / totalIncomeOrBudget) * 100;
            }
            const displayPercentage = isNaN(remainingBalancePercentage) ? 0 : remainingBalancePercentage;
            document.getElementById('remainingBalancePct').textContent = `${Math.round(displayPercentage)}%`;

            // Update Progress Circle (Remaining Balance)
            let progressOffset = 0;
            let progressColor = 'var(--accent-green)'; // Default color for positive balance
            const radius = 34; // Radius of the circle
            const circumference = 2 * Math.PI * radius; // Circumference for SVG dasharray

            if (displayPercentage >= 100) { // Full progress or more
                progressOffset = 0;
            } else if (displayPercentage > 0) { // Some balance remaining
                progressOffset = circumference - (displayPercentage / 100) * circumference;
                if (displayPercentage < 25) { // Low balance warning
                    progressColor = 'var(--accent-orange)';
                }
            } else { // No balance or overspent
                progressOffset = circumference; // Circle fully empty
                progressColor = 'var(--accent-red)'; // Red for negative balance
            }

            const progressCircle = document.querySelector('.progress-ring-progress');
            if (progressCircle) {
                progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
                progressCircle.style.strokeDashoffset = progressOffset;
                progressCircle.style.stroke = progressColor;
            }

            // Update Expense Category Percentages for Dashboard Legend
            const categoryNames = ['Food', 'Medicines', 'Shopping', 'Misc'];
            const categoryAmounts = [
                expenseCategoriesForChart.Food,
                expenseCategoriesForChart.Medicines,
                expenseCategoriesForChart.Shopping,
                expenseCategoriesForChart.Misc,
            ];
            const totalCategoryExpenseForChart = categoryAmounts.reduce((sum, amount) => sum + amount, 0);

            // Update percentage texts for each legend item
            document.getElementById('foodPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Food / totalCategoryExpenseForChart) * 100) : 0}%`;
            document.getElementById('medicinesPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Medicines / totalCategoryExpenseForChart) * 100) : 0}%`;
            document.getElementById('shoppingPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Shopping / totalCategoryExpenseForChart) * 100) : 0}%`;
            document.getElementById('miscPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Misc / totalCategoryExpenseForChart) * 100) : 0}%`;


            // Render Donut Chart
            const ctx = document.getElementById('expenseChart');
            if (ctx) {
                // Destroy existing chart instance if it exists to prevent re-rendering issues
                if (window.expenseChartInstance) {
                    window.expenseChartInstance.destroy();
                }
                // CHART.JS COLORS TO MATCH CSS LEGEND DOT COLORS
                const chartColors = [
                    getComputedStyle(document.documentElement).getPropertyValue('--accent-green').trim(),    // Food
                    getComputedStyle(document.documentElement).getPropertyValue('--accent-red').trim(),      // Medicines
                    getComputedStyle(document.documentElement).getPropertyValue('--accent-orange').trim(),   // Shopping
                    getComputedStyle(document.documentElement).getPropertyValue('--accent-blue').trim()     // Misc
                ];
                window.expenseChartInstance = new Chart(ctx.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: categoryNames,
                        datasets: [{
                            data: categoryAmounts,
                            backgroundColor: chartColors, // Use the defined colors
                            borderColor: 'var(--card-bg)', // Border color around segments
                            borderWidth: 4, // Donut chart border thickness - adjusted here
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '80%', // Thickness of the donut
                        plugins: {
                            legend: {
                                display: false, // Hide default Chart.js legend as we have a custom one
                            },
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
            // Display error messages on dashboard if data fails to load
            if (document.getElementById('netExpenseValue')) document.getElementById('netExpenseValue').textContent = '₱ Error';
            if (document.getElementById('remainingBalanceAmount')) document.getElementById('remainingBalanceAmount').textContent = '₱ Error';
        }
    }

    // --- Transactions Page Specific Logic (transactions.html) ---
    async function renderTransactions(selectedMonth, filterKeyword = '') {
        const transactionsListDiv = document.getElementById('transactionsList');
        if (!transactionsListDiv) return; // Exit if not on transactions page

        try {
            const response = await fetch(CSV_URL);
            const csv = await response.text();
            let data = parseCSV(csv);

            // Filter data by selected month and keyword
            data = data.filter(entry => {
                const amount = parseFloat(entry.Amount);
                const date = new Date(entry.Date);
                const entryType = entry.Type ? entry.Type.toLowerCase() : '';
                const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';

                // Basic data validation for each entry
                if (isNaN(amount) || isNaN(date) || !entryType || !entryWhatKind) {
                    return false; // Skip invalid entries
                }

                const entryDate = new Date(entry.Date);
                entryDate.setHours(0, 0, 0, 0); // Normalize date to start of day

                // Filter by month
                if (entryDate.getMonth() + 1 !== selectedMonth) {
                    return false;
                }

                // Apply keyword filter if present
                if (filterKeyword) {
                    const lowerCaseKeyword = filterKeyword.toLowerCase();
                    const description = entry.Description ? entry.Description.toLowerCase() : '';
                    const whatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';

                    if (!(description.includes(lowerCaseKeyword) || whatKind.includes(lowerCaseKeyword))) {
                        return false; // Exclude if keyword not found
                    }
                }
                return true; // Include the entry
            });

            // Sort transactions by date (descending)
            data.sort((a, b) => new Date(b.Date) - new Date(a.Date));

            transactionsListDiv.innerHTML = ''; // Clear previous transactions

            const groupedTransactions = {};
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Normalize today's date

            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1); // Normalize yesterday's date

            // Group transactions by date for display
            data.forEach(entry => {
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

            // Sort dates for display (Today, Yesterday, then chronological)
            const sortedDates = Object.keys(groupedTransactions).sort((a, b) => {
                if (a === 'Today') return -1;
                if (b === 'Today') return 1;
                if (a === 'Yesterday') return -1;
                if (b === 'Yesterday') return 1;
                const dateA = new Date(a);
                const dateB = new Date(b);
                if (!isNaN(dateA) && !isNaN(dateB)) { // Only compare if valid dates
                    return dateB - dateA; // Descending
                }
                return 0; // Maintain order if dates are invalid
            });

            // Render each grouped transaction
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
                    return timeA[2] - timeB[2]; // Compare seconds if present
                });

                groupedTransactions[dateHeader].forEach(entry => {
                    const itemDiv = document.createElement('div');
                    itemDiv.classList.add('transaction-item');

                    const categoryIconDiv = document.createElement('div');
                    categoryIconDiv.classList.add('transaction-category-icon');

                    const { category: mappedCategory, icon: categoryIcon } = mapCategoryAndIcon(entry.Type, entry['What kind?']);

                    // Assign category-specific background color
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
                    timeSpan.textContent = entry.Time || ''; // Display time if available
                    detailsDiv.appendChild(timeSpan);
                    itemDiv.appendChild(detailsDiv);

                    const amountSpan = document.createElement('span');
                    amountSpan.classList.add('transaction-amount');
                    const amountValue = parseFloat(entry.Amount);
                    amountSpan.textContent = formatCurrency(amountValue);
                    // Add expense/gain class for color styling
                    amountSpan.classList.add(entry.Type && entry.Type.toLowerCase() === 'expenses' ? 'expense' : 'gain');
                    itemDiv.appendChild(amountSpan);

                    groupDiv.appendChild(itemDiv);
                });
                transactionsListDiv.appendChild(groupDiv);
            });

            // Display message if no transactions are found
            if (Object.keys(groupedTransactions).length === 0) {
                 transactionsListDiv.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 2rem;">No transactions found for this month with the applied filter.</p>';
            }

        } catch (error) {
            console.error('Error fetching or processing CSV for transactions:', error);
            transactionsListDiv.innerHTML = '<p style="text-align: center; color: var(--accent-red);">Failed to load transactions. Please try again later.</p>';
        }
    }

    // UPDATED: updateCurrentDateDisplay to correctly format for transactions page
    function updateCurrentDateDisplay() {
        // Target the profile-icon element by its ID on the transactions page
        const profileDateDisplayElement = document.getElementById('profileDateDisplay');
        if (profileDateDisplayElement) {
            const today = new Date();
            const month = today.toLocaleDateString('en-US', { month: 'short' }); // e.g., "May"
            const day = today.getDate(); // e.g., "24"
            // Set the innerHTML with spans for styling the stacked month and day
            profileDateDisplayElement.innerHTML = `<span>${month}</span><span>${day}</span>`;
        }
    }

    // --- Main Page Initialization Logic ---
    const dashboardPage = document.getElementById('dashboard-page');
    const transactionsPage = document.getElementById('transactions-page');

    if (dashboardPage) {
        updateDashboard(); // Load dashboard data if on dashboard page
    } else if (transactionsPage) {
        updateCurrentDateDisplay(); // Set the date in the circle on transactions page

        const monthButtons = document.querySelectorAll('.month-button');
        const currentMonth = new Date().getMonth() + 1; // Get current month (1-indexed)

        let currentActiveMonth = currentMonth; // Default active month to current month

        // Set initial active month button
        let initialMonthSet = false;
        monthButtons.forEach(button => {
            const monthNumber = parseInt(button.dataset.month);
            if (monthNumber === currentMonth) {
                button.classList.add('active');
                initialMonthSet = true;
            } else {
                button.classList.remove('active');
            }
        });

        // Fallback: if no button matches current month (e.g., if months are limited), select closest or first
        if (!initialMonthSet && monthButtons.length > 0) {
            let closestMonthButton = monthButtons[0];
            let minDiff = Math.abs(currentMonth - parseInt(monthButtons[0].dataset.month));

            for (let i = 1; i < monthButtons.length; i++) {
                const diff = Math.abs(currentMonth - parseInt(monthButtons[i].dataset.month));
                if (diff < minDiff) {
                    minDiff = diff;
                    closestMonthButton = monthButtons[i];
                }
            }
            closestMonthButton.classList.add('active');
            currentActiveMonth = parseInt(closestMonthButton.dataset.month);
        } else if (!initialMonthSet) {
             currentActiveMonth = 1; // Default to January if no current month button found at all
        }


        // Initial render of transactions for the determined active month
        renderTransactions(currentActiveMonth);

        // Add event listeners to month buttons
        monthButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Remove active class from all buttons
                monthButtons.forEach(btn => btn.classList.remove('active'));
                // Add active class to the clicked button
                this.classList.add('active');
                currentActiveMonth = parseInt(this.dataset.month); // Update active month
                const filterKeyword = document.getElementById('filterKeyword')?.value || ''; // Get current filter keyword
                renderTransactions(currentActiveMonth, filterKeyword); // Re-render with new month
            });
        });

        // Filter button logic
        const filterButton = document.getElementById('filterButton');
        const filterOptionsDiv = document.getElementById('filterOptions');
        const filterKeywordInput = document.getElementById('filterKeyword');
        const applyFilterButton = document.getElementById('applyFilter');

        if (filterButton && filterOptionsDiv) {
            filterButton.addEventListener('click', () => {
                // Toggle visibility of filter options
                filterOptionsDiv.style.display = filterOptionsDiv.style.display === 'none' ? 'block' : 'none';
                if (filterOptionsDiv.style.display === 'block') {
                    filterKeywordInput.focus(); // Focus on input when opened
                } else {
                    // Clear filter and re-render if filter options are closed
                    filterKeywordInput.value = '';
                    renderTransactions(currentActiveMonth, '');
                }
            });
        }

        if (applyFilterButton && filterKeywordInput) {
            applyFilterButton.addEventListener('click', () => {
                const keyword = filterKeywordInput.value;
                renderTransactions(currentActiveMonth, keyword); // Apply filter and re-render
            });

            // Allow pressing Enter key to apply filter in the keyword input
            filterKeywordInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault(); // Prevent default form submission
                    applyFilterButton.click(); // Trigger apply filter button click
                }
            });
        }
    }
});
