from delta_client import DeltaRestClient
import time
import json
import logging
import requests
import urllib.parse
import hmac
import hashlib
import inspect
import sys

# Configure logging to print directly to console
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

# Also configure the delta_client logger to DEBUG level
delta_logger = logging.getLogger('delta_client')
delta_logger.setLevel(logging.DEBUG)

# API credentials
API_Key = "feNi0b4sL7GhldPeFmefOGdjRzzuf4"
API_Secret = "TVCjMr0CFUOgxR9dutiao10l2YC3bydcQz6Iw1AL8KPU1wXF5iOWEOIgI4re"

# API_Key = "2gMdmqCrjBYazmDbyvxVXPeplB3I1A"
# API_Secret = "vZJqf0YefpDh0ViTMzJWgCL0ug4IuS7o7NywYDMezFcu3iLEbAvL5Dzgoc4L"


# Create the client
client = DeltaRestClient(
    base_url="https://api.india.delta.exchange",
    api_key=API_Key,
    api_secret=API_Secret,
)

try:    
    # positions = client.get_margined_position(product_ids="3136", contract_types="perpetual_futures")
    # logger.info(f"Positions: {json.dumps(positions, indent=2)}")
    
    # balances = client.get_wallet_balances()
    # logger.info(f"Balances: {json.dumps(balances, indent=2)}")


    # cl = client.close_all_positions()
    # logger.info(cl)

    # pos = client.get_position(product_id="3136")
    # logger.info(pos)

    # orders = client.get_active_orders()
    # logger.info(f"Orders: {json.dumps(orders, indent=2)}")

    # cs = client.cancel_order(order_id="904185811",product_id="3136")
    # logger.info(cs)

except Exception as e:
    logger.error(f"Error: {e}")


