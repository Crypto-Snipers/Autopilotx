from datetime import datetime, timezone, timedelta
import pandas as pd
import numpy as np
import pdb
import logging
import os
import time
import pause
import traceback
import warnings
import pymongo
from dotenv import load_dotenv
from logging.handlers import RotatingFileHandler


warnings.simplefilter(action="ignore", category=FutureWarning)
warnings.filterwarnings("ignore")

load_dotenv()


MONGO_URL = "mongodb+srv://upadhyaymanisha13:Manisha%401306@cluster0.opfmq9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"  
# MONGO_URL = os.getenv("MONGO_URL")
# if not MONGO_URL:
#     raise ValueError("MONGO_URL environment variable is not set")

client = pymongo.MongoClient(MONGO_URL)
db = client["Autopilotx"]
users = db["users"]
position_collection = db["position_2"]
trade_collection = db["trades_2"]
ticks = db["ticks"]
candles = db["candleData"]






def resample(df, timeframe:str):
    """OHLCV resampling."""
    df = df.set_index("date")
    ohlcv = (
        df.resample(timeframe, origin="start_day", label="left")
        .agg(
            open=("open", "first"),
            high=("high", "max"),
            low=("low", "min"),
            close=("close", "last"),
            volume=("volume", "sum"),
        )
        .dropna()
    )
    ohlcv = ohlcv[ohlcv["high"] != 0]  # optional safety check
    ohlcv = ohlcv.reset_index()
    return ohlcv


def ema(df, period):
    df[f"EMA"] = df["close"].ewm(span=period, adjust=False).mean().round(2)
    return df


def ATR(df, atr_period):
    hl = pd.Series(df["high"] - df["low"]).abs()
    hc = pd.Series(df["high"] - df["close"].shift()).abs()
    cl = pd.Series(df["close"].shift() - df["low"]).abs()
    hcl = pd.concat([hl, hc, cl], axis=1)
    tr = hcl.max(axis=1)

    # Calculate and return the ATR values
    return tr.ewm(alpha=1 / atr_period, min_periods=atr_period).mean().round(2)

def supertrend(df, atr_period=10, factor=3.0):
    """
    Calculate SuperTrend indicator based on Pine Script implementation

    Args:
        df: DataFrame with OHLC data (must have 'high', 'low', 'close' columns)
        atr_period: ATR period length
        factor: Multiplier for ATR

    Returns:
        DataFrame with supertrend columns added
    """
    # Create a copy of the dataframe to avoid modifying the original
    df = df.copy()

    # Calculate True Range
    df["tr0"] = abs(df["high"] - df["low"])
    df["tr1"] = abs(df["high"] - df["close"].shift())
    df["tr2"] = abs(df["close"].shift() - df["low"])
    df["tr"] = df[["tr0", "tr1", "tr2"]].max(axis=1)

    # Calculate ATR using EMA - FIX HERE
    # Use min_periods=1 instead of min_periods=atr_period to avoid NaN values
    df["atr"] = df["tr"].ewm(alpha=1 / atr_period, min_periods=1).mean()

    # Calculate basic upper and lower bands
    df["hl2"] = (df["high"] + df["low"]) / 2
    df["basic_upperband"] = df["hl2"] + (factor * df["atr"])
    df["basic_lowerband"] = df["hl2"] - (factor * df["atr"])

    # Initialize SuperTrend columns
    df["supertrend"] = 0.0
    df["final_upperband"] = 0.0
    df["final_lowerband"] = 0.0
    df["direction"] = 0  # -1 for uptrend, 1 for downtrend

    # Set initial values for first candle
    if len(df) > 0:
        df.loc[df.index[0], "final_upperband"] = df["basic_upperband"].iloc[0]
        df.loc[df.index[0], "final_lowerband"] = df["basic_lowerband"].iloc[0]
        df.loc[df.index[0], "supertrend"] = df["basic_upperband"].iloc[
            0
        ]  # Start with upper band as default
        df.loc[df.index[0], "direction"] = 1  # Start with downtrend as default

    # Rest of the function remains the same...
    for i in range(1, len(df)):
        # Calculate final upper band
        if (
            df["basic_upperband"].iloc[i] < df["final_upperband"].iloc[i - 1]
            or df["close"].iloc[i - 1] > df["final_upperband"].iloc[i - 1]
        ):
            df.loc[df.index[i], "final_upperband"] = df["basic_upperband"].iloc[i]
        else:
            df.loc[df.index[i], "final_upperband"] = df["final_upperband"].iloc[i - 1]

        # Calculate final lower band
        if (
            df["basic_lowerband"].iloc[i] > df["final_lowerband"].iloc[i - 1]
            or df["close"].iloc[i - 1] < df["final_lowerband"].iloc[i - 1]
        ):
            df.loc[df.index[i], "final_lowerband"] = df["basic_lowerband"].iloc[i]
        else:
            df.loc[df.index[i], "final_lowerband"] = df["final_lowerband"].iloc[i - 1]

        # Determine trend direction and SuperTrend value
        if df["supertrend"].iloc[i - 1] == df["final_upperband"].iloc[i - 1]:
            if df["close"].iloc[i] <= df["final_upperband"].iloc[i]:
                df.loc[df.index[i], "supertrend"] = df["final_upperband"].iloc[i]
                df.loc[df.index[i], "direction"] = 1
            else:
                df.loc[df.index[i], "supertrend"] = df["final_lowerband"].iloc[i]
                df.loc[df.index[i], "direction"] = -1
        elif df["supertrend"].iloc[i - 1] == df["final_lowerband"].iloc[i - 1]:
            if df["close"].iloc[i] >= df["final_lowerband"].iloc[i]:
                df.loc[df.index[i], "supertrend"] = df["final_lowerband"].iloc[i]
                df.loc[df.index[i], "direction"] = -1
            else:
                df.loc[df.index[i], "supertrend"] = df["final_upperband"].iloc[i]
                df.loc[df.index[i], "direction"] = 1
        else:
            if df["close"].iloc[i] <= df["final_upperband"].iloc[i]:
                df.loc[df.index[i], "supertrend"] = df["final_upperband"].iloc[i]
                df.loc[df.index[i], "direction"] = 1
            else:
                df.loc[df.index[i], "supertrend"] = df["final_lowerband"].iloc[i]
                df.loc[df.index[i], "direction"] = -1

    return df.round(2)



def fetch_historical_data(timeframe):
    """
    Fetch historical data from MongoDB and clean it.

    Parameters
    ----------
    timeframe : str
        The time frame of the data to fetch.

    Returns
    -------
    pandas.DataFrame or None
        The fetched and cleaned data, or None if an error occurred.
    """
    try:
        now = datetime.now(tz=timezone.utc)
        rounded = now.replace(second=0, microsecond=0, minute=(now.minute // TF) * TF)
        last_complete = rounded - timedelta(minutes=TF)

        candleData = list(
            candles.find({"symbol": candleSymbol}, {"_id": 0}).sort("date", pymongo.ASCENDING)
        )

        if not candleData:
            logger.error("No data returned from MongoDB")
            return None

        candleDf = pd.DataFrame(candleData)

        required_columns = [
            "date",
            "open",
            "high",
            "low",
            "close",
            "volume",
        ]

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

        df = resample(df=candleDf, timeframe=timeframe)
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

        return df

    except Exception as e:
        logger.error(f"Error in fetch_historical_data: {str(e)}")
        logger.error(traceback.format_exc())
        return None


def setup_logger(strategy_name, logs_dir):
    """
    Sets up a logger with the given strategy name and logs directory.

    This function returns a logger with two handlers: a file handler that
    logs to a file named after the strategy in the given logs directory,
    with a maximum size of 10MB and 5 backup files, and a console handler.

    The logger is configured to log at the INFO level and above, and the
    format string is "%(asctime)s - %(name)s - %(levelname)s - %(message)s".

    If the logs directory does not exist, it is created.

    Parameters
    ----------
    strategy_name : str
        The name of the strategy to log for.
    logs_dir : str
        The directory to log to.

    Returns
    -------
    logger : logging.Logger
        The logger set up with the given parameters.
    """
    if not os.path.exists(logs_dir):
        os.makedirs(logs_dir)

    log_file = f"{logs_dir}/{strategy_name}.log"

    logger = logging.getLogger(strategy_name)
    logger.setLevel(logging.INFO)

    # Clear any existing handlers
    if logger.handlers:
        logger.handlers.clear()

    # File handler with rotation (10MB max size, keep 5 backup files)
    file_handler = RotatingFileHandler(
        log_file, maxBytes=10 * 1024 * 1024, backupCount=5
    )
    file_handler.setLevel(logging.INFO)

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)

    # Create formatter and add it to the handlers
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)

    # Add handlers to logger
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    return logger


def check_entry_signal(df):
    """
    Checks if the given DataFrame meets the conditions for an entry signal.

    Parameters:
    df (pandas.DataFrame): The DataFrame to check for an entry signal.

    Returns:
    None or dict: If an entry signal is detected, returns a dictionary containing the signal details.
                  Otherwise, returns None.

    Raises:
    None
    """
    logger.info("Check entry signal")
    if df.empty:
        logger.error("DataFrame is empty, cannot check entry signal")
        return
    """ date	open	high	low	close	volume	EMA_9	supertrend	final_upperband	final_lowerband	ATR	p_close	p_ema	p_supertrend	trend  """
    if (
        "ATR" not in df.columns
        or "EMA" not in df.columns
        or "supertrend" not in df.columns
        or "close" not in df.columns
    ):
        logger.error("Required columns for entry signal are missing")
        return

    close = df["close"].iloc[-1]
    p_close = df["close"].iloc[-2]
    ema = df["EMA"].iloc[-1]
    p_ema = df["EMA"].iloc[-2]
    p_supertrend = df["supertrend"].iloc[-2]
    supertrend = df["supertrend"].iloc[-1]
    atr_val = df["ATR"].iloc[-1]

    if (
        (p_close > p_supertrend)
        & (close > p_ema)
        & (p_close < p_ema)
        & (atr_val > 0)
    ):
        logger.info("Entry signal met: p_close > p_supertrend, close > p_ema, p_close < p_ema, atr_val > 0")

        # get the current ticks
        current_ticks = ticks.find_one(
            {"symbol": candleSymbol}, sort=[("date", pymongo.DESCENDING)]
        )

        if current_ticks is None:
            logger.error("No current ticks found")
            return

        EntryPrice = float(current_ticks["close"])
        stopLoss = max((EntryPrice - (atr_val * 1)), supertrend)
        takeProfit = EntryPrice + (atr_val * 2)

        singal = {
            "Signal": "BUY",
            "EntryPrice": EntryPrice,
            "StopLoss": stopLoss,
            "TakeProfit": takeProfit,
            "Strategy": STRATEGY,
            "Symbol": candleSymbol,
            "EMA": ema,
            "supertrend": supertrend,
            "Qty": QTY,
            "EntryTime": datetime.now(timezone.utc),
            "Status": "Open",
        }

        return singal

    elif (p_close < p_supertrend) & (close < p_ema) & (p_close > p_ema):
        logger.info("Entry signal met: p_close < p_supertrend, close < p_ema, p_close > p_ema")

        # get the current ticks
        current_ticks = ticks.find_one(
            {"symbol": candleSymbol}, sort=[("date", pymongo.DESCENDING)]
        )

        if current_ticks is None:
            logger.error("No current ticks found")
            return

        EntryPrice = float(current_ticks["close"])
        stopLoss = min((EntryPrice + (atr_val * 1)), supertrend)
        takeProfit = EntryPrice - (atr_val * 2)

        singal = {
            "Signal": "SELL",
            "EntryPrice": EntryPrice,
            "StopLoss": stopLoss,
            "TakeProfit": takeProfit,
            "Strategy": STRATEGY,
            "Symbol": SYMBOL,
            "EMA": ema,
            "supertrend": supertrend,
            "Qty": QTY,
            "EntryTime": datetime.now(timezone.utc),
            "Status": "Open",
        }

        return singal
    
    else:
        logger.info("Entry signal not met")
        return None

def execute_trade(signal):
    """
    Execute a trade based on the generated signal.
    This function should be implemented to place an order in your trading system.
    """
    try:
        logger.info("Executing trade with signal: %s", signal)
        ID = str(time.perf_counter_ns())
        if not isinstance(signal, dict):
            logger.error("Signal must be a dictionary")
            return

        entry_doc = {
            "Strategy": STRATEGY,
            "ID": ID,
            "Symbol": SYMBOL,
            "Side": signal["Signal"],
            "Price": signal["EntryPrice"],
            "StopLoss": signal["StopLoss"],
            "Target": signal["TakeProfit"],
            "Qty": QTY,
            "OrderTime": datetime.now(timezone.utc),
            "OrderType": "MARKET",
            "UpdateTime": 0,
            "Users": {},
        }
        # Insert the trade into the trades collection
        trade_collection.insert_one(entry_doc)

        pos_doc = {
            "Strategy": STRATEGY,
            "ID": ID,
            "Symbol": SYMBOL,
            "Side": signal["Signal"],
            "Condition": "Executed",
            "EntryPrice": signal["EntryPrice"],
            "StopLoss": signal["StopLoss"],
            "Target": signal["TakeProfit"],
            "Qty": QTY,
            "EMA": signal["EMA"],
            "supertrend": signal["supertrend"],
            "EntryTime": datetime.now(timezone.utc),
            "Status": "Open",
            "UpdateTime": 0,
        }

        position_collection.insert_one(pos_doc)
        return pos_doc

    except Exception as e:
        logger.error(f"Error executing trade: {str(e)}")
        logger.error(traceback.format_exc())


def exit_open_positions():
    """
    Exit all open positions for the given strategy and symbol.
    This function should be implemented to close positions in your trading system.
    """
    try:
        open_positions = list(
            position_collection.find({"Status": "Open", "Symbol": SYMBOL})
        )
        if not open_positions:
            # logger.info("No open positions to exit.")
            return

        for position in open_positions:
            exit_condition = False
            exit_type = ""
            ticker = ticks.find_one({"symbol": SYMBOL})
            current_price = float(ticker["close"])
            if current_price < position["StopLoss"]:
                exit_condition = True
                exit_type = "StopLoss"
            elif current_price > position["Target"]:
                exit_condition = True
                exit_type = "Target"
            else:
                exit_condition = False
            
            if not exit_condition:
                # logger.info("Exit condition not met.")
                return

            position_id = position["ID"]
            exit_price = float(ticker["close"])
            pnl = exit_price - position["EntryPrice"]
            exit_time = datetime.now(timezone.utc)
            position["ExitPrice"] = exit_price
            position["ExitTime"] = exit_time
            position["ExitType"] = exit_type
            position["Status"] = "Close"
            position["Pnl"] = pnl

            exit_side = "SELL" if position["Side"] == "BUY" else "BUY"
            exit_doc = {
                "Strategy": STRATEGY,
                "ID": position["ID"],
                "Symbol": position["Symbol"],
                "Side": exit_side,
                "Price": exit_price,
                "Qty": position["Qty"],
                "OrderTime": datetime.now(timezone.utc),
                "OrderType": "Market",
                "Status": "Close",
                "UpdateTime": 0,
                "Users": {},
            }

            # Update the position status to closed
            position_collection.update_one({"ID": position["ID"]}, {"$set": position})
            # Log the exit action
            logger.info(f"Exited position: {exit_doc}")

    except Exception as e:
        logger.error(f"Error exiting open positions: {str(e)}")
        logger.error(traceback.format_exc())


def main():
    """
    Main Function to run strategy
    """
    tm_arr = [0,15,30,45]
    while True:
        dt_mn = int(datetime.now(timezone.utc).minute)
        if dt_mn in tm_arr:
            try:
                logger.info(f"Starting {STRATEGY}")
                df = fetch_historical_data(TIMEFRAME)
                if df is None:
                    logger.error("No data returned from fetch_historical_data")
                    return

                df = ema(df, EMA_PERIOD)
                df = supertrend(df, atr_period=SPT_ATR_PERIOD, factor=SPT_FACTOR)
                df["ATR"] = ATR(df, atr_period=ATR_PERIOD)
                df.sort_values(by="date", inplace=True, ascending=True)
                df.reset_index(inplace=True, drop=True)
                # pdb.set_trace()

                logger.info(df.iloc[-1])
                logger.info(df.iloc[-2])
                if df.empty:
                    logger.error("No valid data after applying indicators")
                    return

                # check is there is an entry signal is running or not

                open_positions = list(
                    position_collection.find({"Status": "Open", "Symbol": SYMBOL})
                )
                if len(open_positions) > 0:
                    logger.info("There is an open position, skipping entry signal check.")

                    exit_open_positions()

                check_signal = check_entry_signal(df)
                if check_signal:
                    logger.info(f"Entry signal generated: {check_signal}")
                    execute_trade(check_signal)
                    time.sleep(60)

                else:
                    logger.info("No entry signal generated at this time.")
                    dt = datetime.now(timezone.utc)
                    pause.until(dt + timedelta(minutes=1))
                    

            except Exception as e:
                logger.error(f"Error in main loop: {str(e)}")
                logger.error(traceback.format_exc())
                time.sleep(60)  # Wait before retrying


        exit_open_positions()


if __name__ == "__main__":
    logs_dir = "logs"
    STRATEGY = "VIPIN_STR"
    logger = setup_logger(STRATEGY, logs_dir)

    TF = 15
    TIMEFRAME = f"{TF}min"
    EMA_PERIOD = 9
    ATR_PERIOD = 14
    SPT_ATR_PERIOD = 10
    SPT_FACTOR = 3
    SL_FACTOR = 1.0
    TP_FACTOR = 2.0
    QTY = 0.15
    SYMBOL = "ETHUSDT"
    candleSymbol = "ETHUSDT"

    main()


