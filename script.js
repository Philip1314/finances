document.addEventListener('DOMContentLoaded', () => {
    const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgMFbI8pivLbRpc2nL2Gyoxw47PmXEVxvUDrjr-t86gj4-J3QM8uV7m8iJN9wxlYo3IY5FQqqUICei/pub?output=csv';
    const transactionsListElement = document.getElementById('transactions-list');

    const categoryColors = {
        "Food": "#FF6B6B", // Red
        "Groceries": "#FF6B6B", // Red
        "Cafe": "#4D96FF", // Blue
        "Coffee": "#4D96FF", // Blue
        "Shopping": "#FFD166", // Yellow
        "Gifts": "#FFD166", // Yellow
        "Transport": "#06D6A0", // Green
        "Taxi": "#06D6A0", // Green
        "Bills": "#758BFD", // Purple/Indigo
        "Utilities": "#758BFD", // Purple/Indigo
        "Health": "#FF9671", // Orange
        "Medicines": "#FF9671", // Orange (as per original image with ₹50)
        "Entertainment": "#C3AED6", // Lavender
        "Wallet": "#57C4E5", // Light Blue for 'Charlie's Wallet' like transactions
        "Miscellaneous": "#BDBDBD", // Gray
        "Default": "#C7C7CC" // Default gray
    };

    function getColorForCategory(category) {
        if (category && categoryColors[category]) {
            return categoryColors[category];
        }
        // Attempt partial match or general terms
        const lowerCategory = category ? category.toLowerCase() : '';
        if (lowerCategory.includes('food') || lowerCategory.includes('restaurant')) return categoryColors["Food"];
        if (lowerCategory.includes('coffee') || lowerCategory.includes('cafe')) return categoryColors["Cafe"];
        if (lowerCategory.includes('shop') || lowerCategory.includes('store')) return categoryColors["Shopping"];
        if (lowerCategory.includes('transport') || lowerCategory.includes('taxi') || lowerCategory.includes('bus')) return categoryColors["Transport"];
        if (lowerCategory.includes('bill') || lowerCategory.includes('utility')) return categoryColors["Bills"];
        if (lowerCategory.includes('health') || lowerCategory.includes('medicine')) return categoryColors["Medicines"];
        return categoryColors["Default"];
    }

    async function fetchTransactions() {
        try {
            const response = await fetch(csvUrl + '&random=' + Math.random()); // Add random to try bypass cache
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
        if (lines.length < 2) return []; // No data beyond headers

        const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, ''));
        const transactions = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(value => value.trim().replace(/"/g, ''));
            if (values.length === headers.length) {
                const transaction = {};
                headers.forEach((header, index) => {
                    transaction[header] = values[index];
                });
                transactions.push(transaction);
            }
        }
        // Sort by timestamp, newest first (assuming 'Timestamp' is a parsable date)
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
            // Format for older dates, e.g., "15 Jul" or "15 Jul 2023" if different year
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
        transactionsListElement.innerHTML = ''; // Clear loading or previous content

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

        // Define the order of groups
        const groupOrder = ["Today", "Yesterday"];
        // Add other date groups dynamically after Today and Yesterday
        Object.keys(groupedTransactions).forEach(groupName => {
            if (!groupOrder.includes(groupName)) {
                groupOrder.push(groupName);
            }
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
                    const amount = parseFloat(transaction.Amount).toFixed(2); // Ensure two decimal places

                    item.innerHTML = `
                        <div class="dot" style="background-color: ${color};"></div>
                        <div class="info">
                            <div class="name">${transaction.Name || 'N/A'}</div>
                            <div class="time">${formattedTime}</div>
                        </div>
                        <div class="amount">₹ ${amount}</div>
                    `;
                    transactionsListElement.appendChild(item);
                });
            }
        }
    }

    // Initial fetch
    fetchTransactions();
});
