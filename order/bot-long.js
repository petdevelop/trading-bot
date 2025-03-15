/* eslint-disable no-undef */
const logger = require('../utils/logger')
const session = require('../utils/session')
const error = require('../utils/error')
const { quoteBotFetch } = require('../quotes/quote')


const goLong = () => {
    const conf1 = {
        TRAILING_BUY_AMOUNT: 0.5,
        TRAILING_STOP_AMOUNT: 0.2,
        SYMBOL: 'NVDA',
        QUANTITY: 1,
        TIME_SLEEP: 1.5,
        TIME_LAPSE: 60 * 2,
        RESET_SELL_PRICE_EVERY: 2,
        LIVE: true
    }
    run(conf1)

    const conf2 = {
        TRAILING_BUY_AMOUNT: 1,
        TRAILING_STOP_AMOUNT: 0.3,
        SYMBOL: 'SPY',
        QUANTITY: 1,
        TIME_SLEEP: 3.5,
        TIME_LAPSE: 60 * 2.5,
        RESET_SELL_PRICE_EVERY: 2,
        LIVE: true
    }
    run(conf2)

    const conf3 = {
      TRAILING_BUY_AMOUNT: 1,
      TRAILING_STOP_AMOUNT: 0.3,
      SYMBOL: 'TSLA',
      QUANTITY: 1,
      TIME_SLEEP: 2.5,
      TIME_LAPSE: 60 * 1,
      RESET_SELL_PRICE_EVERY: 2,
      LIVE: true
    }
    run(conf3)

}


const run = async (params) => {
    let {
        TRAILING_BUY_AMOUNT,
        TRAILING_STOP_AMOUNT,
        SYMBOL,
        QUANTITY,
        TIME_SLEEP,
        TIME_LAPSE,
        RESET_SELL_PRICE_EVERY,
        LIVE
    } = params


    let state = {
        trailingBuyPrice: 0.0,
        trailingSellPrice: 0.0,
        highestPriceAfterBuy: 0.0,
        lowestPriceAfterSell: null,
        lowestPriceAfterSellTime: null,
        currentPrice: null,
        lastPrice: null,
        currentTime: null,
        soldOut: true,
        buyPrice: 0.0,
        sellPrice: 0.0,
        totalProfitOrLoss: 0.0,
        totalTransations: 0,
        totalMisBuys: 0,
        elapsedTime: 0,
    }

    while (true) {

        await sleep(TIME_SLEEP * 1000)
        if (! await updateStateWithPrice(state, SYMBOL, LIVE)) continue

        if (state.soldOut) {
            if (! state.lowestPriceAfterSell || state.currentPrice < state.lowestPriceAfterSell) {
                updateStateOnLowestPriceAfterSell(state, TRAILING_BUY_AMOUNT)
            }

            logger.info(`Trailing Buy Price: ${state.trailingBuyPrice}`)

            if (state.elapsedTime < TIME_LAPSE) {
                if (state.currentPrice >= state.trailingBuyPrice) {
                    if (state.currentPrice >= state.sellPrice && 
                        state.currentPrice >= state.lastPrice) {
                            
                        logger.info("Price has risen above trailing buy price and elapsed time is within the allowed range, placing buy order.")
                        const buyResponse = await placeOrder('BUY', SYMBOL, QUANTITY, LIVE)
        
                        if (! buyResponse) {
                            logger.info("Error placing buy order.")
                            continue
                        }
        
                        updateStateAfterBuy(state, TRAILING_STOP_AMOUNT)
                    } else {
                        updateStateAfterMisBuy(state, TRAILING_BUY_AMOUNT, RESET_SELL_PRICE_EVERY)
    
                        logger.info(`Price has risen above trailing buy price BUT ${state.currentPrice} is below ${state.sellPrice}. Resetting to current price`)
                    }
                } else {
                    logger.info(`Price ${state.currentPrice} is below ${state.trailingBuyPrice} and ${state.elapsedTime} is bellow ${TIME_LAPSE} seconds`)
                }
            } else  {
                updateStateAfterMisBuy(state, TRAILING_BUY_AMOUNT, RESET_SELL_PRICE_EVERY)

                logger.info(`Elapsed time ${state.elapsedTime} exceeds ${TIME_LAPSE}. Resetting to current price`)
            }
                
        } else {

            if (state.currentPrice > state.highestPriceAfterBuy) {
                updateStateOnHighestPriceAfterBuy(state, TRAILING_STOP_AMOUNT)
            }

            logger.info(`Trailing Sell Price: ${state.trailingSellPrice}`)

            if (state.currentPrice <= state.trailingSellPrice || state.currentPrice >= state.sellPrice + TRAILING_STOP_AMOUNT) { 

                logger.info("Price has dropped to the trailing sell price, selling now.")
                const sellResponse = await placeOrder('SELL', SYMBOL, QUANTITY, LIVE)

                if (! sellResponse) {
                    error("Error placing sell order.")
                    continue
                } else {
                    updateStateAfterSell(state, QUANTITY, TRAILING_BUY_AMOUNT)
                }
            }
        }

    }
}

/* Buy Flow */
const updateStateToReadyToBuy = (state, TRAILING_BUY_AMOUNT) => {
    state.lowestPriceAfterSell = state.currentPrice
    state.lowestPriceAfterSellTime = state.currentTime
    state.trailingBuyPrice = Number(state.lowestPriceAfterSell + TRAILING_BUY_AMOUNT)
}

const updateStateAfterBuy = (state, TRAILING_STOP_AMOUNT) => {
    updateStateToReadyToSell(state, TRAILING_STOP_AMOUNT)
    state.buyPrice = state.currentPrice
    state.soldOut = false

    logger.info(`Price after Buy: ${state.buyPrice}`)
    logger.info(`Trailing Sell Price set to: ${state.trailingSellPrice}`)
    logger.info("You are no longer sold out. Tracking for trailing stop loss.")
}

const updateStateOnHighestPriceAfterBuy = (state, TRAILING_STOP_AMOUNT) => {
    updateStateToReadyToSell(state, TRAILING_STOP_AMOUNT)
    logger.info(`New Highest Price After Buy: ${state.highestPriceAfterBuy}`)
}

const updateStateAfterMisBuy = (state, TRAILING_BUY_AMOUNT, RESET_SELL_PRICE_EVERY) => {
    updateStateToReadyToBuy(state, TRAILING_BUY_AMOUNT)
    state.totalMisBuys += 1

    if (RESET_SELL_PRICE_EVERY && state.totalMisBuys % RESET_SELL_PRICE_EVERY === 0) {
        state.sellPrice = state.currentPrice
    } 
}

/* Sell Flow */
const updateStateToReadyToSell = (state, TRAILING_STOP_AMOUNT) => {
    state.highestPriceAfterBuy = state.currentPrice
    state.trailingSellPrice = state.highestPriceAfterBuy - TRAILING_STOP_AMOUNT
}

const updateStateAfterSell = (state, QUANTITY, TRAILING_BUY_AMOUNT) => {
    updateStateToReadyToBuy(state, TRAILING_BUY_AMOUNT)

    state.sellPrice = state.currentPrice
    const profitOrLoss = QUANTITY * (state.sellPrice - state.buyPrice)
    state.totalProfitOrLoss += profitOrLoss 
    state.totalTransations += 1
    state.soldOut = true

    logger.info(`Sell Price: ${state.sellPrice}`)
    logger.info(`Buy Price: ${state.buyPrice}`)
    logger.info(`Profit/Loss for this trade: $${profitOrLoss}`)
    logger.info("You are now sold out. Ready to buy again.")
}

const updateStateOnLowestPriceAfterSell = (state, TRAILING_BUY_AMOUNT) => {
    updateStateToReadyToBuy(state, TRAILING_BUY_AMOUNT)

    logger.info(`Lowest Price updated to: ${state.lowestPriceAfterSell}`)
    logger.info(`Trailing Buy Price updated to: ${state.trailingBuyPrice}`)
}

const updateStateWithPrice = async (state, SYMBOL, LIVE) => {
    const [price, timestamp] = await getCurrentPrice(SYMBOL)
    state.lastPrice = state.currentPrice
    state.currentPrice = price
    state.currentTime = new Date(timestamp * 1000)
    state.elapsedTime = state.lowestPriceAfterSellTime ? (state.currentTime - state.lowestPriceAfterSellTime) / 1000 : 0

    if (state.currentPrice === null) {
        logger.info("Error fetching current price!")
        return false
    }

    logger.info(`------------------------${SYMBOL}----------------------------`)
    logger.info(`Live: ${LIVE}`)
    logger.info(`Total Transaction: ${state.totalTransations}`) 
    logger.info(`Total Profit/Loss: $${state.totalProfitOrLoss}`)
    logger.info(`Total Misbuys: ${state.totalMisBuys}`)
    logger.info(`Current Price: ${state.currentPrice}`)
    logger.info(`Current Time: ${state.currentTime}`)
    // logger.info(`Elapsed Time since lowest price: ${state.elapsedTime} seconds`)

    return true
}

const isMarketAboutToClose = () => {
    // Market close time in EST (3:58 PM), but want to convert to UTC
    const marketClose = new Date()
    marketClose.setHours(15, 58, 0, 0)  // Set to 3:58 PM

    // Convert to UTC
    const marketCloseUTC = new Date(marketClose.getTime() + marketClose.getTimezoneOffset() * 60000)

    if (state.currentTime >= marketClose) {
        console.log("It's time to sell before market close!")
        logger.info(`Selling before market close ${new Date(state.currentUTC)}, ${new Date(marketCloseUTC)}`)
        return true
    } 

    return false
}

const isMarketHour = (utcTime) => {
    // Convert the UTC time to local Eastern Time (EST or EDT)
    const localTime = new Date(utcTime);
    
    // Get the current time zone offset in minutes (to adjust for EST or EDT)
    const timezoneOffset = localTime.getTimezoneOffset();  // Offset in minutes

    // Adjust the UTC time to local time by applying the timezone offset
    const localTimeInMillis = localTime.getTime() + (timezoneOffset * 60000); // Convert minutes to milliseconds
    const localDate = new Date(localTimeInMillis);

    // Get the hours and minutes in the local time zone
    const hours = localDate.getHours();
    const minutes = localDate.getMinutes();

    // Market hours are from 9:30 AM to 4:00 PM
    // Check if the time is between 9:30 AM and 4:00 PM
    return (hours > 9 || (hours === 9 && minutes >= 30)) && hours < 16;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const placeOrder = async (orderAction, symbol, quantity, live) => {
    if (!live) 
        return await Promise.resolve()

    const clientOrderId = Math.floor(Math.random() * (9999999999 - 1000000000) + 1000000000)

    try {
        const previewResponse = await previewBotOrder(clientOrderId, orderAction, symbol, quantity)
        if (previewResponse.statusCode !== 200) { 
            error(previewResponse)
            return null
        } else {
            return await placeBotOrder(clientOrderId, previewResponse.body.PreviewOrderResponse.PreviewIds[0].previewId, orderAction, symbol, quantity)
        }
    } catch(error) {
        error(error)
        return null
    }

}

const getCurrentPrice = async (SYMBOL) => {
    try {
        const [currentPrice, currentTime] = await quoteBotFetch(SYMBOL)
        return [Number(currentPrice), currentTime]
    } catch(err) {
        return [null, null]
    }
   
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
        })

        const reqUrl = session.getPreviewOrderUrl()
        const authClient = session.getItem('authClient')

        // Sending POST request to API
        authClient.post(reqUrl, requestObject)
            .then((resp) => {
                // logger.info(`API url: ${reqUrl}`)
                // logger.info(`Request body: ${requestObject}`)
                // logger.info(`Receive response from preview order  \n${JSON.stringify(resp, null, 4)}`)

                if (resp.statusCode === 200) {
                    resolve(resp)  // Resolve the promise with the response
                } else if (resp.statusCode === 204) {
                    error(`Error processing Preview Order statusCode:${resp.statusCode}`, false)
                    reject(`Error processing Preview Order statusCode:${resp.statusCode}`)  // Reject the promise
                } else {
                    error(`Error processing Preview Order statusCode:${resp.statusCode}`, false)
                    reject(`Error processing Preview Order statusCode:${resp.statusCode}`)  // Reject the promise
                }
            })
            .catch((err) => {
                error(`Receive error from preview order: ${JSON.stringify(err)}`, false)
                reject(err)  // Reject the promise with the error
            })
    })
}
  
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
      })

      // logger.info(`Sending request to place order with body  \n${JSON.stringify(requestObject, null, 4)}`)
    
      const reqUrl = session.getPlaceOrderUrl()
      const authClient = session.getItem('authClient')
      
      // Sending POST request to API
      authClient.post(reqUrl, requestObject)
          .then((resp) => {
              // logger.info(`API url: ${reqUrl}`)
              // logger.info(`Request body: ${requestObject}`)
              // logger.info(`Receive response from Place Order  \n${JSON.stringify(resp, null, 4)}`)
              
              if (resp.statusCode === 200) {
                  // Successful response, resolve the promise
                  resolve(resp)
              } else if (resp.statusCode === 204) {
                  error(`Error processing Place Order statusCode:${resp.statusCode}`, false)
                  reject(`Error processing Place Order statusCode:${resp.statusCode}`)  // Reject the promise
              } else {
                  error(`Error processing Place Order statusCode:${resp.statusCode}`, false)
                  reject(`Error processing Place Order statusCode:${resp.statusCode}`)  // Reject the promise
              }
          })
          .catch((err) => {
              logger.info(err)
              error(`Receive error from place order: ${JSON.stringify(err)}`, false)
              reject(err)  // Reject the promise with the error
          })
  })
}


module.exports = {
  goLong
}