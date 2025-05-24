document.addEventListener('DOMContentLoaded', () => {
    // IMPORTANT: Ensure this CSV URL is correct and publicly accessible from your Google Sheet.
    // This URL is crucial for fetching your transaction data.
    // Replace with your actual published CSV URL
    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgMFbI8pivLbRpc2nL2Gyoxw47PmXEVxvUDrjr-t86gj4-J3QM8uV7m8iJN9wxlYo3IY5FQqqUICei/pub?output=csv';

    // Helper function to parse CSV data from the fetched text.
    // It handles headers, splits lines, and creates an array of objects.
    function parseCSV(csv) {
        const lines = csv.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) return []; // Return empty array if no data

        const headers = lines[0].split(',').map(header => header.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(value => value.trim());
            // Basic validation: ensure number of values matches headers
            if (values.length !== headers.length) {
                console.warn('Skipping malformed CSV row (column mismatch):', lines[i]);
                continue; // Skip rows that don't match header count
            }
            const entry = {};
            headers.forEach((header, index) => {
                entry[header] = values[index];
            });
            data.push(entry);
        }
        return data;
    }

    // Function to format currency to Philippine Peso (₱).
    function formatCurrency(amount) {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount)) {
            return '₱ 0.00'; // Default if amount is not a valid number
        }
        return `₱ ${numAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Maps the 'Type' (Expenses/Gains) and 'What kind?' from the Google Form
    // to a simplified category (for dashboard chart) and an appropriate icon (for transactions list).
    function mapCategoryAndIcon(type, whatKind) {
        let category = 'Misc'; // Default dashboard expense category if not explicitly matched
        let icon = '✨'; // Default general icon

        const lowerCaseWhatKind = whatKind ? whatKind.toLowerCase() : '';
        const lowerCaseType = type ? type.toLowerCase() : '';

        if (lowerCaseType === 'gains') {
            category = 'Gain'; // Internal category, not for donut chart
            switch (lowerCaseWhatKind) {
                case 'salary':
                    icon = '💸'; // Money bag icon for salary
                    break;
                case 'allowance': // Allowance received (gain)
                    icon = '🎁'; // Gift icon
                    break;
                default:
                    icon = '💰'; // General money icon for other gains
                    break;
            }
        } else if (lowerCaseType === 'expenses') {
            switch (lowerCaseWhatKind) {
                case 'food':
                case 'groceries': // Map groceries to Food category for chart
                    category = 'Food';
                    icon = '🍔'; // Burger icon
                    break;
                case 'medicines':
                    category = 'Medicines';
                    icon = '💊'; // Pill icon
                    break;
                case 'online shopping':
                    category = 'Shopping'; // Map online shopping to Shopping category
                    icon = '🛍️'; // Shopping bags icon
                    break;
                case 'transportation':
                    category = 'Transportation'; // Specific category for transaction list
                    icon = '🚌'; // Bus icon
                    break;
                case 'utility bills':
                    category = 'Utility Bills'; // Specific category for transaction list
                    icon = '💡'; // Lightbulb/bill icon
                    break;
                case 'allowance': // Allowance spent (expense)
                    category = 'Misc'; // For dashboard chart, allowance spent goes to Misc
                    icon = '🚶'; // Person walking/general expense icon
                    break;
                default:
                    category = 'Misc'; // Catch-all for other expenses not explicitly categorized
                    icon = '✨'; // Sparkle/miscellaneous icon
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

            let totalExpensesAmount = 0; // Accumulates all expense amounts for remaining balance
            let totalGainsAmount = 0;   // Accumulates all gain amounts for remaining balance

            // Stores amounts for categories specifically displayed on the donut chart.
            // Only 'Expenses' contribute to these.
            const expenseCategoriesForChart = {
                Food: 0,
                Medicines: 0,
                Shopping: 0,
                Misc: 0,
            };

            data.forEach(entry => {
                const amount = parseFloat(entry.Amount);
                // Skip entries with invalid amounts or missing Type/What kind?
                if (isNaN(amount) || !entry.Type || !entry['What kind?']) return;

                const entryType = entry.Type.toLowerCase();
                const entryWhatKind = entry['What kind?'].toLowerCase();

                if (entryType === 'expenses') {
                    totalExpensesAmount += amount; // Always deduct expenses from balance

                    // Categorize for the donut chart
                    if (entryWhatKind === 'food' || entryWhatKind === 'groceries') {
                        expenseCategoriesForChart.Food += amount;
                    } else if (entryWhatKind === 'medicines') {
                        expenseCategoriesForChart.Medicines += amount;
                    } else if (entryWhatKind === 'online shopping') {
                        expenseCategoriesForChart.Shopping += amount;
                    } else {
                        // Any other expense, including 'Transportation', 'Utility Bills',
                        // and 'Allowance' (when it's an expense), goes into 'Misc' for the chart.
                        expenseCategoriesForChart.Misc += amount;
                    }
                } else if (entryType === 'gains') {
                    totalGainsAmount += amount; // Always add gains to balance
                }
            });

            // Display Net Expense (which is total categorized expenses)
            const netExpenseForDisplay = totalExpensesAmount;
            document.getElementById('netExpenseValue').textContent = formatCurrency(netExpenseForDisplay);

            // Calculate Remaining Balance
            const remainingBalance = totalGainsAmount - totalExpensesAmount;
            // Define a base budget. If total gains are 0, this acts as a default initial budget.
            const defaultOrBaseBudget = 5000;
            const totalIncomeOrBudget = totalGainsAmount > 0 ? totalGainsAmount : defaultOrBaseBudget;

            document.getElementById('remainingBalanceAmount').textContent = `${formatCurrency(remainingBalance)} of ${formatCurrency(totalIncomeOrBudget)}`;

            // Calculate and display Remaining Balance Percentage
            const remainingBalancePercentage = (remainingBalance / totalIncomeOrBudget) * 100;
            const displayPercentage = isNaN(remainingBalancePercentage) ? 0 : Math.max(0, Math.min(100, remainingBalancePercentage));
            document.getElementById('remainingBalancePct').textContent = `${Math.round(displayPercentage)}%`;

            // Update Progress Circle (visual representation of remaining balance)
            let progressOffset = 0;
            let progressColor = 'var(--accent-green)'; // Default color for good balance
            const radius = 34;
            const circumference = 2 * Math.PI * radius;

            if (remainingBalancePercentage >= 100) {
                progressOffset = 0; // Full circle (100% or more remaining)
            } else if (remainingBalancePercentage > 0) {
                // Fill based on remaining percentage
                progressOffset = circumference - (remainingBalancePercentage / 100) * circumference;
                if (remainingBalancePercentage < 25) { // Change color if balance is low
                    progressColor = 'var(--accent-orange)';
                }
            } else { // remainingBalancePercentage <= 0 (balance is zero or negative / overspent)
                progressOffset = circumference; // Circle fully empty (or full red indicating overspent)
                progressColor = 'var(--accent-red)'; // Red for overspent
            }

            const progressCircle = document.querySelector('.progress-ring-progress');
            if (progressCircle) {
                progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
                progressCircle.style.strokeDashoffset = progressOffset;
                progressCircle.style.stroke = progressColor; // Apply dynamic color
            }

            // Chart.js Data for Donut Chart (ONLY Expense Categories)
            const categoryNames = ['Food', 'Medicines', 'Shopping', 'Misc'];
            const categoryAmounts = [
                expenseCategoriesForChart.Food,
                expenseCategoriesForChart.Medicines,
                expenseCategoriesForChart.Shopping,
                expenseCategoriesForChart.Misc,
            ];
            const categoryColors = [
                'var(--accent-green)',  // Food
                'var(--accent-red)',    // Medicines
                'var(--accent-orange)', // Shopping
                'var(--accent-blue)'    // Misc
            ];

            const totalCategoryExpenseForChart = categoryAmounts.reduce((sum, amount) => sum + amount, 0);

            // Update legend percentages below the chart
            document.getElementById('foodPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Food / totalCategoryExpenseForChart) * 100) : 0}%`;
            document.getElementById('medicinesPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Medicines / totalCategoryExpenseForChart) * 100) : 0}%`;
            document.getElementById('shoppingPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Shopping / totalCategoryExpenseForChart) * 100) : 0}%`;
            document.getElementById('miscPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Misc / totalCategoryExpenseForChart) * 100) : 0}%`;

            // Render Chart.js Donut Chart
            const ctx = document.getElementById('expenseChart');
            if (ctx) {
                // Destroy existing chart instance to prevent re-rendering issues
                if (window.expenseChartInstance) {
                    window.expenseChartInstance.destroy();
                }
                window.expenseChartInstance = new Chart(ctx.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: categoryNames,
                        datasets: [{
                            data: categoryAmounts,
                            backgroundColor: categoryColors,
                            borderColor: 'var(--card-bg)', // Border color matches card background
                            borderWidth: 8, // Thicker border for visual separation
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '80%', // Makes it a ring/donut
                        plugins: {
                            legend: {
                                display: false, // Hide default legend, we have a custom one
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        let label = context.label || '';
                                        if (label) {
                                            label += ': ';
                                        }
                                        if (context.parsed !== null) {
                                            label += formatCurrency(context.parsed); // Format tooltip amount
                                        }
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
    async function renderTransactions(selectedMonth) {
        const transactionsListDiv = document.getElementById('transactionsList');
        if (!transactionsListDiv) return; // Exit if the transactions list element isn't found

        try {
            const response = await fetch(CSV_URL);
            const csv = await response.text();
            let data = parseCSV(csv);

            // Filter out entries that are missing critical data or have invalid dates/amounts
            data = data.filter(entry => {
                const amount = parseFloat(entry.Amount);
                const date = new Date(entry.Date);
                return !isNaN(amount) && !isNaN(date) && entry.Type && entry['What kind?'];
            });

            // Sort transactions by date in descending order (newest first)
            data.sort((a, b) => new Date(b.Date) - new Date(a.Date));

            transactionsListDiv.innerHTML = ''; // Clear existing transactions

            const groupedTransactions = {};
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Normalize 'today' to start of day

            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1); // Normalize 'yesterday' to start of day

            data.forEach(entry => {
                const entryDate = new Date(entry.Date);
                entryDate.setHours(0, 0, 0, 0); // Normalize entry date to start of day for accurate comparison

                // Filter by the currently selected month
                if (entryDate.getMonth() + 1 !== selectedMonth) {
                    return; // Skip if not in the selected month
                }

                let dateHeader;
                // Assign "Today", "Yesterday", or full date string for grouping
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

            // Sort the date headers for consistent display (Today, Yesterday, then chronological)
            const sortedDates = Object.keys(groupedTransactions).sort((a, b) => {
                if (a === 'Today') return -1;
                if (b === 'Today') return 1;
                if (a === 'Yesterday') return -1;
                if (b === 'Yesterday') return 1;
                // For actual dates, sort descending
                return new Date(b) - new Date(a);
            });


            sortedDates.forEach(dateHeader => {
                const groupDiv = document.createElement('div');
                groupDiv.classList.add('transaction-group');

                const headerDiv = document.createElement('div');
                headerDiv.classList.add('transaction-date-header');
                headerDiv.textContent = dateHeader;
                groupDiv.appendChild(headerDiv);

                // Sort transactions within each date group by time (if 'Time' column exists)
                groupedTransactions[dateHeader].sort((a, b) => {
                    const timeA = a.Time ? a.Time.split(':').map(Number) : [0, 0];
                    const timeB = b.Time ? b.Time.split(':').map(Number) : [0, 0];
                    if (timeA[0] !== timeB[0]) return timeA[0] - timeB[0]; // Compare hours
                    return timeA[1] - timeB[1]; // Compare minutes
                });

                groupedTransactions[dateHeader].forEach(entry => {
                    const itemDiv = document.createElement('div');
                    itemDiv.classList.add('transaction-item');

                    const categoryIconDiv = document.createElement('div');
                    categoryIconDiv.classList.add('transaction-category-icon');

                    // Use the mapCategoryAndIcon function to get the appropriate icon and internal category
                    const { category: mappedCategory, icon: categoryIcon } = mapCategoryAndIcon(entry.Type, entry['What kind?']);

                    // Apply CSS class for icon background color based on actual 'Type' or mapped category
                    if (entry.Type && entry.Type.toLowerCase() === 'gains') {
                         categoryIconDiv.classList.add('category-gain'); // Green for gains
                    } else { // For expenses
                        // Apply specific category colors if defined in CSS, otherwise default to misc
                        switch (mappedCategory.toLowerCase()) {
                            case 'food': categoryIconDiv.classList.add('category-food'); break;
                            case 'medicines': categoryIconDiv.classList.add('category-medicines'); break;
                            case 'shopping': categoryIconDiv.classList.add('category-shopping'); break;
                            default: categoryIconDiv.classList.add('category-misc'); break; // For 'Transportation', 'Utility Bills', 'Allowance Expense', and other 'Misc'
                        }
                    }

                    categoryIconDiv.textContent = categoryIcon; // Set the emoji icon
                    itemDiv.appendChild(categoryIconDiv);

                    const detailsDiv = document.createElement('div');
                    detailsDiv.classList.add('transaction-details');

                    const nameSpan = document.createElement('span');
                    nameSpan.classList.add('transaction-name');
                    // Display Description first, fallback to 'What kind?' if no description
                    nameSpan.textContent = entry.Description || entry['What kind'] || 'N/A';
                    detailsDiv.appendChild(nameSpan);

                    const timeSpan = document.createElement('span');
                    timeSpan.classList.add('transaction-time');
                    timeSpan.textContent = entry.Time || ''; // Display time if available
                    detailsDiv.appendChild(timeSpan);
                    itemDiv.appendChild(detailsDiv);

                    const amountSpan = document.createElement('span');
                    amountSpan.classList.add('transaction-amount');
                    const amountValue = parseFloat(entry.Amount);
                    amountSpan.textContent = formatCurrency(amountValue); // Format amount with currency
                    // Apply 'expense' or 'gain' class for text color
                    amountSpan.classList.add(entry.Type && entry.Type.toLowerCase() === 'expenses' ? 'expense' : 'gain');
                    itemDiv.appendChild(amountSpan);

                    groupDiv.appendChild(itemDiv);
                });
                transactionsListDiv.appendChild(groupDiv);
            });

            // Display a message if no transactions are found for the selected month
            if (Object.keys(groupedTransactions).length === 0) {
                 transactionsListDiv.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 2rem;">No transactions for this month.</p>';
            }

        } catch (error) {
            console.error('Error fetching or processing CSV for transactions:', error);
            transactionsListDiv.innerHTML = '<p style="text-align: center; color: var(--accent-red);">Failed to load transactions. Please try again later.</p>';
        }
    }

    // Function to update the current date display in the header of transactions.html
    function updateCurrentDateDisplay() {
        const dateDisplayElement = document.getElementById('currentDateDisplay');
        if (dateDisplayElement) {
            const today = new Date();
            // Format as "Month Day" (e.g., "May 24")
            const options = { month: 'short', day: 'numeric' };
            dateDisplayElement.textContent = today.toLocaleDateString('en-US', options);
        }
    }

    // --- Main Page Initialization Logic ---
    // This runs when the DOM content is fully loaded for either HTML page.
    const dashboardPage = document.getElementById('dashboard-page');
    const transactionsPage = document.getElementById('transactions-page');

    if (dashboardPage) {
        // If on the dashboard page, update the dashboard
        updateDashboard();
    } else if (transactionsPage) {
        // If on the transactions page:
        updateCurrentDateDisplay(); // Update the current date in the header

        const monthButtons = document.querySelectorAll('.month-button');
        const currentMonth = new Date().getMonth() + 1; // getMonth() is 0-indexed (0-11)

        let initialMonthSet = false;
        // Find and activate the button for the current month on page load
        monthButtons.forEach(button => {
            const monthNumber = parseInt(button.dataset.month);
            if (monthNumber === currentMonth) {
                button.classList.add('active');
                initialMonthSet = true;
            } else {
                button.classList.remove('active');
            }
        });

        // Fallback: If for some reason the current month button isn't found (e.g., only Jan-Jun buttons exist),
        // try to activate the closest month or default to the first button.
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
            renderTransactions(parseInt(closestMonthButton.dataset.month)); // Render with the fallback month
        } else if (initialMonthSet) {
             renderTransactions(currentMonth); // Render with the actual current month
        } else {
            renderTransactions(1); // Default to January (month 1) if no buttons found or specific month couldn't be set
        }


        // Add event listeners to all month buttons for filtering transactions
        monthButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Remove 'active' class from all buttons
                monthButtons.forEach(btn => btn.classList.remove('active'));
                // Add 'active' class to the clicked button
                this.classList.add('active');
                const selectedMonth = parseInt(this.dataset.month); // Get the month number from data-month attribute
                renderTransactions(selectedMonth); // Re-render transactions for the selected month
            });
        });
    }
});
