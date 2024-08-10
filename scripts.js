document.addEventListener('DOMContentLoaded', () => {
    const faucetsList = document.getElementById('faucets-list');
    const gamesList = document.getElementById('games-list');

    // Load faucets data
    if (faucetsList) {
        fetch('data/faucets.json')
            .then(response => response.json())
            .then(data => {
                data.faucets.forEach(item => {
                    const article = document.createElement('article');
                    article.className = 'item';

                    article.innerHTML = `
                        <div class="item-content">
                            <img src="${item.image}" alt="${item.title}">
                            <h3>${item.title}</h3>
                        </div>
                        <p>${item.description}</p>
                        <a href="${item.link}" class="button" target="_blank">Go to Faucet</a>
                    `;

                    faucetsList.appendChild(article);
                });
            })
            .catch(error => console.error('Error loading faucets data:', error));
    }

    // Load games data
    if (gamesList) {
        fetch('data/games.json')
            .then(response => response.json())
            .then(data => {
                data.games.forEach(item => {
                    const article = document.createElement('article');
                    article.className = 'item';

                    article.innerHTML = `
                        <div class="item-content">
                            <img src="${item.image}" alt="${item.title}">
                            <h3>${item.title}</h3>
                        </div>
                        <p>${item.description}</p>
                        <a href="${item.link}" class="button" target="_blank">Go to Game</a>
                    `;

                    gamesList.appendChild(article);
                });
            })
            .catch(error => console.error('Error loading games data:', error));
    }
});
