// Function to show the specified tab and hide others
function showTab(tabId) {
    const tabs = document.querySelectorAll('.tab-content');

    // Use a loop to hide all tabs
    tabs.forEach(tab => {
        tab.classList.remove('active');
    });

    // Show the selected tab
    const activeTab = document.getElementById(tabId);
    if (activeTab) {
        activeTab.classList.add('active');
    }
}

// Initialize the default tab when the page loads
document.addEventListener('DOMContentLoaded', () => {
    showTab('top-faucets');
});
