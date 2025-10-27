from dotenv import load_dotenv
from time import sleep as Sleep
from pause import until as Until
import os
from os import system
from Utils import file_run, file_path_locator, file_name, setup_logger
import sys

load_dotenv(dotenv_path=".env")
ENV = os.getenv("ENV", "dev")
PORT = os.getenv("PORT", 8001)


def DoOver():
    filename = "DoOver"
    folder = file_path_locator()

    codepath = file_name(filename=filename, folder=folder, ftype="code")
    logpath = file_name(filename=filename, folder=folder, ftype="logs")

    Command = f"screen -mSL {filename} -Logfile {logpath} /home/ubuntu/cryptocode-{ENV}/venv/bin/python3 {codepath}"
    print(Command)
    status = system(Command)


def start_crypto_trading_system(logger):
    """Start all necessary components of the cryptocurrency trading system"""
    logger.info("Starting cryptocurrency trading system...")

    try:
        # Core components
        # file_run("LiveCandle", logger, logname="LiveCandle")
        # Run uvicorn directly with subprocess
        import subprocess
        import os
        import signal

        # Kill any existing backend_server screen
        from Utils import kill_me

        kill_me(f"backend_server-{ENV}")

        # Kill any existing processes on port 8001
        try:
            # Find processes using port 8001
            port_check = subprocess.run(
                f"lsof -i :{PORT} -t", shell=True, capture_output=True, text=True
            )
            if port_check.stdout.strip():
                # Kill processes if found
                pids = port_check.stdout.strip().split("\n")
                logger.info(f"Found processes using port {PORT}: {pids}")
                for pid in pids:
                    if pid.strip():
                        subprocess.run(f"kill -9 {pid.strip()}", shell=True)
                        logger.info(f"Killed process {pid.strip()} using port {PORT}")
                # Wait a moment for the port to be released
                import time

                time.sleep(2)
            else:
                logger.info(f"No processes found using port {PORT}")
        except Exception as e:
            logger.warning(f"Error killing processes on port {PORT}: {e}")

        # Set up the environment with PYTHONPATH
        env = os.environ.copy()
        env["PYTHONPATH"] = "/home/ubuntu"

        # Change to the correct directory
        os.chdir("/home/ubuntu")

        # Create the screen command - use the full path to uvicorn
        cmd = f"screen -dmSL backend_server-{ENV} -Logfile /home/ubuntu/cryptocode-{ENV}/screenlogs/backend_server.log /home/ubuntu/cryptocode-{ENV}/venv/bin/uvicorn cryptocode-{ENV}.code.backend:app --host 0.0.0.0 --port {PORT} --workers 1"

        logger.info(f"Starting backend_server with command: {cmd}")
        subprocess.call(cmd, shell=True, env=env)

        # start websocket server to get the canle data and ticks data

        # file_run("bn_candle", logger, logname="candle_eth", params=["ETH/USD"])
        # file_run("bn_live", logger, logname="live_ohlc_eth", params=["ETH/USDT"])

        # file_run("bn_candle", logger, logname="candle_btc", params=["BTC/USD"])
        # file_run("bn_live", logger, logname="live_ohlc_btc", params=["BTC/USDT"])

        # Position and balance management
        # file_run("live_position_updater", logger, logname="live_position_updater")
        # file_run("balanceUpdater", logger, logname="balanceUpdater")

        # External integrations
        # file_run("googleSheet", logger, logname="googleSheet")
        # file_run(
        #     "user_notification_watcher", logger, logname="user_notification_watcher"
        # )
        # file_run("coindcx_order", logger, logname="coindcx_order")

        # file_run("new_order", logger, logname="new_order")
        # file_run("telegram_bot", logger, logname="telegram_bot")
        # file_run("emailSender", logger, logname="EmailSender")

        # Trading strategies
        # logger.info("Starting strategy")
        # file_run("FRC_SPT_STRA", logger, logname="ETH_Multiplier")
        # file_run("EMA_NEW", logger, logname="Bit_Bounce", params=["Bit_Bounce"])

        # file_run("Bit_new", logger, logname="Bit_new")
        # file_run("vipin_str_live", logger, logname="vipin_str_live")

        logger.info("All cryptocurrency trading components started successfully")
    except Exception as e:
        logger.error(f"Error starting trading system components: {e}")
        logger.exception("Detailed exception information:")


def setup_crontab_entry():

    python_path = f"/home/ubuntu/cryptocode-{ENV}/venv/bin/python3"
    script_path = f"/home/ubuntu/cryptocode-{ENV}/code/CodeRunner.py"
    log_path = f"/home/ubuntu/cryptocode-{ENV}/logs/coderunner_startup.log"

    crontab_entry = f"@reboot cd /home/ubuntu/cryptocode-{ENV}/code && {python_path} {script_path} >> {log_path} 2>&1\n"

    temp_crontab = "/tmp/crypto_crontab"

    system("crontab -l > /tmp/crypto_crontab 2>/dev/null || touch /tmp/crypto_crontab")

    with open(temp_crontab, "r") as f:
        if crontab_entry in f.read():
            print("Crontab entry already exists.")
            return

    with open(temp_crontab, "a") as f:
        f.write(crontab_entry)

    system(f"crontab {temp_crontab}")
    system(f"rm {temp_crontab}")

    print("Added crontab entry for automatic startup on reboot")
    print("To verify, run: crontab -l")
    print(f"Entry: {crontab_entry.strip()}")


if __name__ == "__main__":
    try:
        # setup_crontab_entry()

        # Setup logging
        current_file = str(os.path.basename(__file__)).replace(".py", "")
        LOG_FILE = f"/home/ubuntu/cryptocode-{ENV}/logs/{current_file}.log"
        logger = setup_logger(
            name=current_file, log_to_file=True, log_file=LOG_FILE, capture_print=True
        )

        logger.info("CodeRunner started - System initialization")
        logger.info(f"Running with Python: {sys.executable}")

        start_crypto_trading_system(logger)

    except Exception as e:
        if "logger" in locals():
            logger.error(f"Critical error in main execution: {e}")
            logger.exception("Detailed exception information:")
        else:
            print(f"Critical error before logger setup: {e}", file=sys.stderr)
