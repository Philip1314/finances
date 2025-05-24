document.addEventListener('DOMContentLoaded', () => {
    const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgMFbI8pivLbRpc2nL2Gyoxw47PmXEVxvUDrjr-t86gj4-J3QM8uV7m8iJN9wxlYo3IY5FQqqUICei/pub?output=csv';
    const transactionsListElement = document.getElementById('transactions-list');
    const CURRENCY_SYMBOL = '₱'; 

    const categoryColors = {
        "Food": "#FF6B6B", 
        "Groceries": "#FF6B6B", 
        "Cafe": "#4D96FF", 
        "Coffee": "#4D96FF", 
        "Shopping": "#FFD166", 
        "Gifts": "#FFD166", 
        "Transport": "#06D6A0", 
        "Taxi": "#06D6A0", 
        "Bills": "#758BFD", 
        "Utilities": "#758BFD", 
        "Health": "#FF9671", 
        "Medicines": "#FF9671", 
        "Entertainment": "#C3AED6", 
        "Wallet": "#57C4E5", 
        "Miscellaneous": "#BDBDBD", 
        "Default": "#C7C7CC" 
    };

    function getColorForCategory(category) {
        if (!category) return categoryColors["Default"];
        if (categoryColors[category]) {
            return categoryColors[category];
        }
        const lowerCategory = category.toLowerCase();
        if (lowerCategory.includes('food') || lowerCategory.includes('restaurant')) return categoryColors["Food"];
        if (lowerCategory.includes('coffee') || lowerCategory.includes('cafe')) return categoryColors["Cafe"];
        if (lowerCategory.includes('shop') || lowerCategory.includes('store')) return categoryColors["Shopping"];
        if (lowerCategory.includes('transport') || lowerCategory.includes('taxi') || lowerCategory.includes('bus')) return categoryColors["Transport"];
        if (lowerCategory.includes('bill') || lowerCategory.includes('utility')) return categoryColors["Bills"];
        if (lowerCategory.includes('health') || lowerCategory.includes('medicine')) return categoryColors["Medicines"];
        return categoryColors["Default"];
    }

    async function fetchTransactions() {
        if (!transactionsListElement) return;
        transactionsListElement.innerHTML = '<div class="loading-placeholder">Loading transactions...</div>';
        try {
            const response = await fetch(csvUrl + '&random=' + Math.random()); 
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const csvText = await response.text();
            const transactions = parseCSV(csvText);
            displayTransactions(transactions);
        } catch (error) {
            console.error('Error fetching or parsing transactions:', error);
            transactionsListElement.innerHTML = `<div class="error-placeholder">Failed to load transactions. ${error.message}</div>`;
        }
    }

    function parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) return []; 

        const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, ''));
        const transactions = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(value => value.trim().replace(/"/g, ''));
            if (values.length === headers.length) {
                const transaction = {};
                headers.forEach((header, index) => {
                    transaction[header] = values[index];
                });
                if (transaction.Timestamp && transaction.Name && transaction.Amount && transaction.Category) {
                    transactions.push(transaction);
                }
            }
        }
        transactions.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
        return transactions;
    }

    function formatDateForDisplay(timestampString) {
        const date = new Date(timestampString);
        if (isNaN(date)) return "Invalid Date";

        const day = date.getDate();
        const month = date.toLocaleString('default', { month: 'short' });
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day} ${month} &bull; ${hours}:${minutes}`;
    }
    
    function getRelativeDateGroup(timestampString) {
        const date = new Date(timestampString);
        if (isNaN(date)) return "Other";

        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return "Today";
        } else if (date.toDateString() === yesterday.toDateString()) {
            return "Yesterday";
        } else {
            const currentYear = today.getFullYear();
            const dateYear = date.getFullYear();
            const day = date.getDate();
            const month = date.toLocaleString('default', { month: 'short' });
            if (dateYear === currentYear) {
                return `${day} ${month}`;
            } else {
                return `${day} ${month} ${dateYear}`;
            }
        }
    }

    function displayTransactions(transactions) {
        if (!transactionsListElement) return;
        transactionsListElement.innerHTML = ''; 

        if (transactions.length === 0) {
            transactionsListElement.innerHTML = '<div class="loading-placeholder">No transactions found.</div>';
            return;
        }

        const groupedTransactions = transactions.reduce((acc, transaction) => {
            const groupName = getRelativeDateGroup(transaction.Timestamp);
            if (!acc[groupName]) {
                acc[groupName] = [];
            }
            acc[groupName].push(transaction);
            return acc;
        }, {});

        const groupOrder = ["Today", "Yesterday"];
        Object.keys(groupedTransactions).forEach(groupName => {
            if (!groupOrder.includes(groupName)) {
                groupOrder.push(groupName);
            }
        });
        groupOrder.sort((a, b) => {
            if (a === "Today") return -1;
            if (b === "Today") return 1;
            if (a === "Yesterday") return -1;
            if (b === "Yesterday") return 1;
            let dateA = new Date(a + (a.includes(' ') ? '' : ' ' + new Date().getFullYear()));
            let dateB = new Date(b + (b.includes(' ') ? '' : ' ' + new Date().getFullYear()));
            if (!isNaN(dateA) && !isNaN(dateB)) return dateB - dateA; 
            return a.localeCompare(b); 
        });
        
        for (const groupName of groupOrder) {
            if (groupedTransactions[groupName] && groupedTransactions[groupName].length > 0) {
                const groupHeader = document.createElement('div');
                groupHeader.className = 'date-group-header';
                groupHeader.textContent = groupName;
                transactionsListElement.appendChild(groupHeader);

                groupedTransactions[groupName].forEach(transaction => {
                    const item = document.createElement('div');
                    item.className = 'transaction-item';

                    const category = transaction.Category || 'Default';
                    const color = getColorForCategory(category);
                    const formattedTime = formatDateForDisplay(transaction.Timestamp);
                    const amount = parseFloat(transaction.Amount);
                    const displayAmount = !isNaN(amount) ? amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : 'N/A';

                    item.innerHTML = `
                        <div class="dot" style="background-color: ${color};"></div>
                        <div class="info">
                            <div class="name">${transaction.Name || 'N/A'}</div>
                            <div class="time">${formattedTime}</div>
                        </div>
                        <div class="amount">${CURRENCY_SYMBOL} ${displayAmount}</div>
                    `;
                    transactionsListElement.appendChild(item);
                });
            }
        }
    }

    fetchTransactions();
});
