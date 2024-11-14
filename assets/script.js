const articlesPerPage = 20;
let currentPage = 1;
let articles = [];
let currentTag = '';

document.addEventListener("DOMContentLoaded", function () {
    loadArticles(); // Ensure articles load after the DOM is ready
});

function loadArticles() {
    // Sample articles with different tags
    articles = [
        { image: "articles/binance.jpg", title: "Binance Co-Founder Responds to Allegations of Listing Fees", link: "articles/binance241114.html", tags: ["Cryptocurrency", "Listing"] },
        { image: "articles/bitcoin.jpg", title: "Bitcoin's Surge: Post-Election Rally and the Road Ahead", link: "articles/bitcoin241113.html", tags: ["Exchanges", "Cryptocurrency"] },
        // Add more articles as needed
    ];
    displayArticles(); // Call the function to display articles
}

function displayArticles() {
    const articlesList = document.getElementById("articles-list");
    articlesList.innerHTML = ""; // Clear existing content

    // Filter articles based on current tag
    const filteredArticles = currentTag ? articles.filter(article => article.tags.includes(currentTag)) : articles;
    const start = (currentPage - 1) * articlesPerPage;
    const end = start + articlesPerPage;
    const pageArticles = filteredArticles.slice(start, end);

    // Check if there are articles to display
    if (pageArticles.length === 0) {
        articlesList.innerHTML = "<p>No articles available.</p>";
        return;
    }

    // Display each article as a card
    pageArticles.forEach(article => {
        const articleCard = document.createElement("div");
        articleCard.className = "article-card";
        articleCard.onclick = () => window.location.href = article.link; // Make the whole card clickable

        const tagsHtml = article.tags.map(tag => `<span class="tag tag-${tag.toLowerCase()}">${tag}</span>`).join("");
        
        articleCard.innerHTML = `
            <img src="${article.image}" alt="Article Image">
            <div>
                <h2>${article.title}</h2>
                <div class="tags">${tagsHtml}</div>
            </div>
        `;
        articlesList.appendChild(articleCard);
    });
    updatePageIndicator();
}

function updatePageIndicator() {
    document.getElementById("page-indicator").textContent = `Page ${currentPage}`;
}

function nextPage() {
    const filteredArticles = currentTag ? articles.filter(article => article.tags.includes(currentTag)) : articles;
    if ((currentPage * articlesPerPage) < filteredArticles.length) {
        currentPage++;
        displayArticles();
    }
}

function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        displayArticles();
    }
}

function filterByTag(tag) {
    currentTag = tag;
    currentPage = 1; // Reset to first page when filtering
    displayArticles();
}
