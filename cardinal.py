import pynvim

@pynvim.plugin
class HelloWorld(object):
    def __init__(self) -> None:
        self.nvim = nvim

    @pynvim.command('HelloWorld', nargs='*', sync=True)
    def hello_world(self, args):
        self.nvim.command('echo "Hello, World!"')
