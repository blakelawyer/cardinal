from kivy.app import App
from kivy.lang import Builder
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.properties import ListProperty, BooleanProperty
from kivy.core.window import Window

class HoverButton(Button):
    shadow_color = ListProperty([0, 0, 0, 0.5])
    normal_color = ListProperty([1, 0.2, 0.2549, 1])  
    hover_color = ListProperty([0.8, 0.16, 0.2, 1])  
    is_hovering = BooleanProperty(False)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        Window.bind(mouse_pos=self.on_mouse_pos)
        self.background_normal = ''
        self.background_color = [0, 0, 0, 0]

    def on_mouse_pos(self, *args):
        if not self.get_root_window():
            return
        pos = args[1]
        inside = self.collide_point(*self.to_widget(*pos))
        if inside != self.is_hovering:
            self.is_hovering = inside

kv = '''
#:import Window kivy.core.window.Window
#:import dp kivy.metrics.dp

<HoverButton>:
    canvas.before:
        # Shadow
        Color:
            rgba: self.shadow_color
        RoundedRectangle:
            pos: self.pos[0] + dp(4), self.pos[1] - dp(4)
            size: self.size[0] + dp(2), self.size[1] + dp(2)
            radius: [dp(20)]
        # Button background
        Color:
            rgba: self.hover_color if self.is_hovering else self.normal_color
        RoundedRectangle:
            pos: self.pos
            size: self.size
            radius: [dp(20)]

<MainMenu>:
    orientation: 'vertical'
    padding: dp(20)
    spacing: dp(10)

    # Background color: hex 37302F -> (0.216, 0.188, 0.184, 1)
    canvas.before:
        Color:
            rgba: 0.216, 0.188, 0.184, 1
        Rectangle:
            pos: self.pos
            size: self.size

    # Title label
    Label:
        text: 'Cardinal'
        font_size: '40sp'
        color: 1, 1, 1, 1
        size_hint_y: None
        height: dp(80)

    # Container for centering the button group vertically
    BoxLayout:
        orientation: 'vertical'
        size_hint_y: 1

        # Top spacer
        Widget:
            size_hint_y: 1

        # Button container (fixed height)
        BoxLayout:
            orientation: 'vertical'
            size_hint_y: None
            height: (Window.height * 0.1) * 4 + dp(90)
            spacing: dp(30)
            
            # Each button is wrapped in an AnchorLayout for horizontal centering.
            AnchorLayout:
                size_hint_y: None
                height: Window.height * 0.1
                HoverButton:
                    text: 'Study'
                    font_size: '24sp'
                    size_hint_x: 0.4
                    size_hint_y: 1
                    color: 1, 1, 1, 1

            AnchorLayout:
                size_hint_y: None
                height: Window.height * 0.1
                HoverButton:
                    text: 'Create'
                    font_size: '24sp'
                    size_hint_x: 0.4
                    size_hint_y: 1
                    color: 1, 1, 1, 1

            AnchorLayout:
                size_hint_y: None
                height: Window.height * 0.1
                HoverButton:
                    text: 'Edit'
                    font_size: '24sp'
                    size_hint_x: 0.4
                    size_hint_y: 1
                    color: 1, 1, 1, 1

            AnchorLayout:
                size_hint_y: None
                height: Window.height * 0.1
                HoverButton:
                    text: 'Exit'
                    font_size: '24sp'
                    size_hint_x: 0.4
                    size_hint_y: 1
                    color: 1, 1, 1, 1

        # Bottom spacer
        Widget:
            size_hint_y: 1
'''

class MainMenu(BoxLayout):
    pass

class CardinalApp(App):
    def build(self):
        Builder.load_string(kv)
        return MainMenu()

if __name__ == '__main__':
    CardinalApp().run()

