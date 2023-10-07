from textual import on
from textual import work
from textual.app import App, ComposeResult
from textual.reactive import var
from textual.screen import Screen
from textual.widgets import Footer, Header, Label, ListItem, ListView, Static, Button, LoadingIndicator
from textual.containers import Container, Center
import json
import time
import asyncio

def log_message(message):
    with open('log.txt', 'a') as file:
        file.write(str(message) + '\n')

with open('cards.txt', 'r') as file:
    cards = json.load(file)

class Study(Screen):

    card_index = 0 

    BINDINGS = [
        ("escape", "study_key('escape')", "Back"),
        ("space", "study_key('space')", "Flip"),
    ]
    
    def compose(self) -> ComposeResult:

        yield Header()

        yield Center(
            Label("CARD FRONT", shrink=True, id="card-content"),
            Button("Previous", id="previous"),
            Button("Flip", id="flip"),
            Button("Next", id="next"),
        id="card-container")

        yield Footer()

    def on_mount(self) -> None:
        self.title = "Cardinal"
        self.sub_title = "Study"

    def action_study_key(self, key) -> None:
        if key == 'escape':
            self.app.pop_screen()
        elif key == 'space':
            log_message('flip card!')

class Create(Screen):

    BINDINGS = []

    def compose(self) -> ComposeResult:
        yield Header()
        yield ListView(
            ListItem(Label("Back"), id="menu"),
        )
        yield Footer()

    def on_mount(self) -> None:
        self.title = "Cardinal"
        self.sub_title = "Create"

class Edit(Screen):

    BINDINGS = []

    def compose(self) -> ComposeResult:
        yield Header()
        yield ListView(
            ListItem(Label("Back"), id="menu"),
        )
        yield Footer()

    def on_mount(self) -> None:
        self.title = "Cardinal"
        self.sub_title = "Edit"

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
        await asyncio.sleep(3)
        self.push_screen(Menu())


if __name__ == "__main__":
    app = Cardinal()
    app.run()

