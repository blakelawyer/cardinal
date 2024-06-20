const { invoke } = window.__TAURI__.tauri;

window.addEventListener("DOMContentLoaded", () => {
    const deckSelect = document.getElementById('deck-select');
    const decks = JSON.parse(localStorage.getItem('decks'));
    if (decks) {
        decks.forEach(deck => {
            const option = document.createElement('option');
            option.value = deck;
            option.textContent = deck;
            deckSelect.appendChild(option);
        });
    }

    const createButton = document.getElementById('create-flashcard-button');
    createButton.addEventListener('click', () => {
        const frontText = document.getElementById('front-text').value;
        const backText = document.getElementById('back-text').value;
        const deckName = deckSelect.value;


        if (deckName !== "") {
            invoke('create_card', {
                front: frontText,
                back: backText,
                deck: deckName
            })
            .then(() => {
                invoke('log', {message: `Card created.`})
            })
            .catch(error => {
                invoke('log', {message: `Error creating card: ${error}`})
            });
        } else {
            invoke('log', {message: `Can't create card until deck is selected.`})
        }

    });

    const backButton = document.getElementById('back-button');
    backButton.addEventListener('click', () => {
        invoke('back', {}).then((result) => {
            window.location.href = `${result}.html`;
        }).catch((error) => invoke('log', {message: `Back button error: ${error}`}));
    });
});
