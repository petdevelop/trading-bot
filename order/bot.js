/* eslint-disable no-undef */
const logger = require('../utils/logger');
const session = require('../utils/session');
const error = require('../utils/error');
const { quoteBotFetch } = require('../quotes/quote')


/** Bot parameters **/ 
const TRAILING_BUY_PERCENTAGE = 0.004  // Trailing buy percentage for buying  
const TRAILING_STOP_PERCENTAGE = 0.002  // Trailing stop loss percentage for selling 
const SYMBOL = "HOLO"
const QUANTITY = 1  // This is a fixed amount (not a percentage)
const TIME_SLEEP = 5  // Sleep for X seconds, adjust based on frequency of checks
const TIME_LAPSE = 60 * 1  // Maximum allowed time lapse (in seconds) to buy again 60 * 30


  const placeOrder = async (orderAction) => {
    const clientOrderId = Math.floor(Math.random() * (9999999999 - 1000000000) + 1000000000);

    const previewResponse = await previewBotOrder(clientOrderId, orderAction)
    if (previewResponse.statusCode !== 200) { 
      return error(previewResponse)
    }

    await placeBotOrder(clientOrderId, previewResponse.body.PreviewOrderResponse.PreviewIds[0].previewId, orderAction)
  }

  const getCurrentTimestamp = () => {
      return Math.floor(new Date().getTime() / 1000);
  }

  const getCurrentPrice = async (symbol) => {
    const price = await quoteBotFetch(symbol)
    return price ?? 0.0
  }

const previewBotOrder = (clientOrderId, orderAction) => {
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
                                    symbol: SYMBOL
                                },
                                orderAction: orderAction,
                                quantityType: 'QUANTITY',
                                quantity: QUANTITY
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
                logger.info(`API url: ${reqUrl}`);
                logger.info(`Request body: ${requestObject}`);
                logger.info(`Receive response from preview order  \n${JSON.stringify(resp, null, 4)}`);

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

  
const placeBotOrder = (clientOrderId, previewId, orderAction) => {
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
                                  symbol: SYMBOL
                              },
                              orderAction: orderAction,
                              quantityType: 'QUANTITY',
                              quantity: QUANTITY
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

      logger.info(`Sending request to place order with body  \n${JSON.stringify(requestObject, null, 4)}`);
    
      const reqUrl = session.getPlaceOrderUrl();
      const authClient = session.getItem('authClient');
      
      // Sending POST request to API
      authClient.post(reqUrl, requestObject)
          .then((resp) => {
              logger.info(`API url: ${reqUrl}`);
              logger.info(`Request body: ${requestObject}`);
              logger.info(`Receive response from Place Order  \n${JSON.stringify(resp, null, 4)}`);
              
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
              console.log(err);
              error(`Receive error from place order: ${JSON.stringify(err)}`, false);
              reject(err);  // Reject the promise with the error
          });
  });
};




const runBot = async () => {

    let trailingBuyPrice = 0.0;
    let trailingSellPrice = 0.0;
    let highestPriceAfterBuy = 0.0;
    let lowestPriceAfterSell = null;
    let lowestPriceTimestamp = null;
    let soldOut = true;
    let buyPrice = 0.0;
    let sellPrice = 0.0;

    while (true) {
        console.log("----------------------------------------------------");

        if (soldOut) {
            const currentPrice = await getCurrentPrice(SYMBOL);

            if (currentPrice === 0.0) {
                console.log("Error fetching current price!");
                await new Promise(resolve => setTimeout(resolve, TIME_SLEEP * 1000));
                continue;
            }

            console.log(`Current Price: ${currentPrice}`);

            if (lowestPriceAfterSell === null) {
                console.log(`Price after sell: ${currentPrice}`);
                lowestPriceAfterSell = currentPrice;
                lowestPriceTimestamp = getCurrentTimestamp();
                trailingBuyPrice = lowestPriceAfterSell * (1 + TRAILING_BUY_PERCENTAGE);
                console.log(`Trailing Buy Price set to: ${trailingBuyPrice}`);
                console.log(`Lowest Price Timestamp: ${lowestPriceTimestamp}`);
            }

            console.log(`Lowest Price After Sell: ${lowestPriceAfterSell}`);
            console.log(`Trailing Buy Price: ${trailingBuyPrice}`);

            if (currentPrice < lowestPriceAfterSell) {  
                lowestPriceAfterSell = currentPrice;
                lowestPriceTimestamp = getCurrentTimestamp();
                trailingBuyPrice = lowestPriceAfterSell * (1 + TRAILING_BUY_PERCENTAGE);
                console.log(`New Lowest Price After Sell: ${lowestPriceAfterSell}`);
                console.log(`Trailing Buy Price updated to: ${trailingBuyPrice}`);
                console.log(`New Lowest Price Timestamp: ${lowestPriceTimestamp}`);
            }

            if (lowestPriceTimestamp !== null) {
                const elapsedTime = getCurrentTimestamp() - lowestPriceTimestamp;
                console.log(`Elapsed Time since lowest price: ${elapsedTime} seconds`);

                if (currentPrice >= trailingBuyPrice) { //todo 
                    if (elapsedTime <= TIME_LAPSE) {
                        console.log("Price has risen above trailing buy price and elapsed time is within the allowed range, placing buy order.");
                        const buyResponse = await placeOrder('BUY');

                        if (buyResponse === null) {
                            console.log("Error placing buy order.");
                            continue;
                        }

                        buyPrice = currentPrice;
                        console.log(`Price after Buy: ${buyPrice}`);
                        highestPriceAfterBuy = currentPrice;
                        trailingSellPrice = highestPriceAfterBuy * (1 - TRAILING_STOP_PERCENTAGE);
                        console.log(`Trailing Sell Price set to: ${trailingSellPrice}`);

                        lowestPriceAfterSell = currentPrice;
                        lowestPriceTimestamp = getCurrentTimestamp();
                        soldOut = false;
                        console.log("You are no longer sold out. Tracking for trailing stop loss.");
                    } else {
                        console.log(`Price ${currentPrice} is above the trailing buy price ${trailingBuyPrice}, but elapsed time ${elapsedTime} exceeds TIME_LAPSE. Resetting to current price.`);
                        lowestPriceAfterSell = currentPrice;
                        lowestPriceTimestamp = getCurrentTimestamp();
                        trailingBuyPrice = lowestPriceAfterSell * (1 + TRAILING_BUY_PERCENTAGE);
                        console.log(`Lowest Price After Sell reset to ${lowestPriceAfterSell}. New Trailing Buy Price: ${trailingBuyPrice}`);
                    }
                } else {
                    console.log(`Current price ${currentPrice} is below the trailing buy price ${trailingBuyPrice}. Not placing buy order.`);
                }
            }
        } else {
            const currentPrice = await getCurrentPrice(SYMBOL);

            if (currentPrice === 0.0) {
                console.log("Error fetching current price!");
                await new Promise(resolve => setTimeout(resolve, TIME_SLEEP * 1000));
                continue;
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
                const sellResponse = await placeOrder('SELL');

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

                await new Promise(resolve => setTimeout(resolve, TIME_SLEEP * 1000));
            }
        }

        await new Promise(resolve => setTimeout(resolve, TIME_SLEEP * 1000));
    }
}

module.exports = {
  runBot
}