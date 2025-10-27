import os
import traceback
import warnings
import time
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import numpy as np
import pandas as pd
import pymongo
import logging
from logging.handlers import RotatingFileHandler

# Load environment variables
load_dotenv()

# Strategy configuration
STRATEGY = "pankaj_ETH"
SYMBOL = "ETHUSDT"  # "BTCUSDT"
TF = 5  # 5-minute timeframe
TF_MINUTES = TF - 1
TF_SECONDS = 59
TIMEFRAME = f"{TF}min"

# Risk management parameters
RISK_AMOUNT = 100  # Amount willing to risk per trade in USD
MAX_DAILY_LOSS = 500  # Maximum daily loss in USD
ACCOUNT_BALANCE = 10000  # Account balance in USD

# Strategy Parameters - Configurable
PATTERN_PERCENTAGE = 0.3  # Minimum percentage change for consecutive candle pattern
SMA_DISTANCE_PERCENTAGE = 0.5  # Minimum distance from SMA200 as percentage
STOPLOSS_BUFFER_PERCENTAGE = 0.1  # Buffer percentage for stoploss
RISK_REWARD_RATIO = 3.0  # Target is 3x the stoploss distance
TRAIL_RATIO = 2.0  # Trail point is 2x the stoploss distance
TARGET_RATIO_FINAL = 5.0  # Final target is 5x the stoploss distance
EXIT_1_PERCENTAGE = 50  # Percentage of position to exit at first target (50% default)

# Indicator parameters
SMA_PERIOD = 200  # SMA period


# MongoDB setup
# MONGO_URL = os.environ.get("MONGO_URL")
MONGO_URL = "mongodb+srv://vipinpal7060:gEfl55JVEWDCZum1@cluster0.fg30pmw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
client = pymongo.MongoClient(MONGO_URL)
db = client["CryptoSniper"]
candles = db["candleData"]
ticks = db["ticks"]
candleSymbol = SYMBOL
trade_collection = db["trades"]
position_collection = db["position"]


warnings.simplefilter(action="ignore", category=FutureWarning)
warnings.filterwarnings("ignore")


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


def round_numeric_values(value):
    """
    Round numeric values to 2 decimal places for MongoDB storage.
    Handles numpy types, floats, and nested dictionaries/lists.

    Args:
        value: The value to round

    Returns:
        Rounded value if numeric, otherwise original value
    """
    if isinstance(value, (float, np.float64, np.float32)):
        return round(float(value), 2)
    elif isinstance(value, (int, np.int64, np.int32)):
        return value  # Don't round integers
    elif isinstance(value, dict):
        return {k: round_numeric_values(v) for k, v in value.items()}
    elif isinstance(value, list):
        return [round_numeric_values(item) for item in value]
    else:
        return value


def calculate_supertrend(df, atr_period=10, factor=3):
    """Calculate SuperTrend indicator."""
    # Calculate ATR
    df["tr0"] = abs(df["high"] - df["low"])
    df["tr1"] = abs(df["high"] - df["close"].shift())
    df["tr2"] = abs(df["close"].shift() - df["low"])
    df["tr"] = df[["tr0", "tr1", "tr2"]].max(axis=1)
    df["atr"] = df["tr"].ewm(alpha=1 / atr_period, min_periods=1).mean()

    # Calculate SuperTrend
    df["hl2"] = (df["high"] + df["low"]) / 2
    df["basic_ub"] = df["hl2"] + (factor * df["atr"])
    df["basic_lb"] = df["hl2"] - (factor * df["atr"])

    # Initialize Supertrend columns
    df["final_ub"] = 0.00
    df["final_lb"] = 0.00
    df["supertrend"] = 0.00
    df["supertrend_direction"] = 1  # 1 for uptrend, -1 for downtrend

    for i in range(len(df)):
        if i == 0:
            df.loc[df.index[i], "final_ub"] = df.loc[df.index[i], "basic_ub"]
            df.loc[df.index[i], "final_lb"] = df.loc[df.index[i], "basic_lb"]
            df.loc[df.index[i], "supertrend"] = df.loc[df.index[i], "final_ub"]
            continue

        # Calculate Final Upper Band
        if (
            df.loc[df.index[i], "basic_ub"] < df.loc[df.index[i - 1], "final_ub"]
            or df.loc[df.index[i - 1], "close"] > df.loc[df.index[i - 1], "final_ub"]
        ):
            df.loc[df.index[i], "final_ub"] = df.loc[df.index[i], "basic_ub"]
        else:
            df.loc[df.index[i], "final_ub"] = df.loc[df.index[i - 1], "final_ub"]

        # Calculate Final Lower Band
        if (
            df.loc[df.index[i], "basic_lb"] > df.loc[df.index[i - 1], "final_lb"]
            or df.loc[df.index[i - 1], "close"] < df.loc[df.index[i - 1], "final_lb"]
        ):
            df.loc[df.index[i], "final_lb"] = df.loc[df.index[i], "basic_lb"]
        else:
            df.loc[df.index[i], "final_lb"] = df.loc[df.index[i - 1], "final_lb"]

        # Calculate Supertrend
        if (
            df.loc[df.index[i - 1], "supertrend"] == df.loc[df.index[i - 1], "final_ub"]
            and df.loc[df.index[i], "close"] <= df.loc[df.index[i], "final_ub"]
        ):
            df.loc[df.index[i], "supertrend"] = df.loc[df.index[i], "final_ub"]
            df.loc[df.index[i], "supertrend_direction"] = 1
        elif (
            df.loc[df.index[i - 1], "supertrend"] == df.loc[df.index[i - 1], "final_ub"]
            and df.loc[df.index[i], "close"] > df.loc[df.index[i], "final_ub"]
        ):
            df.loc[df.index[i], "supertrend"] = df.loc[df.index[i], "final_lb"]
            df.loc[df.index[i], "supertrend_direction"] = -1
        elif (
            df.loc[df.index[i - 1], "supertrend"] == df.loc[df.index[i - 1], "final_lb"]
            and df.loc[df.index[i], "close"] >= df.loc[df.index[i], "final_lb"]
        ):
            df.loc[df.index[i], "supertrend"] = df.loc[df.index[i], "final_lb"]
            df.loc[df.index[i], "supertrend_direction"] = -1
        elif (
            df.loc[df.index[i - 1], "supertrend"] == df.loc[df.index[i - 1], "final_lb"]
            and df.loc[df.index[i], "close"] < df.loc[df.index[i], "final_lb"]
        ):
            df.loc[df.index[i], "supertrend"] = df.loc[df.index[i], "final_ub"]
            df.loc[df.index[i], "supertrend_direction"] = 1

    return df


def calculate_sma(df, period=200):
    """Calculate Simple Moving Average (SMA) for the specified period."""
    df[f"SMA{period}"] = df["close"].rolling(window=period).mean().round(2)
    return df


def fetch_historical_data(timeframe, max_retries=3, retry_delay=5):
    """
    Fetch historical data from MongoDB with retry logic.

    Args:
        timeframe (str): The time frame of the data to fetch.
        max_retries (int): Maximum number of retry attempts
        retry_delay (int): Delay between retries in seconds

    Returns:
        pd.DataFrame or None: The fetched and cleaned data, or None if an error occurred.
    """
    retry_count = 0

    while retry_count <= max_retries:
        try:
            now = datetime.now(tz=timezone.utc)
            rounded = now.replace(
                second=0, microsecond=0, minute=(now.minute // TF) * TF
            )
            last_complete = rounded - timedelta(minutes=TF)

            # Connect to MongoDB with a timeout
            client = pymongo.MongoClient(MONGO_URL, serverSelectionTimeoutMS=10000)
            db = client["CryptoSniper"]
            candles = db["candleData"]

            # Format symbol for MongoDB query
            candleSymbol = SYMBOL

            # Fetch candle data
            logger.info(
                f"Attempting to fetch data for {candleSymbol} (Attempt {retry_count + 1}/{max_retries + 1})"
            )
            candleData = list(candles.find({"symbol": candleSymbol}, {"_id": 0}))

            if not candleData:
                logger.error("No data returned from MongoDB")
                return None

            # Convert to DataFrame
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

            candleDf["date"] = pd.to_datetime(
                candleDf["date"], utc=True, errors="coerce"
            )

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

            # Close the connection
            client.close()

            return df

        except pymongo.errors.AutoReconnect as e:  # type: ignore
            retry_count += 1
            if retry_count <= max_retries:
                logger.warning(
                    f"MongoDB connection error: {str(e)}. Retrying in {retry_delay} seconds... (Attempt {retry_count}/{max_retries})"
                )
                time.sleep(retry_delay)
            else:

                logger.error(
                    f"Failed to connect to MongoDB after {max_retries} retries: {str(e)}"
                )
                logger.error(traceback.format_exc())
                return None

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


def find_consecutive_candle_pattern(df, target_percentage=PATTERN_PERCENTAGE):
    """
    Detects patterns of consecutive red or green candles with a specified total percentage change.

    Args:
            df (pd.DataFrame): DataFrame with 'open', 'close', and 'candle' columns, and a 'date' column.
            target_percentage (float): The minimum percentage change required for the pattern (e.g., 1.0 for 1%).

    Returns:
            list: A list of dictionaries, each describing a detected pattern.
                Each dictionary contains 'type' (drop/rise), 'start_index', 'end_index',
                'start_date', 'end_date', 'num_candles', 'start_price', 'end_price', 'percentage_change'.
    """

    detected_patterns = []

    consecutive_candle_count = 0
    series_start_price = 0
    series_end_price = 0
    current_series_type = None  # To store "red" or "green" for the current series
    # Initializing these to None or 0, as they will be properly set when a series begins
    series_start_index = -1
    series_end_index = -1

    for i in range(len(df)):
        # Determine candle type based on close vs open
        if df["close"].iloc[i] > df["open"].iloc[i]:
            current_candle_type = "green"
        else:
            current_candle_type = "red"

        current_open = df["open"].iloc[i]
        current_close = df["close"].iloc[i]
        current_date = df["date"].iloc[i]

        # Check if this candle continues the current series
        if current_candle_type == current_series_type:
            consecutive_candle_count += 1
            series_end_price = current_close
            series_end_index = i  # Update end index for the ongoing series
        else:
            # Series is broken or starting a new one
            # First, check if the previous series met the criteria
            if consecutive_candle_count > 0 and series_start_price != 0:
                # Calculate percentage change for the COMPLETED series
                if current_series_type == "red":
                    percentage_change = (
                        (series_start_price - series_end_price) / series_start_price
                    ) * 100
                    pattern_type = "drop"
                elif current_series_type == "green":
                    percentage_change = (
                        (series_end_price - series_start_price) / series_start_price
                    ) * 100
                    pattern_type = "rise"
                else:
                    percentage_change = (
                        0  # Should not happen if current_series_type is set
                    )
                    pattern_type = "unknown"

                if percentage_change >= target_percentage:
                    detected_patterns.append(
                        {
                            "type": pattern_type,
                            "start_index": series_start_index,
                            "start_date": df["date"].iloc[series_start_index],
                            "end_index": series_end_index,
                            "end_date": df["date"].iloc[series_end_index],
                            "num_candles": consecutive_candle_count,
                            "start_price": series_start_price,
                            "end_price": series_end_price,
                            "percentage_change": percentage_change,
                        }
                    )

            # Reset for the new series starting with the current candle
            consecutive_candle_count = 1
            series_start_price = current_open
            current_series_type = current_candle_type
            series_end_price = current_close  # Initialize end price for the new series
            series_start_index = i
            series_end_index = i  # The end index for a new single candle series is also its start index

    # After the loop, check if the last series in the DataFrame met the criteria
    if consecutive_candle_count > 0 and series_start_price != 0:
        if current_series_type == "red":
            percentage_change = (
                (series_start_price - series_end_price) / series_start_price
            ) * 100
            pattern_type = "drop"
        elif current_series_type == "green":
            percentage_change = (
                (series_end_price - series_start_price) / series_start_price
            ) * 100
            pattern_type = "rise"
        else:
            percentage_change = 0
            pattern_type = "unknown"

        if percentage_change >= target_percentage:
            detected_patterns.append(
                {
                    "type": pattern_type,
                    "start_index": series_start_index,
                    "start_date": df["date"].iloc[series_start_index],
                    "end_index": series_end_index,
                    "end_date": df["date"].iloc[series_end_index],
                    "num_candles": consecutive_candle_count,
                    "start_price": series_start_price,
                    "end_price": series_end_price,
                    "percentage_change": percentage_change,
                }
            )

    return detected_patterns


def check_entry_signal(df):
    """
    Check for entry signals based on pattern detection and confirmation.

    Args:
        df (pd.DataFrame): DataFrame with price data and indicators

    Returns:
        dict or None: Signal details if entry signal is detected, None otherwise
    """
    # Initialize logger
    logger = logging.getLogger(STRATEGY)
    # Calculate candle colors based on close vs open
    df = df.reset_index()
    df["candle"] = np.where(df["close"] > df["open"], "green", "red")

    # Look at only the most recent candles (last 50 candles should be enough)
    recent_df = df.iloc[-50:].copy()

    # Find consecutive candle patterns in recent candles
    patterns = find_consecutive_candle_pattern(
        recent_df, target_percentage=PATTERN_PERCENTAGE
    )

    if not patterns:
        logger.info(
            f"No consecutive candle patterns found meeting the {PATTERN_PERCENTAGE}% criteria in recent candles."
        )
        return None

    logger.info(f"Recent patterns: {patterns}")

    # Get the latest pattern
    pattern = patterns[-1]

    # Check if the pattern is recent (ended in the last 3 candles)
    latest_idx = len(recent_df) - 1
    if latest_idx - pattern["end_index"] > 2:
        logger.info(
            f"Pattern found but not recent enough. Pattern {pattern}, Latest candle: {recent_df['date'].iloc[-1]}"
        )
        return None

    logger.info(f"Recent pattern found: {pattern}")

    # Check for entry confirmation
    if pattern["type"] == "drop":  # Buy setup
        # Check if the next candle after pattern end confirms entry
        if pattern["end_index"] + 1 <= len(recent_df):
            # For buy setup, we need a green candle after the drop pattern
            next_candle_idx = pattern["end_index"] + 1

            # Check if we have a green candle after the pattern
            if recent_df["candle"].iloc[next_candle_idx] == "green":
                # Check SMA200 distance condition - low of the last candle should be at least SMA_DISTANCE_PERCENTAGE% away from SMA200
                if "SMA200" in recent_df.columns:
                    sma_value = recent_df["SMA200"].iloc[next_candle_idx]
                    if not pd.isna(sma_value):
                        # Calculate distance from SMA200 as percentage
                        low_price = recent_df["low"].iloc[next_candle_idx]
                        sma_distance_pct = abs(((low_price / sma_value) - 1) * 100)

                        if sma_distance_pct < SMA_DISTANCE_PERCENTAGE:
                            logger.info(
                                f"Buy setup rejected: Last candle low ({low_price}) is only {sma_distance_pct:.2f}% away from SMA200 ({sma_value}), minimum required: {SMA_DISTANCE_PERCENTAGE}%"
                            )
                            return None

                        logger.info(
                            f"SMA200 distance check passed: {sma_distance_pct:.2f}% > {SMA_DISTANCE_PERCENTAGE}%"
                        )
                    else:
                        logger.warning(
                            "SMA200 value is NaN, skipping SMA distance check"
                        )
                else:
                    logger.warning("SMA200 not calculated, skipping SMA distance check")

                # Check if the green candle closes above the high of the previous candle
                if next_candle_idx + 1 < len(recent_df):
                    # Entry on the close of the green candle
                    EntryPrice = recent_df["close"].iloc[next_candle_idx]
                    EntryTime = recent_df["date"].iloc[next_candle_idx] + timedelta(
                        minutes=TF_MINUTES, seconds=TF_SECONDS
                    )  # Set to XX:55:02

                    # Calculate stoploss with buffer percentage
                    last_red_candle_idx = pattern["end_index"]
                    green_candle_low = recent_df["low"].iloc[next_candle_idx]
                    last_red_candle_low = recent_df["low"].iloc[last_red_candle_idx]

                    # Take the lowest of the green candle and last red candle, then apply buffer
                    lowest_point = min(green_candle_low, last_red_candle_low)
                    buffer_amount = lowest_point * (STOPLOSS_BUFFER_PERCENTAGE / 100)
                    StopLoss = lowest_point - buffer_amount

                    StopLossPoint = abs(EntryPrice - StopLoss)
                    TargetPoint = StopLossPoint * RISK_REWARD_RATIO
                    TrailPoint = StopLossPoint * TRAIL_RATIO
                    Target1 = EntryPrice + TargetPoint  # First target (3x stoploss)
                    Target2 = EntryPrice + (
                        StopLossPoint * TARGET_RATIO_FINAL
                    )  # Second target (5x stoploss)

                    logger.info(
                        f"Buy Signal: EntryPrice={EntryPrice:.2f}, EntryTime={EntryTime}, StopLoss={StopLoss:.2f}, Target1={Target1:.2f}, Target2={Target2:.2f}"
                    )

                    return {
                        "Side": "Buy",
                        "EntryPrice": EntryPrice,
                        "EntryTime": EntryTime,
                        "StopLoss": StopLoss,
                        "Target1": Target1,
                        "Target2": Target2,
                        "TrailPoint": TrailPoint,
                        "PatternType": pattern["type"].capitalize(),
                        "PatternStartDate": pattern["start_date"],
                        "PatternEndDate": pattern["end_date"],
                        "StopLossPoint": StopLossPoint,
                        "TargetPoint": TargetPoint,
                        "Exit1Percentage": EXIT_1_PERCENTAGE,
                    }

    elif pattern["type"] == "rise":  # Sell setup
        # Check if the next candle after pattern end confirms entry
        if pattern["end_index"] + 1 <= len(recent_df):
            # For sell setup, we need a red candle after the rise pattern
            next_candle_idx = pattern["end_index"] + 1

            # Check if we have a red candle after the pattern
            if recent_df["candle"].iloc[next_candle_idx] == "red":
                # Check SMA200 distance condition - high of the last candle should be at least SMA_DISTANCE_PERCENTAGE% away from SMA200
                if "SMA200" in recent_df.columns:
                    sma_value = recent_df["SMA200"].iloc[next_candle_idx]
                    if not pd.isna(sma_value):
                        # Calculate distance from SMA200 as percentage
                        high_price = recent_df["high"].iloc[next_candle_idx]
                        sma_distance_pct = abs(((high_price / sma_value) - 1) * 100)

                        if sma_distance_pct < SMA_DISTANCE_PERCENTAGE:
                            logger.info(
                                f"Sell setup rejected: Last candle high ({high_price}) is only {sma_distance_pct:.2f}% away from SMA200 ({sma_value}), minimum required: {SMA_DISTANCE_PERCENTAGE}%"
                            )
                            return None

                        logger.info(
                            f"SMA200 distance check passed: {sma_distance_pct:.2f}% > {SMA_DISTANCE_PERCENTAGE}%"
                        )
                    else:
                        logger.warning(
                            "SMA200 value is NaN, skipping SMA distance check"
                        )
                else:
                    logger.warning("SMA200 not calculated, skipping SMA distance check")

                # Entry on the close of the red candle
                EntryPrice = recent_df["close"].iloc[next_candle_idx]
                EntryTime = recent_df["date"].iloc[next_candle_idx] + timedelta(
                    minutes=TF_MINUTES, seconds=TF_SECONDS
                )  # Set to XX:55:02

                # Calculate stoploss with buffer percentage
                last_green_candle_idx = pattern["end_index"]
                red_candle_high = recent_df["high"].iloc[next_candle_idx]
                last_green_candle_high = recent_df["high"].iloc[last_green_candle_idx]

                # Take the highest of the red candle and last green candle, then apply buffer
                highest_point = max(red_candle_high, last_green_candle_high)
                buffer_amount = highest_point * (STOPLOSS_BUFFER_PERCENTAGE / 100)
                StopLoss = highest_point + buffer_amount

                StopLossPoint = abs(EntryPrice - StopLoss)
                TargetPoint = StopLossPoint * RISK_REWARD_RATIO
                TrailPoint = StopLossPoint * TRAIL_RATIO
                Target1 = EntryPrice - TargetPoint  # First target (3x stoploss)
                Target2 = EntryPrice - (
                    StopLossPoint * TARGET_RATIO_FINAL
                )  # Second target (5x stoploss)

                logger.info(
                    f"Sell Signal: EntryPrice={EntryPrice:.2f}, EntryTime={EntryTime}, StopLoss={StopLoss:.2f}, Target1={Target1:.2f}, Target2={Target2:.2f}"
                )

                return {
                    "Side": "Sell",
                    "EntryPrice": EntryPrice,
                    "EntryTime": EntryTime,
                    "StopLoss": StopLoss,
                    "Target1": Target1,
                    "Target2": Target2,
                    "TrailPoint": TrailPoint,
                    "PatternType": pattern["type"].capitalize(),
                    "PatternStartDate": pattern["start_date"],
                    "PatternEndDate": pattern["end_date"],
                    "StopLossPoint": StopLossPoint,
                    "TargetPoint": TargetPoint,
                    "Exit1Percentage": EXIT_1_PERCENTAGE,
                }

    return None


def calculate_position_size(entry_price, stop_loss, risk_amount=RISK_AMOUNT):
    """
    Calculate position size based on risk amount and stop loss distance.

    Args:
        entry_price (float): Entry price of the trade
        stop_loss (float): Stop loss price of the trade
        risk_amount (float): Amount willing to risk in USD

    Returns:
        float: Position size in the base currency
    """
    stop_loss_distance = abs(entry_price - stop_loss)

    if stop_loss_distance == 0:
        logger.error("Stop loss distance is zero, cannot calculate position size")
        return 0.001  # Default minimum position size

    # Calculate position size based on risk amount and stop loss distance
    position_size = risk_amount / stop_loss_distance

    # Round to appropriate precision based on the asset
    if SYMBOL.startswith("BTC"):
        position_size = round(position_size, 6)  # 0.000001 BTC precision
    elif SYMBOL.startswith("ETH"):
        position_size = round(position_size, 5)  # 0.00001 ETH precision
    else:
        position_size = round(position_size, 4)  # 0.0001 precision for other assets

    # Ensure minimum position size
    min_size = 0.001
    if position_size < min_size:
        position_size = min_size

    # Ensure position size doesn't exceed maximum percentage of account
    max_position_size = (ACCOUNT_BALANCE * 0.5) / entry_price  # 50% max position size
    if position_size > max_position_size:
        logger.warning(
            f"Position size {position_size} exceeds max allowed ({max_position_size}), limiting to max"
        )
        position_size = max_position_size

    return position_size


def execute_trade(signal):
    """
    Execute a trade based on the generated signal.
    This function places an order in the trading system.

    Args:
        signal (dict): Signal details including Side, EntryPrice, StopLoss, Target1, Target2, etc.
    """
    try:
        if not signal:
            logger.warning("No valid signal provided to execute_trade")
            return

        # Calculate position size based on risk management
        position_size = 2.0 #calculate_position_size(
        #     signal["EntryPrice"], signal["StopLoss"]
        # )

        # Generate a unique trade ID
        trade_id = f"{STRATEGY}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"

        # Create trade document
        trade_doc = {
            "Strategy": STRATEGY,
            "ID": trade_id,
            "Type": "Entry",
            "Symbol": SYMBOL,
            "Side": signal["Side"],
            "Price": signal["EntryPrice"],
            "Qty": position_size,
            "OrderTime": signal["EntryTime"],  # Use the actual entry signal time
            "OrderType": "Market",
            "Status": "Open",
            "UpdateTime": 0,
            "RiskAmount": RISK_AMOUNT,
            "Users": {},
        }

        # Create position document with additional fields for the enhanced strategy
        position_doc = {
            "Strategy": STRATEGY,
            "ID": trade_id,
            "Symbol": SYMBOL,
            "Side": signal["Side"],
            "EntryPrice": signal["EntryPrice"],
            "EntryTime": signal["EntryTime"],  # Use the actual entry signal time
            "StopLoss": signal["StopLoss"],
            "Target1": signal["Target1"],  # First target (3x stoploss)
            "Target2": signal["Target2"],  # Second target (5x stoploss)
            "TrailPoint": signal["TrailPoint"],
            "PatternType": signal["PatternType"],
            "PatternStartDate": signal["PatternStartDate"],
            "PatternEndDate": signal["PatternEndDate"],
            "StopLossPoint": signal["StopLossPoint"],
            "TargetPoint": signal["TargetPoint"],
            "TrailHit": False,
            "Exit1Hit": False,  # Flag to track if first exit (50%) has been executed
            "Exit1Percentage": signal[
                "Exit1Percentage"
            ],  # Percentage to exit at first target
            "RemainingPercentage": 100,  # Track remaining position percentage
            "Status": "Open",
            "Qty": position_size,
            "RiskAmount": RISK_AMOUNT,
            "DailyLossTracking": 0,  # Initialize daily loss tracking
        }

        # Round numeric values before inserting into MongoDB
        trade_doc = round_numeric_values(trade_doc)
        position_doc = round_numeric_values(position_doc)

        # Insert documents into MongoDB
        trade_collection.insert_one(trade_doc)
        position_collection.insert_one(position_doc)

        # Create stoploss order document
        sl_doc = {
            "Strategy": STRATEGY,
            "ID": trade_id,
            "Type": "StopLoss",
            "Symbol": SYMBOL,
            "Side": (
                "Sell" if signal["Side"] == "Buy" else "Buy"
            ),  # Opposite side for stop loss
            "Price": signal["StopLoss"],
            "Qty": position_size,
            "OrderTime": datetime.now(timezone.utc),
            "OrderType": "Stop",
            "Status": "Open",
            "UpdateTime": 0,
            "ParentID": trade_id,
            "Users": {},
        }

        # Round numeric values before inserting into MongoDB
        sl_doc = round_numeric_values(sl_doc)

        # Insert stoploss order into MongoDB
        trade_collection.insert_one(sl_doc)

        logger.info(f"Trade executed: {trade_doc}")
        logger.info(f"Position opened: {position_doc}")
        logger.info(f"Stop loss order placed: {sl_doc}")

    except Exception as e:
        logger.error(f"Error executing trade: {str(e)}")
        logger.error(traceback.format_exc())



def exit_open_positions():
    """
    Check and exit open positions based on stop loss, trail stop, target conditions, or session end time.
    Implements partial exit at 3x stoploss point (Target1) and final exit at 5x stoploss point (Target2).
    """
    try:
        # Get all open positions

        ## Ticks
        ticker = get_ticker()
        current_price = float(ticker["close"])
        open_positions = position_collection.find(
            {"Strategy": STRATEGY, "Status": "Open"}
        )
        daily_loss = 0

        for position in open_positions:
            side = position["Side"]
            entry_price = position["EntryPrice"]
            stop_loss = position["StopLoss"]
            target1 = position["Target1"]  # 3x stoploss target
            target2 = position["Target2"]  # 5x stoploss target
            trail_point = position["TrailPoint"]
            trail_hit = position["TrailHit"]
            exit1_hit = position.get(
                "Exit1Hit", False
            )  # Check if first partial exit has been executed
            exit1_percentage = position.get(
                "Exit1Percentage", 50
            )  # Default to 50% if not specified
            remaining_percentage = position.get(
                "RemainingPercentage", 100
            )  # Default to 100% if not specified
            position_qty = position["Qty"]
            risk_amount = position.get(
                "RiskAmount", RISK_AMOUNT
            )  # Use default if not in position doc

            # Get the latest candle
            latest_candle = ticker
            current_price = float(latest_candle["close"])
            current_high = float(latest_candle["high"])
            current_low = float(latest_candle["low"])

            # Variables to track exit conditions
            exit_condition_met = False
            exit_type = ""
            exit_price = 0
            exit_percentage = 0

            if side == "Buy":
                # Check if stop loss is hit (using low price for buy positions)
                if current_price <= stop_loss or current_low <= stop_loss:
                    
                    exit_type = "StopLoss"
                    exit_price = stop_loss
                    exit_percentage = (
                        remaining_percentage  # Exit all remaining position
                    )

                    pnl = (exit_price - entry_price) * position_qty
                    pnl = round(pnl, 2)

                    trade_collection.update_one(
                        {"ID": position["ID"], "Type": "StopLoss","Status": "Open"},
                        {"$set": {"Status": "executed", "UpdateTime": datetime.now(timezone.utc)}},
                    )

                    position_collection.update_one(
                        {"_id": position["_id"]},
                        {
                            "$set": {
                                "Status": "Closed",
                                "ExitPrice": exit_price,
                                "ExitTime": datetime.now(timezone.utc),
                                "ExitType": exit_type,
                                "RemainingPercentage": 0,
                                "FinalPnL": pnl,
                            }
                        },
                    )

                    logger.info(
                        f"Position {position['ID']} closed with {exit_type} at price {exit_price}. PnL: {pnl}"
                    )


                ## trail stop loss at trail point movement at 1:2 
                elif current_price >= entry_price + trail_point and not trail_hit:
                    trail_hit = True
                    strail_stop_price = entry_price + 1
                    position_collection.update_one(
                        {"_id": position["_id"]},
                        {"$set": {"TrailHit": True, "StopLoss": strail_stop_price}},
                    )

                    ## cancel stoploss order from the broker and send a new stop loss order
                    trade_collection.update_one(
                        {"ID": position["ID"], "Type": "StopLoss","Status": "Open"},
                        {"$set": {"Status": "Cancelled", "UpdateTime": datetime.now(timezone.utc)}},
                    )

                    ## send new stop loss order
                    new_sl_order = {
                        "Strategy": STRATEGY,
                        "ID": position["ID"],
                        "Type": "StopLoss",
                        "Symbol": SYMBOL,
                        "Side": (
                            "Sell" if position["Side"] == "Buy" else "Buy"
                        ),  # Opposite side for stop loss
                        "Price": strail_stop_price,
                        "Qty": position_qty,
                        "OrderTime": datetime.now(timezone.utc),
                        "OrderType": "Stop",
                        "Status": "Open",
                        "UpdateTime": 0,
                        "Users": {},
                    }
                    
                    trade_collection.insert_one(new_sl_order)

                    logger.info(
                        f"Trail stop activated for position {position['ID']} at price {current_price}"
                    )

                

                # Check if first target is hit and first exit hasn't been executed yet
                elif (
                    current_price >= target1 or current_high >= target1
                ) and not exit1_hit:
                    exit_type = "Target1"
                    exit_price = target1
                    exit_percentage = (
                        exit1_percentage  # Exit specified percentage (e.g., 50%)
                    )

                    exit1_hit = True
                    ## cancel old stoploss open order

                    trade_collection.update_one(
                        {"ID": position["ID"], "Type": "StopLoss","Status": "Open"},
                        {"$set": {"Status": "Cancelled", "UpdateTime": datetime.now(timezone.utc)}},
                    )


                    ## send exit order with exit1_percentage

                    exit_qty = position_qty * (exit_percentage / 100)

                    exit_order = {
                        "Strategy": STRATEGY,
                        "ID": position["ID"],
                        "Type": "Exit1",
                        "Symbol": SYMBOL,
                        "Side": (
                            "Sell" if position["Side"] == "Buy" else "Buy"
                        ),
                        "Price": exit_price,
                        "Qty": exit_qty,
                        "OrderTime": datetime.now(timezone.utc),
                        "OrderType": "Stop",
                        "Status": "Open",
                        "UpdateTime": 0,
                        "Users": {},
                    }

                    trade_collection.insert_one(exit_order)

                    ## send new stop loss order with remaining qty
                    new_sl_order = {
                        "Strategy": STRATEGY,
                        "ID": position["ID"],
                        "Type": "StopLoss",
                        "Symbol": SYMBOL,
                        "Side": (
                            "Sell" if position["Side"] == "Buy" else "Buy"
                        ),
                        "Price": stop_loss,
                        "Qty": position_qty - exit_qty,
                        "OrderTime": datetime.now(timezone.utc),
                        "OrderType": "Stop",
                        "Status": "Open",
                        "UpdateTime": 0,
                        "Users": {},
                    }

                    trade_collection.insert_one(new_sl_order)
                    
                    # Update position to mark Exit1Hit as true and reduce remaining percentage
                    position_collection.update_one(
                        {"_id": position["_id"]},
                        {"$set": {
                            "Exit1Hit": True,
                            "RemainingPercentage": remaining_percentage - exit1_percentage,
                            "PartialExitPrice": exit_price,
                            "PartialExitTime": datetime.now(timezone.utc),
                        }},
                        upsert=True

                    )

                # Check if second target is hit and we still have remaining position
                elif (
                    (current_price >= target2 or current_high >= target2)
                    and remaining_percentage > 0
                ):
                
                    exit_type = "Target2"
                    exit_price = target2
                    
                    # Round the values
                    position_qty = position["Qty"]
                    remaining_percentage = position["RemainingPercentage"]
                    exit_qty = position_qty * (remaining_percentage / 100)
                    exit_qty = round(exit_qty, 2)
                    exit_price_rounded = round(exit_price, 2)
                    pnl = (exit_price - entry_price) * position_qty
                    pnl_rounded = round(pnl, 2)

                    ## cancel stoploss order from the broker and send a new stop loss order with the remaing qty
                    trade_collection.update_one(
                        {"ID": position["ID"], "Type": "StopLoss","Status": "Open"},
                        {"$set": {"Status": "Cancelled", "UpdateTime": datetime.now(timezone.utc)}},
                    )

                    ## send new exit order
                    exit_order = {
                        "Strategy": STRATEGY,
                        "ID": position["ID"],
                        "Type": "Exit2",
                        "Symbol": SYMBOL,
                        "Side": (
                            "Sell" if position["Side"] == "Buy" else "Buy"
                        ),
                        "Price": exit_price_rounded,
                        "Qty": exit_qty,
                        "OrderTime": datetime.now(timezone.utc),
                        "OrderType": "Market",
                        "Status": "Open",
                        "UpdateTime": 0,
                        "Users": {},
                    }
                        
                    # Round numeric values before inserting into MongoDB
                    exit_order = round_numeric_values(exit_order)

                    # Insert exit trade into MongoDB
                    trade_collection.insert_one(exit_order)


                    position_collection.update_one(
                        {"_id": position["_id"]},
                        {
                            "$set": {
                                "Status": "Closed",
                                "ExitPrice": exit_price_rounded,
                                "ExitTime": datetime.now(timezone.utc),
                                "ExitType": exit_type,
                                "RemainingPercentage": 0,
                                "FinalPnL": pnl_rounded,
                            }
                        },
                        upsert=True
                    )
                    logger.info(
                        f"Position {position['ID']} closed with {exit_type} at price {exit_price}. PnL: {pnl}"
                    )

            elif side == "Sell":
                # Check if stop loss is hit (using high price for sell positions)
                if current_price >= stop_loss or current_high >= stop_loss :
                    exit_type = "StopLoss"
                    exit_price = stop_loss
                    exit_percentage = (
                        remaining_percentage  # Exit all remaining position
                    )

                    pnl = (entry_price - exit_price) * position_qty
                    pnl = round(pnl, 2)

                    trade_collection.update_one(
                        {"ID": position["ID"], "Type": "StopLoss","Status": "Open"},
                        {"$set": {"Status": "executed", "UpdateTime": datetime.now(timezone.utc)}},
                    )

                    position_collection.update_one(
                        {"_id": position["_id"]},
                        {
                            "$set": {
                                "Status": "Closed",
                                "ExitPrice": exit_price,
                                "ExitTime": datetime.now(timezone.utc),
                                "ExitType": exit_type,
                                "RemainingPercentage": 0,
                                "FinalPnL": pnl,
                            }
                        },
                    )

                    logger.info(
                        f"Position {position['ID']} closed with {exit_type} at price {exit_price}. PnL: {pnl}"
                    )


                ## trail stop loss at trail point movement at 1:2 
                elif current_price >= entry_price - trail_point and not trail_hit:
                    trail_hit = True
                    strail_stop_price = entry_price - 1
                    position_collection.update_one(
                        {"_id": position["_id"]},
                        {"$set": {"TrailHit": True, "StopLoss": strail_stop_price}},
                    )

                    ## cancel stoploss order from the broker and send a new stop loss order
                    trade_collection.update_one(
                        {"ID": position["ID"], "Type": "StopLoss","Status": "Open"},
                        {"$set": {"Status": "Cancelled", "UpdateTime": datetime.now(timezone.utc)}},
                    )

                    ## send new stop loss order
                    new_sl_order = {
                        "Strategy": STRATEGY,
                        "ID": position["ID"],
                        "Type": "StopLoss",
                        "Symbol": SYMBOL,
                        "Side": (
                            "Sell" if position["Side"] == "Buy" else "Buy"
                        ),  # Opposite side for stop loss
                        "Price": strail_stop_price,
                        "Qty": position_qty,
                        "OrderTime": datetime.now(timezone.utc),
                        "OrderType": "Stop",
                        "Status": "Open",
                        "UpdateTime": 0,
                        "Users": {},
                    }
                    
                    trade_collection.insert_one(new_sl_order)

                    logger.info(
                        f"Trail stop activated for position {position['ID']} at price {current_price}"
                    )


                # Check if first target is hit and first exit hasn't been executed yet
                elif (
                    current_price <= target1 or current_low <= target1
                ) and not exit1_hit:
                    exit_type = "Target1"
                    exit_price = target1
                    exit_percentage = (
                        exit1_percentage  # Exit specified percentage (e.g., 50%)
                    )

                    exit1_hit = True
                    ## cancel old stoploss open order

                    trade_collection.update_one(
                        {"ID": position["ID"], "Type": "StopLoss","Status": "Open"},
                        {"$set": {"Status": "Cancelled", "UpdateTime": datetime.now(timezone.utc)}},
                    )


                    ## send exit order with exit1_percentage

                    exit_qty = position_qty * (exit_percentage / 100)

                    exit_order = {
                        "Strategy": STRATEGY,
                        "ID": position["ID"],
                        "Type": "Exit1",
                        "Symbol": SYMBOL,
                        "Side": (
                            "Sell" if position["Side"] == "Buy" else "Buy"
                        ),
                        "Price": exit_price,
                        "Qty": exit_qty,
                        "OrderTime": datetime.now(timezone.utc),
                        "OrderType": "Stop",
                        "Status": "Open",
                        "UpdateTime": 0,
                        "Users": {},
                    }

                    trade_collection.insert_one(exit_order)

                    ## send new stop loss order with remaining qty
                    new_sl_order = {
                        "Strategy": STRATEGY,
                        "ID": position["ID"],
                        "Type": "StopLoss",
                        "Symbol": SYMBOL,
                        "Side": (
                            "Sell" if position["Side"] == "Buy" else "Buy"
                        ),
                        "Price": stop_loss,
                        "Qty": position_qty - exit_qty,
                        "OrderTime": datetime.now(timezone.utc),
                        "OrderType": "Stop",
                        "Status": "Open",
                        "UpdateTime": 0,
                        "Users": {},
                    }

                    trade_collection.insert_one(new_sl_order)

                    # Update position to mark Exit1Hit as true and reduce remaining percentage
                    position_collection.update_one(
                        {"_id": position["_id"]},
                        {"$set": {
                            "Exit1Hit": True,
                            "RemainingPercentage": remaining_percentage - exit1_percentage,
                            "PartialExitPrice": exit_price,
                            "PartialExitTime": datetime.now(timezone.utc),
                        }},
                        upsert=True
                    )

                
                # Check if second target is hit and we still have remaining position
                elif (
                    (current_price <= target2 or current_low <= target2)
                    and remaining_percentage > 0
                ):
                    exit_type = "Target2"
                    exit_price = target2
                    
                    # Round the values
                    position_qty = position["Qty"]
                    remaining_percentage = position["RemainingPercentage"]
                    exit_qty = position_qty * (remaining_percentage / 100)
                    exit_qty = round(exit_qty, 2)
                    exit_price_rounded = round(exit_price, 2)
                    pnl = (entry_price - exit_price) * position_qty
                    pnl_rounded = round(pnl, 2)

                    ## cancel stoploss order from the broker and send a new stop loss order with the remaing qty
                    trade_collection.update_one(
                        {"ID": position["ID"], "Type": "StopLoss","Status": "Open"},
                        {"$set": {"Status": "Cancelled", "UpdateTime": datetime.now(timezone.utc)}},
                    )

                    ## send new exit order
                    exit_order = {
                        "Strategy": STRATEGY,
                        "ID": position["ID"],
                        "Type": "Exit2",
                        "Symbol": SYMBOL,
                        "Side": (
                            "Sell" if position["Side"] == "Buy" else "Buy"
                        ),
                        "Price": exit_price_rounded,
                        "Qty": exit_qty,
                        "OrderTime": datetime.now(timezone.utc),
                        "OrderType": "Market",
                        "Status": "Open",
                        "UpdateTime": 0,
                        "Users": {},
                    }
                        
                    # Round numeric values before inserting into MongoDB
                    exit_order = round_numeric_values(exit_order)

                    # Insert exit trade into MongoDB
                    trade_collection.insert_one(exit_order)


                    position_collection.update_one(
                        {"_id": position["_id"]},
                        {
                            "$set": {
                                "Status": "Closed",
                                "ExitPrice": exit_price_rounded,
                                "ExitTime": datetime.now(timezone.utc),
                                "ExitType": exit_type,
                                "RemainingPercentage": 0,
                                "FinalPnL": pnl_rounded,
                            }
                        },
                        upsert=True
                    )
                    logger.info(
                        f"Position {position['ID']} closed with {exit_type} at price {exit_price}. PnL: {pnl}"
                    )

    except Exception as e:
        logger.error(f"Error checking positions: {str(e)}")
        logger.error(traceback.format_exc())




def get_ticker():
    try:
        return ticks.find_one({"symbol": candleSymbol},{"_id": 0})
    except Exception as e:
        logger.error(f"Error getting ticker: {str(e)}")
        logger.error(traceback.format_exc())

    



def main():
    """
    Main Function to run strategy
    """
    try:
        logger.info(
            f"Starting {STRATEGY} strategy for {SYMBOL} on {TIMEFRAME} timeframe"
        )

        # Fetch historical data
        df = fetch_historical_data(TIMEFRAME)
        if df is None:
            logger.error("No data returned from fetch_historical_data")
            return

        # Calculate indicators
        df = calculate_sma(df, SMA_PERIOD)
        df = calculate_supertrend(df) 

        if df.empty:
            logger.error("No valid data after applying indicators")
            return

        logger.info(
            f"Latest SMA200: {df['SMA200'].iloc[-1]:.2f}, Latest price: {df['close'].iloc[-1]:.2f}"
        )

        # Skip entry signal check if we have open positions
        open_positions = list(
            position_collection.find(
                {"Strategy": STRATEGY, "Symbol": SYMBOL, "Status": "Open"}
            )
        )

        if len(open_positions) > 0:
            logger.info(
                f"Found {len(open_positions)} open position(s), skipping entry signal check"
            )
            return

        # If no open positions and we haven't exceeded max daily loss, check for entry signals
        check_signal = check_entry_signal(df)
        if check_signal:
            logger.info(f"Entry signal generated: {check_signal}")
            execute_trade(check_signal)
        else:
            logger.info("No entry signal generated at this time.")

    except Exception as e:
        logger.error(f"Error in main function: {str(e)}")
        logger.error(traceback.format_exc())




if __name__ == "__main__":
    # Setup logging
    logs_dir = "logs"
    logger = setup_logger(STRATEGY, logs_dir)
    logger.info(f"Starting {STRATEGY} strategy")
    try:
        while True:
            current_time = datetime.now(timezone.utc)

            # Check for open positions and monitor exit conditions more frequently
            open_positions = list(
                position_collection.find(
                    {"Strategy": STRATEGY,"Status": "Open"}
                )
            )

            if len(open_positions) > 0:
                # If we have open positions, check exit conditions more frequently (every 5 seconds)
                logger.info(
                    f"Checking exit conditions for {len(open_positions)} open position(s) at {current_time}"
                )
                exit_open_positions()
                # Fetch latest data
                # df = fetch_historical_data(TIMEFRAME)
                # logger.info(
                #     f"Fetching latest data for {df.iloc[-1]} on {TIMEFRAME} timeframe"
                # )
                # if df is not None:
                #     df = calculate_sma(df, SMA_PERIOD)
                    

                time.sleep(5)  # Check exit conditions every 5 seconds

            # Run full strategy logic near the end of each candle
            elif current_time.minute % TF == (TF - 1) and current_time.second > 59:
                logger.info(f"Running full strategy at {current_time}")
                main()
                time.sleep(5)  # Sleep until next candle period
            else:
                time.sleep(
                    1
                )  # Regular sleep interval when no positions and not near candle close
    except KeyboardInterrupt:
        logger.info("Strategy stopped by user")
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        logger.error(traceback.format_exc())

