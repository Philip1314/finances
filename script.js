document.addEventListener('DOMContentLoaded', () => {
    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgMFbI8pivLbRpc2nL2Gyoxw47PmXEVxvUDrjr-t86gj4-J3QM8uV7m8iJN9wxlYo3IY5FQqqUICei/pub?output=csv';

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
                case 'salary':
                    icon = '💸';
                    break;
                case 'allowance':
                    icon = '🎁';
                    break;
                default:
                    icon = '💰';
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
                case 'allowance':
                    category = 'Misc'; // Allowance spent often falls into a general category for analysis
                    icon = '🚶';
                    break;
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
            const displayPercentage = isNaN(remainingBalancePercentage) ? 0 : remainingBalancePercentage;
            document.getElementById('remainingBalancePct').textContent = `${Math.round(displayPercentage)}%`;

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
                            borderColor: 'var(--card-bg)',
                            borderWidth: 8,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '80%',
                        plugins: {
                            legend: {
                                display: false,
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
            if (document.getElementById('netExpenseValue')) document.getElementById('netExpenseValue').textContent = '₱ Error';
            if (document.getElementById('remainingBalanceAmount')) document.getElementById('remainingBalanceAmount').textContent = '₱ Error';
        }
    }

    // --- Transactions Page Specific Logic (transactions.html) ---
    async function renderTransactions(selectedMonth, filterKeyword = '') {
        const transactionsListDiv = document.getElementById('transactionsList');
        if (!transactionsListDiv) return;

        try {
            const response = await fetch(CSV_URL);
            const csv = await response.text();
            let data = parseCSV(csv);

            data = data.filter(entry => {
                const amount = parseFloat(entry.Amount);
                const date = new Date(entry.Date);
                const entryType = entry.Type ? entry.Type.toLowerCase() : '';
                const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';

                if (isNaN(amount) || isNaN(date) || !entryType || !entryWhatKind) {
                    return false;
                }

                const entryDate = new Date(entry.Date);
                entryDate.setHours(0, 0, 0, 0);

                if (entryDate.getMonth() + 1 !== selectedMonth) {
                    return false;
                }

                if (filterKeyword) {
                    const lowerCaseKeyword = filterKeyword.toLowerCase();
                    const description = entry.Description ? entry.Description.toLowerCase() : '';
                    const whatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';

                    if (!(description.includes(lowerCaseKeyword) || whatKind.includes(lowerCaseKeyword))) {
                        return false;
                    }
                }
                return true;
            });

            data.sort((a, b) => new Date(b.Date) - new Date(a.Date));

            transactionsListDiv.innerHTML = '';

            const groupedTransactions = {};
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);

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
                    const amountValue = parseFloat(entry.Amount);
                    amountSpan.textContent = formatCurrency(amountValue);
                    amountSpan.classList.add(entry.Type && entry.Type.toLowerCase() === 'expenses' ? 'expense' : 'gain');
                    itemDiv.appendChild(amountSpan);

                    groupDiv.appendChild(itemDiv);
                });
                transactionsListDiv.appendChild(groupDiv);
            });

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
        // Target the profile-icon element by its new ID
        const profileDateDisplayElement = document.getElementById('profileDateDisplay');
        if (profileDateDisplayElement) {
            const today = new Date();
            const month = today.toLocaleDateString('en-US', { month: 'short' });
            const day = today.getDate();
            // Set the innerHTML with spans for styling the stacked month and day
            profileDateDisplayElement.innerHTML = `<span>${month}</span><span>${day}</span>`;
        }
    }

    // --- Main Page Initialization Logic ---
    const dashboardPage = document.getElementById('dashboard-page');
    const transactionsPage = document.getElementById('transactions-page');

    if (dashboardPage) {
        updateDashboard();
    } else if (transactionsPage) {
        updateCurrentDateDisplay(); // Call this when on transactions page

        const monthButtons = document.querySelectorAll('.month-button');
        const currentMonth = new Date().getMonth() + 1;

        let currentActiveMonth = currentMonth;

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
             currentActiveMonth = 1; // Default to January if no current month button found
        }

        renderTransactions(currentActiveMonth);

        monthButtons.forEach(button => {
            button.addEventListener('click', function() {
                monthButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                currentActiveMonth = parseInt(this.dataset.month);
                const filterKeyword = document.getElementById('filterKeyword')?.value || '';
                renderTransactions(currentActiveMonth, filterKeyword);
            });
        });

        // Filter button logic
        const filterButton = document.getElementById('filterButton');
        const filterOptionsDiv = document.getElementById('filterOptions');
        const filterKeywordInput = document.getElementById('filterKeyword');
        const applyFilterButton = document.getElementById('applyFilter');

        if (filterButton && filterOptionsDiv) {
            filterButton.addEventListener('click', () => {
                filterOptionsDiv.style.display = filterOptionsDiv.style.display === 'none' ? 'block' : 'none';
                if (filterOptionsDiv.style.display === 'block') {
                    filterKeywordInput.focus();
                } else {
                    filterKeywordInput.value = '';
                    renderTransactions(currentActiveMonth, '');
                }
            });
        }

        if (applyFilterButton && filterKeywordInput) {
            applyFilterButton.addEventListener('click', () => {
                const keyword = filterKeywordInput.value;
                renderTransactions(currentActiveMonth, keyword);
            });

            filterKeywordInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    applyFilterButton.click();
                }
            });
        }
    }
});
