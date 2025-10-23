"""
1. strategy create a new position ( entry added into trades and position )
2. order file reads:
    2.1: read trades collection to find the strategy name and Side , Symbol & Qty 
    2.2: read user collection users using the key strategies who have deployed this strategy and broker_credentials from pandas import apifrom user document
    2.3 use user broker_credentials to create a client (CoinDcxClient) and place the order  ( https://docs.coindcx.com/#create-order )  ( ## avg_price can not be used as entry price due to getting 0 value just after order placement
 )
    2.4 store response in clientTrades collection of each 
    2.5 call list orders (https://docs.coindcx.com/#list-orders) with input: side (it coming from trades collection side key value ) , status  = 'filled'
        filter its output using the orderId as id from the above response stored in clientTrades collection and match orderId to id
    2.5.1: update cliendTrades avg_price 

"""

import pymongo
from CoinDcxClient import CoinDcxClient
import pause
from datetime import datetime, timedelta
from dotenv import load_dotenv


def check_live_positions(strategies):
    # get all strategies
    strategies = list(strategies.find({"is_active": True}))
    running_positions = []
    for strategy in strategies:
        # print(strategy)
        # get all positions
        open_positions = position.find_one({"Strategy": strategy["name"], "Status": "Open"})
        if open_positions:
            running_positions.append(open_positions)

    return running_positions


if __name__ == "__main__":

    import os
    load_dotenv()
    MONGO_URI = os.getenv("MONGO_URL")
    DB_NAME = os.getenv("MONGO_DB_NAME")

    client = pymongo.MongoClient(MONGO_URI)
    db = client[DB_NAME]
    trades = db["trades"]
    position = db["position"]
    users = db["users"]
    clientTrades = db["clientTrades"]
    strategies = db["strategies"]

    while True:

        running_positions = check_live_positions(strategies)
        print(running_positions)

        for pos in running_positions:
            print(pos)
            # # get all user of this position
            strategy = pos["Strategy"]
            all_users = list(users.find({"status":"Approved", "is_active": True, "strategies." + strategy + ".status": "active"}))
            # print(users)
            print("----------------")
            for user in all_users:
                print(user)
                user_currency = user["currency"]
                side = pos["Side"].lower()
                strategyId = pos["Strategy"]
                email = user["email"]
                print("User:", email, side, strategyId)

                # userTrades = clientTrades.find_one({"userId": email,"side": side,"strategyId": strategyId,"price": pos["EntryPrice"]},sort=[('_id', -1)] )
                userTrades = clientTrades.find_one({"userId": email, "side": side, "strategyId": strategyId, "trade_id": str(pos["ID"])}, sort=[('_id', -1)])
                print("User Trades:", userTrades)
                if not userTrades:
                    continue
                user_trades_id = userTrades.get("orderId")
                avg_price = userTrades.get("avg_price")
                if avg_price > 0.0:
                    continue
                
                # print("User Trades Id:",user_trades_id)
                # print("----------------")
                # get broker credentials
                broker_connection = user.get("broker_connection", {})
                # print("Broker Connection:", broker_connection)
                
                if broker_connection and broker_connection.get("broker_name", "").lower() == "coindcx":
                    try:
                        # create client with the broker credentials
                        client = CoinDcxClient(
                            api_key=broker_connection["api_key"],
                            secret_key=broker_connection["api_secret"]
                        )
                        print("Successfully created CoinDCX client")
                    except Exception as e:
                        print(f"Error creating CoinDCX client: {e}")
                        continue

                    # # get all orders
                    # orders = client.get_orders(pos["Symbol"], pos["Side"].lower(), pos["Qty"])
                    orders = client.get_futures_orders(
                        status='open,filled,partially_filled,partially_cancelled,cancelled,rejected,untriggered',
                        side=side,
                        margin_currency_short_name=[user_currency],
                        page=1,
                        size=10
                    )
                    for order in orders:
                        # print("Order:",order)
                        if order["id"] == user_trades_id:
                            print("Found order", order)
                            # # update client trades
                            clientTrades.update_one(
                                {"orderId": order["id"], "trade_id": str(pos["ID"])},
                                {"$set": {"avg_price": order["avg_price"]}}
                            )
                            print("Updated client trades", user_trades_id)
                            # break

        ct = datetime.now() + timedelta(minutes=1)
        pause.until(ct)

