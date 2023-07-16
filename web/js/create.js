window.onload = function () {
  eel.echo("create.html loaded");
};

async function storeFlashcard(front, back) {
  eel.echo("Storing flashcard..");
  await eel.store_flashcard(front, back);
  // const result = await eel.test()();
  // const res = await eel.call_me()();
}
