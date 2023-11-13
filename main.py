from textual import on
from textual import work
from textual.app import App, ComposeResult
from textual.screen import Screen
from textual.widgets import Footer, Header, Label, ListItem, ListView, LoadingIndicator, Input, OptionList
from textual.widgets.option_list import Option, Separator
from textual.containers import Center
import json
import asyncio

def log_message(message):
    with open('log.txt', 'a') as file:
        file.write(str(message) + '\n')

with open('cards.txt', 'r') as file:
    cards = json.load(file)

class Study(Screen):

    card_index = 0

    BINDINGS = [
        ("escape", "study_key('escape')", "Main Menu"),
        ("space", "study_key('space')", "Flip"),
        ("enter", "study_key('enter')", "Next"),
    ]
    
    def compose(self) -> ComposeResult:

        yield Header()

        yield Center(
            Label(cards[self.card_index]['front'], shrink=True, id="card-front"),
            Label(cards[self.card_index]['back'], shrink=True, id="card-back"),
        id="card-container")

        yield Footer()

    def on_mount(self) -> None:
        self.title = "Cardinal"
        self.sub_title = "Study"
        self.query_one("#card-back").visible = False
        self.card_revealed = False

    def action_study_key(self, key) -> None:
        if key == 'escape':
            log_message('Back to Main Menu From Study')
            self.app.pop_screen()
        elif key == 'space':
            log_message('Flip card!')
            self.query_one("#card-back").visible = True
            self.card_revealed = True
        elif key == 'enter' and self.card_revealed:
            if self.card_index < len(cards) - 1:
                log_message('Next card!')
                self.card_index += 1
                self.query_one("#card-front", Label).update(cards[self.card_index]['front'])
                self.query_one("#card-back", Label).update(cards[self.card_index]['back'])
                self.query_one("#card-back").visible = False
                self.card_revealed = False
            else:
                log_message('Done studying, returning to main menu!')
                self.app.pop_screen()


class Create(Screen):

    BINDINGS = [
        ("escape", "create_key('escape')", "Back"),
    ]

    def compose(self) -> ComposeResult:
        yield Header()

        yield Input(placeholder="Front", id='card-front')
        yield Input(placeholder="Back", id='card-back')

        yield Footer()

    def on_mount(self) -> None:
        log_message(cards)
        self.title = "Cardinal"
        self.sub_title = "Create"
        self.front = None
        self.back = None

    def action_create_key(self, key) -> None:
        if key == 'escape':
            log_message('Back to Main Menu From Create')
            self.app.pop_screen()

    def on_input_submitted(self, event):
        if len(event.value) > 0:
            if event.input.id == "card-front":
                log_message(f"Front of card submitted: {event.value}")
                self.front = event.value
            else:
                log_message(f"Back of card submitted: {event.value}")
                self.back = event.value

            if self.front is not None and self.back is not None:
                new_card = {"front": self.front, "back": self.back}
                log_message(f"Creating card: {new_card}")
                cards.append(new_card)
                with open('cards.txt', 'w') as file:
                    json.dump(cards, file, indent=4)
                self.front = None
                self.back = None
                self.query_one("#card-front", Input).value = ""
                self.query_one("#card-back", Input).value = ""


class Edit(Screen):

    BINDINGS = [
        ("escape", "edit_key('escape')", "Back"),
        ("j", "vim_key('j')", "Down"),
        ("k", "vim_key('k')", "Up"),
        ("enter", "select", "Select")
    ]

    def compose(self) -> ComposeResult:
        yield Header()
        option_items = []
        for index, card in enumerate(cards):
            option_items.append(Option(card["front"], id=str(index)))
            option_items.append(Separator())
        yield OptionList(*option_items, id="card-options")
        yield Footer()

    def on_mount(self) -> None:
        self.title = "Cardinal"
        self.sub_title = "Edit"
        self.set_focus(self.query_one("#card-options"))

    def on_option_list_option_selected(self, event: OptionList.OptionHighlighted):
        log_message(event.option.id)

    def action_edit_key(self, key) -> None:
        if key == 'escape':
            log_message('Back to Main Menu From Edit')
            self.app.pop_screen()

    def action_vim_key(self, key) -> None:
        if key == 'j':
            self.query_one("#card-options", OptionList).action_cursor_down()
        elif key == 'k':
            self.query_one("#card-options", OptionList).action_cursor_up()



class Menu(Screen):

    BINDINGS = [
        ("j", "vim_key('j')", "Down"),
        ("k", "vim_key('k')", "Up"),
    ]

    def compose(self) -> ComposeResult:

        yield Header()
        
        yield ListView(
            ListItem(Label("Study"), id="study"),
            ListItem(Label("Create Cards"), id="create"),
            ListItem(Label("Edit Cards"), id="edit"),
        id="main-menu")

        yield Footer()

    def on_mount(self) -> None:
        self.title = "Cardinal"
        self.sub_title = "Memory's Refrain"
        self.set_focus(self.query_one("#main-menu"))

    @on(ListView.Selected)
    def show_chosen(self, event: ListView.Selected) -> None:
        if event.item.id == "study":
            self.app.push_screen(Study())
        elif event.item.id == "create":
            self.app.push_screen(Create())
        elif event.item.id == "edit":
            self.app.push_screen(Edit())
        elif event.item.id == "menu":
            self.app.pop_screen()

    def action_vim_key(self, key) -> None:
        if key == 'j':
            self.query_one("#main-menu", ListView).action_cursor_down()
        elif key == 'k':
            self.query_one("#main-menu", ListView).action_cursor_up()

class Cardinal(App):
    CSS_PATH = "styles.tcss"
    AUTO_FOCUS = ""

    def compose(self) -> ComposeResult:
        yield Header()
        yield LoadingIndicator()
        yield Footer()

    def on_mount(self) -> None:
        self.title = "Cardinal"
        self.sub_title = "Memory's Refrain"

        # Until there's real work to do, simulate a small amount of loading so LoadingIndicator shows for a bit..
        self.simulate_loading()

    @work
    async def simulate_loading(self):
        await asyncio.sleep(1)
        self.push_screen(Menu())


if __name__ == "__main__":
    app = Cardinal()
    app.run()

