import eel
import asyncio
import subprocess
import atexit
from surrealdb import Surreal

@eel.expose
async def call_me():
    print('in call me')

    # loop = asyncio.get_running_loop()  # Or, if in 3.7, use get_running_loop()
    # loop.create_task(test())
    # print(loop)
    await test()

    return('call me has returned!')

async def test():
    print("TEST!")
    return('testing returning!')

# Debug function from JavaScript calls.
@eel.expose                        
def echo(message):
    print(f"Echo: {message}")

# Exits the program upon Exit button press.
@eel.expose                        
def exit():
    print("Exit button pressed!")
    quit()

@eel.expose
async def store_flashcard(front, back):
    print(f"Card front: {front}")
    print(f"Card back: {back}")

    # db = Surreal("http://localhost:9000")
    # await db.connect()
    # await db.signin({"user": "root", "pass": "root"})
    # await db.use("cardinal", "cardinal")

    print('here')

# Start the SurrealDB as background process with automatic cleanup on script exit.
def start_db():
    print("Starting SurrealDB..")

    # Start SurrealDB as a background process.
    process = subprocess.Popen(["surreal", "start", "--user", "root", "--pass", "root", "memory", "--bind", "0.0.0.0:9000"])

    # Bind the process to Python script termination to automatically close the DB.
    def cleanup():
        process.terminate()
    atexit.register(cleanup)

async def test_db():
    async with Surreal("ws://localhost:9000/rpc") as db:
        await db.signin({"user": "root", "pass": "root"})
        await db.use("test", "test")
        await db.query("""
        insert into person {
            user: 'me',
            pass: 'very_safe',
            tags: ['python', 'documentation']
        };
        """)
        print(await db.query("select * from person"))

    await asyncio.sleep(1)


async def main():

    # Startup the SurrealDB.
    start_db()

    # Testing the SurrealDB.
    # await test_db()

    # Initialize Eel and start the web server.
    eel.init('web', allowed_extensions=['.js', '.html'])
    eel.start('index.html', mode='default')             


if __name__ == "__main__":
    asyncio.run(main())
