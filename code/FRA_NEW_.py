import os
import traceback
import warnings
import time
from datetime import datetime, timedelta, timezone
import pytz
from Utils import file_path_locator, setup_logger
from dotenv import load_dotenv
import numpy as np
import pandas as pd
import pymongo
from os import path

warnings.simplefilter(action="ignore", category=FutureWarning)
warnings.filterwarnings("ignore")

load_dotenv()


def liveUpdate():
    up = LiveCollection.find_one({"Strategy": STRATEGY})
    if up is None:
        logger.info("No live update found, fetching historical data")
        setup_dict = {"Strategy": STRATEGY, "PREV FRACTAL": 0}
        LiveCollection.insert_one(setup_dict)
        return setup_dict if up is None else up

    return up


def ATR(df, atr_period):
    hl = pd.Series(df["high"] - df["low"]).abs()
    hc = pd.Series(df["high"] - df["close"].shift()).abs()
    cl = pd.Series(df["close"].shift() - df["low"]).abs()
    hcl = pd.concat([hl, hc, cl], axis=1)
    tr = hcl.max(axis=1)

    # Calculate and return the ATR values
    return tr.ewm(alpha=1 / atr_period, min_periods=atr_period).mean().round(2)


def resample(df: pd.DataFrame, timeframe: str) -> pd.DataFrame:
    if not isinstance(df, pd.DataFrame):
        raise TypeError("Input 'df' must be a pandas DataFrame.")
    if not all(
        col in df.columns for col in ["date", "open", "high", "low", "close", "volume"]
    ):
        raise ValueError(
            "DataFrame must contain 'date', 'open', 'high', 'low', 'close', 'volume' columns."
        )
    if not pd.api.types.is_datetime64_any_dtype(df["date"]):
        df["date"] = pd.to_datetime(df["date"])

    original_last_timestamp = df["date"].max()

    df = df.set_index("date").sort_index()

    ohlcv_dict = {
        "open": "first",
        "high": "max",
        "low": "min",
        "close": "last",
        "volume": "sum",
    }

    resampled_df = df.resample(timeframe, origin="start_day").agg(ohlcv_dict)

    resampled_df.dropna(subset=["close"], inplace=True)

    timeframe_delta = pd.to_timedelta(timeframe)

    resampled_df = resampled_df[
        resampled_df.index + timeframe_delta - pd.Timedelta(nanoseconds=1)
        <= original_last_timestamp
    ]

    return resampled_df.reset_index()


def detect_fractals(df: pd.DataFrame, lookback_periods: int = 2) -> pd.DataFrame:

    if not pd.api.types.is_datetime64_any_dtype(df["date"]):
        df["date"] = pd.to_datetime(df["date"])

    if lookback_periods < 1:
        raise ValueError("lookback_periods must be at least 1.")

    df_result = df.sort_values(by="date", ascending=True).copy()

    if df_result.empty:
        return pd.DataFrame(
            columns=[
                "date",
                "open",
                "high",
                "low",
                "close",
                "volume",
                "fractal_top",
                "fractal_bottom",
                "fractal_time_top",
                "fractal_time_bottom",
            ]
        )

    highs = df_result["high"].values
    lows = df_result["low"].values
    dates = df_result["date"].values

    assert isinstance(
        len(highs), int
    ), f"len(highs) is not an integer! It's {type(len(highs))}"

    detected_fractal_top_price = np.full(len(highs), np.nan)
    detected_fractal_bottom_price = np.full(len(highs), np.nan)
    detected_fractal_top_time_list = [pd.NaT] * len(highs)
    detected_fractal_bottom_time_list = [pd.NaT] * len(highs)

    detected_fractal_top_time = np.array(detected_fractal_top_time_list)
    detected_fractal_bottom_time = np.array(detected_fractal_bottom_time_list)

    # --- Fractal Detection Loop ---
    for i in range(lookback_periods, len(highs) - lookback_periods):
        is_fractal_high = True
        for j in range(1, lookback_periods + 1):
            if highs[i] <= highs[i - j] or highs[i] <= highs[i + j]:
                is_fractal_high = False
                break

        if is_fractal_high:
            detected_fractal_top_price[i] = highs[i]
            detected_fractal_top_time[i] = dates[i]

        is_fractal_low = True
        for j in range(1, lookback_periods + 1):
            if lows[i] >= lows[i - j] or lows[i] >= lows[i + j]:
                is_fractal_low = False
                break

        if is_fractal_low:
            detected_fractal_bottom_price[i] = lows[i]
            detected_fractal_bottom_time[i] = dates[i]

    # Add temporary columns
    df_result["_temp_detected_fractal_top_price"] = detected_fractal_top_price
    df_result["_temp_detected_fractal_bottom_price"] = detected_fractal_bottom_price
    df_result["_temp_detected_fractal_top_time"] = detected_fractal_top_time
    df_result["_temp_detected_fractal_bottom_time"] = detected_fractal_bottom_time

    df_result["fractal_top"] = df_result["_temp_detected_fractal_top_price"].ffill()
    df_result["fractal_bottom"] = df_result[
        "_temp_detected_fractal_bottom_price"
    ].ffill()
    df_result["fractal_time_top"] = df_result["_temp_detected_fractal_top_time"].ffill()
    df_result["fractal_time_bottom"] = df_result[
        "_temp_detected_fractal_bottom_time"
    ].ffill()

    df_result["fractal_time_top"] = pd.to_datetime(df_result["fractal_time_top"])
    df_result["fractal_time_bottom"] = pd.to_datetime(df_result["fractal_time_bottom"])

    df_result["fractal_top"] = df_result["fractal_top"].shift(2)
    df_result["fractal_bottom"] = df_result["fractal_bottom"].shift(2)
    df_result["fractal_time_top"] = df_result["fractal_time_top"].shift(2)
    df_result["fractal_time_bottom"] = df_result["fractal_time_bottom"].shift(2)

    # Drop temporary columns
    df_result = df_result.drop(
        columns=[
            "_temp_detected_fractal_top_price",
            "_temp_detected_fractal_bottom_price",
            "_temp_detected_fractal_top_time",
            "_temp_detected_fractal_bottom_time",
        ]
    )

    return df_result


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

        df = resample(candleDf, timeframe)
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

        # print(df.tail())
        return df

    except Exception as e:
        logger.error(f"Error in fetch_historical_data: {str(e)}")
        logger.error(traceback.format_exc())
        return None


def SuperTrend(
    df: pd.DataFrame, atr_period: int = 10, factor: float = 3
) -> pd.DataFrame:
    y = df.copy()

    # Calculate ATR
    atr = (
        pd.concat(
            [
                (y["high"] - y["low"]).abs(),
                (y["high"] - y["close"].shift()).abs(),
                (y["close"].shift() - y["low"]).abs(),
            ],
            axis=1,
        )
        .max(axis=1)
        .ewm(alpha=1 / atr_period, min_periods=atr_period)
        .mean()
    )
    y["atr"] = atr.fillna(0)

    # Calculate basic bands
    hl2 = (y["high"] + y["low"]) / 2
    ub = hl2 + factor * y["atr"]
    lb = hl2 - factor * y["atr"]

    # Initialize columns
    direction = np.ones(len(y), dtype=int)
    supertrend = np.zeros(len(y))

    # Compute Supertrend
    for i in range(1, len(y)):
        if direction[i - 1] == 1:
            if y["close"].iloc[i] < lb.iloc[i - 1]:
                direction[i] = -1
                ub.iloc[i] = ub.iloc[i]
            else:
                direction[i] = 1
                lb.iloc[i] = max(lb.iloc[i], lb.iloc[i - 1])
        else:
            if y["close"].iloc[i] > ub.iloc[i - 1]:
                direction[i] = 1
                lb.iloc[i] = lb.iloc[i]
            else:
                direction[i] = -1
                ub.iloc[i] = min(ub.iloc[i], ub.iloc[i - 1])

        # Set supertrend value
        supertrend[i] = lb.iloc[i] if direction[i] == 1 else ub.iloc[i]

    y["Direction"] = direction
    y["Supertrend"] = supertrend
    return y


def analyze_market_data(df, ATR_PERIOD=14, FRACTAL_PERIOD=5, ST_FACTOR=3):
    df = df.copy()

    df["atr"] = ATR(df, ATR_PERIOD)

    df = detect_fractals(df, FRACTAL_PERIOD)

    df = SuperTrend(df, ATR_PERIOD, ST_FACTOR)

    fractal_cols = [
        "fractal_top",
        "fractal_bottom",
        "fractal_time_top",
        "fractal_time_bottom",
    ]
    df[fractal_cols] = df[fractal_cols].ffill()

    return df


def check_for_entry_signals(df, trade_dict):

    open_positions = list(
        PositionCollection.find({"Strategy": STRATEGY, "Status": "Open"})
    )
    if len(open_positions) > 0:
        logger.info("Open positions exist, skipping entry signal generation")
        return None

    latest = df.iloc[-1]
    prev = df.iloc[-2]
    prev_frac = trade_dict["PREV FRACTAL"]

    # # 1min candle
    ticker = Ticks.find_one({"symbol": candleSymbol})

    # logger.info(f"ticker: \n{ticker}")
    # logger.info(f"latest: \n{latest.to_dict()}")
    # logger.info(f"prev: \n{prev.to_dict()}")

    # Find the most recent valid fractal top and bottom
    recent_top = None
    recent_bottom = None

    # Look for the most recent fractal top
    for i in range(len(df) - 1, 0, -1):
        if not np.isnan(df.iloc[i]["fractal_top"]):
            recent_top = df.iloc[i]
            break

    # Look for the most recent fractal bottom
    for i in range(len(df) - 1, 0, -1):
        if not np.isnan(df.iloc[i]["fractal_bottom"]):
            recent_bottom = df.iloc[i]
            break

    # No signals if we don't have recent fractals
    if recent_top is None or recent_bottom is None:
        return None

    direction = latest.get("Direction", None)
    if direction is None:
        logger.warning(
            "SuperTrend direction not found in dataframe, cannot determine trend direction"
        )
        return None

    latest_time = pd.to_datetime(ticker["date"], utc=True)
    fractal_time_top = pd.to_datetime(recent_top["fractal_time_top"], utc=True)
    fractal_time_bottom = pd.to_datetime(recent_bottom["fractal_time_bottom"], utc=True)

    # Check for buy signal - price breaks above recent fractal top and SuperTrend direction is -1 (bullish)
    if (
        ticker["high"] > recent_top["fractal_top"]
        and latest_time >= fractal_time_top
        and prev_frac != recent_top["fractal_top"]
        and ticker["close"] > latest["Supertrend"]
    ):

        logger.info(f"Latest candle: {latest.to_dict()}")
        logger.info(f"Previous candle: {prev.to_dict()}")
        logger.info(f"Ticker: {ticker}")

        entry_price = ticker["close"]
        atr_sl = entry_price - (SL_FACTOR * latest["atr"])
        take_profit = entry_price + (TP_FACTOR * latest["atr"])

        qty = 0.01  # (CAPITAL * LEVERAGE) / entry_price
        stop_loss = atr_sl

        return {
            "Signal": "BUY",
            "EntryPrice": float(entry_price),
            "atr_sl": float(atr_sl),
            "StopLoss": float(stop_loss),
            "Target": float(take_profit),
            "Atr": float(latest["atr"]),
            "FractalPrice": float(recent_top["fractal_top"]),
            "FractalTime": fractal_time_top,
            "EntryTime": latest_time,
            "Direction": int(direction),
            "SuperTrend": int(latest["Supertrend"]),
        }

    # Check for sell signal - price breaks below recent fractal bottom and SuperTrend direction is 1 (bearish)
    if (
        ticker["low"] < recent_bottom["fractal_bottom"]
        and latest_time >= fractal_time_bottom
        and prev_frac != recent_bottom["fractal_bottom"]
        and ticker["close"] < latest["Supertrend"]
    ):

        logger.info(f"Latest candle: {latest.to_dict()}")
        logger.info(f"Previous candle: {prev.to_dict()}")
        logger.info(f"Ticker: {ticker}")

        entry_price = ticker["close"]
        atr_sl = entry_price + (SL_FACTOR * latest["atr"])
        take_profit = entry_price - (TP_FACTOR * latest["atr"])

        qty = 0.01
        stop_loss = atr_sl

        return {
            "Signal": "SELL",
            "EntryPrice": float(entry_price),
            "atr_sl": float(atr_sl),
            "StopLoss": float(stop_loss),
            "Target": float(take_profit),
            "Atr": float(latest["atr"]),
            "FractalPrice": float(recent_top["fractal_bottom"]),
            "FractalTime": fractal_time_bottom,  # #FratalTime
            "EntryTime": latest_time,
            "Direction": int(direction),
            "SuperTrend": int(latest["Supertrend"]),
        }

    return None


def execute_trade(signal):
    try:
        qty = 0.01

        POSITION_ID = int(time.perf_counter_ns())

        position_doc = {
            "Strategy": STRATEGY,
            "ID": POSITION_ID,
            "Symbol": SYMBOL,
            "Side": str(signal["Signal"]),
            "Condition": "Executed",
            "EntryPrice": float(signal["EntryPrice"]),
            "Qty": round(qty, 3),
            "StopLoss": round(float(signal["StopLoss"]), 2),
            "Target": round(float(signal["Target"]), 2),
            "Atr": round(float(signal["Atr"]), 2),
            "FractalPrice": round(float(signal["FractalPrice"]), 2),
            "FractalTime": pd.to_datetime(signal["FractalTime"]).to_pydatetime(),
            "EntryTime": pd.to_datetime(signal["EntryTime"]).to_pydatetime(),
            "Direction": int(signal["Direction"]),
            "SuperTrend": int(signal["SuperTrend"]),
            "Status": "Open",
            "UpdateTime": 0,
        }

        PositionCollection.insert_one(position_doc)

        entry_doc = {
            "Strategy": STRATEGY,
            "ID": POSITION_ID,
            "Symbol": SYMBOL,
            "Side": str(signal["Signal"]),
            "StopLoss": round(float(signal["StopLoss"]), 2),
            "Target": round(float(signal["Target"]), 2),
            "Price": float(signal["EntryPrice"]),
            "OrderTime": pd.to_datetime(signal["EntryTime"]).to_pydatetime(),
            "OrderType": "MARKET",
            "Qty": round(qty, 3),
            "UpdateTime": 0,
            "Users": {},
        }

        TradeCollection.insert_one(entry_doc)

        time.sleep(60)
        live_doc = {
            "Strategy": STRATEGY,
            "ID": 0,
            "PREV FRACTAL": signal["FractalPrice"],
            "EntryID": POSITION_ID,
            "Symbol": SYMBOL,
            "Side": signal["Signal"],
            "EntryTime": signal["EntryTime"],
            "EntryPrice": signal["EntryPrice"],
            "Qty": round(qty, 3),
            "FractalPrice": signal["FractalPrice"],
            "FractalTime": signal["FractalTime"],
            "ATR": signal["Atr"],
            "Direction": round(signal["Direction"], 2),
            "SuperTrend": round(signal["SuperTrend"], 2),
            "StopLoss": round(signal["StopLoss"], 2),
            "Target": round(float(signal["Target"]), 2),
            "Status": "Open",
        }

        LiveCollection.update_one(
            {"Strategy": STRATEGY}, {"$set": live_doc}, upsert=True
        )

        return POSITION_ID

    except Exception as e:
        logger.error(f"Error executing trade: {str(e)}")
        logger.error(traceback.format_exc())
        return None


def check_open_positions():

    try:
        # Get current price
        ticker = Ticks.find_one({"symbol": candleSymbol})
        current_price = ticker["close"]

        # Get open positions
        open_positions = list(
            PositionCollection.find({"Strategy": STRATEGY, "Status": "Open"})
        )
        # logger.info(open_positions)
        for position in open_positions:
            exit_triggered = False
            exit_type = None
            exit_price = None

            # Check if stop loss hit
            if position["Side"] == "BUY":
                if current_price <= position["StopLoss"]:
                    exit_triggered = True
                    exit_type = "StopLoss"
                    exit_price = position["StopLoss"]

                    flt = {
                        "Condition": "Executed",
                        "UpdateTime": datetime.now(tz=pytz.utc),
                    }

                    TradeCollection.update_one({"ID": position["ID"]}, {"$set": flt})
                elif current_price >= position["Target"]:
                    exit_triggered = True
                    exit_type = "Target"
                    exit_price = position["Target"]
                    flt = {
                        "Condition": "Target",
                        "UpdateTime": datetime.now(tz=pytz.utc),
                    }
                    TradeCollection.update_one({"ID": position["ID"]}, {"$set": flt})
            else:
                if current_price >= position["StopLoss"]:
                    exit_triggered = True
                    exit_type = "StopLoss"
                    exit_price = position["StopLoss"]
                    flt = {
                        "Condition": "StopLoss",
                        "UpdateTime": datetime.now(tz=pytz.utc),
                    }
                    TradeCollection.update_one({"ID": position["ID"]}, {"$set": flt})

                elif current_price <= position["Target"]:
                    exit_triggered = True
                    exit_type = "Target"
                    exit_price = position["Target"]
                    flt = {
                        "Condition": "Target",
                        "UpdateTime": datetime.now(tz=pytz.utc),
                    }
                    TradeCollection.update_one({"ID": position["ID"]}, {"$set": flt})

            if exit_triggered:
                # Calculate PNL
                if position["Side"] == "BUY":
                    pnl = (exit_price - position["EntryPrice"]) * position["Qty"]
                else:
                    pnl = (position["EntryPrice"] - exit_price) * position["Qty"]

                # Update position status
                PositionCollection.update_one(
                    {"Strategy": STRATEGY, "ID": position["ID"]},
                    {
                        "$set": {
                            "Status": "Closed",
                            "ExitPrice": exit_price,
                            "ExitTime": ticker["date"],
                            "ExitType": exit_type,
                            "PNL": pnl,
                        }
                    },
                )

                # Update live collection
                LiveCollection.update_one(
                    {"Strategy": STRATEGY},
                    {
                        "$set": {
                            "ExitPrice": exit_price,
                            "ExitTime": ticker["date"],
                            "ExitType": exit_type,
                            "PNL": pnl,
                            "Status": "Completed",
                        }
                    },
                )

                logger.info(f"Position closed: {position}")

    except Exception as e:
        logger.error(f"Error checking positions: {str(e)}")
        logger.error(traceback.format_exc())

    except Exception as e:
        logger.error(f"Error updating OHLC database: {str(e)}")
        logger.error(traceback.format_exc())


def main():
    logger.info(f"Starting {STRATEGY}")

    while True:
        try:
            # Fetch historical data
            df = fetch_historical_data(TIMEFRAME)
            # logger.info(f"df: {df.to_dict()}")
            if df is None:
                logger.warning(
                    "No data returned from fetch_historical_data, waiting 60 seconds..."
                )
                time.sleep(60)
                continue

            if len(df) < 5:  # Need enough data for analysis
                logger.warning(
                    f"Not enough data points for analysis ({len(df)} < 5), waiting..."
                )
                time.sleep(60)
                continue

            df = analyze_market_data(df)

            open_positions = list(
                PositionCollection.find({"Strategy": STRATEGY, "Status": "Open"})
            )

            if len(open_positions) == 0:

                trade_dict = liveUpdate()
                # Check for entry signals
                signal = check_for_entry_signals(df, trade_dict)

                # Execute trade if signal found
                if signal is not None:
                    trade_id = execute_trade(signal)
                    if trade_id:
                        logger.info(f"Trade executed with ID: {trade_id}")
                        time.sleep(60)
            else:

                check_open_positions()

        except Exception as e:
            logger.error(f"Error in main loop: {str(e)}")
            logger.error(traceback.format_exc())
            time.sleep(60)  # Wait before retrying


if __name__ == "__main__":
    # MongoDB connection
    load_dotenv()
    MONGO_LINK = os.getenv("MONGO_URL")
    MONGO_DEV_DB_NAME = os.getenv("MONGO_DB_NAME")

    STRATEGY = "ETH Multiplier"
    # STRATEGY = #str(argv[1])

    if "BTC" in STRATEGY:
        SYMBOL = "BTC-USDT"
        candleSymbol = "BTCUSDT"
    elif "ETH" in STRATEGY:
        SYMBOL = "ETH-USDT"
        candleSymbol = "ETHUSDT"
    elif "SOL" in STRATEGY:
        SYMBOL = "SOL-USDT"
        candleSymbol = "SOLUSDT"
    else:
        print("Symbol not allow")
        # sys.exit(1)

    # Setup logger
    current_file = str(os.path.basename(__file__)).replace(".py", "")
    folder = file_path_locator()
    logs_dir = path.join(path.normpath(folder), "logs")
    if not os.path.exists(logs_dir):
        os.makedirs(logs_dir)

    LOG_file = f"{logs_dir}/{STRATEGY}.log"

    logger = setup_logger(
        name=current_file, log_to_file=True, log_file=LOG_file, capture_print=False
    )

    TF = 5
    TIMEFRAME = f"{TF}min"
    FRACTAL_PERIOD = 5
    ATR_PERIOD = 14
    ST_FACTOR = 3.0
    SL_FACTOR = 1.0
    TP_FACTOR = 2.0
    LEVERAGE = 20
    CAPITAL = 150

    # Initialize MongoDB connections
    myclient = pymongo.MongoClient(MONGO_LINK)
    db_name = MONGO_DEV_DB_NAME
    mydb = myclient[db_name]
    LiveCollection = mydb["live"]
    PositionCollection = mydb["position"]
    TradeCollection = mydb["trades"]
    candles = mydb["candleData"]
    Ticks = mydb["ticks"]

    trade_dict = liveUpdate()

    try:
        import pause

        dt = datetime.now()
        minutes = dt.minute
        tt = minutes + 1
        pause.until(dt.replace(minute=tt, second=0))

        main()

    except KeyboardInterrupt:
        logger.info("Strategy stopped by user")
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
        logger.error(traceback.format_exc())
