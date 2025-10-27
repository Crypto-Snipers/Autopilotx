from __future__ import annotations
import time
import warnings
import pandas as pd
from datetime import datetime, timedelta, timezone
import pymongo
from sys import argv
import pytz
from dotenv import load_dotenv
import pause
import traceback
import os
from Utils import file_path_locator, setup_logger
from os import path

warnings.simplefilter(action="ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=DeprecationWarning)


def fetch_historical_data(timeframe):
    try:

        now = datetime.now(tz=timezone.utc)
        rounded = now.replace(second=0, microsecond=0, minute=(now.minute // TF) * TF)
        last_complete = rounded - timedelta(minutes=TF)

        candleData = list(
            candles.find({"symbol": candleSymbol}, {"_id": 0})
            .sort("timestamp", pymongo.ASCENDING)
            .limit(40000)
        )

        if not candleData:
            logger.error("No data returned from MongoDB")
            return None

        candleDf = pd.DataFrame(candleData)

        required_columns = ["date", "open", "high", "low", "close", "volume"]
        missing_columns = [
            col for col in required_columns if col not in candleDf.columns
        ]

        if missing_columns:
            logger.error(f"Missing required columns in data: {missing_columns}")
            logger.error(f"Available columns: {candleDf.columns.tolist()}")
            return None

        candleDf = candleDf[required_columns].copy()

        numeric_cols = ["open", "high", "low", "close", "volume"]
        for col in numeric_cols:
            candleDf[col] = pd.to_numeric(candleDf[col], errors="coerce")

        candleDf["date"] = pd.to_datetime(candleDf["date"], utc=True, errors="coerce")

        candleDf.dropna(inplace=True)

        if candleDf.empty:
            logger.error("No valid data after cleaning")
            return None

        df = cand_conv(timeframe, candleDf)
        df.reset_index(inplace=True, drop=True)

        if df["date"].dt.tz is None:
            df["date"] = df["date"].dt.tz_localize("UTC")
        else:
            df["date"] = df["date"].dt.tz_convert("UTC")

        if last_complete.tzinfo is None:
            last_complete = last_complete.replace(tzinfo=timezone.utc)
        else:
            last_complete = last_complete.astimezone(timezone.utc)

        df = df[df["date"] <= last_complete]

        if df.empty:
            logger.warning("No complete candles available after filtering")
            return None

        print(df.tail())
        return df

    except Exception as e:
        logger.error(f"Error in fetch_historical_data: {str(e)}")
        logger.error(traceback.format_exc())
        return None


def cand_conv2(timeframe, df, z=False):
    if df.empty:
        return df

    last_date = df.loc[df.index[-1], "date"]
    total_minutes = last_date.hour * 60 + last_date.minute
    delete_row = False

    if isinstance(timeframe, str):
        try:
            timeframe = int(timeframe.replace("min", ""))
        except ValueError:
            logger.error(f"Invalid timeframe format: {timeframe}")
            raise

    if z:
        if total_minutes % timeframe == 0:
            df = df[:-1]
            delete_row = False
        elif (total_minutes + 1) % timeframe == 0:
            delete_row = False
        elif total_minutes + timeframe > 1440:
            delete_row = False
        else:
            delete_row = True

    ohlc_dict = {
        "open": "first",
        "high": "max",
        "low": "min",
        "close": "last",
        "volume": "sum",
    }

    if not pd.api.types.is_datetime64_any_dtype(df["date"]):
        df["date"] = pd.to_datetime(df["date"])

    df = df.set_index("date")

    try:
        df = df.resample(f"{timeframe}T").apply(ohlc_dict)
    except Exception as e:
        logger.error(f"Error in resampling: {str(e)}")
        logger.error(f"timeframe value: {timeframe}, type: {type(timeframe)}")
        raise

    df = df.reset_index()

    if delete_row and z:
        df = df[:-1]

    return df


def cand_conv(timeframe, df):
    if df.empty:
        return df

    # Ensure date is in datetime format
    if not pd.api.types.is_datetime64_any_dtype(df["date"]):
        df["date"] = pd.to_datetime(df["date"])

    # Sort by date to ensure proper processing
    df = df.sort_values("date").reset_index(drop=True)

    # Find all midnight timestamps
    c = list(df.loc[(df["date"].dt.hour == 0) & (df["date"].dt.minute == 0)].index)
    cd = pd.DataFrame()

    # Handle different cases based on where the day boundaries are
    if not c or (len(c) == 1 and c[0] == 0):
        x = cand_conv2(timeframe, df, z=True)
        if not x.empty:
            cd = pd.concat([cd, x], ignore_index=True)
            if not cd.empty:
                cd = cd.iloc[1:].reset_index(drop=True)
        return cd

    elif len(c) == 1 and c[0] != 0:
        x1 = cand_conv2(timeframe, df[: c[0]])
        x2 = cand_conv2(timeframe, df[c[0] :], z=True)
        cd = pd.concat([x1[1:], x2], ignore_index=True)
        return cd

    elif c[0] == 0:
        c = c[1:]

    # Process data between day boundaries
    for i in range(len(c)):
        if i == 0:
            x = cand_conv2(timeframe, df[: c[i]])
        elif i == len(c) - 1:
            x1 = cand_conv2(timeframe, df[c[i - 1] : c[i]])
            x2 = cand_conv2(timeframe, df[c[i] :], z=True)
            cd = pd.concat([cd, x1, x2], ignore_index=True)
            continue
        else:
            x = cand_conv2(timeframe, df[c[i - 1] : c[i]])

        if not x.empty:
            cd = pd.concat([cd, x], ignore_index=True)

    # Clean up the result
    if not cd.empty:
        cd = cd.iloc[1:].reset_index(drop=True)

    return cd


def calculate_emas(df):
    df["EMA_20"] = df["close"].ewm(span=EMA_PERIOD_FAST, adjust=False).mean()
    df["EMA_50"] = df["close"].ewm(span=EMA_PERIOD_SLOW, adjust=False).mean()
    df["P_EMA_20"] = df["EMA_20"].shift(1)
    df["P_EMA_50"] = df["EMA_50"].shift(1)
    return df


def check_buy_signal(df):
    prev_row = df.iloc[-2]
    last_row = df.iloc[-1]

    return (
        prev_row["P_EMA_20"] < prev_row["P_EMA_50"]  # # buy
        and last_row["EMA_20"] > last_row["EMA_50"]
        and last_row["close"] > last_row["EMA_20"]
        and last_row["close"] > last_row["EMA_50"]
        # prev_row['close'] > prev_row['EMA_10'] and
        # prev_row['close'] > prev_row['EMA_30']
    )

    # return (
    #     # prev_row['P_EMA_10'] > prev_row['P_EMA_30'] and
    #     # last_row['EMA_10'] < last_row['EMA_30'] and
    #     # last_row['close'] < last_row['EMA_10'] and
    #     last_row['close'] > last_row['EMA_30']
    # )


def liveUpdate(Strategy):
    up = LiveCollection.find_one({"Strategy": Strategy})
    if up is None:
        logger.info("No live update found, fetching historical data")
        setup_dict = {"Strategy": Strategy}
        LiveCollection.insert_one(setup_dict)
        return setup_dict if up is None else up

    return up


def live_trading_loop():

    while True:
        try:
            ct = datetime.now().replace(
                second=0, microsecond=0, minute=(datetime.now().minute // TF) * TF
            )
            next_candle_time = ct + timedelta(minutes=TF)

            open_positions = list(
                PositionCollection.find({"Strategy": STRATEGY, "Status": "Open"})
            )

            if len(open_positions) == 0:
                df = fetch_historical_data(TF)
                if df is None or len(df) < 5:
                    logger.warning(
                        f"Not enough data for analysis (df shape: {df.shape if df is not None else None}), waiting..."
                    )
                    pause.until(next_candle_time)
                    continue

                df = calculate_emas(df)
                if check_buy_signal(df) and len(open_positions) == 0:
                    # print(f"[{datetime.utcnow()}] Buy signal detected!")
                    logger.info(f"[{datetime.utcnow()}] Buy signal detected!")

                    ema20 = df["EMA_20"].iloc[-1].round(2)
                    ema50 = df["EMA_50"].iloc[-1].round(2)

                    POSITION_ID = int(time.perf_counter_ns())

                    entry_price = df["close"].iloc[-1].round(2)
                    entry_time = df["date"].iloc[-1]

                    sl = round(entry_price - SL_POINT, 2)
                    target = round(entry_price + TG_POINT, 2)

                    # qty = (CAPITAL * LEVERAGE) / entry_price
                    qty = 0.01  # max(QTY,round(qty, 3))

                    position_doc = {
                        "ID": POSITION_ID,
                        "Strategy": STRATEGY,
                        "Symbol": SYMBOL,
                        "Side": "BUY",
                        "Condition": "Executed",
                        "EntryPrice": entry_price,
                        "EntryTime": entry_time,
                        "Qty": qty,
                        "StopLoss": sl,
                        "Target": target,
                        "EMA_20": ema20,
                        "EMA_50": ema50,
                        "Status": "Open",
                        "ExitTime": "",
                        "ExitPrice": "",
                        "ExitType": "",
                        "UpdateTime": datetime.utcnow(),
                        "PNL": 0,
                    }

                    PositionCollection.insert_one(position_doc)
                    logger.info(
                        f"Position {POSITION_ID} opened and logged in PositionCollection."
                    )

                    entry_doc = {
                        "Strategy": STRATEGY,
                        "ID": POSITION_ID,
                        "Symbol": SYMBOL,
                        "Side": "BUY",
                        "StopLoss": sl,
                        "Target": target,
                        "Price": entry_price,
                        "OrderTime": entry_time,
                        "OrderType": "MARKET",
                        "Qty": qty,
                        "UpdateTime": 0,
                        "Users": {},
                    }

                    result = TradeCollection.insert_one(entry_doc)
                    logger.info(
                        f"Entry trade executed successfully: {result.inserted_id} for position {POSITION_ID}"
                    )

                    # # StopLoss Doc

                    # sl_doc = {
                    #     "ID": sl_id,
                    #     "StopLoss":True,
                    #     'Symbol': SYMBOL,
                    #     "Side": "SELL",
                    #     "Condition":"Open",
                    #     "Price": sl,
                    #     "OrderTime": entry_time,
                    #     "OrderType":"STOP_MARKET",
                    #     'Qty': qty,
                    #     'Status': 'Open',
                    #     "UpdateTime": 0,
                    #     "Users":{}
                    # }
                    # res = TradeCollection.insert_one(sl_doc)
                    # logger.info(f"SL trade executed successfully: {res.inserted_id} for position {POSITION_ID}")

                    live_status_update_data = {
                        "Strategy": STRATEGY,
                        "ID": POSITION_ID,
                        "Symbol": SYMBOL,
                        "Side": "BUY",
                        "EntryTime": entry_time,
                        "EntryPrice": entry_price,
                        "Qty": qty,
                        "StopLoss": sl,
                        "Target": target,
                        "EMA_20": ema20,
                        "EMA_50": ema50,
                        "Status": "Open",
                    }

                    LiveCollection.update_one(
                        {"Strategy": STRATEGY},
                        {"$set": live_status_update_data},
                        upsert=True,
                    )
                    logger.info(
                        f"Live status updated to 'Open' for position {POSITION_ID}."
                    )

                    time.sleep(60)
                    continue

                else:
                    pause.until(next_candle_time)

            else:
                ticker = Ticks.find_one({"symbol": candleSymbol})
                if not ticker or "close" not in ticker:
                    logger.warning("No valid ticker data found, waiting briefly...")
                    time.sleep(10)
                    continue

                current_price = float(ticker["close"])

                for position in open_positions:
                    position_id = position["ID"]
                    side = position["Side"]
                    entry_price = position["EntryPrice"]
                    qty = position["Qty"]

                    exit_price = None
                    exit_type = None
                    df = fetch_historical_data(TF)
                    df = calculate_emas(df)

                    if side == "BUY":
                        if current_price <= position["StopLoss"]:
                            exit_price = current_price
                            exit_type = "StopLoss"
                            logger.info(
                                f"Position {position_id}: Stop Loss hit at price {exit_price}"
                            )
                            flt = {
                                "Strategy": STRATEGY,
                                "Condition": "Executed",
                                "UpdateTime": datetime.now(tz=pytz.utc),
                            }
                            TradeCollection.update_one(
                                {"ID": position["ID"]}, {"$set": flt}
                            )

                        elif current_price >= position["Target"]:
                            exit_price = current_price
                            exit_type = "Target"
                            logger.info(
                                f"Position {position_id}: Target hit at price {exit_price}"
                            )
                            flt = {
                                "Strategy": STRATEGY,
                                "Condition": "Cancel",
                                "UpdateTime": datetime.now(tz=pytz.utc),
                            }
                            TradeCollection.update_one(
                                {"ID": position["ID"]}, {"$set": flt}
                            )

                        elif df["close"].iloc[-1] < df["EMA_20"].iloc[-2]:
                            exit_price = df["close"].iloc[-1]
                            exit_type = "EMA20_Crossover"
                            logger.info(
                                f"Position {position_id}: candle close ({df['close'].iloc[-2]:.2f}) < EMA20 ({df['EMA_20'].iloc[-2]:.2f}). Exiting at {exit_price:.2f}"
                            )

                        if exit_price is None:
                            continue

                        pnl = (exit_price - entry_price) * qty
                        logger.info(
                            f"Position {position_id} closed with {exit_type}. PNL: {pnl:.2f}"
                        )

                        PositionCollection.update_one(
                            {"Strategy": STRATEGY, "ID": position["ID"]},
                            {
                                "$set": {
                                    "Status": "Closed",
                                    "ExitPrice": exit_price,
                                    "ExitTime": datetime.utcnow(),
                                    "ExitType": exit_type,
                                    "PNL": pnl,
                                }
                            },
                        )

                        logger.info(
                            f"Position {position_id} updated as 'Closed' in PositionCollection."
                        )

                        LiveCollection.update_one(
                            {"Strategy": STRATEGY},
                            {
                                "$set": {
                                    "ExitTime": datetime.utcnow(),
                                    "ExitPrice": exit_price,
                                    "ExitType": exit_type,
                                    "PNL": pnl,
                                    "Status": "Completed",
                                }
                            },
                        )
                        logger.info(
                            f"Live status updated for exit of position {position_id}."
                        )

                        logger.info(f"Exit trade logged for position {position_id}.")

                time.sleep(10)

        except Exception as e:
            print(f"[{datetime.utcnow()}] Error in main loop: {e}")
            logger.error(f"[{datetime.utcnow()}] Error in main loop: {e}")
            logger.error(traceback.format_exc())
            pause.until(next_candle_time)


if __name__ == "__main__":

    # MongoDB connection
    load_dotenv()

    MONGO_LINK = os.getenv("MONGO_URL")
    MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")
    QTY = 0.01

    STRATEGY = str(argv[1])
    STRATEGY = STRATEGY.replace("_", " ").strip()
    SYMBOL = ""
    candleSymbol = ""

    if "BTC" in STRATEGY or "Bit" in STRATEGY:
        SYMBOL = "BTC-USDT"
        candleSymbol = "BTCUSDT"

    else:
        print("Symbol not allow")

    # Setup logger
    current_file = str(os.path.basename(__file__)).replace(".py", "")
    folder = file_path_locator()
    logs_dir = path.join(path.normpath(folder), "logs")
    if not os.path.exists(logs_dir):
        os.makedirs(logs_dir)

    LOG_file = f"{logs_dir}/{STRATEGY}.log"

    logger = setup_logger(
        name=current_file,
        log_to_file=True,
        log_file=LOG_file,
        capture_print=False,
        log_to_console=False,
    )

    myclient = pymongo.MongoClient(MONGO_LINK)
    db_name = MONGO_DB_NAME
    mydb = myclient[f"{db_name}"]
    LiveCollection = mydb["live"]
    PositionCollection = mydb["position"]
    TradeCollection = mydb["trades"]
    candles = mydb["candleData"]
    Ticks = mydb["ticks"]

    trade_dict = liveUpdate(STRATEGY)

    # Strategy Parameters
    TF = 30
    TIME_FRAME = f"{TF}min"
    EMA_PERIOD_FAST = 20
    EMA_PERIOD_SLOW = 50
    SL_POINT = 200
    TG_POINT = 1000

    logger.info(SYMBOL)
    dt = datetime.now()
    ct = dt.replace(second=0, microsecond=0, minute=(dt.minute // TF) * TF)
    next_candle_time = ct + timedelta(minutes=TF)

    logger.info(f"Current time: {dt}, Next candle time: {next_candle_time}")

    if dt.minute % TF != 0:
        pause.until(next_candle_time)

    live_trading_loop()
