document.addEventListener('DOMContentLoaded', () => {
    const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgMFbI8pivLbRpc2nL2Gyoxw47PmXEVxvUDrjr-t86gj4-J3QM8uV7m8iJN9wxlYo3IY5FQqqUICei/pub?output=csv';
    const CURRENCY_SYMBOL = '₱';
    const MONTHLY_EXPENSE_LIMIT = 10000; // Philippine Peso

    // !!! --- CUSTOMIZE THIS ARRAY --- !!!
    // Add the exact category names from your Google Sheet that represent income/gains.
    // These are case-sensitive.
    const INCOME_CATEGORIES = ["Salary", "Bonus", "Gifts Received", "Freelance Income", "Investment Gains"]; 
    // !!! --- END CUSTOMIZATION --- !!!

    // DOM Elements for Financial Overview
    const totalGainsValueEl = document.getElementById('totalGainsValue');
    const totalExpensesDisplayValueEl = document.getElementById('totalExpensesDisplayValue');
    const remainingBalanceValueEl = document.getElementById('remainingBalanceValue');

    // DOM Elements for Donut Chart
    const totalExpensesForChartValueEl = document.getElementById('totalExpensesForChartValue');
    const chartLegendEl = document.getElementById('chartLegend');
    const expenseDonutChartEl = document.getElementById('expenseDonutChart');

    // DOM Elements for Expense Limit
    const limitPercentageEl = document.getElementById('limitPercentage');
    const currentMonthExpenseForLimitEl = document.getElementById('currentMonthExpenseForLimit');
    const monthlyLimitTotalEl = document.getElementById('monthlyLimitTotal');
    const limitProgressCircleEl = document.getElementById('limitProgressCircle');
    
    // DOM Element for Pending Bills
    const pendingBillsListEl = document.getElementById('pendingBillsList');

    const categoryColors = { // Primarily for expense categories in the donut chart
        "Food": "#10B981",       
        "Medicines": "#EF4444",  
        "Shopping": "#F59E0B",   
        "Miscellaneous": "#3B82F6", 
        "Bills": "#6366F1",      
        "Transport": "#8B5CF6",  
        "Default": "#9CA3AF"    
    };

    function formatCurrency(amount) {
        return `${CURRENCY_SYMBOL}${amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }

    function getColor(category) {
        if (!category) return categoryColors["Default"];
        if (categoryColors[category]) return categoryColors[category];
        
        const lowerCategory = category.toLowerCase();
        if (lowerCategory.includes('food') || lowerCategory.includes('restaurant')) return categoryColors["Food"];
        if (lowerCategory.includes('medicine') || lowerCategory.includes('health') || lowerCategory.includes('pharmacy')) return categoryColors["Medicines"];
        if (lowerCategory.includes('shop') || lowerCategory.includes('store') || lowerCategory.includes('apparel') || lowerCategory.includes('market')) return categoryColors["Shopping"];
        if (lowerCategory.includes('bill') || lowerCategory.includes('utilities') || lowerCategory.includes('rent') || lowerCategory.includes('subscription')) return categoryColors["Bills"];
        if (lowerCategory.includes('transport') || lowerCategory.includes('gas') || lowerCategory.includes('taxi') || lowerCategory.includes('commute')) return categoryColors["Transport"];
        
        for (const key in categoryColors) {
            if (lowerCategory.includes(key.toLowerCase())) {
                return categoryColors[key];
            }
        }
        return categoryColors["Default"];
    }

    async function fetchData() {
        try {
            const response = await fetch(csvUrl + '&t=' + new Date().getTime()); 
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const csvText = await response.text();
            const transactions = parseCSV(csvText);
            processDashboardData(transactions);
            displayPendingBills(); 
        } catch (error) {
            console.error("Error fetching or processing data:", error);
            if(totalGainsValueEl) totalGainsValueEl.textContent = 'Error';
            if(totalExpensesDisplayValueEl) totalExpensesDisplayValueEl.textContent = 'Error';
            if(remainingBalanceValueEl) remainingBalanceValueEl.textContent = 'Error';
            if(pendingBillsListEl) pendingBillsListEl.innerHTML = '<div class="bill-item-placeholder">Error loading data.</div>';
        }
    }

    function parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) return [];
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        return lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            const transaction = {};
            headers.forEach((header, index) => transaction[header] = values[index]);
            return transaction;
        }).filter(t => t.Timestamp && t.Name && t.Amount && t.Category); 
    }

    function processDashboardData(transactions) {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let totalGains = 0;
        let totalExpenses = 0;
        const expensesByCategory = {};

        transactions.forEach(t => {
            const transactionDate = new Date(t.Timestamp);
            if (transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear) {
                const amount = parseFloat(t.Amount);
                if (isNaN(amount) || amount <= 0) return; 

                if (INCOME_CATEGORIES.includes(t.Category)) {
                    totalGains += amount;
                } else {
                    totalExpenses += amount;
                    const category = t.Category || "Miscellaneous";
                    expensesByCategory[category] = (expensesByCategory[category] || 0) + amount;
                }
            }
        });
        
        const remainingBalance = totalGains - totalExpenses;

        // Update Financial Overview card
        if(totalGainsValueEl) totalGainsValueEl.textContent = formatCurrency(totalGains);
        if(totalExpensesDisplayValueEl) totalExpensesDisplayValueEl.textContent = formatCurrency(totalExpenses);
        if(remainingBalanceValueEl) {
            remainingBalanceValueEl.textContent = formatCurrency(remainingBalance);
            remainingBalanceValueEl.style.color = remainingBalance < 0 ? '#EF4444' : '#10B981'; // Red if negative, green if positive
        }
        
        // Update Donut Chart (for expenses)
        const expenseChartData = Object.entries(expensesByCategory)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value); 

        updateDonutChart(expenseChartData, totalExpenses);
        updateChartLegend(expenseChartData, totalExpenses);
        
        // Update Expense Limit section (based on totalExpenses)
        updateExpenseLimitSection(totalExpenses);
    }

    function updateDonutChart(expenseChartData, totalExpensesValue) {
        if(!expenseDonutChartEl || !totalExpensesForChartValueEl) return;
        
        totalExpensesForChartValueEl.textContent = formatCurrency(totalExpensesValue);
        expenseDonutChartEl.innerHTML = ''; 
        
        if (totalExpensesValue === 0 || expenseChartData.length === 0) {
            return;
        }

        let accumulatedPercentage = 0;
        const radius = 50; 
        const circumference = 2 * Math.PI * radius;

        expenseChartData.forEach(item => {
            const percentage = (item.value / totalExpensesValue) * 100;
            if (percentage === 0) return; 

            const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
            const strokeDashoffset = -(accumulatedPercentage / 100) * circumference;

            const segment = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            segment.setAttribute("cx", "60"); 
            segment.setAttribute("cy", "60");
            segment.setAttribute("r", radius.toString()); 
            segment.setAttribute("stroke", getColor(item.name));
            segment.setAttribute("stroke-width", "20"); 
            segment.setAttribute("stroke-dasharray", strokeDasharray);
            segment.setAttribute("stroke-dashoffset", strokeDashoffset.toString());
            segment.setAttribute("fill", "none");

            expenseDonutChartEl.appendChild(segment);
            accumulatedPercentage += percentage;
        });
    }
    
    function updateChartLegend(expenseChartData, totalExpensesValue) {
        if(!chartLegendEl) return;
        chartLegendEl.innerHTML = ''; 
        if (totalExpensesValue === 0 || expenseChartData.length === 0) return;

        const legendItems = expenseChartData.slice(0, 4); 

        legendItems.forEach(item => {
            const percentage = (item.value / totalExpensesValue) * 100;
            if (percentage === 0) return;

            const legendItemDiv = document.createElement('div');
            legendItemDiv.className = 'legend-item';
            legendItemDiv.innerHTML = `
                <span class="legend-dot" style="background-color: ${getColor(item.name)};"></span>
                <span class="legend-text">${item.name}</span>
                <span class="legend-percentage">${percentage.toFixed(0)}%</span>
            `;
            chartLegendEl.appendChild(legendItemDiv);
        });
    }

    function updateExpenseLimitSection(currentTotalExpenses) {
        if(!limitPercentageEl || !currentMonthExpenseForLimitEl || !monthlyLimitTotalEl || !limitProgressCircleEl) return;

        const percentage = Math.min((currentTotalExpenses / MONTHLY_EXPENSE_LIMIT) * 100, 100); 
        
        currentMonthExpenseForLimitEl.textContent = formatCurrency(currentTotalExpenses);
        monthlyLimitTotalEl.textContent = formatCurrency(MONTHLY_EXPENSE_LIMIT);
        limitPercentageEl.textContent = `${percentage.toFixed(0)}%`;

        const radius = 40; 
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percentage / 100) * circumference;
        
        limitProgressCircleEl.style.strokeDasharray = `${circumference} ${circumference}`;
        limitProgressCircleEl.style.strokeDashoffset = offset;
    }

    function displayPendingBills() {
        if(!pendingBillsListEl) return;
        const pendingBillsData = [
            { name: "Meralco Electric Bill", amount: 1500.75, dueDate: "05" },
            { name: "Converge Internet", amount: 1899.00, dueDate: "12" },
            { name: "Water Bill", amount: 650.50, dueDate: "15" },
        ];
        pendingBillsListEl.innerHTML = ''; 

        if (pendingBillsData.length === 0) {
            pendingBillsListEl.innerHTML = '<div class="bill-item-placeholder">No pending bills.</div>';
            return;
        }

        pendingBillsData.forEach(bill => {
            const billItem = document.createElement('div');
            billItem.className = 'bill-item';
            billItem.innerHTML = `
                <div class="bill-date">${bill.dueDate}</div>
                <div class="bill-info">
                    <span class="bill-name">${bill.name}</span>
                </div>
                <div class="bill-amount">${formatCurrency(bill.amount)}</div>
            `;
            pendingBillsListEl.appendChild(billItem);
        });
        const note = document.createElement('p');
        note.style.fontSize = '12px';
        note.style.color = '#777';
        note.style.textAlign = 'center';
        note.style.marginTop = '10px';
        note.innerHTML = '<em>Pending bills are sample data. <br>This data is not from your spreadsheet.</em>';
        pendingBillsListEl.appendChild(note);
    }

    // Initial Load
    fetchData();
});
