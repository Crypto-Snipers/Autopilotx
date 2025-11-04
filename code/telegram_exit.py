import pymongo
from dotenv import load_dotenv
import os
import time


load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")

client = pymongo.MongoClient(MONGO_URL)
db = client["Autopilotx"]
users = db["users"]
positions = db["position"]
trades = db["trades"]
ticks = db["ticks"]

# get all running trades of telegram Status "Open"

while True:
    all_positions = list(
        positions.find({"username": {"$exists": True, "$ne": None}, "Status": "Open"})
    )

    for position in all_positions:
        print(position)
        sym = position["Symbol"].replace("-", "")
        ticker = ticks.find_one({"symbol": sym})
        if not ticker:
            print(f"No ticker found for symbol {sym}")
            continue

        current_price = float(ticker["close"])
        # print(f"Current price for {sym}: {current_price}")

        if position["Side"] == "BUY":
            if current_price <= position["StopLoss"]:
                positions.update_one(
                    {"_id": position["_id"]},
                    {
                        "$set": {
                            "ExitPrice": current_price,
                            "ExitType": "StopLoss",
                            "Status": "Closed",
                            "Pnl": position["Qty"]
                            * (current_price - position["EntryPrice"]),
                        }
                    },
                )
                print("Stop loss triggered for BUY position")

            elif current_price >= position["Target"]:
                positions.update_one(
                    {"_id": position["_id"]},
                    {
                        "$set": {
                            "ExitPrice": current_price,
                            "ExitType": "TakeProfit",
                            "Status": "Closed",
                            "Pnl": position["Qty"]
                            * (current_price - position["EntryPrice"]),
                        }
                    },
                )
                print("Take profit triggered for BUY position")

        elif position["Side"] == "SELL":
            if current_price >= position["StopLoss"]:
                positions.update_one(
                    {"_id": position["_id"]},
                    {
                        "$set": {
                            "ExitPrice": current_price,
                            "ExitType": "StopLoss",
                            "Status": "Closed",
                            "Pnl": position["Qty"]
                            * (position["EntryPrice"] - current_price),
                        }
                    },
                )
                print("Stop loss triggered for SELL position")

            elif current_price <= position["Target"]:
                positions.update_one(
                    {"_id": position["_id"]},
                    {
                        "$set": {
                            "ExitPrice": current_price,
                            "ExitType": "TakeProfit",
                            "Status": "Closed",
                            "Pnl": position["Qty"]
                            * (position["EntryPrice"] - current_price),
                        }
                    },
                )
                print("Take profit triggered for SELL position")

        else:
            print(f"Position {position['_id']} has no valid side or is already closed.")

    time.sleep(60)

