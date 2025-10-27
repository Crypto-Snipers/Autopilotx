import requests
import urllib.parse
import time
import datetime
import hashlib
import hmac
import base64
import json
import logging
from enum import Enum
from typing import Dict, List, Union, Optional, Any
from decimal import Decimal

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("delta_client")

version = "1.0.0"


class DeltaAPIError(Exception):
    """Base exception for Delta API errors"""

    def __init__(self, message, status_code=None, response=None):
        self.message = message
        self.status_code = status_code
        self.response = response
        super().__init__(self.message)


class InvalidParameterError(DeltaAPIError):
    """Exception raised for invalid parameters"""

    pass


class AuthenticationError(DeltaAPIError):
    """Exception raised for authentication failures"""

    pass


class RateLimitError(DeltaAPIError):
    """Exception raised when rate limit is exceeded"""

    pass


class ServerError(DeltaAPIError):
    """Exception raised for server-side errors"""

    pass


class OrderType(Enum):
    MARKET = "market_order"
    LIMIT = "limit_order"


class TimeInForce(Enum):
    FOK = "fok"
    IOC = "ioc"
    GTC = "gtc"


class DeltaRestClient:
    """
    Delta Exchange REST API Client

    This client provides a Python interface to the Delta Exchange API, supporting both
    authenticated and unauthenticated endpoints for trading, market data, and account management.

    Base URLs for different environments:
    - Production-India : https://api.india.delta.exchange (For https://india.delta.exchange/)
    - Testnet-India : https://cdn-ind.testnet.deltaex.org (For https://testnet.delta.exchange/)
    - Production-Global : https://api.delta.exchange (For https://www.delta.exchange/)
    - Testnet-Global : https://testnet-api.delta.exchange (For https://testnet-global.delta.exchange/)

    Important Notes:
    - Each environment is fully independent
    - API keys and secrets are specific to each environment
    - Product IDs, asset IDs, and user IDs differ between environments
    - Always verify you're using the correct product IDs for your target environment

    Usage Examples:
    ```python
    # Initialize client
    client = DeltaRestClient(
        base_url='https://api.india.delta.exchange',
        api_key='your_api_key',
        api_secret='your_api_secret'
    )

    # Get market data (no authentication required)
    tickers = client.get_ticker(identifier={
        "contract_types": "perpetual_futures",
        "underlying_asset_symbols": "BTC"
    })

    # Place an order (authentication required)
    order = client.place_order(
        product_id=27,  # Make sure to use the correct product ID for your environment
        size=1,
        side="buy",
        limit_price=50000,  # For limit orders
        order_type=OrderType.LIMIT
    )
    ```
    """

    def __init__(self, base_url, api_key=None, api_secret=None, raise_for_status=True):
        self.base_url = base_url
        self.api_key = api_key
        self.api_secret = api_secret
        self.raise_for_status = raise_for_status
        self.session = self._init_session()

    def _init_session(self):
        session = requests.Session()
        return session

    def request(
        self,
        method,
        path,
        payload=None,
        query=None,
        auth=False,
        base_url=None,
        headers={},
    ):
        """
        Make a request to the Delta Exchange API

        Args:
            method (str): HTTP method (GET, POST, PUT, DELETE)
            path (str): API endpoint path
            payload (dict, optional): Request body for POST/PUT requests
            query (dict, optional): Query parameters for GET requests
            auth (bool, optional): Whether authentication is required
            base_url (str, optional): Override the default base URL
            headers (dict, optional): Additional headers to include

        Returns:
            requests.Response: The HTTP response object

        Raises:
            AuthenticationError: When API keys are missing or invalid
            InvalidParameterError: When request parameters are invalid
            RateLimitError: When API rate limit is exceeded
            ServerError: When server returns 5xx errors
            DeltaAPIError: For other API errorwa
        """
        try:
            if base_url is None:
                base_url = self.base_url
            url = f"{base_url}{path}"

            logger.debug(f"Making {method} request to {url}")
            if query:
                logger.debug(f"Query parameters: {query}")
            if payload:
                logger.debug(f"Payload: {payload}")

            res = None
            if auth:
                if self.api_key is None or self.api_secret is None:
                    raise AuthenticationError("API key or API secret missing")

                timestamp = get_time_stamp()
                signature_data = (
                    method
                    + timestamp
                    + path
                    + query_string(query)
                    + body_string(payload)
                )
                signature = generate_signature(self.api_secret, signature_data)
                logger.debug(f"Signature data: {signature_data}")
                logger.debug(f"Generated signature: {signature}")

                auth_headers = {
                    "Content-Type": "application/json",
                    "api-key": self.api_key,
                    "timestamp": timestamp,
                    "signature": signature,
                    "User-Agent": f"delta-rest-client-v{version}",
                }
                # Merge with any additional headers
                request_headers = {**auth_headers, **headers}

                res = self.session.request(
                    method,
                    url,
                    data=body_string(payload),
                    params=query,
                    timeout=(3, 6),
                    headers=request_headers,
                )
            else:
                non_auth_headers = {
                    "User-Agent": f"delta-rest-client-v{version}",
                    "Content-Type": "application/json",
                }
                # Merge with any additional headers
                request_headers = {**non_auth_headers, **headers}

                res = requests.request(
                    method,
                    url,
                    data=body_string(payload),
                    params=query,
                    timeout=(3, 6),
                    headers=request_headers,
                )

            if self.raise_for_status:
                custom_raise_for_status(res)

            return res

        except requests.exceptions.Timeout:
            logger.error(f"Request timeout for {method} {path}")
            raise DeltaAPIError(f"Request timeout for {method} {path}", response=None)

        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error for {method} {path}: {str(e)}")
            raise DeltaAPIError(f"Connection error: {str(e)}", response=None)

        except Exception as e:
            if not isinstance(e, DeltaAPIError):
                logger.error(f"Unexpected error in request: {str(e)}")
                raise DeltaAPIError(f"Unexpected error: {str(e)}", response=None)
            raise

    def get_assets(self, auth=False):
        response = self.request("GET", "/v2/assets", auth=auth)
        return parseResponse(response)

    def get_product(self, product_id, auth=False):
        response = self.request("GET", "/v2/products/%s" % (product_id), auth=auth)
        product = parseResponse(response)
        return product

    def get_product_by_symbol(self, symbol, auth=False):
        response = self.request("GET", "/v2/products/%s" % (symbol), auth=auth)
        product = parseResponse(response)
        return product

    def batch_create(self, product_id, orders):
        response = self.request(
            "POST",
            "/v2/orders/batch",
            {"product_id": product_id, "orders": orders},
            auth=True,
        )
        return parseResponse(response)

    def create_order(self, order):
        response = self.request("POST", "/v2/orders", order, auth=True)
        return parseResponse(response)

    def batch_cancel(self, product_id, orders):
        response = self.request(
            "DELETE",
            "/v2/orders/batch",
            {"product_id": product_id, "orders": orders},
            auth=True,
        )
        return parseResponse(response)

    def batch_edit(self, product_id, orders):
        response = self.request(
            "PUT",
            "/v2/orders/batch",
            {"product_id": product_id, "orders": orders},
            auth=True,
        )
        return parseResponse(response)

    def get_live_orders(self, query=None):
        response = self.request("GET", "/v2/orders", query=query, auth=True)
        return parseResponse(response)

    def get_active_orders(
        self,
        product_ids=None,
        states=None,
        contract_types=None,
        order_types=None,
        start_time=None,
        end_time=None,
        after=None,
        before=None,
        page_size=None,
    ):
        """
        Get active orders from the Delta Exchange API.

        This method requires authentication and returns orders based on the specified filters.

        Args:
            product_ids (str, optional): Comma separated product ids. If not specified, all orders will be returned.
            states (str, optional): Comma separated list of states - open,pending
            contract_types (str, optional): Comma separated list of desired contract types 
                (futures, perpetual_futures, call_options, put_options). If not specified, all orders will be returned.
            order_types (str, optional): Comma separated order types (market, limit, stop_market, stop_limit, all_stop)
            start_time (int, optional): From time in microseconds in epoch; referring to the order creation time
            end_time (int, optional): To time in microseconds in epoch; referring to the order creation time
            after (str, optional): After cursor for pagination; becomes null if page after the current one does not exist
            before (str, optional): Before cursor for pagination; becomes null if page before the current one does not exist
            page_size (int, optional): Number of records per page

        Returns:
            dict: The active orders information with the following structure:
            {
              "success": true,
              "result": [
                {
                  "id": 123,
                  "user_id": 453671,
                  "size": 10,
                  "unfilled_size": 2,
                  "side": "buy",
                  "order_type": "limit_order",
                  "limit_price": "59000",
                  "stop_order_type": "stop_loss_order",
                  "stop_price": "55000",
                  "paid_commission": "0.5432",
                  "commission": "0.5432",
                  "reduce_only": false,
                  "client_order_id": "34521712",
                  "state": "open",
                  "created_at": "1725865012000000",
                  "product_id": 27,
                  "product_symbol": "BTCUSD"
                }
              ],
              "meta": {
                "after": "g3QAAAACZAAKY3JlYXRlZF9hdHQAAAAN",
                "before": "a2PQRSACZAAKY3JlYXRlZF3fnqHBBBNZL"
              }
            }

        Raises:
            AuthenticationError: If API keys are missing or invalid
            DeltaAPIError: For other API errors

        Examples:
            ```python
            # Get all active orders
            orders = client.get_active_orders()

            # Get only open orders for specific products
            orders = client.get_active_orders(
                product_ids="27,28",
                states="open"
            )

            # Get orders with pagination
            orders = client.get_active_orders(
                states="open,pending",
                page_size=50,
                order_types="limit,market"
            )

            # Get orders for perpetual futures only
            orders = client.get_active_orders(
                contract_types="perpetual_futures",
                states="open"
            )
            ```
        """
        logger.info("Getting active orders")

        query = {}
        if product_ids:
            query["product_ids"] = product_ids
        if states:
            query["states"] = states
        if contract_types:
            query["contract_types"] = contract_types
        if order_types:
            query["order_types"] = order_types
        if start_time:
            query["start_time"] = start_time
        if end_time:
            query["end_time"] = end_time
        if after:
            query["after"] = after
        if before:
            query["before"] = before
        if page_size:
            query["page_size"] = page_size

        response = self.request("GET", "/v2/orders", query=query, auth=True)
        return parseResponse(response)

    def get_l2_orderbook(self, identifier, auth=False):
        response = self.request("GET", "/v2/l2orderbook/%s" % (identifier), auth=auth)
        return parseResponse(response)

    def get_ticker(self, identifier, auth=False):
        """
        Get ticker information from the Delta Exchange API.

        This method supports two ways of calling:
        1. With a dictionary of query parameters to filter tickers
        2. With a string identifier to get a specific ticker

        Args:
            identifier (Union[str, dict]): Either a string symbol (e.g., "BTCUSD") or a
                dictionary of query parameters for filtering tickers
            auth (bool, optional): Whether to use authentication. Defaults to False.

        Returns:
            dict: The ticker information

        Raises:
            InvalidParameterError: If the parameters are invalid
            DeltaAPIError: For other API errors

        Examples:
            ```python
            # Get tickers with query parameters
            tickers = client.get_ticker(identifier={
                "contract_types": "perpetual_futures",
                "underlying_asset_symbols": "BTC"
            })

            # Get a specific ticker by symbol
            ticker = client.get_ticker(identifier="BTCUSD")
            ```
        """
        logger.info(f"Getting ticker for identifier: {identifier}")

        # Handle both string identifiers (path parameter) and dictionaries (query parameters)
        if isinstance(identifier, dict):
            # Use query parameters
            response = self.request("GET", "/v2/tickers", query=identifier, auth=auth)
        else:
            # Use path parameter for backward compatibility
            response = self.request("GET", f"/v2/tickers/{identifier}", auth=auth)

        return parseResponse(response)

    def get_public_trades(self, symbol, auth=False):
        """
        Get public trades for a specific symbol from the Delta Exchange API.

        Args:
            symbol (str): The symbol to get trades for (e.g., "BTCUSD")
            auth (bool, optional): Whether to use authentication. Defaults to False.

        Returns:
            dict: The trades information with the following structure:
            {
              "success": true,
              "result": {
                "trades": [
                  {
                    "side": "buy",
                    "size": 0,
                    "price": "string",
                    "timestamp": 0
                  }
                ]
              }
            }

        Raises:
            InvalidParameterError: If the symbol is invalid
            DeltaAPIError: For other API errors

        Examples:
            ```python
            # Get public trades for BTCUSD
            trades = client.get_public_trades(symbol="BTCUSD")
            ```
        """
        logger.info(f"Getting public trades for symbol: {symbol}")

        if not symbol:
            raise InvalidParameterError("Symbol is required")

        response = self.request("GET", f"/v2/trades/{symbol}", auth=auth)
        return parseResponse(response)

    def get_balances(self, asset_id):
        response = self.request(
            "GET", "/v2/wallets/balances", query={"asset_id": asset_id}, auth=True
        )
        return parseResponse(response)

    def get_wallet_balances(self):
        
        """
        Get all wallet balances from the Delta Exchange API.

        This method requires authentication.

        Returns:
            dict: The wallet balances information with the following structure:
            {
              "meta": {
                "net_equity": "string",
                "robo_trading_equity": "string"
              },
              "result": [
                {
                  "asset_id": 0,
                  "asset_symbol": "string",
                  "available_balance": "string",
                  "available_balance_for_robo": "string",
                  "balance": "string",
                  "blocked_margin": "string",
                  "commission": "string",
                  "cross_asset_liability": "string",
                  "cross_commission": "string",
                  "cross_locked_collateral": "string",
                  "cross_order_margin": "string",
                  "cross_position_margin": "string",
                  "id": 0,
                  "interest_credit": "string",
                  "order_margin": "string",
                  "pending_referral_bonus": "string",
                  "pending_trading_fee_credit": "string",
                  "portfolio_margin": "string",
                  "position_margin": "string",
                  "trading_fee_credit": "string",
                  "unvested_amount": "string",
                  "user_id": 0
                }
              ],
              "success": true
            }

        Raises:
            AuthenticationError: If API keys are missing or invalid
            DeltaAPIError: For other API errors

        Examples:
            ```python
            # Get all wallet balances
            balances = client.get_wallet_balances()

            # Print available balance for each asset
            for wallet in balances['result']:
                print(f"{wallet['asset_symbol']}: {wallet['available_balance']}")
            ```
        """
        logger.info("Getting wallet balances")

        response = self.request("GET", "/v2/wallet/balances", auth=True)
        return parseResponse(response)

    def get_order_history(
        self,
        product_ids=None,
        contract_types=None,
        order_types=None,
        start_time=None,
        end_time=None,
        after=None,
        before=None,
        page_size=None,
    ):
        """
        Get order history (cancelled and closed orders) from the Delta Exchange API.

        This method requires authentication.

        Args:
            product_ids (str, optional): Comma separated product ids
            contract_types (str, optional): Comma separated list of desired contract types
            order_types (str, optional): Comma separated order types (market, limit, stop_market, stop_limit, all_stop)
            start_time (int, optional): From time in microseconds in epoch
            end_time (int, optional): To time in microseconds in epoch
            after (str, optional): After cursor for pagination
            before (str, optional): Before cursor for pagination
            page_size (int, optional): Number of records per page

        Returns:
            dict: The order history information with the following structure:
            {
              "success": true,
              "result": [
                {
                  "id": 123,
                  "user_id": 453671,
                  "size": 10,
                  "unfilled_size": 2,
                  "side": "buy",
                  "order_type": "limit_order",
                  "limit_price": "59000",
                  "stop_order_type": "stop_loss_order",
                  "stop_price": "55000",
                  "paid_commission": "0.5432",
                  "commission": "0.5432",
                  "reduce_only": false,
                  "client_order_id": "34521712",
                  "state": "open",
                  "created_at": "1725865012000000",
                  "product_id": 27,
                  "product_symbol": "BTCUSD"
                }
              ],
              "meta": {
                "after": "g3QAAAACZAAKY3JlYXRlZF9hdHQAAAAN",
                "before": "a2PQRSACZAAKY3JlYXRlZF3fnqHBBBNZL"
              }
            }

        Raises:
            AuthenticationError: If API keys are missing or invalid
            DeltaAPIError: For other API errors

        Examples:
            ```python
            # Get all order history
            history = client.get_order_history()

            # Get order history for specific products with pagination
            history = client.get_order_history(
                product_ids="27,28",
                order_types="limit,market",
                page_size=50
            )
            ```
        """
        logger.info("Getting order history")

        query = {}
        if product_ids:
            query["product_ids"] = product_ids
        if contract_types:
            query["contract_types"] = contract_types
        if order_types:
            query["order_types"] = order_types
        if start_time:
            query["start_time"] = start_time
        if end_time:
            query["end_time"] = end_time
        if after:
            query["after"] = after
        if before:
            query["before"] = before
        if page_size:
            query["page_size"] = page_size

        response = self.request("GET", "/v2/orders/history", query=query, auth=True)
        return parseResponse(response)

    def get_fills(
        self,
        product_ids=None,
        contract_types=None,
        start_time=None,
        end_time=None,
        after=None,
        before=None,
        page_size=None,
    ):
        """
        Get fill history from the Delta Exchange API.

        This method requires authentication.

        Args:
            product_ids (str, optional): Comma separated product ids
            contract_types (str, optional): Comma separated list of desired contract types
            start_time (int, optional): From time in microseconds in epoch
            end_time (int, optional): To time in microseconds in epoch
            after (str, optional): After cursor for pagination
            before (str, optional): Before cursor for pagination
            page_size (int, optional): Number of records per page

        Returns:
            dict: The fill history information with the following structure:
            {
              "success": true,
              "result": [
                {
                  "id": 0,
                  "size": 0,
                  "fill_type": "normal",
                  "side": "buy",
                  "price": "string",
                  "role": "taker",
                  "commission": "string",
                  "created_at": "string",
                  "product_id": 0,
                  "product_symbol": "string",
                  "order_id": "string",
                  "settling_asset_id": 0,
                  "settling_asset_symbol": "string",
                  "meta_data": {
                    "commission_deto": "string",
                    "commission_deto_in_settling_asset": "string",
                    "effective_commission_rate": "string",
                    "liquidation_fee_deto": "string",
                    "liquidation_fee_deto_in_settling_asset": "string",
                    "order_price": "string",
                    "order_size": "string",
                    "order_type": "string",
                    "order_unfilled_size": "string",
                    "tfc_used_for_commission": "string",
                    "tfc_used_for_liquidation_fee": "string",
                    "total_commission_in_settling_asset": "string",
                    "total_liquidation_fee_in_settling_asset": "string"
                  }
                }
              ],
              "meta": {
                "after": "g3QAAAACZAAKY3JlYXRlZF9hdHQAAAAN",
                "before": "a2PQRSACZAAKY3JlYXRlZF3fnqHBBBNZL"
              }
            }

        Raises:
            AuthenticationError: If API keys are missing or invalid
            DeltaAPIError: For other API errors

        Examples:
            ```python
            # Get all fills
            fills = client.get_fills()

            # Get fills for specific products with time range
            import time
            end = int(time.time() * 1000000)  # Current time in microseconds
            start = end - (7 * 24 * 60 * 60 * 1000000)  # 7 days ago in microseconds
            fills = client.get_fills(
                product_ids="27,28",
                start_time=start,
                end_time=end,
                page_size=50
            )
            ```
        """
        logger.info("Getting fill history")

        query = {}
        if product_ids:
            query["product_ids"] = product_ids
        if contract_types:
            query["contract_types"] = contract_types
        if start_time:
            query["start_time"] = start_time
        if end_time:
            query["end_time"] = end_time
        if after:
            query["after"] = after
        if before:
            query["before"] = before
        if page_size:
            query["page_size"] = page_size

        response = self.request("GET", "/v2/fills", query=query, auth=True)
        return parseResponse(response)

    def download_fills_history_csv(
        self, product_ids=None, contract_types=None, start_time=None, end_time=None
    ):
        """
        Download fill history as CSV from the Delta Exchange API.

        This method requires authentication.

        Args:
            product_ids (str, optional): Comma separated product ids
            contract_types (str, optional): Comma separated list of desired contract types
            start_time (int, optional): From time in microseconds in epoch
            end_time (int, optional): To time in microseconds in epoch

        Returns:
            str: CSV content as a string

        Raises:
            AuthenticationError: If API keys are missing or invalid
            DeltaAPIError: For other API errors

        Examples:
            ```python
            # Download all fills as CSV
            csv_data = client.download_fills_history_csv()

            # Write to a file
            with open('fills_history.csv', 'w') as f:
                f.write(csv_data)

            # Download fills for specific products and time range
            import time
            end = int(time.time() * 1000000)  # Current time in microseconds
            start = end - (30 * 24 * 60 * 60 * 1000000)  # 30 days ago in microseconds
            csv_data = client.download_fills_history_csv(
                product_ids="27,28",
                start_time=start,
                end_time=end
            )
            ```
        """
        logger.info("Downloading fill history CSV")

        query = {}
        if product_ids:
            query["product_ids"] = product_ids
        if contract_types:
            query["contract_types"] = contract_types
        if start_time:
            query["start_time"] = start_time
        if end_time:
            query["end_time"] = end_time

        response = self.request(
            "GET", "/v2/fills/history/download/csv", query=query, auth=True
        )
        return response.text  # Return the raw CSV text

    def close_all_positions(
        self, close_all_portfolio=True, close_all_isolated=True, user_id=None
    ):
        """
        Close all positions (portfolio and/or isolated) on the Delta Exchange API.

        This method requires authentication.

        Args:
            close_all_portfolio (bool, optional): Whether to close all portfolio margin positions. Defaults to True.
            close_all_isolated (bool, optional): Whether to close all isolated margin positions. Defaults to True.
            user_id (int, optional): User ID. If not provided, the authenticated user's ID will be used.

        Returns:
            dict: Response with success status

        Raises:
            AuthenticationError: If API keys are missing or invalid
            InvalidParameterError: If the parameters are invalid
            DeltaAPIError: For other API errors

        Examples:
            ```python
            # Close all positions (both portfolio and isolated)
            result = client.close_all_positions()

            # Close only portfolio margin positions
            result = client.close_all_positions(close_all_portfolio=True, close_all_isolated=False)

            # Close only isolated margin positions
            result = client.close_all_positions(close_all_portfolio=False, close_all_isolated=True)
            ```
        """
        logger.info("Closing all positions")

        payload = {
            "close_all_portfolio": close_all_portfolio,
            "close_all_isolated": close_all_isolated,
        }

        if user_id is not None:
            payload["user_id"] = user_id

        response = self.request(
            "POST", "/v2/positions/close_all", payload=payload, auth=True
        )
        return parseResponse(response)

    def get_position(self, product_id):
        response = self.request(
            "GET", "/v2/positions", query={"product_id": product_id}, auth=True
        )
        positions = parseResponse(response)
        if len(positions) == 0:
            return None
        return positions

    def get_margined_position(self, product_ids=None, contract_types=None):
        """
        Get margined positions from the Delta Exchange API.

        This method requires authentication.

        Args:
            product_ids (str, optional): Comma separated product ids. If not specified, all open positions will be returned.
            contract_types (str, optional): Comma separated list of desired contract types (perpetual_futures, call_options, put_options).
                                           If not specified, all open positions will be returned.

        Returns:
            dict: The margined positions information with the following structure:
            {
              "success": true,
              "result": [
                {
                  "user_id": 0,
                  "size": 0,
                  "entry_price": "string",
                  "margin": "string",
                  "liquidation_price": "string",
                  "bankruptcy_price": "string",
                  "adl_level": 0,
                  "product_id": 0,
                  "product_symbol": "string",
                  "commission": "string",
                  "realized_pnl": "string",
                  "realized_funding": "string"
                }
              ]
            }

        Raises:
            AuthenticationError: If API keys are missing or invalid
            DeltaAPIError: For other API errors

        Examples:
            ```python
            # Get all margined positions
            positions = client.get_margined_position()

            # Get margined positions for specific products
            positions = client.get_margined_position(product_ids="27,28")

            # Get margined positions for perpetual futures
            positions = client.get_margined_position(contract_types="perpetual_futures")
            ```
        """
        logger.info("Getting margined positions")

        query = {}
        if product_ids:
            query["product_ids"] = product_ids
        if contract_types:
            query["contract_types"] = contract_types

        response = self.request("GET", "/v2/positions/margined", query=query, auth=True)
        return parseResponse(response)

    def set_leverage(self, product_id, leverage):
        response = self.request(
            "POST",
            "/v2/positions/leverage",
            payload={"product_id": product_id, "leverage": leverage},
            auth=True,
        )
        return parseResponse(response)

    def get_profile(self):
        """
        Get user profile information from the Delta Exchange API.

        This method requires authentication.

        Returns:
            dict: The user profile information with the following structure:
            {
              "success": true,
              "result": {
                "id": "98765432",
                "email": "example@example.com",
                "account_name": "Main",
                "first_name": "First",
                "last_name": "Last",
                "dob": "1985-08-25",
                "country": "Country",
                "phone_number": "1234567890",
                "margin_mode": "isolated",
                "pf_index_symbol": ".DEXBTUSD",
                "is_sub_account": false,
                "is_kyc_done": true
              }
            }

        Raises:
            AuthenticationError: If API keys are missing or invalid
            DeltaAPIError: For other API errors

        Examples:
            ```python
            # Get user profile
            profile = client.get_profile()

            # Access specific user information
            user_id = profile["result"]["id"]
            email = profile["result"]["email"]
            margin_mode = profile["result"]["margin_mode"]
            ```
        """
        logger.info("Getting user profile")

        response = self.request("GET", "/v2/profile", auth=True)
        return parseResponse(response)

    def change_position_margin(self, product_id, delta_margin):
        response = self.request(
            "POST",
            "/v2/positions/change_margin",
            {"product_id": product_id, "delta_margin": str(delta_margin)},
            auth=True,
        )
        return parseResponse(response)

    def cancel_order(self, product_id, order_id):
        response = self.request(
            "DELETE",
            "/v2/orders",
            {"product_id": product_id, "id": order_id},
            auth=True,
        )
        return parseResponse(response)

    def place_stop_order(
        self,
        product_id,
        size,
        side,
        stop_price=None,
        limit_price=None,
        trail_amount=None,
        order_type=OrderType.LIMIT,
        isTrailingStopLoss=False,
    ):
        order = {
            "product_id": product_id,
            "size": int(size),
            "side": side,
            "order_type": order_type.value,
        }
        if limit_price != None:
            order["limit_price"] = str(limit_price)
        if isTrailingStopLoss:
            if trail_amount == None:
                raise Exception("trail_amount is required for trailingStopLoss")
            order["trail_amount"] = str(trail_amount)
        else:
            if stop_price == None:
                raise Exception("stop_price is required")
            order["stop_price"] = str(stop_price)
        return self.create_order(order)

    def place_order(
        self,
        product_id,
        size,
        side,
        limit_price=None,
        time_in_force=None,
        order_type=OrderType.LIMIT,
        post_only="false",
        client_order_id=None,
    ):
        order = {
            "product_id": product_id,
            "size": int(size),
            "side": side,
            "order_type": order_type.value,
            "post_only": post_only,
        }
        if order_type.value == "limit_order":
            order["limit_price"] = str(limit_price)

        if time_in_force:
            order["time_in_force"] = time_in_force.value

        if client_order_id:
            order["client_order_id"] = client_order_id

        return self.create_order(order)

    def order_history(self, query={}, page_size=100, after=None):
        if after is not None:
            query["after"] = after
        query["page_size"] = page_size
        response = self.request("GET", "/v2/orders/history", query=query, auth=True)
        return response.json()

    def fills(self, query={}, page_size=100, after=None):
        if after is not None:
            query["after"] = after
        query["page_size"] = page_size
        response = self.request("GET", "/v2/fills", query=query, auth=True)
        return response.json()


def parseResponse(response):
    response = response.json()
    if response["success"]:
        return response["result"]
    elif "error" in response:
        raise requests.exceptions.HTTPError(response["error"])
    else:
        raise requests.exceptions.HTTPError()


def create_order_format(price, size, side, product_id, post_only="false"):
    order = {
        "product_id": product_id,
        "limit_price": str(price),
        "size": int(size),
        "side": side,
        "order_type": "limit_order",
        "post_only": post_only,
    }
    return order


def cancel_order_format(order):
    order = {"id": order["id"], "product_id": order["product_id"]}
    return order


def round_by_tick_size(price, tick_size, floor_or_ceil=None):
    remainder = price % tick_size
    if remainder == 0:
        price = price
    if floor_or_ceil == None:
        floor_or_ceil = "ceil" if (remainder >= tick_size / 2) else "floor"
    if floor_or_ceil == "ceil":
        price = price - remainder + tick_size
    else:
        price = price - remainder
    number_of_decimals = len(format(Decimal(repr(float(tick_size))), "f").split(".")[1])
    price = round(Decimal(price), number_of_decimals)
    return price


def generate_signature(secret, message):
    message = bytes(message, "utf-8")
    secret = bytes(secret, "utf-8")
    hash = hmac.new(secret, message, hashlib.sha256)
    return hash.hexdigest()


def get_time_stamp():
    import time
    return str(int(time.time()))


def query_string(query):
    if query == None or len(query) == 0:
        return ""
    else:
        query_strings = []
        for key, value in query.items():
            query_strings.append(key + "=" + urllib.parse.quote_plus(str(value)))
        return "?" + "&".join(query_strings)


def body_string(body):
    if body == None:
        return ""
    else:
        return json.dumps(body, separators=(",", ":"))


def custom_raise_for_status(response):
    """Raises appropriate exception based on response status code.

    Args:
        response (requests.Response): The HTTP response object

    Raises:
        AuthenticationError: For 401 Unauthorized responses
        InvalidParameterError: For 400 Bad Request responses
        RateLimitError: For 429 Too Many Requests responses
        ServerError: For 5xx Server Error responses
        DeltaAPIError: For other error responses
    """
    if response.status_code >= 200 and response.status_code < 300:
        return

    error_msg = ""
    if isinstance(response.reason, bytes):
        try:
            reason = response.reason.decode("utf-8")
        except UnicodeDecodeError:
            reason = response.reason.decode("iso-8859-1")
    else:
        reason = response.reason

    # Try to get more detailed error information from response body
    response_body = ""
    try:
        response_json = response.json()
        if isinstance(response_json, dict):
            response_body = json.dumps(response_json, indent=2)
            # Extract specific error message if available
            if "message" in response_json:
                reason = response_json["message"]
            elif "error" in response_json:
                reason = response_json["error"]
    except ValueError:
        # If response is not JSON, use text
        response_body = (
            response.text[:200] + "..." if len(response.text) > 200 else response.text
        )

    # Format the error message
    error_msg = (
        f"{response.status_code} {reason} for url: {response.url}\n{response_body}"
    )

    # Raise appropriate exception based on status code
    if response.status_code == 400:
        raise InvalidParameterError(
            error_msg, status_code=response.status_code, response=response
        )
    elif response.status_code == 401:
        raise AuthenticationError(
            error_msg, status_code=response.status_code, response=response
        )
    elif response.status_code == 429:
        raise RateLimitError(
            error_msg, status_code=response.status_code, response=response
        )
    elif 500 <= response.status_code < 600:
        raise ServerError(
            error_msg, status_code=response.status_code, response=response
        )
    else:
        raise DeltaAPIError(
            error_msg, status_code=response.status_code, response=response
        )


def raise_for_status(response):
    """Raises :class:`HTTPError`, if one occurred."""

    http_error_msg = ""
    if isinstance(response.reason, bytes):
        # We attempt to decode utf-8 first because some servers
        # choose to localize their reason strings. If the string
        # isn't utf-8, we fall back to iso-8859-1 for all other
        # encodings. (See PR #3538)
        try:
            reason = response.reason.decode("utf-8")
        except UnicodeDecodeError:
            reason = response.reason.decode("iso-8859-1")
    else:
        reason = response.reason
    if 400 <= response.status_code < 600:
        reason = response.reason + " " + str(response.text)
        http_error_msg = (
            f"{response.status_code} HTTP Error: {reason} for url: {response.url}"
        )

    if http_error_msg:
        raise requests.HTTPError(http_error_msg, response=response)
