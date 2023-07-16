window.onload = function () {
  eel.echo("create.html loaded");
};

async function storeFlashcard(front, back) {
  eel.echo("Storing flashcard..");
  await eel.save_flashcard(front, back)();
}
