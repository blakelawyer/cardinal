import eel

@eel.expose                        
def echo(message):
    print(f"Echo: {message}")

@eel.expose                        
def exit():
    quit()

def main():
    # Initialize Eel and start the web server.
    eel.init('web', allowed_extensions=['.js', '.html'])
    eel.start('index.html')             


if __name__ == "__main__":
    main()
