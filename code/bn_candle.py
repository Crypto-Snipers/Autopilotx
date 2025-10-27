from datetime import datetime, timedelta
import traceback
import pandas as pd
import requests
import warnings
import pymongo
import time
import ccxt
import pause
import logging
from os import path, sep, pardir, system
from logging.handlers import RotatingFileHandler
from subprocess import run as Run, PIPE as Pipe
from re import findall as FindAll
from sys import argv
import sys
from dotenv import load_dotenv
import os


def cand_data(limit1=14):
    try:
        timeframe = "1m"
        if limit1 <= 500:
            data = binance.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit1)

            df = pd.DataFrame(data)
            df.columns = ["timestamp", "open", "high", "low", "close", "volume"]
            df.drop(df.index[len(df) - 1], inplace=True)

            df["date"] = pd.to_datetime(df["timestamp"], unit="ms")
            df = df[["date", "open", "high", "low", "close", "volume"]]

            return df
        else:
            df1 = pd.DataFrame()
            x = limit1 // 500 + 1
            if limit1 % 500 == 0:
                x = x - 1
            limit = 500
            for i in range(1, x + 1):

                if i % 30 == 0:
                    time.sleep(1 / 5)
                if i == 1:

                    data = binance.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)
                    data.pop()
                else:

                    data = binance.fetch_ohlcv(
                        symbol, timeframe=timeframe, since=start_date, limit=limit
                    )

                df = pd.DataFrame(data)
                start_date = int(df.loc[df.index[0], 0]) - 60000 * limit
                df1 = pd.concat([df, df1], ignore_index=True)

            df1.columns = ["timestamp", "open", "high", "low", "close", "volume"]
            df1["date"] = pd.to_datetime(df1["timestamp"], unit="ms")
            df1 = df1[["date", "open", "high", "low", "close", "volume"]]

            return df1

    except Exception as e:
        print("Error: ", e, datetime.utcnow())
        time.sleep(60)
        return cand_data(limit1)


def cand_data2(limit1=14):

    while True:
        try:

            x = requests.get(data_url)

            data = x.json()

            df = pd.DataFrame(data[:-1])

            df = df[range(0, 6)].apply(pd.to_numeric, errors="ignore")

            df.rename(
                {0: "date", 1: "open", 2: "high", 3: "low", 4: "close", 5: "volume"},
                axis=1,
                inplace=True,
            )

            df["date"] = pd.to_datetime(df["date"], unit="ms")

            return df

        except Exception as e:

            print("*********************************************")
            print(traceback.format_exc())
            print("*********************************************")
            time.sleep(1)

            continue


def FileFolder():

    wd = path.abspath(path.dirname(__file__))
    fname = path.basename(__file__)[:-3]
    fol = wd + sep + pardir  # pardir Goes Back 1 Folder

    return fname, fol


def LogSetup(fol):

    log_dir = path.join(path.normpath(fol), "logs/calde_data")
    formatter = logging.Formatter(
        "%(asctime)s - %(levelname)s - [%(filename)s:%(funcName)s:%(lineno)d] - %(message)s"
    )
    log_handler = RotatingFileHandler(log_dir)
    log_handler.setFormatter(formatter)

    logger = logging.getLogger(log_dir)
    logger.addHandler(log_handler)
    logger.setLevel(logging.INFO)

    return logger


def FileName(filename, folder, ftype):

    if ftype == "logs":

        dirname = path.join(path.normpath(folder), "logs")

        fname = path.join(dirname, f"{filename}.log")

        return fname

    elif ftype == "code":

        dirname = path.join(path.normpath(folder), "code")

        fname = path.join(dirname, f"{filename}.py")

        return fname

    return None


def CodeRunner(ID: str, CodePath: str, LogPath: str, Params: tuple) -> None:
    """Runs the Code With the Given Parameters"""

    Command = f"screen -dmSL {ID} -Logfile {LogPath} /usr/bin/python3 {CodePath}"

    for Param in Params:
        Command += f" {Param}"

    print(Command)

    status = system(Command)

    print(ID)
    return None


def Killer():

    screens = RunScreens()

    for spid, name in screens:

        logger.info(f"Killer:  screen -XS {spid}.{name} kill")
        system(f"screen -XS {spid}.{name} kill")


def RunScreens():

    screen = Run(["screen", "-ls"], stdout=Pipe, text=True).stdout
    screens = FindAll(rf"([0-9]+)\.({"coin"}_\w+)", screen)  # ([0-9]+)\.(\w+)

    return screens


def FileRun(filename):

    _, folder = FileFolder()
    codepath = FileName(filename=filename, folder=folder, ftype="code")
    logpath = FileName(filename=filename, folder=folder, ftype="logs")

    system(
        f"screen -XS {filename} kill"
    )  #### this will kill the program you select below #####

    CodeRunner(
        ID=filename, CodePath=codepath, LogPath=logpath, Params=[]
    )  #### this will run the program you select below


def Killer(filename):

    system(
        f"screen -XS {filename} kill"
    )  #### this will kill the program you select below #####


if __name__ == "__main__":

    pd.set_option("mode.chained_assignment", None)
    warnings.simplefilter(action="ignore", category=FutureWarning)
    warnings.filterwarnings("ignore", category=DeprecationWarning)

    if len(argv) > 1:
        symbol = argv[1]
    else:
        print("Usage: python get_canldle.py <symbol>")
        sys.exit(1)

    delete = False

    filename, folder = FileFolder()
    # config = EnvVars(filename, folder)

    logger = LogSetup(folder)

    # symbol = 'BTC/USD'

    load_dotenv()

    MONGO_LINK = os.getenv("MONGO_URL")
    MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")

    myclient = pymongo.MongoClient(MONGO_LINK)

    def_type = "delivery"
    data_url = f"https://fapi.binance.com/fapi/v1/klines?symbol={symbol.replace('/','')}&interval=1m"

    mydb = myclient[f"{MONGO_DB_NAME}"]
    mycol = mydb["candleData"]

    coll = f"{symbol.replace('/','')}T"

    binance = ccxt.binance(
        {
            "enableRateLimit": True,
            "options": {
                "defaultType": def_type,
            },
        }
    )

    if delete:
        mycol.delete_many({"symbol": coll})
        tf = 60

        num = (440 * tf) + 100
        df1 = cand_data(num)
        df1["symbol"] = coll
        mycol.insert_many(df1.to_dict("records"))
        print(df1)

    else:

        num = 100 * 220

        df = cand_data(num)
        df["symbol"] = coll
        last_date = mycol.find_one(
            {"symbol": coll}, sort=[("_id", pymongo.DESCENDING)]
        )["date"]
        df = df[df["date"] > last_date]

        if len(df) != 0:

            print(df)
            mycol.insert_many(df.to_dict("records"))

    while True:

        sz = datetime.now().replace(second=4, microsecond=0)

        df = cand_data()
        df["symbol"] = coll

        last_date = mycol.find_one(sort=[("_id", pymongo.DESCENDING)])["date"]

        df = df[df["date"] > last_date]

        last_minute = (datetime.utcnow() - timedelta(minutes=1)).minute

        if last_date.minute == last_minute:

            sleeper_agent = (sz + timedelta(minutes=1)).strftime("%d-%m-%Y %H:%M:%S")
            sleeper_agent = datetime.strptime(sleeper_agent, "%d-%m-%Y %H:%M:%S")

            # print( datetime.utcnow(),datetime.now() - sz, sleeper_agent ,sz )

            print("YOLO, Data Already There", datetime.utcnow())

            pause.until(sleeper_agent)

        if len(df) != 0:
            df["symbol"] = coll
            mycol.insert_many(df.to_dict("records"))

            # sx = datetime.now()

            sleeper_agent = (sz + timedelta(minutes=1, seconds=1)).strftime(
                "%d-%m-%Y %H:%M:%S"
            )
            sleeper_agent = datetime.strptime(sleeper_agent, "%d-%m-%Y %H:%M:%S")

            print(datetime.utcnow(), datetime.now() - sz, sleeper_agent)

            print(df)

            pause.until(sleeper_agent)

        else:

            sx = datetime.utcnow()

            print(sx, "YO")

            continue

        del df
