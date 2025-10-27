from datetime import datetime, timezone, timedelta
import pandas as pd
import numpy as np
import pymongo
from dotenv import load_dotenv
import os
import logging
from logging.handlers import RotatingFileHandler
import traceback
import time
import pause

def pine_rma(df, src_column, length):
    """Wilder's RMA identical to TradingView ta.rma()."""
    alpha = 1 / length
    result = pd.Series(np.nan, index=df.index, dtype=float)

    if len(df) < length:
        return result

    result.iloc[length - 1] = df[src_column].iloc[:length].mean()

    for i in range(length, len(df)):
        result.iloc[i] = (
            alpha * df[src_column].iloc[i] + (1 - alpha) * result.iloc[i - 1]
        )
    return result


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

    resampled_df = df.resample(timeframe, origin="start_day").agg(ohlcv_dict)  # type: ignore

    resampled_df.dropna(subset=["close"], inplace=True)

    timeframe_delta = pd.to_timedelta(timeframe)

    resampled_df = resampled_df[
        resampled_df.index + timeframe_delta - pd.Timedelta(nanoseconds=1)  # type: ignore
        <= original_last_timestamp
    ]

    return resampled_df.reset_index()


def atr_calculation(df, period=2):
    """Calculate Average True Range (ATR) using Wilder's method."""
    hl = df["high"] - df["low"]
    hpc = (df["high"] - df["close"].shift()).abs()
    lpc = (df["low"] - df["close"].shift()).abs()
    df["TrueRange"] = pd.concat([hl, hpc, lpc], axis=1).max(axis=1)
    df["ATR"] = pine_rma(df, "TrueRange", period)
    return df


def sma(df, period):
    """
    Calculate Simple Moving Average (SMA) of a given period.

    Parameters
    ----------
    df : pandas.DataFrame
            DataFrame containing the column "close".
    period : int
            The moving average period.

    Returns
    -------
    pandas.DataFrame
            The input DataFrame with an additional column "sma_<period>" containing the SMA values.
    """
    df[f"SMA_{period}"] = df["close"].rolling(window=period, min_periods=period).mean()

    return df


def ema(df, period):
    """
    Calculate Exponential Moving Average (EMA) of a given period.

    Parameters
    ----------
    df : pandas.DataFrame
            DataFrame containing the column "close".
    period : int
            The moving average period.

    Returns
    -------
    pandas.DataFrame
        The input DataFrame with an additional column "ema_<period>" containing the EMA values.
    """
    df[f"EMA_{period}"] = df["close"].ewm(span=period, adjust=False).mean()
    return df


def rsi(df, length=2):
    """
    Calculate Relative Strength Index (RSI) of a given length.

    Parameters
    ----------
    df : pandas.DataFrame
        DataFrame containing the column "close".
    length : int
        The RSI period.

    Returns
    -------
    pandas.DataFrame
        The input DataFrame with an additional column "RSI" containing the RSI values.
    """

    change = df["close"].diff()
    up = np.where(change > 0, change, 0)
    down = np.where(change < 0, -change, 0)

    roll_up = pd.Series(up, index=df.index).ewm(alpha=1 / length, adjust=False).mean()
    roll_down = (
        pd.Series(down, index=df.index).ewm(alpha=1 / length, adjust=False).mean()
    )
    rs = roll_up / roll_down.replace(0, np.nan)
    df["RSI"] = 100 - (100 / (1 + rs))
    return df


def adx(df, di_length=2, adx_smoothing=2):
    """
    Calculate Average Directional Index (ADX) of a given length.

    Parameters
    ----------
    df : pandas.DataFrame
        DataFrame containing the columns "high", "low", and "ATR".
    di_length : int
        The length of the Directional Movement Index (DMI).
    adx_smoothing : int
        The length of the Average Directional Index (ADX) smoothing.

    Returns
    -------
    pandas.DataFrame
        The input DataFrame with additional columns "+DM", "-DM", "+DM_rma", "-DM_rma", "+DI", "-DI", "DX", and "ADX" containing the respective values.
    """

    up_move = df["high"].diff()
    down_move = -df["low"].diff()

    plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0)
    minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0)

    df["+DM"] = plus_dm
    df["-DM"] = minus_dm

    df["+DM_rma"] = pine_rma(df, "+DM", di_length)
    df["-DM_rma"] = pine_rma(df, "-DM", di_length)

    df["+DI"] = 100 * df["+DM_rma"] / df["ATR"]
    df["-DI"] = 100 * df["-DM_rma"] / df["ATR"]

    df["DX"] = 100 * (
        (df["+DI"] - df["-DI"]).abs() / (df["+DI"] + df["-DI"]).replace(0, np.nan)
    )
    df["ADX"] = pine_rma(df, "DX", adx_smoothing)
    return df


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
            candles.find({"symbol": candleSymbol}, {"_id": 0})
            .sort("date", pymongo.ASCENDING)
            .limit(4000)
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
    if (
        "RSI" not in df.columns
        or "SMA_50" not in df.columns
        or "EMA_7" not in df.columns
        or "ADX" not in df.columns
        or "close" not in df.columns
    ):
        logger.error("Required columns for entry signal are missing")
        return

    close = df["close"].iloc[-1]
    sma_50 = df["SMA_50"].iloc[-1]
    ema_7 = df["EMA_7"].iloc[-1]
    rsi_val = df["RSI"].iloc[-1]
    adx_val = df["ADX"].iloc[-1]

    if close > sma_50 and close > ema_7 and rsi_val > adx_val:
        logger.info("Entry signal met: Close > SMA_50, Close > EMA_7, RSI > ADX")
        logger.info(f" latest candle: {df.iloc[-1]}")

        # get the current ticks
        current_ticks = ticks.find_one(
            {"symbol": candleSymbol}, sort=[("date", pymongo.DESCENDING)]
        )
        if current_ticks is None:
            logger.error("No current ticks found")
            return

        EntryPrice = float(current_ticks["close"])

        singal = {
            "Signal": "BUY",
            "EntryPrice": EntryPrice,
            "Strategy": STRATEGY,
            "Symbol": SYMBOL,
            "ADX": adx_val,
            "RSI": rsi_val,
            "SMA_50": sma_50,
            "EMA_7": ema_7,
            "Qty": QTY,
            "EntryTime": datetime.now(timezone.utc),
            "Status": "open",
        }

        return singal

    else:
        logger.info(
            "Entry signal not met: Close <= SMA_50 or Close <= EMA_7 or RSI <= ADX"
        )
        logger.info(f"Close: {close}, SMA_50: {sma_50}, EMA_7: {ema_7}, RSI: {rsi_val}, ADX: {adx_val}")
        logger.info(f" latest candle: {df.iloc[-1]}")

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
            "Qty": QTY,
            "ADX": signal["ADX"],
            "RSI": signal["RSI"],
            "SMA_50": signal["SMA_50"],
            "EMA_7": signal["EMA_7"],
            "EntryTime": datetime.now(timezone.utc),
            "Status": "Open",
            "UpdateTime": 0,
        }

        position_collection.insert_one(pos_doc)
        return pos_doc

    except Exception as e:
        logger.error(f"Error executing trade: {str(e)}")
        logger.error(traceback.format_exc())


def exit_open_positions(df: pd.DataFrame):
    """
    Exit all open positions for the given strategy and symbol.
    This function should be implemented to close positions in your trading system.
    """
    try:
        open_positions = list(
            position_collection.find({"Status": "Open", "Symbol": SYMBOL})
        )
        if not open_positions:
            logger.info("No open positions to exit.")
            return

        for position in open_positions:
            exit_condition = df.iloc[-1]["RSI"] <= df.iloc[-1]["ADX"]
            if not exit_condition:
                logger.info("Exit condition not met.")
                return

            position_id = position["_id"]
            exit_price = df.iloc[-1]["close"]
            pnl = exit_price - position["EntryPrice"]
            exit_time = datetime.now(timezone.utc)
            position["ExitPrice"] = exit_price
            position["ExitTime"] = exit_time
            position["Status"] = "Closed"
            position["Pnl"] = pnl

            exit_side = "SELL" if position["Side"] == "BUY" else "BUY"
            exit_doc = {
                "Strategy": STRATEGY,
                "ID": position["ID"],
                "Symbol": position["Symbol"],
                "Side": exit_side,
                "Price": exit_price,
                "Qty": position["qty"],
                "OrderTime": datetime.now(timezone.utc),
                "OrderType": "Market",
                "Status": "Closed",
                "UpdateTime": 0,
                "Users": {},
            }

            # Update the position status to closed
            position_collection.update_one({"_id": position["_id"]}, {"$set": position})
            # Log the exit action
            logger.info(f"Exited position: {exit_doc}")

    except Exception as e:
        logger.error(f"Error exiting open positions: {str(e)}")
        logger.error(traceback.format_exc())


def main():
    """
    Main Function to run strategy
    """
    df = fetch_historical_data(TIMEFRAME)
    if df is None:
        logger.error("No data returned from fetch_historical_data")
        return

    df = atr_calculation(df, ATR_PERIOD)
    df = sma(df, SMA_PERIOD)
    df = ema(df, EMA_PERIOD)
    df = rsi(df, RSI_LENGTH)
    df = adx(df, DI_LENGTH, ADX_SMOOTHING)
    df.round(2)
    
    if df.empty:
        logger.error("No valid data after applying indicators")
        return


    # check is there is an entry signal is running or not

    open_positions = list(
        position_collection.find({"Status": "Open", "Symbol": SYMBOL})
    )
    if len(open_positions) > 0:
        logger.info("There is an open position, skipping entry signal check.")
        exit_open_positions(df=df)
        time.sleep(60)

        return

    check_signal = check_entry_signal(df)
    if check_signal:
        logger.info("latest candle: \n%s", df.iloc[-1])
        logger.info("second latest candle: \n%s", df.iloc[-2])
        logger.info("third latest candle: \n%s", df.iloc[-3])
        logger.info(f"Entry signal generated: {check_signal}")
        execute_trade(check_signal)

    else:
        logger.info("No entry signal generated at this time.")


if __name__ == "__main__":
    load_dotenv(override=True)

    MONGO_URL = os.getenv("MONGO_URL")
    if not MONGO_URL:
        raise ValueError("MONGO_URL environment variable is not set")


    # Connect to MongoDB
    client = pymongo.MongoClient(MONGO_URL)
    db = client["CryptoSniper"]
    position_collection = db["position_2"]
    trade_collection = db["trades_2"]
    candles = db["candleData"]
    ticks = db["ticks"]

    STRATEGY = "Bit_Bounce_test"
    SYMBOL = "BTC-USDT"
    candleSymbol = "BTCUSDT"

    # Setup logger
    logs_dir = "/home/ubuntu/cryptocode/logs"
    logger = setup_logger(STRATEGY, logs_dir)

    ## strategy setup

    TF = 15
    TIMEFRAME = f"{TF}min"  # 15min
    SMA_PERIOD = 50
    EMA_PERIOD = 7
    RSI_LENGTH = 2
    ADX_LENGTH = 2
    ATR_PERIOD = 2
    DI_LENGTH = 2
    ADX_SMOOTHING = 2
    QTY = 0.01

    logger.info(
        f"Starting {STRATEGY} strategy for {SYMBOL} with timeframe {TIMEFRAME}, SMA period {SMA_PERIOD}, EMA period {EMA_PERIOD}, RSI length {RSI_LENGTH}, ADX length {ADX_LENGTH}, ATR period {ATR_PERIOD}, DI length {DI_LENGTH}, ADX smoothing {ADX_SMOOTHING}, and quantity {QTY}"
    )

    while True:
        dt = datetime.now(timezone.utc)
        logger.info(dt)
        hours = dt.hour
        minutes = dt.minute
        if minutes % 15 == 0:
            main()
            time.sleep(60)
        else:
            time.sleep(30)

        