import requests
import hmac
import hashlib
import time
import logging
from typing import Optional, Dict, Any

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Helper functions
def get_time_stamp():
    return str(int(time.time()))

def query_string(params):
    if not params:
        return ""
    return "?" + "&".join([f"{key}={value}" for key, value in params.items()])

def body_string(payload):
    if not payload:
        return ""
    import json
    return json.dumps(payload)

def generate_signature(api_secret, signature_data):
    return hmac.new(
        api_secret.encode('utf-8'),
        signature_data.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

# Custom exceptions
class AuthenticationError(Exception):
    pass

class DeltaAPIError(Exception):
    def __init__(self, message, response=None):
        self.message = message
        self.response = response
        super().__init__(self.message)

# Custom status check
def custom_raise_for_status(response):
    if 400 <= response.status_code < 600:
        error_msg = f"HTTP error {response.status_code}"
        try:
            error_data = response.json()
            if "error" in error_data:
                error_msg = f"{error_msg}: {error_data['error'].get('message', 'Unknown error')}"
        except:
            pass
        raise DeltaAPIError(error_msg, response=response)


def search_referral(api_key: str, api_secret: str, referee_user_id: str, 
                   base_url: str = "https://api.india.delta.exchange") -> Dict[str, Any]:
    
    # Validate API credentials
    if api_key is None or api_secret is None:
        raise AuthenticationError("API key or API secret missing")
    
    # Construct the endpoint URL
    path = "/v2/referrals/search"
    url = f"{base_url}{path}"
    
    # Prepare query parameters
    params = {
        'referee_user_id': referee_user_id
    }
    
    # HTTP method
    method = "GET"
    
    try:
        # Generate timestamp for authentication
        timestamp = get_time_stamp()
        
        # Create signature data
        signature_data = method + timestamp + path + query_string(params) + body_string(None)
        
        # Generate signature
        signature = generate_signature(api_secret, signature_data)
        
        # Prepare headers
        headers = {
            "Content-Type": "application/json",
            "api-key": api_key,
            "timestamp": timestamp,
            "signature": signature,
            "User-Agent": "delta-rest-client-python"
        }
        
        # Make the API request
        logger.info(f"Making API request to {url} with params {params}")
        response = requests.request(
            method,
            url,
            params=params,
            timeout=(3, 6),  # Connect timeout, Read timeout
            headers=headers
        )
        
        # Check for errors
        custom_raise_for_status(response)
        
        # Return the JSON response
        return response.json()
        
    except requests.exceptions.Timeout:
        logger.error(f"Request timeout for {method} {path}")
        raise DeltaAPIError(f"Request timeout for {method} {path}", response=None)
        
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Connection error for {method} {path}: {str(e)}")
        raise DeltaAPIError(f"Connection error: {str(e)}", response=None)
        
    except DeltaAPIError as e:
        # Re-raise DeltaAPIError
        logger.error(f"API error: {e.message}")
        raise
        
    except Exception as e:
        logger.error(f"Unexpected error in search_referral: {str(e)}")
        raise DeltaAPIError(f"Unexpected error: {str(e)}", response=None)


# Example usage function
def example_usage():
    """
    Example of how to use the search_referral function.
    """
    # Your API credentials (replace with actual values)
    API_KEY = "XxjZwmFfvIPoyjVQdcvh4MFUF4ZQBn"
    API_SECRET = "AnQUZyIBgTZXvlhQNeqU7X5eDQxDrsPCn7uy6OYXqUx0kQlxolLsprmJvT88"
    
    # User ID to search for
    referee_user_id = "41682202"
    
    try:
        result = search_referral(API_KEY, API_SECRET, referee_user_id)
        print("Referral found!")
        print(f"User details: {result}")
        
        # Access specific fields if needed
        # print(f"Registration date: {result.get('registration_date')}")
        # print(f"Traded in last 30 days: {result.get('traded_last_30_days')}")
        
    except AuthenticationError as e:
        print(f"Authentication Error: {e}")
    except DeltaAPIError as e:
        print(f"API Error: {e.message}")
    except Exception as e:
        print(f"Unexpected error: {e}")


if __name__ == "__main__":
    example_usage()

