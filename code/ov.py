from Utils import file_run, setup_logger, kill_me
import os


if __name__ == "__main__":

    current_file = str(os.path.basename(__file__)).replace(".py", "")
    LOG_FILE = f"/home/ubuntu/cryptocode/logs/{current_file}.log"
    logger = setup_logger(name=current_file, log_to_file=True, log_file=LOG_FILE)

    # file_run(
    #     filename="anyname",  # unused
    #     logger=logger,
    #     logname="backend_server",
    #     params=["/home/ubuntu/cryptocode/venv/bin/uvicorn", "cryptocode.code.backend:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "3"]
    # )

    # file_run("LiveCandle", logger, logname="LiveCandle")
    # file_run("emailSender", logger, logname="EmailSender")
    # file_run("backend", logger, logname="backend_server")
    # file_run("live_position_updater", logger, logname="live_position_updater")
    # file_run("balanceUpdater", logger, logname="balanceUpdater")
    # file_run("googleSheet", logger, logname="googleSheet")
    # file_run("telegram_bot", logger, logname="telegram_bot")
    # file_run("new_order", logger, logname="new_order")
    # file_run("user_notification_watcher", logger, logname="user_notification_watcher")

    # file_run("coindcx_order", logger, logname="coindcx_order")
    # file_run("FRA_NEW_",logger,logname="ETH_Multiplier", params=["ETH_Multiplier"])
    # file_run("EMA_NEW",logger,logname="Bit_Bounce", params=["Bit_Bounce"])
    # file_run("FRA_NEW_",logger,logname="ETH_Multiplier", params=["ETH_Multiplier"])

    ####################################################################################################

    # kill_me("Bit_Bounce")
    # kill_me("emailSender")
    # kill_me("ETH_Multiplier")
    # kill_me("live_position_updater")
    # kill_me("balanceUpdater")
    # # kill_me("backend_server")
    # kill_me("googleSheet")
    # kill_me("user_notification_watcher")
    # kill_me("telegram_bot")
    # kill_me("new_order")
    # kill_me("coindcx_order")

    pass
