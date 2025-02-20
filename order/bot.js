const logger = require('../utils/logger');
const session = require('../utils/session');
const printPreviewOrder = require('./printPreviewOrder');
const next = require('../main/next');
const error = require('../utils/error');

/*
const previewOrder = () => {
  const requestObject = `{"PreviewOrderRequest": {"orderType": "EQ","clientOrderId":${session.order.client_order_id},
  "Order": [{"allOrNone": "false","priceType": "${session.order.price_type}",
  "orderTerm":"${session.order.order_term}","marketSession": "REGULAR","limitPrice":${session.order.limit_price},
  "Instrument": [{"Product": {"securityType": "EQ","symbol":"${session.order.symbol}"},
  "orderAction":"${session.order.order_action}","quantityType": "QUANTITY", "quantity":${session.order.quantity}}]}]}}`;

  const reqUrl = session.getPreviewOrderUrl();
  const authClient = session.getItem('authClient');
  const response = authClient.post(reqUrl, requestObject);
  logger.info(`API url: ${reqUrl}`);
  logger.info(`Request body: ${requestObject}`);
  response.then((resp) => {
    logger.info(`Receive response from Order  \n${JSON.stringify(resp, null, 4)}`);
    if (resp.statusCode === 200) {
      printPreviewOrder(resp);
    } else if (resp.statusCode === 204) {
      error(`Error processing Preview Order statusCode:${resp.statusCode}`, false);
    } else {
      error(`Error processing Preview Order statusCode:${resp.statusCode}`, false);
    }
    next('order', '0', 'order', true);
  }).catch((err) => {
    error(`Receive error from preview order: ${JSON.stringify(err)}`, false);
    next('order', '0', 'order', true);
  });
};
*/

const previewOrder = () => {
  const requestObject = `{
    "PreviewOrderRequest": {
      "orderType": "EQ",
      "clientOrderId": 6991319315,
      "Order": [
        {
          "allOrNone": "false",
          "priceType": "TRAILING_STOP_CNST",
          "orderTerm": "GOOD_FOR_DAY",
          "marketSession": "REGULAR",
          "stopPrice": 222,
          "Instrument": [
            {
              "Product": {
                "securityType": "EQ",
                "symbol": "SPY"
              },
              "orderAction": "BUY",
              "quantityType": "QUANTITY",
              "quantity": 1
            }
          ]
        }
      ]
    }
  }
`;

  const reqUrl = session.getPreviewOrderUrl();
  const authClient = session.getItem('authClient');
  const response = authClient.post(reqUrl, requestObject);
  logger.info(`API url: ${reqUrl}`);
  logger.info(`Request body: ${requestObject}`);
  response.then((resp) => {
    logger.info(`Receive response from Order  \n${JSON.stringify(resp, null, 4)}`);
    if (resp.statusCode === 200) {
      // printPreviewOrder(resp)

      console.log('placing order ...')
      placeOrder(resp.body.PreviewOrderResponse.PreviewIds)
    } else if (resp.statusCode === 204) {
      error(`Error processing Preview Order statusCode:${resp.statusCode}`, false);
    } else {
      error(`Error processing Preview Order statusCode:${resp.statusCode}`, false);
    }
    next('order', '0', 'order', true);
  }).catch((err) => {
    error(`Receive error from preview order: ${JSON.stringify(err)}`, false);
    next('order', '0', 'order', true);
  });
};

const placeOrder = (previewIds) => {
  console.log('here 1')
  const requestObject = `{
    "PlaceOrderRequest": {
      "orderType": "EQ",
      "clientOrderId": 6991319315,
        "PreviewIds": [
            {
                "previewId": ${previewIds[0].previewId}
            }
        ],
      "Order": [
        {
          "allOrNone": "false",
          "priceType": "TRAILING_STOP_CNST",
          "orderTerm": "GOOD_FOR_DAY",
          "marketSession": "REGULAR",
          "stopPrice": 222,
          "Instrument": [
            {
              "Product": {
                "securityType": "EQ",
                "symbol": "SPY"
              },
              "orderAction": "BUY",
              "quantityType": "QUANTITY",
              "quantity": 1
            }
          ]
        }
      ]
    }
  }
`;

console.log(requestObject)

  const reqUrl = session.getPlaceOrderUrl();
  const authClient = session.getItem('authClient');
  const response = authClient.post(reqUrl, requestObject);
  logger.info(`API url: ${reqUrl}`);
  logger.info(`Request body: ${requestObject}`);
  response.then((resp) => {
    logger.info(`Receive response from Place Order  \n${JSON.stringify(resp, null, 4)}`);
    if (resp.statusCode === 200) {
      printPreviewOrder(resp);
    } else if (resp.statusCode === 204) {
      error(`Error processing Place Order statusCode:${resp.statusCode}`, false);
    } else {
      error(`Error processing Place Order statusCode:${resp.statusCode}`, false);
    }
    next('order', '0', 'order', true);
  }).catch((err) => {
    console.log(err)
    error(`Receive error from place order: ${JSON.stringify(err)}`, false);
    next('order', '0', 'order', true);
  });
};

const runBot = () => {
    session.order = {
        price_type: 'TRAILING_STOP_CNST', //TRAILING_STOP_CNST
        order_type: 'EQ',
        client_order_id: Math.floor(Math.random() * (9999999999 - 1000000000)
            + 1000000000),
        order_term: 'GOOD_FOR_DAY',
        // limit_price: 200,
        symbol: 'BTC',
        order_action: 'BUY',
        quantity: 1,
        stop_price: 150,
    }
    previewOrder();

}

module.exports = {
  runBot
}



import base64
import datetime
import json
from typing import Any, Dict, Optional
import uuid
import requests
import os
from nacl.signing import SigningKey
from dotenv import load_dotenv
import time

load_dotenv()

API_KEY = os.getenv("ROBINHOOD_CRIPTO_API_KEY")
BASE64_PRIVATE_KEY = os.getenv("ROBINHOOD_PRIVATE_KEY")

TRAILING_BUY_PERCENTAGE = 0.04  # Trailing buy percentage for buying  
TRAILING_STOP_PERCENTAGE = TRAILING_BUY_PERCENTAGE / 1.1  # Trailing stop loss percentage for selling 
SYMBOL = "SOL-USD"
QUANTITY = "0.1"  # This is a fixed amount (not a percentage)
TIME_SLEEP = 5  # Sleep for X seconds, adjust based on frequency of checks
TIME_LAPSE = 60 * 1 # Maximum allowed time lapse (in seconds) to buy again 60 * 30

class CryptoAPITrading:
    def __init__(self):
        self.api_key = API_KEY
        private_key_seed = base64.b64decode(BASE64_PRIVATE_KEY)
        self.private_key = SigningKey(private_key_seed)
        self.base_url = "https://trading.robinhood.com"

    @staticmethod
    def _get_current_timestamp() -> int:
        return int(datetime.datetime.now(tz=datetime.timezone.utc).timestamp())

    @staticmethod
    def get_query_params(key: str, *args: Optional[str]) -> str:
        if not args:
            return ""

        params = []
        for arg in args:
            params.append(f"{key}={arg}")

        return "?" + "&".join(params)

    def make_api_request(self, method: str, path: str, body: str = "") -> Any:
        timestamp = self._get_current_timestamp()
        headers = self.get_authorization_header(method, path, body, timestamp)
        url = self.base_url + path

        try:
            response = {}
            if method == "GET":
                response = requests.get(url, headers=headers, timeout=10)
            elif method == "POST":
                response = requests.post(url, headers=headers, json=json.loads(body), timeout=10)
            return response.json()
        except requests.RequestException as e:
            print(f"Error making API request: {e}")
            return None

    def get_authorization_header(self, method: str, path: str, body: str, timestamp: int) -> Dict[str, str]:
        message_to_sign = f"{self.api_key}{timestamp}{path}{method}{body}"
        signed = self.private_key.sign(message_to_sign.encode("utf-8"))

        return {
            "x-api-key": self.api_key,
            "x-signature": base64.b64encode(signed.signature).decode("utf-8"),
            "x-timestamp": str(timestamp),
        }

    def get_account(self) -> Any:
        path = "/api/v1/crypto/trading/accounts/"
        return self.make_api_request("GET", path)

    def get_open_positions(self) -> Any:
        path = "/api/v1/crypto/trading/positions/"
        return self.make_api_request("GET", path)

    def place_order(self, client_order_id: str, side: str, order_type: str, symbol: str, order_config: Dict[str, str]) -> Any:
        body = {
            "client_order_id": client_order_id,
            "side": side,
            "type": order_type,
            "symbol": symbol,
            f"{order_type}_order_config": order_config,
        }
        path = "/api/v1/crypto/trading/orders/"
        return self.make_api_request("POST", path, json.dumps(body))

    def get_current_price(self, symbol: str) -> float:
        path = f"/api/v1/crypto/marketdata/best_bid_ask/?symbol={symbol}&side=both&quantity=1"
        response = self.make_api_request("GET", path)

        if response and "results" in response:
            bid_price = float(response["results"][0]["price"])
            return bid_price

        return 0.0  # Return 0 if no price is found

    def cancel_order(self, order_id: str) -> Any:
        path = f"/api/v1/crypto/trading/orders/{order_id}/cancel/"
        return self.make_api_request("POST", path)


def main():
    api_trading_client = CryptoAPITrading()

    trailing_buy_price = 0.0
    trailing_sell_price = 0.0
    highest_price_after_buy = 0.0
    lowest_price_after_sell = float('inf')  # Track the lowest price after selling
    lowest_price_timestamp = None  # Track the timestamp when lowest price after sell is hit
    sold_out = True
    buy_price = 0.0
    sell_price = 0.0

    while True:
        print("----------------------------------------------------")
        if sold_out:
            current_price = api_trading_client.get_current_price(SYMBOL)
            if current_price == 0.0:
                print("Error fetching current price!")
                time.sleep(TIME_SLEEP)
                continue

            print(f"Current Price: {current_price}")

            # When first selling, set the initial lowest price after sell
            if lowest_price_after_sell == float('inf'):
                print(f"Price after sell: {current_price}")
                lowest_price_after_sell = current_price  # Initialize with the sell price
                lowest_price_timestamp = api_trading_client._get_current_timestamp()  # Log the timestamp of the lowest price
                trailing_buy_price = lowest_price_after_sell * (1 + TRAILING_BUY_PERCENTAGE)
                print(f"Trailing Buy Price set to: {trailing_buy_price}")
                print(f"Lowest Price Timestamp: {lowest_price_timestamp}")

            # Log the values for debugging
            print(f"Lowest Price After Sell: {lowest_price_after_sell}")
            print(f"Trailing Buy Price: {trailing_buy_price}")

            # Update the lowest price after sell if current price drops lower
            if current_price < lowest_price_after_sell:
                lowest_price_after_sell = current_price
                lowest_price_timestamp = api_trading_client._get_current_timestamp()  # Log the new timestamp
                trailing_buy_price = lowest_price_after_sell * (1 + TRAILING_BUY_PERCENTAGE)  # Update trailing buy price
                print(f"New Lowest Price After Sell: {lowest_price_after_sell}")
                print(f"Trailing Buy Price updated to: {trailing_buy_price}")
                print(f"New Lowest Price Timestamp: {lowest_price_timestamp}")

            # Time lapse comparison (check if elapsed time is above a threshold)
            if lowest_price_timestamp is not None:
                elapsed_time = api_trading_client._get_current_timestamp() - lowest_price_timestamp
                print(f"Elapsed Time since lowest price: {elapsed_time} seconds")

            # Nested Condition for Price and Elapsed Time Check
            if current_price >= trailing_buy_price:
                if elapsed_time <= TIME_LAPSE:
                    print("Price has risen above trailing buy price and elapsed time is within the allowed range, placing buy order.")
                    buy_response = api_trading_client.place_order(
                        str(uuid.uuid4()),
                        "buy",
                        "market",
                        SYMBOL,
                        {"asset_quantity": QUANTITY}
                    )
                    if buy_response is None:
                        print("Error placing buy order.")
                        continue

                    buy_price = current_price
                    print(f"Price after Buy: {buy_price}")
                    highest_price_after_buy = current_price
                    trailing_sell_price = highest_price_after_buy * (1 - TRAILING_STOP_PERCENTAGE)
                    print(f"Trailing Sell Price set to: {trailing_sell_price}")

                    lowest_price_after_sell = current_price
                    lowest_price_timestamp = None  # Reset timestamp
                    sold_out = False
                    print("You are no longer sold out. Tracking for trailing stop loss.")
                else:
                    # Reset to current price if the elapsed time exceeds the allowed range
                    print(f"Price {current_price} is above the trailing buy price {trailing_buy_price}, but elapsed time {elapsed_time} exceeds TIME_LAPSE. Resetting to current price.")
                    lowest_price_after_sell = current_price  # Reset the lowest price after sell to current price
                    lowest_price_timestamp = api_trading_client._get_current_timestamp()  # Reset timestamp to current time
                    trailing_buy_price = lowest_price_after_sell * (1 + TRAILING_BUY_PERCENTAGE)  # Update trailing buy price
                    print(f"Lowest Price After Sell reset to {lowest_price_after_sell}. New Trailing Buy Price: {trailing_buy_price}")
            else:
                print(f"Current price {current_price} is below the trailing buy price {trailing_buy_price}. Not placing buy order.")
        else:
            current_price = api_trading_client.get_current_price(SYMBOL)
            if current_price == 0.0:
                print("Error fetching current price!")
                time.sleep(TIME_SLEEP)
                continue

            # Trailing stop loss logic after buying
            # Update highest price after buy and trailing sell price if needed
            if current_price > highest_price_after_buy:
                highest_price_after_buy = current_price
                trailing_sell_price = highest_price_after_buy * (1 - TRAILING_STOP_PERCENTAGE)  # Update trailing sell price
                print(f"New Highest Price After Buy: {highest_price_after_buy}")
                # print(f"Trailing Sell Price: {trailing_sell_price}")

            # Log current price and trailing sell price for debugging
            print(f"Current Price: {current_price}")
            print(f"Trailing Sell Price: {trailing_sell_price}")

            # Check if the current price has dropped to trailing sell price
            if current_price <= trailing_sell_price:
                print("Price has dropped to the trailing sell price, selling now.")
                sell_response = api_trading_client.place_order(
                    str(uuid.uuid4()),
                    "sell",
                    "market",
                    SYMBOL,
                    {"asset_quantity": QUANTITY}
                )

                if sell_response is None:
                    print("Error placing sell order.")
                else:
                    sell_price = current_price
                    profit_or_loss = sell_price - buy_price  # Calculate the profit or loss
                    lowest_price_after_sell = sell_price  # Update lowest price after sell
                    print(f"Sell Price: {sell_price}")
                    print(f"Buy Price: {buy_price}")
                    print(f"Profit/Loss for this trade: {profit_or_loss}")

                    sold_out = True
                    print("You are now sold out. Ready to buy again.")

                time.sleep(TIME_SLEEP)

        time.sleep(TIME_SLEEP)  # Sleep for a while before checking the price again


if __name__ == "__main__":
    main()
