from textual import on
from textual.app import App, ComposeResult
from textual.reactive import var
from textual.screen import Screen
from textual.widgets import Footer, Header, Label, ListItem, ListView, Static
import json

with open('cards.txt', 'r') as file:
    cards = json.load(file)

class Study(Screen):

    card_index = 0
    
    def compose(self) -> ComposeResult:

        yield Header()

        yield Label("ASDFASDFASDF", classes="border") 

        yield ListView(
            ListItem(Label("Back"), id="menu"),
        )
        yield Footer()

    def on_mount(self) -> None:
        self.title = "Cardinal"
        self.sub_title = "Study"

class Create(Screen):

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

    def compose(self) -> ComposeResult:
        yield Header()
        yield ListView(
            ListItem(Label("Back"), id="menu"),
        )
        yield Footer()

    def on_mount(self) -> None:
        self.title = "Cardinal"
        self.sub_title = "Edit"


class Cardinal(App):

    CSS_PATH = "styles.tcss"


    def compose(self) -> ComposeResult:

        yield Header()
        
        # Cardinal Main Menu
        yield ListView(
            ListItem(Label("Study"), id="study"),
            ListItem(Label("Create Cards"), id="create"),
            ListItem(Label("Edit Cards"), id="edit"),
        )

        yield Footer()

    def on_mount(self) -> None:
        self.title = "Cardinal"
        self.sub_title = "Memory's Refrain"

    @on(ListView.Selected)
    def show_chosen(self, event: ListView.Selected) -> None:
        if event.item.id == "study":
            self.push_screen(Study())
        elif event.item.id == "create":
            self.push_screen(Create())
        elif event.item.id == "edit":
            self.push_screen(Edit())
        elif event.item.id == "menu":
            self.pop_screen()


if __name__ == "__main__":
    app = Cardinal()
    app.run()

