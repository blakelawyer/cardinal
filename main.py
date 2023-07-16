import eel
import asyncio
import subprocess
import atexit
from surrealdb import Surreal

# Debug function from JavaScript calls.
@eel.expose                        
def echo(message):
    print(f"JavaScript: {message}")

# Exits the program upon Exit button press.
@eel.expose                        
def exit():
    print("Exit button pressed!")
    quit()

@eel.expose
def save_flashcard(front, back):
    print("Python: Saving flashcard..")
    print(f"Card front: {front}")
    print(f"Card back: {back}")

    # Our little trick for executing async code from a normal eel function.
    loop = asyncio.get_event_loop()
    loop.run_until_complete(store_flashcard(front, back))

async def store_flashcard(front, back):
    print("Python: Storing flashcard in database..")
    db = Surreal("http://localhost:9000")
    await db.connect()
    await db.signin({"user": "root", "pass": "root"})
    await db.use("cardinal", "cardinal")

    await db.create(
        "cards",
        {
            "front": front,
            "back": back,
        },
    )
    result = await db.select("cards")
    print(result)

# Start the SurrealDB as background process with automatic cleanup on script exit.
def start_db():
    print("Starting SurrealDB..")

    # Start SurrealDB as a background process.
    process = subprocess.Popen(["surreal", "start", "--user", "root", "--pass", "root", "memory", "--bind", "0.0.0.0:9000"])

    # Bind the process to Python script termination to automatically close the DB.
    def cleanup():
        process.terminate()
    atexit.register(cleanup)


def main():

    # Startup the SurrealDB.
    start_db()

    # Initialize Eel and start the web server.
    eel.init('web', allowed_extensions=['.js', '.html'])
    eel.start('index.html', mode='default')             


if __name__ == "__main__":
    main()
