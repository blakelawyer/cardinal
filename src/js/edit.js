const { invoke } = window.__TAURI__.tauri;

function createDeckButtons(decks, container) {
    container.innerHTML = ''; 
    decks.forEach(deck => {
        const button = document.createElement('button');
        button.textContent = deck;
        button.addEventListener('click', () => {
            console.log(`Deck ${deck} button clicked`);
            
            document.getElementById('card-container').innerHTML = '';
            container.innerHTML = '';

            invoke('edit_deck', {deck})
                .then(cards => {
                    createCardElements(cards, document.getElementById('card-container'));
                })
                .catch(error => {
                    console.error('Error fetching cards:', error);
                });
        });
        container.appendChild(button);
    });
}

function createCardElements(cards, container) {
    container.innerHTML = ''; 
    cards.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.className = 'card';
        cardElement.textContent = `Card Back: ${card.back}`; 
        container.appendChild(cardElement);
    });
}

window.addEventListener("DOMContentLoaded", () => {
    const deckContainer = document.getElementById('deck-container');
    const decks = JSON.parse(localStorage.getItem('decks'));
    if (decks) {
        createDeckButtons(decks, deckContainer);
    }

    const backButton = document.getElementById('back-button');
    backButton.addEventListener('click', () => {
        invoke('back', {}).then((result) => {
            window.location.href = `${result}.html`;
        }).catch((error) => console.error(error));
    });
});

