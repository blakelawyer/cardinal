const { invoke } = window.__TAURI__.tauri;

function createDeckButtons(decks, container) {
    container.innerHTML = ''; 
    decks.forEach(deck => {
        const button = document.createElement('button');
        button.textContent = deck;
        button.addEventListener('click', () => {
            invoke('log', { message: `Deck ${deck} button clicked`});
            
            document.getElementById('card-container').innerHTML = '';
            container.innerHTML = '';

            invoke('edit_deck', {deck})
                .then(cards => {
                    createCardElements(cards, document.getElementById('card-container'));
                })
                .catch(error => {
                    invoke('log', {message: `Error fetching cards for deck ${deck}: ${error}` });
                });
        });
        container.appendChild(button);
    });
}

function createCardElements(cards, container) {
    container.innerHTML = ''; 
    cards.forEach(card => {
        const cardButton = document.createElement('button'); 
        cardButton.className = 'card';
        const displayText = card.front.length > 50 ? `${card.front.substring(0, 50)}...` : card.front;
        cardButton.innerHTML = `Front: ${displayText} <br> Back: ${card.back}`;

        cardButton.dataset.id = card.id;
        cardButton.dataset.front = card.front;
        cardButton.dataset.back = card.back;
        cardButton.dataset.deck = card.deck;

        cardButton.addEventListener('click', () => {
            invoke('log', { message: `Selected card: Deck: ${cardButton.dataset.deck}, Card ID: ${cardButton.dataset.id}`});


            const idAsInteger = parseInt(cardButton.dataset.id, 10);
            invoke('edit_card', {
                id: idAsInteger, 
                front: cardButton.dataset.front,
                back: cardButton.dataset.back,
                deck: cardButton.dataset.deck
            })
            .then(() => {
                invoke('log', {message: `Editing card..`});
                container.innerHTML = '';

                 // Display editable fields for front and back
                container.innerHTML += `
                    <textarea id="edit-front">${cardButton.dataset.front}</textarea>
                    <textarea id="edit-back">${cardButton.dataset.back}</textarea>
                    <button type="button" id="save-button">Save Changes</button>
                `;

                // Event listener for save button
                document.getElementById('save-button').addEventListener('click', () => {
                    const updatedFront = document.getElementById('edit-front').value;
                    const updatedBack = document.getElementById('edit-back').value;
                    // Implement save logic here
                });

            })
            .catch(error => {
                invoke('log', {message: `Error editing card: ${error}`});
            });
        });

        container.appendChild(cardButton);
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
        }).catch((error) => invoke('log', {message: `Back button error: ${error}`}));
    });
});

