/* eslint-disable no-undef */
const logger = require('../utils/logger');
const session = require('../utils/session');
const error = require('../utils/error');
const { quoteBotFetch } = require('../quotes/quote')



const placeOrder = async (orderAction, symbol, quantity) => {
// const clientOrderId = Math.floor(Math.random() * (9999999999 - 1000000000) + 1000000000);

// const previewResponse = await previewBotOrder(clientOrderId, orderAction, symbol, quantity)
// if (previewResponse.statusCode !== 200) { 
//   return error(previewResponse)
// }

// await placeBotOrder(clientOrderId, previewResponse.body.PreviewOrderResponse.PreviewIds[0].previewId, orderAction, symbol, quantity)
    await Promise.resolve()
}

const getCurrentTimestamp = () => {
    return Math.floor(new Date().getTime() / 1000);
}

const getCurrentPrice = async (symbol) => {
    const price = await quoteBotFetch(symbol)
    return Number(price ?? 0.0)
}

const previewBotOrder = (clientOrderId, orderAction, symbol, quantity) => {
    return new Promise((resolve, reject) => {
        const requestObject = JSON.stringify({
            PreviewOrderRequest: {
                orderType: 'EQ',
                clientOrderId: `${clientOrderId}`,
                Order: [
                    {
                        allOrNone: false,
                        priceType: 'MARKET',
                        orderTerm: 'GOOD_FOR_DAY',
                        marketSession: 'REGULAR',
                        Instrument: [
                            {
                                Product: {
                                    securityType: 'EQ',
                                    symbol: symbol
                                },
                                orderAction: orderAction,
                                quantityType: 'QUANTITY',
                                quantity: quantity
                            }
                        ]
                    }
                ]
            }
        });

        const reqUrl = session.getPreviewOrderUrl();
        const authClient = session.getItem('authClient');

        // Sending POST request to API
        authClient.post(reqUrl, requestObject)
            .then((resp) => {
                // logger.info(`API url: ${reqUrl}`);
                // logger.info(`Request body: ${requestObject}`);
                // logger.info(`Receive response from preview order  \n${JSON.stringify(resp, null, 4)}`);

                if (resp.statusCode === 200) {
                    resolve(resp);  // Resolve the promise with the response
                } else if (resp.statusCode === 204) {
                    error(`Error processing Preview Order statusCode:${resp.statusCode}`, false);
                    reject(`Error processing Preview Order statusCode:${resp.statusCode}`);  // Reject the promise
                } else {
                    error(`Error processing Preview Order statusCode:${resp.statusCode}`, false);
                    reject(`Error processing Preview Order statusCode:${resp.statusCode}`);  // Reject the promise
                }
            })
            .catch((err) => {
                error(`Receive error from preview order: ${JSON.stringify(err)}`, false);
                reject(err);  // Reject the promise with the error
            });
    });
};

  
const placeBotOrder = (clientOrderId, previewId, orderAction, symbol, quantity) => {
  return new Promise((resolve, reject) => {
      const requestObject = JSON.stringify({
          PlaceOrderRequest: {
              orderType: 'EQ',
              clientOrderId: `${clientOrderId}`,
              Order: [
                  {
                      allOrNone: false,
                      priceType: 'MARKET',
                      orderTerm: 'GOOD_FOR_DAY',
                      marketSession: 'REGULAR',
                      stopPrice: 222,
                      limitPrice: 222,
                      Instrument: [
                          {
                              Product: {
                                  securityType: 'EQ',
                                  symbol: symbol
                              },
                              orderAction: orderAction,
                              quantityType: 'QUANTITY',
                              quantity: quantity
                          }
                      ]
                  }
              ],
              PreviewIds: [
                  {
                      previewId: previewId
                  }
              ],
          }
      });

      // logger.info(`Sending request to place order with body  \n${JSON.stringify(requestObject, null, 4)}`);
    
      const reqUrl = session.getPlaceOrderUrl();
      const authClient = session.getItem('authClient');
      
      // Sending POST request to API
      authClient.post(reqUrl, requestObject)
          .then((resp) => {
              // logger.info(`API url: ${reqUrl}`);
              // logger.info(`Request body: ${requestObject}`);
              // logger.info(`Receive response from Place Order  \n${JSON.stringify(resp, null, 4)}`);
              
              if (resp.statusCode === 200) {
                  // Successful response, resolve the promise
                  resolve(resp);
              } else if (resp.statusCode === 204) {
                  error(`Error processing Place Order statusCode:${resp.statusCode}`, false);
                  reject(`Error processing Place Order statusCode:${resp.statusCode}`);  // Reject the promise
              } else {
                  error(`Error processing Place Order statusCode:${resp.statusCode}`, false);
                  reject(`Error processing Place Order statusCode:${resp.statusCode}`);  // Reject the promise
              }
          })
          .catch((err) => {
              logger.info(err);
              error(`Receive error from place order: ${JSON.stringify(err)}`, false);
              reject(err);  // Reject the promise with the error
          });
  });
};


const runBot = () => {
    const conf1 = {
        TRAILING_BUY_AMOUNT: 2,
        TRAILING_STOP_AMOUNT: 1,
        SYMBOL: 'SPY',
        QUANTITY: 100,
        TIME_SLEEP: 5,
        TIME_LAPSE: 60 * 5
    }
    run(conf1)

    const conf2 = {
        TRAILING_BUY_AMOUNT: 2,
        TRAILING_STOP_AMOUNT: 1,
        SYMBOL: 'TSLA',
        QUANTITY: 100,
        TIME_SLEEP: 2,
        TIME_LAPSE: 60 * 3
    }
    run(conf2)

    const conf3 = {
      TRAILING_BUY_AMOUNT: 0.5,
      TRAILING_STOP_AMOUNT: 0.2,
      SYMBOL: 'NVDA',
      QUANTITY: 100,
      TIME_SLEEP: 3,
      TIME_LAPSE: 60 * 2
  }
  run(conf3)

  const conf4 = {
    TRAILING_BUY_AMOUNT: 1,
    TRAILING_STOP_AMOUNT: 0.5,
    SYMBOL: 'AAPL',
    QUANTITY: 100,
    TIME_SLEEP: 4,
    TIME_LAPSE: 60 * 2
  }
  run(conf4)

}


const run = async (params) => {
    const {
        TRAILING_BUY_AMOUNT,
        TRAILING_STOP_AMOUNT,
        SYMBOL,
        QUANTITY,
        TIME_SLEEP,
        TIME_LAPSE
    } = params;

    let trailingBuyPrice = 0.0;
    let trailingSellPrice = 0.0;
    let highestPriceAfterBuy = 0.0;
    let lowestPriceAfterSell = null;
    let lowestPriceTimestamp = null;
    let soldOut = true;
    let buyPrice = 0.0;
    let sellPrice = 0.0;
    let totalProfitOrLoss = 0.0;
    let totalTransations = 0;

    while (true) {

        if (soldOut) {
            const currentPrice = await getCurrentPrice(SYMBOL);

            if (currentPrice === 0.0) {
                logger.info("Error fetching current price!");
                await new Promise(resolve => setTimeout(resolve, TIME_SLEEP * 1000));
                continue;
            }

            logger.info(`Current Price: ${currentPrice}`);

            if (lowestPriceAfterSell === null) {
                logger.info(`Price after sell: ${currentPrice}`);
                lowestPriceAfterSell = currentPrice;
                lowestPriceTimestamp = getCurrentTimestamp();
                trailingBuyPrice = Number(lowestPriceAfterSell + TRAILING_BUY_AMOUNT);
                logger.info(`Trailing Buy Price set to: ${trailingBuyPrice}`);
                logger.info(`Lowest Price Timestamp: ${lowestPriceTimestamp}`);
            }

            logger.info(`Lowest Price After Sell: ${lowestPriceAfterSell}`);
            logger.info(`Trailing Buy Price: ${trailingBuyPrice}`);

            if (currentPrice < lowestPriceAfterSell) {  
                lowestPriceAfterSell = currentPrice;
                lowestPriceTimestamp = getCurrentTimestamp();
                trailingBuyPrice = Number(lowestPriceAfterSell + TRAILING_BUY_AMOUNT);
                logger.info(`New Lowest Price After Sell: ${lowestPriceAfterSell}`);
                logger.info(`Trailing Buy Price updated to: ${trailingBuyPrice}`);
                logger.info(`New Lowest Price Timestamp: ${lowestPriceTimestamp}`);
            }

            if (lowestPriceTimestamp !== null) {
                const elapsedTime = getCurrentTimestamp() - lowestPriceTimestamp;
                logger.info(`Elapsed Time since lowest price: ${elapsedTime} seconds`);

                if (currentPrice >= trailingBuyPrice) { //todo 
                    if (elapsedTime <= TIME_LAPSE) {
                        logger.info("Price has risen above trailing buy price and elapsed time is within the allowed range, placing buy order.");
                        const buyResponse = await placeOrder('BUY', SYMBOL, QUANTITY);

                        if (buyResponse === null) {
                            logger.info("Error placing buy order.");
                            continue;
                        }

                        buyPrice = currentPrice;
                        logger.info(`Price after Buy: ${buyPrice}`);
                        highestPriceAfterBuy = currentPrice;
                        trailingSellPrice = highestPriceAfterBuy - TRAILING_STOP_AMOUNT;
                        logger.info(`Trailing Sell Price set to: ${trailingSellPrice}`);

                        lowestPriceAfterSell = currentPrice;
                        lowestPriceTimestamp = getCurrentTimestamp();
                        soldOut = false;
                        logger.info("You are no longer sold out. Tracking for trailing stop loss.");
                    } else {
                        logger.info(`Price ${currentPrice} is above the trailing buy price ${trailingBuyPrice}, but elapsed time ${elapsedTime} exceeds ${TIME_LAPSE}. Resetting to current price.`);
                        lowestPriceAfterSell = currentPrice;
                        lowestPriceTimestamp = getCurrentTimestamp();
                        trailingBuyPrice = Number(lowestPriceAfterSell + TRAILING_BUY_AMOUNT);
                        logger.info(`Lowest Price After Sell reset to ${lowestPriceAfterSell}. New Trailing Buy Price: ${trailingBuyPrice}`);
                    }
                } else {
                    logger.info(`Current price ${currentPrice} is below the trailing buy price ${trailingBuyPrice}. Not placing buy order.`);
                }
            }
        } else {
            const currentPrice = await getCurrentPrice(SYMBOL);

            if (currentPrice === 0.0) {
                logger.info("Error fetching current price!");
                await new Promise(resolve => setTimeout(resolve, TIME_SLEEP * 1000));
                continue;
            }

            if (currentPrice > highestPriceAfterBuy) {
                highestPriceAfterBuy = currentPrice;
                trailingSellPrice = Number(highestPriceAfterBuy - TRAILING_STOP_AMOUNT);
                logger.info(`New Highest Price After Buy: ${highestPriceAfterBuy}`);
            }

            logger.info(`Current Price: ${currentPrice}`);
            logger.info(`Trailing Sell Price: ${trailingSellPrice}`);

            if (currentPrice <= trailingSellPrice) {
                logger.info("Price has dropped to the trailing sell price, selling now.");
                const sellResponse = await placeOrder('SELL', SYMBOL, QUANTITY);

                if (sellResponse === null) {
                    error("Error placing sell order.");
                } else {
                    sellPrice = currentPrice;
                    const profitOrLoss = QUANTITY * (sellPrice - buyPrice);
                    totalProfitOrLoss += profitOrLoss;  // Add the current profit or loss to the total
                    lowestPriceAfterSell = sellPrice;
                    totalTransations += 1;
                    logger.info(`Sell Price: ${sellPrice}`);
                    logger.info(`Buy Price: ${buyPrice}`);
                    logger.info(`Profit/Loss for this trade: $${profitOrLoss}`);

                    soldOut = true;
                    logger.info("You are now sold out. Ready to buy again.");
                }

                await new Promise(resolve => setTimeout(resolve, TIME_SLEEP * 1000));
            }
        }
       
        logger.info(`Total Transaction: ${totalTransations}`); 
        logger.info(`Total Profit/Loss: $${totalProfitOrLoss}`);
        logger.info(`---^---------------------${SYMBOL}------------------------^----`);

        await new Promise(resolve => setTimeout(resolve, TIME_SLEEP * 1000));
    }
}

module.exports = {
  runBot
}