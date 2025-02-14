const validSymbol = require('../utils/validSymbol');
const session = require('../utils/session');
const logger = require('../utils/logger');
const printQuote = require('./printQuote');
const next = require('../main/next');
const accessTokenSuccessQuote = require('./accessTokenSuccess');
const accessTokenFail = require('../utils/accessTokenFail');
const error = require('../utils/error');

//
// quote URL: v1/market/quote/{symbols}
//

const getPrice = (data) => {
  try {
    console.log('in getPrice')
    console.log('data.QuoteResponse', data.QuoteResponse)
    const quoteResponse = data.QuoteResponse;

    if (!quoteResponse || !Array.isArray(quoteResponse.QuoteData) || quoteResponse.QuoteData.length === 0) {
      console.log('Error: QuoteData is undefined or empty');
      return 0;
    }

    const quoteData = quoteResponse.QuoteData[0];

    console.log('quoteData', quoteData)

    if (typeof quoteResponse.Messages !== 'undefined') {
      printMsg(quoteResponse.Messages);
      return 0;
    }

    console.log('quoteData.All.bid.toFixed(2)', quoteData.All.bid.toFixed(2))

    return quoteData.All.bid.toFixed(2);
  } catch (error) {
    console.log('Error in getPrice function:', error.message);
    return 0;
  }
}


const quoteFetch = async (symbol) => {
  logger.info(`At quoteFetch with ${symbol}`);
  try {
    if (!validSymbol(symbol)) {
      logger.error(`Not a valid symbol: ${symbol}`);
      throw new Error('Invalid symbol'); // Throw error if symbol is invalid
    }

    const reqUrl = `${session.getQuoteUri() + symbol}.json`;
    const authClient = session.getItem('authClient');

    if (authClient !== null) {
      logger.info(`At quoteFetch with authClient valid`);
      // Access token exists, perform the API call
      const resp = await authClient.get(reqUrl);
      logger.info(`API url: ${reqUrl}`);
      logger.info(`Received response from Quotes: \n${JSON.stringify(resp.body, null, 4)}`);

      // Check if the response has the expected structure
      if (resp.body && resp.body.QuoteResponse && resp.body.QuoteResponse.QuoteData) {
        const price = getPrice(resp.body);

        console.log('price: ', price)
        if (price !== undefined) {
          return price;  // This will resolve the promise with the price
        } else {
          logger.error('Price is undefined after processing response body');
          throw new Error('Price could not be fetched');  // Error handling if price is undefined
        }
      } else {
        logger.error('Invalid response structure: QuoteResponse or QuoteData is missing');
        throw new Error('Invalid response structure');
      }
    } else {
      // Access token is not available, attempt to get it using request token
      const etradeClient = session.getEtradeClient();
      const verifier = session.getItem('verifier');
      const reqToken = session.getItem('reqToken');
      const reqTokenSecret = session.getItem('reqTokenSecret');
      
      session.setQuoteUrl(reqUrl);

      logger.info(`at get accessToken`);
      // Access token for quote
      await etradeClient.accessToken(reqToken, reqTokenSecret, verifier);
      return await quoteFetch(symbol);  // Retry after getting access token
    }
  } catch (error) {
    logger.error(`Error fetching quote: ${error.message}`);
    throw new Error(`Error fetching quote: ${error.message}`);  // Throw error if any part of the function fails
  }
};



const runBot = () => {
  const uuid = require("uuid");
  const { setInterval } = require("timers");

  const TRAILING_STOP_PERCENTAGE = 0.0005; // Trailing stop loss percentage for selling
  const TRAILING_BUY_PERCENTAGE = 0.005; // Trailing buy percentage for buying
  const SYMBOL = "SPY";
  const QUANTITY = "0.01"; // This is a fixed amount (not a percentage)
  const TIME_SLEEP = 5000; // Sleep for X milliseconds (5 seconds)
  const TIME_LAPSE = 60 * 1; // Time lapse in seconds

  class CryptoAPITrading {
    static getCurrentTimestamp() {
      return Math.floor(new Date().getTime() / 1000);
    }

    async placeOrder(clientOrderId, side, orderType, symbol, orderConfig) {
      const body = {
        client_order_id: clientOrderId,
        side: side,
        type: orderType,
        symbol: symbol,
        [`${orderType}_order_config`]: orderConfig,
      };
      const path = "/api/v1/crypto/trading/orders/";
      return await this.makeApiRequest("POST", path, JSON.stringify(body));
    }

    async getCurrentPrice(symbol) {
      try {
        const response = await quoteFetch(symbol);

        if (!response) {
          throw new Error('Invalid or empty response from quote fetch');
        }

        const price = getPrice(response);

        if (price === undefined) {
          throw new Error('Price could not be calculated');
        }

        console.log(`Current price for ${symbol}: ${price}`);
        return price;

      } catch (error) {
        console.error(`Error fetching price for ${symbol}:`, error.message);
        return 0; // Return 0 if there's an error (or handle it as needed)
      }
    }
  }

  async function main() {
    const apiTradingClient = new CryptoAPITrading();

    let trailingBuyPrice = 0.0;
    let trailingSellPrice = 0.0;
    let highestPriceAfterBuy = 0.0;
    let lowestPriceAfterSell = Infinity;
    let lowestPriceTimestamp = null;
    let soldOut = true;
    let buyPrice = 0.0;
    let sellPrice = 0.0;

    setInterval(async () => {
      console.log("----------------------------------------------------");

      if (soldOut) {
        const currentPrice = await apiTradingClient.getCurrentPrice(SYMBOL);
        console.log('currentPrice :', currentPrice);
        
        if (currentPrice === 0.0) {
          console.log("Error fetching current price!");
          return;
        }

        console.log(`Current Price: ${currentPrice}`);

        if (lowestPriceAfterSell === Infinity) {
          console.log(`Price after sell: ${currentPrice}`);
          lowestPriceAfterSell = currentPrice;
          lowestPriceTimestamp = CryptoAPITrading.getCurrentTimestamp();
          trailingBuyPrice = lowestPriceAfterSell * (1 + TRAILING_BUY_PERCENTAGE);
          console.log(`Trailing Buy Price set to: ${trailingBuyPrice}`);
          console.log(`Lowest Price Timestamp: ${lowestPriceTimestamp}`);
        }

        console.log(`Lowest Price After Sell: ${lowestPriceAfterSell}`);
        console.log(`Trailing Buy Price: ${trailingBuyPrice}`);

        if (currentPrice < lowestPriceAfterSell) {
          lowestPriceAfterSell = currentPrice;
          lowestPriceTimestamp = CryptoAPITrading.getCurrentTimestamp();
          trailingBuyPrice = lowestPriceAfterSell * (1 + TRAILING_BUY_PERCENTAGE);
          console.log(`New Lowest Price After Sell: ${lowestPriceAfterSell}`);
          console.log(`Trailing Buy Price updated to: ${trailingBuyPrice}`);
          console.log(`New Lowest Price Timestamp: ${lowestPriceTimestamp}`);
        }

        if (lowestPriceTimestamp !== null) {
          const elapsedTime = CryptoAPITrading.getCurrentTimestamp() - lowestPriceTimestamp;
          console.log(`Elapsed Time since lowest price: ${elapsedTime} seconds`);
        }

        if (currentPrice >= trailingBuyPrice) {
          const elapsedTime = CryptoAPITrading.getCurrentTimestamp() - lowestPriceTimestamp;
          if (elapsedTime <= TIME_LAPSE) {
            console.log("Price has risen above trailing buy price and elapsed time is within the allowed range, placing buy order.");
            const buyResponse = await apiTradingClient.placeOrder(
              uuid.v4(),
              "buy",
              "market",
              SYMBOL,
              { asset_quantity: QUANTITY }
            );

            if (buyResponse === null) {
              console.log("Error placing buy order.");
              return;
            }

            buyPrice = currentPrice;
            console.log(`Price after Buy: ${buyPrice}`);
            highestPriceAfterBuy = currentPrice;
            trailingSellPrice = highestPriceAfterBuy * (1 - TRAILING_STOP_PERCENTAGE);
            console.log(`Trailing Sell Price set to: ${trailingSellPrice}`);

            lowestPriceAfterSell = currentPrice;
            lowestPriceTimestamp = null;
            soldOut = false;
            console.log("You are no longer sold out. Tracking for trailing stop loss.");
          } else {
            console.log(`Elapsed time ${elapsedTime} exceeds allowed range. Resetting to current price.`);
            lowestPriceAfterSell = currentPrice;
            lowestPriceTimestamp = CryptoAPITrading.getCurrentTimestamp();
            trailingBuyPrice = lowestPriceAfterSell * (1 + TRAILING_BUY_PERCENTAGE);
            console.log(`Lowest Price After Sell reset to ${lowestPriceAfterSell}. New Trailing Buy Price: ${trailingBuyPrice}`);
          }
        } else {
          console.log(`Current price ${currentPrice} is below the trailing buy price ${trailingBuyPrice}. Not placing buy order.`);
        }
      } else {
        const currentPrice = await apiTradingClient.getCurrentPrice(SYMBOL);
        if (currentPrice === 0.0) {
          console.log("Error fetching current price!");
          return;
        }

        if (currentPrice > highestPriceAfterBuy) {
          highestPriceAfterBuy = currentPrice;
          trailingSellPrice = highestPriceAfterBuy * (1 - TRAILING_STOP_PERCENTAGE);
          console.log(`New Highest Price After Buy: ${highestPriceAfterBuy}`);
        }

        console.log(`Current Price: ${currentPrice}`);
        console.log(`Trailing Sell Price: ${trailingSellPrice}`);

        if (currentPrice <= trailingSellPrice) {
          console.log("Price has dropped to the trailing sell price, selling now.");
          const sellResponse = await apiTradingClient.placeOrder(
            uuid.v4(),
            "sell",
            "market",
            SYMBOL,
            { asset_quantity: QUANTITY }
          );

          if (sellResponse === null) {
            console.log("Error placing sell order.");
          } else {
            sellPrice = currentPrice;
            const profitOrLoss = sellPrice - buyPrice;
            lowestPriceAfterSell = sellPrice;
            console.log(`Sell Price: ${sellPrice}`);
            console.log(`Buy Price: ${buyPrice}`);
            console.log(`Profit/Loss for this trade: ${profitOrLoss}`);

            soldOut = true;
            console.log("You are now sold out. Ready to buy again.");
          }
        }
      }
    }, TIME_SLEEP);
  }

  main();
};

module.exports = {
  quoteFetch,
  runBot
};
