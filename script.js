document.addEventListener('DOMContentLoaded', () => {
    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgMFbI8pivLbRpc2nL2Gyoxw47PmXEVxvUDjjr-t86gj4-J3QM8uV7m8iJN9wxlYo3IY5FQqqUICei/pub?output=csv';

    // Helper function to parse CSV
    function parseCSV(csv) {
        const lines = csv.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) return [];

        const headers = lines[0].split(',').map(header => header.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(value => value.trim());
            const entry = {};
            headers.forEach((header, index) => {
                entry[header] = values[index];
            });
            data.push(entry);
        }
        return data;
    }

    // Function to format currency to Philippine Peso
    function formatCurrency(amount) {
        return `₱ ${parseFloat(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Function to calculate and update dashboard
    async function updateDashboard() {
        if (document.getElementById('expenseChart')) { // Only run if on dashboard page
            try {
                const response = await fetch(CSV_URL);
                const csv = await response.text();
                const data = parseCSV(csv);

                let totalExpenses = 0;
                let totalGains = 0;
                const expenseCategories = {
                    Food: 0,
                    Medicines: 0,
                    Shopping: 0,
                    Misc: 0,
                };

                data.forEach(entry => {
                    const amount = parseFloat(entry.Amount);
                    if (isNaN(amount)) return; // Skip invalid amounts

                    if (entry.Type === 'Expense') {
                        totalExpenses += amount;
                        switch (entry.Category) {
                            case 'Food':
                                expenseCategories.Food += amount;
                                break;
                            case 'Medicines':
                                expenseCategories.Medicines += amount;
                                break;
                            case 'Shopping':
                                expenseCategories.Shopping += amount;
                                break;
                            default:
                                expenseCategories.Misc += amount;
                                break;
                        }
                    } else if (entry.Type === 'Gain') {
                        totalGains += amount;
                    }
                });

                const netExpense = totalExpenses; // As per the image, "Net Expense" is total expenses
                const remainingBalance = totalGains - totalExpenses;
                const totalIncomeOrBudget = totalGains > 0 ? totalGains : totalExpenses * 1.5; // If no gains, assume budget is 1.5x expenses or a default value

                document.getElementById('netExpenseValue').textContent = formatCurrency(netExpense);
                document.getElementById('remainingBalanceAmount').textContent = `${formatCurrency(remainingBalance)} of ${formatCurrency(totalIncomeOrBudget)}`;

                const remainingBalancePercentage = (remainingBalance / totalIncomeOrBudget) * 100;
                const displayPercentage = isNaN(remainingBalancePercentage) ? 0 : Math.max(0, Math.min(100, remainingBalancePercentage)); // Clamp between 0 and 100
                document.getElementById('remainingBalancePct').textContent = `${Math.round(displayPercentage)}%`;

                // Update progress circle
                const radius = 34; // r from CSS
                const circumference = 2 * Math.PI * radius;
                const offset = circumference - (displayPercentage / 100) * circumference;
                const progressCircle = document.querySelector('.progress-ring-progress');
                progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
                progressCircle.style.strokeDashoffset = offset;

                // Chart.js data
                const categoryNames = ['Food', 'Medicines', 'Shopping', 'Misc'];
                const categoryAmounts = [
                    expenseCategories.Food,
                    expenseCategories.Medicines,
                    expenseCategories.Shopping,
                    expenseCategories.Misc,
                ];
                const categoryColors = [
                    'var(--accent-green)', // Food
                    'var(--accent-red)',    // Medicines
                    'var(--accent-orange)', // Shopping
                    'var(--accent-blue)'    // Misc
                ];

                const totalCategoryExpense = categoryAmounts.reduce((sum, amount) => sum + amount, 0);

                // Update legend percentages
                document.getElementById('foodPct').textContent = `${Math.round((expenseCategories.Food / totalCategoryExpense) * 100) || 0}%`;
                document.getElementById('medicinesPct').textContent = `${Math.round((expenseCategories.Medicines / totalCategoryExpense) * 100) || 0}%`;
                document.getElementById('shoppingPct').textContent = `${Math.round((expenseCategories.Shopping / totalCategoryExpense) * 100) || 0}%`;
                document.getElementById('miscPct').textContent = `${Math.round((expenseCategories.Misc / totalCategoryExpense) * 100) || 0}%`;


                // Initialize Chart.js
                const ctx = document.getElementById('expenseChart').getContext('2d');
                if (window.expenseChartInstance) {
                    window.expenseChartInstance.destroy(); // Destroy previous instance
                }
                window.expenseChartInstance = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: categoryNames,
                        datasets: [{
                            data: categoryAmounts,
                            backgroundColor: categoryColors,
                            borderColor: 'var(--card-bg)', // Inner border color
                            borderWidth: 8, // Thicker border
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '80%', // Make it a ring chart
                        plugins: {
                            legend: {
                                display: false, // Custom legend below chart
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        let label = context.label || '';
                                        if (label) {
                                            label += ': ';
                                        }
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

            } catch (error) {
                console.error('Error fetching or processing CSV for dashboard:', error);
                document.getElementById('netExpenseValue').textContent = '₱ Error';
                document.getElementById('remainingBalanceAmount').textContent = '₱ Error';
            }
        }
    }

    // Function to render transactions list
    async function renderTransactions(selectedMonth = new Date().getMonth() + 1) { // Default to current month
        const transactionsListDiv = document.getElementById('transactionsList');
        if (!transactionsListDiv) return; // Only run if on transactions page

        try {
            const response = await fetch(CSV_URL);
            const csv = await response.text();
            let data = parseCSV(csv);

            // Sort data by date (assuming 'Date' column is YYYY-MM-DD or similar)
            data.sort((a, b) => new Date(b.Date) - new Date(a.Date));

            transactionsListDiv.innerHTML = ''; // Clear previous transactions

            const groupedTransactions = {};

            data.forEach(entry => {
                const entryDate = new Date(entry.Date);
                // Ensure the date is valid before proceeding
                if (isNaN(entryDate)) {
                    console.warn('Invalid date entry:', entry.Date);
                    return;
                }

                // Filter by selected month
                if (entryDate.getMonth() + 1 !== selectedMonth) {
                    return;
                }

                const today = new Date();
                const yesterday = new Date(today);
                yesterday.setDate(today.getDate() - 1);

                let dateHeader = entryDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); // Default full date

                if (entryDate.toDateString() === today.toDateString()) {
                    dateHeader = 'Today';
                } else if (entryDate.toDateString() === yesterday.toDateString()) {
                    dateHeader = 'Yesterday';
                }

                if (!groupedTransactions[dateHeader]) {
                    groupedTransactions[dateHeader] = [];
                }
                groupedTransactions[dateHeader].push(entry);
            });

            for (const dateHeader in groupedTransactions) {
                const groupDiv = document.createElement('div');
                groupDiv.classList.add('transaction-group');

                const headerDiv = document.createElement('div');
                headerDiv.classList.add('transaction-date-header');
                headerDiv.textContent = dateHeader;
                groupDiv.appendChild(headerDiv);

                groupedTransactions[dateHeader].forEach(entry => {
                    const itemDiv = document.createElement('div');
                    itemDiv.classList.add('transaction-item');

                    const categoryIconDiv = document.createElement('div');
                    categoryIconDiv.classList.add('transaction-category-icon');

                    let categoryClass = '';
                    let iconText = '';

                    switch (entry.Category.toLowerCase()) {
                        case 'food':
                            categoryClass = 'category-food';
                            iconText = '🍔';
                            break;
                        case 'medicines':
                            categoryClass = 'category-medicines';
                            iconText = '💊';
                            break;
                        case 'shopping':
                            categoryClass = 'category-shopping';
                            iconText = '🛍️';
                            break;
                        case 'salary':
                        case 'gain': // Assuming 'Gain' is a type
                            categoryClass = 'category-gain';
                            iconText = '💸'; // Money bag for gains
                            break;
                        default:
                            categoryClass = 'category-misc';
                            iconText = '✨'; // General icon
                            break;
                    }
                    categoryIconDiv.classList.add(categoryClass);
                    categoryIconDiv.textContent = iconText;
                    itemDiv.appendChild(categoryIconDiv);

                    const detailsDiv = document.createElement('div');
                    detailsDiv.classList.add('transaction-details');

                    const nameSpan = document.createElement('span');
                    nameSpan.classList.add('transaction-name');
                    nameSpan.textContent = entry.Description;
                    detailsDiv.appendChild(nameSpan);

                    const timeSpan = document.createElement('span');
                    timeSpan.classList.add('transaction-time');
                    // Format time (assuming 'Time' column is HH:MM)
                    timeSpan.textContent = entry.Time || '';
                    detailsDiv.appendChild(timeSpan);
                    itemDiv.appendChild(detailsDiv);

                    const amountSpan = document.createElement('span');
                    amountSpan.classList.add('transaction-amount');
                    const amountValue = parseFloat(entry.Amount);
                    amountSpan.textContent = formatCurrency(amountValue);
                    amountSpan.classList.add(entry.Type === 'Expense' ? 'expense' : 'gain');
                    itemDiv.appendChild(amountSpan);

                    groupDiv.appendChild(itemDiv);
                });
                transactionsListDiv.appendChild(groupDiv);
            }

            if (Object.keys(groupedTransactions).length === 0) {
                 transactionsListDiv.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 2rem;">No transactions for this month.</p>';
            }

        } catch (error) {
            console.error('Error fetching or processing CSV for transactions:', error);
            transactionsListDiv.innerHTML = '<p style="text-align: center; color: var(--accent-red);">Failed to load transactions. Please try again later.</p>';
        }
    }

    // Universal Initialization
    if (document.querySelector('.container')) { // Check if any part of the app is present
        // Initialize dashboard if on index.html
        if (document.getElementById('expenseChart')) {
            updateDashboard();
        }

        // Initialize transactions if on transactions.html
        if (document.getElementById('transactionsList')) {
            // Get current month to set active and render
            const currentMonth = new Date().getMonth() + 1; // getMonth() is 0-indexed
            const monthButtons = document.querySelectorAll('.month-button');

            // Set initial active month button
            monthButtons.forEach(button => {
                if (parseInt(button.dataset.month) === currentMonth) {
                    button.classList.add('active');
                } else {
                    button.classList.remove('active');
                }
            });

            renderTransactions(currentMonth);

            // Add event listeners for month buttons
            monthButtons.forEach(button => {
                button.addEventListener('click', function() {
                    monthButtons.forEach(btn => btn.classList.remove('active'));
                    this.classList.add('active');
                    const selectedMonth = parseInt(this.dataset.month);
                    renderTransactions(selectedMonth);
                });
            });
        }
    }
});
