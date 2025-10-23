from datetime import datetime, timezone
import threading
import websocket
import warnings
import pymongo
import sys
import traceback
import json
import time

from sys import argv
from dotenv import load_dotenv
import os


def DB_Updater(msg):

    try:

        kline = {
            "symbol": coll,
            "Insert_Time": datetime.now(timezone.utc),
            "date": datetime.fromtimestamp(msg["k"]["t"] / 1000),
            "open": msg["k"]["o"],
            "high": msg["k"]["h"],
            "low": msg["k"]["l"],
            "close": msg["k"]["c"],
            "volume": msg["k"]["v"],
        }

        if msg["k"]["x"]:

            candles.insert_one(kline, bypass_document_validation=True)

        # Remove the _id field if it exists in the kline document to prevent the immutable field error
        if "_id" in kline:
            del kline["_id"]
        klines.update_one({"symbol": coll}, {"$set": kline}, upsert=True)

    except Exception:
        print("*********************************************")
        print(traceback.format_exc())
        print("*********************************************")


def On_Msg(ws, msg):

    threading.Thread(target=DB_Updater, args=(json.loads(msg),)).start()


def On_Error(ws, error):

    print("*********************************************")
    print(error)
    ws.close()
    print("*********************************************")


def On_Close(ws, *args, **kwargs):
    print(args, kwargs)
    print("######### Socket Closed #########")


def On_Open(ws):

    print("######### Socket Open #########")


def Looper():

    while True:
        s = threading.Thread(target=ws.run_forever)
        s.start()
        s.join()


if __name__ == "__main__":

    warnings.simplefilter(action="ignore", category=FutureWarning)
    warnings.filterwarnings("ignore", category=DeprecationWarning)

    if len(argv) > 1:
        symbol = argv[1]
    else:
        print("Usage: python live_ohlc.py <symbol>")
        sys.exit(1)

    interval = "1m"

    load_dotenv()

    MONGO_URL = os.getenv("MONGO_URL")
    MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")

    myclient = pymongo.MongoClient(MONGO_URL)

    mydb = myclient[f"{MONGO_DB_NAME}"]
    klines = mydb["ticks"]
    candles = mydb["candleData"]
    coll = f"{symbol.replace('/','')}"

    try:

        db_data = {"date": 0, "open": 0, "high": 0, "low": 0, "close": 0, "volume": 0}
        db_data["symbol"] = coll
        klines.insert_one(db_data)

        print(f"{symbol} Klines Database Created")

    except pymongo.errors.DuplicateKeyError as e:

        print(f"{symbol},  E: {e.code}  Klines Database Already Exists")

    if "USDT" in symbol:

        base_url = "wss://fstream.binance.com/ws/"

        stream_name = (
            f'{"".join(symbol.split("/")).lower()}_perpetual@continuousKline_{interval}'
        )

        url = base_url + stream_name

    else:

        base_url = "wss://dstream.binance.com/ws/"

        stream_name = (
            f'{"".join(symbol.split("/")).lower()}_perpetual@continuousKline_{interval}'
        )

        url = base_url + stream_name

    while True:

        if datetime.utcnow().second > 0:

            ws = websocket.WebSocketApp(url=url)
            ws.on_message = On_Msg
            ws.on_error = On_Error
            ws.on_close = On_Close
            ws.on_open = On_Open

            print("here")
            threading.Thread(target=Looper).start()
            break

        time.sleep(1)
