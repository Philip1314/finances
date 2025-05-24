// ... (existing helper functions: parseCSV, formatCurrency) ...

// --- Dashboard Specific Logic (unchanged) ---
async function updateDashboard() {
    // ... (previous dashboard logic) ...
}

// --- Transactions Page Specific Logic ---
async function renderTransactions(selectedMonth) {
    // ... (previous renderTransactions logic) ...
}

// New function to update the current date display
function updateCurrentDateDisplay() {
    const dateDisplayElement = document.getElementById('currentDateDisplay');
    if (dateDisplayElement) {
        const today = new Date();
        // Format as "Month Day" (e.g., "May 24")
        const options = { month: 'short', day: 'numeric' };
        dateDisplayElement.textContent = today.toLocaleDateString('en-US', options);
    }
}


// --- Page Initialization Logic ---
document.addEventListener('DOMContentLoaded', () => { // Ensure this wraps all initialization
    const dashboardPage = document.getElementById('dashboard-page');
    const transactionsPage = document.getElementById('transactions-page');

    if (dashboardPage) {
        updateDashboard();
    } else if (transactionsPage) {
        // Update the current date display in the header
        updateCurrentDateDisplay();

        const monthButtons = document.querySelectorAll('.month-button');
        const currentMonth = new Date().getMonth() + 1; // getMonth() is 0-indexed

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
            renderTransactions(parseInt(closestMonthButton.dataset.month));
        } else if (initialMonthSet) {
             renderTransactions(currentMonth);
        } else {
            renderTransactions(1);
        }


        monthButtons.forEach(button => {
            button.addEventListener('click', function() {
                monthButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                const selectedMonth = parseInt(this.dataset.month);
                renderTransactions(selectedMonth);
            });
        });
    }
});
