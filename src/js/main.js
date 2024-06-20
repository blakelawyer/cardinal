const { invoke } = window.__TAURI__.tauri;

function setupButtonListeners() {
    const studyButton = document.getElementById('study-button');
    const editButton = document.getElementById('edit-button');
    const createButton = document.getElementById('create-button');
    const backButton = document.getElementById('back-button');

    if (studyButton) {
        studyButton.addEventListener('click', () => {
            invoke('study', {}).then(() => {
                window.location.href = 'html/study.html';
            }).catch(error => {
                invoke('log', {message: `Error with study button: ${error}`});
            });
        });
    }

    // Do we want to be using local storage for this?
    if (editButton) {
        editButton.addEventListener('click', () => {
            invoke('edit', {}).then((decks) => {
                localStorage.setItem('decks', JSON.stringify(decks));
                window.location.href = 'html/edit.html';
            }).catch(error => {
                invoke('log', {message: `Error with edit button: ${error}`});
            });
        });
    }

    if (createButton) {
        createButton.addEventListener('click', () => {
            invoke('create', {}).then((decks) => {
                localStorage.setItem('decks', JSON.stringify(decks));
                window.location.href = 'html/create.html';
            }).catch(error => {
                invoke('log', {message: `Error with create button: ${error}`});
            });
        });
    }

    if (backButton) {
        backButton.addEventListener('click', () => {
            invoke('back', {}).then(() => {
                window.location.href = '../index.html';
            }).catch(error => {
                invoke('log', {message: `Error with back button: ${error}`});
            });
        });
    }
}

window.addEventListener("DOMContentLoaded", setupButtonListeners);
