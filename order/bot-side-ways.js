/* eslint-disable no-undef */
const logger = require('../utils/logger')
const session = require('../utils/session')
const error = require('../utils/error')
const { quoteBotFetch } = require('../quotes/quote')

const BUY_TYPE = {
    LONG: 'LONG',
    SHORT: 'SHORT'
}

const MARKET_SESSION_TYPE = {
    REGULAR: 'REGULAR',
    EXTENDED: 'EXTENDED'
}

const ORDER_TERM = {
    GOOD_FOR_DAY: 'GOOD_FOR_DAY',
    GOOD_UNTIL_CANCEL: 'GOOD_FOR_DAY'
} 

const PRICE_TYPE = {
    LIMIT: 'LIMIT',
    MARKET: 'MARKET'
}


const goSideWays = () => {
    const conf1 = {
        SYMBOL: 'AAPL',
        QUANTITY: 5,
        TIME_SLEEP: 3,
        STRETCH_AMOUNT: 1,

        LIVE: true,
        TRAILING_BUY_AMOUNT: 0,
        TRAILING_STOP_AMOUNT: 0,
        TIME_LAPSE: 15
    }
    run(conf1)

    // const conf2 = {
    //     SYMBOL: 'SPY',
    //     QUANTITY: 5,
    //     TIME_SLEEP: 4,
    //     STRETCH_AMOUNT: 4,

    //     LIVE: true,
    //     TRAILING_BUY_AMOUNT: 0,
    //     TRAILING_STOP_AMOUNT: 0,
    //     TIME_LAPSE: 15
    // }
    // run(conf2)

    const conf3 = {
      SYMBOL: 'TSLA',
      QUANTITY: 5,
      TIME_SLEEP: 2,
      STRETCH_AMOUNT: 2,

      LIVE: true,
      TRAILING_BUY_AMOUNT: 0,
      TRAILING_STOP_AMOUNT: 0,
      TIME_LAPSE: 15
    }
    run(conf3)

    const conf4 = {
        SYMBOL: 'NVDA',
        QUANTITY: 5,
        TIME_SLEEP: 2.5,
        STRETCH_AMOUNT: 1,
  
        LIVE: true,
        TRAILING_BUY_AMOUNT: 0,
        TRAILING_STOP_AMOUNT: 0,
        TIME_LAPSE: 15
    }
    run(conf4)

    // const conf5 = {
    //     SYMBOL: 'BAC',
    //     QUANTITY: 20,
    //     TIME_SLEEP: 6,
    //     STRETCH_AMOUNT: 2,

    //     LIVE: true,
    //     TRAILING_BUY_AMOUNT: 0,
    //     TRAILING_STOP_AMOUNT: 0,
    //     TIME_LAPSE: 15
    // }
    // run(conf5)


    // const conf6 = {
    //     SYMBOL: 'PFE',
    //     QUANTITY: 20,
    //     TIME_SLEEP: 4.5,
    //     STRETCH_AMOUNT: 1,

    //     LIVE: true,
    //     TRAILING_BUY_AMOUNT: 0,
    //     TRAILING_STOP_AMOUNT: 0,
    //     TIME_LAPSE: 15
    // }
    // run(conf6)

}


const run = async (params) => {
    let {
        TRAILING_BUY_AMOUNT,
        TRAILING_STOP_AMOUNT,
        SYMBOL,
        QUANTITY,
        TIME_SLEEP,
        TIME_LAPSE,
        STRETCH_AMOUNT,
        LIVE
    } = params


    let state = {
        /*** Long ***/
        trailingBuyPriceLong: 0.0,
        trailingSellPriceLong: 0.0,
        highestPriceAfterBuy: 0.0,
        highestPriceAfterSell: null,
        highestPriceAfterSellTime: null,
        elapsedTimeAfterSellLong: 0,
        totalProfitOrLossLong: 0,
        totalTransationsLong: 0,
        buyPriceLong: 0, 

        /*** Short ***/
        trailingBuyPriceShort: 0.0,
        trailingSellPriceShort: 0.0,
        lowestPriceAfterBuy: 0.0,
        lowestPriceAfterSell: null,
        lowestPriceAfterSellTime: null,
        elapsedTimeAfterSellShort: 0,
        totalProfitOrLossShort: 0,
        totalTransationsShort: 0,
        buyPriceShort: 0, 

        /*** Common ***/
        currentPrice: null,
        lastPrice: null,
        lastJump: null,
        currentTime: null,
        soldOut: true,
        buyPrice: 0.0,
        sellPrice: 0.0,
        totalProfitOrLoss: 0.0,
        totalTransations: 0,
        totalMisBuys: 0,
        buyType: null, // SHORT | LONG
        regularOrder: null // true or false
    }

    while (true) {

        await sleep(TIME_SLEEP * 1000)
        if (! await updateStateWithPrice(state, SYMBOL, LIVE, STRETCH_AMOUNT, TRAILING_BUY_AMOUNT)) continue

        if (state.soldOut) {


            // if (state.elapsedTimeAfterSellShort > TIME_LAPSE || state.elapsedTimeAfterSellLong > TIME_LAPSE) {
            //     updateStateAfterMisBuyLong(state, TRAILING_BUY_AMOUNT)
            //     updateStateAfterMisBuyShort(state, TRAILING_BUY_AMOUNT)
            //     continue
            // }

            if (state.currentPrice >= state.trailingBuyPriceLong && state.currentPrice > state.buyPriceLong) {
                logger.info("Price has risen above trailing LONG buy price and elapsed time is within the allowed range, placing buy order.")
                const buyResponse = await placeOrder('BUY', SYMBOL, QUANTITY, LIVE, state.regularOrder, state.currentPrice)

                if (! buyResponse) {
                    logger.info("Error placing buy order.")
                    continue
                }

                updateStateAfterBuyLong(state, TRAILING_STOP_AMOUNT)

            } else if (state.currentPrice <= state.trailingBuyPriceShort && state.currentPrice < state.buyPriceShort) { 
                logger.info("Price has fallen trailing SHORT buy price and elapsed time is within the allowed range, placing buy order.")
                const sellShortResponse = await placeOrder('SELL_SHORT', SYMBOL, QUANTITY, LIVE, state.regularOrder, state.currentPrice)

                if (! sellShortResponse) {
                    logger.info("Error placing sell short order.")
                    continue
                }

                updateStateAfterBuyShort(state, TRAILING_STOP_AMOUNT)
            } else  {
                logger.info(`Trailing ...`)
            }
                
        } else {
            if (state.buyType === BUY_TYPE.LONG) {
                if (state.currentPrice > state.highestPriceAfterBuy) {
                    updateStateOnHighestPriceAfterBuyLong(state, TRAILING_STOP_AMOUNT)
                } 
                logger.info(`Trailing Sell Price: ${state.trailingSellPriceLong}`)

                // if (state.currentPrice < state.buyPrice - (TRAILING_STOP_AMOUNT / 2) || state.currentPrice >= state.buyPrice + TRAILING_STOP_AMOUNT) { 
                // if (state.currentPrice < state.buyPrice || state.currentPrice < state.trailingSellPriceLong) { 
                // if (state.currentPrice < state.buyPrice || state.currentPrice >= state.buyPrice + TRAILING_STOP_AMOUNT) { 
                    // || state.currentPrice >= state.buyPrice + state.lastJump
                if (state.currentPrice < state.trailingSellPriceLong) { 

                    logger.info("Price has dropped to the trailing sell price, selling now.")
                    const sellResponse = await placeOrder('SELL', SYMBOL, QUANTITY, LIVE, state.regularOrder, state.currentPrice)
                    
                    if (! sellResponse) {
                        error("Error placing sell order.")
                        continue
                    } else {
                        updateStateAfterSellLong(state, QUANTITY, TRAILING_BUY_AMOUNT)
                    }
                }
            } else if (state.buyType === BUY_TYPE.SHORT) {
                if (state.currentPrice < state.lowestPriceAfterBuy) {
                    updateStateOnLowestPriceAfterBuyShort(state, TRAILING_STOP_AMOUNT)
                }
                logger.info(`Trailing Sell Price: ${state.trailingSellPriceShort}`)

                // if (state.currentPrice > state.buyPrice || state.currentPrice <= state.buyPrice - TRAILING_STOP_AMOUNT) { 
                    // || state.currentPrice <= state.buyPrice - state.lastJump
                if (state.currentPrice > state.trailingSellPriceShort) { 

                    logger.info("Price has rise to the trailing sell price, selling now.")
                    const sellResponse = await placeOrder('BUY_TO_COVER', SYMBOL, QUANTITY, LIVE, state.regularOrder, state.currentPrice)
    
                    if (! sellResponse) {
                        error("Error placing sell order.")
                        continue
                    } else {
                        updateStateAfterSellShort(state, QUANTITY, TRAILING_BUY_AMOUNT)
                    }
                }
            } else {
                error(`Incorrect buyType ${state.buyType}`)
            }            

        }

    }
}

/*** Buy Long Flow ***/

const updateStateToReadyToBuyLong = (state, TRAILING_BUY_AMOUNT) => {
    state.lowestPriceAfterSell = state.currentPrice
    state.lowestPriceAfterSellTime = state.currentTime

    if (state.lastJump) {
        state.trailingBuyPriceLong = Number(state.lowestPriceAfterSell) + Number(state.lastJump)
    }
}

const updateStateAfterBuyLong = (state, TRAILING_STOP_AMOUNT) => {
    updateStateToReadyToSellLong(state, TRAILING_STOP_AMOUNT)
    state.buyPrice = state.currentPrice
    state.buyPriceLong = state.currentPrice
    state.buyType = BUY_TYPE.LONG
    state.soldOut = false

    logger.info(`Price after Buy Long: ${state.buyPrice}`)
    logger.info(`Trailing Sell Price set to: ${state.trailingSellPriceLong}`)
    logger.info("You are no longer sold out. Tracking for trailing stop loss.")
}

const updateStateOnHighestPriceAfterBuyLong = (state, TRAILING_STOP_AMOUNT) => {
    updateStateToReadyToSellLong(state, TRAILING_STOP_AMOUNT)
    logger.info(`New Highest Price After Buy: ${state.highestPriceAfterBuy}`)
}

const updateStateAfterMisBuyLong = (state, TRAILING_BUY_AMOUNT) => {
    updateStateToReadyToBuyLong(state, TRAILING_BUY_AMOUNT)
    state.totalMisBuys += 1
}

/*** Buy Short Flow ***/

const updateStateToReadyToBuyShort = (state, TRAILING_BUY_AMOUNT) => {
    state.highestPriceAfterSell = state.currentPrice
    state.highestPriceAfterSellTime = state.currentTime
    state.trailingBuyPriceShort = Number(state.highestPriceAfterSell - TRAILING_BUY_AMOUNT).toFixed(2)
}

const updateStateAfterBuyShort = (state, TRAILING_STOP_AMOUNT) => {
    updateStateToReadyToSellShort(state, TRAILING_STOP_AMOUNT)
    state.buyPrice = state.currentPrice
    state.buyPriceShort = state.currentPrice
    state.soldOut = false
    state.buyType = BUY_TYPE.SHORT

    logger.info(`Price after Buy Short: ${state.buyPrice}`)
    logger.info(`Trailing Sell Price set to: ${state.trailingBuyPriceShort}`)
    logger.info("You are no longer sold out. Tracking for trailing stop loss.")
}

const updateStateAfterMisBuyShort = (state, TRAILING_BUY_AMOUNT) => {
    updateStateToReadyToBuyShort(state, TRAILING_BUY_AMOUNT)
    state.totalMisBuys += 1
}

const updateStateOnLowestPriceAfterBuyShort = (state, TRAILING_STOP_AMOUNT) => {
    updateStateToReadyToSellShort(state, TRAILING_STOP_AMOUNT)
    logger.info(`New Lowest Price After Buy Short: ${state.lowestPriceAfterBuy}`)
}


/* Sell Flow */
const updateStateToReadyToSellLong = (state, TRAILING_STOP_AMOUNT) => {
    state.highestPriceAfterBuy = state.currentPrice
    if (state.lastJump) {
        state.trailingSellPriceLong = state.highestPriceAfterBuy - state.lastJump
    }
}

const updateStateToReadyToSellShort = (state, TRAILING_STOP_AMOUNT) => {
    state.lowestPriceAfterBuy = state.currentPrice
    state.trailingSellPriceShort = state.lowestPriceAfterBuy + state.lastJump
}


const updateStateAfterSellLong = (state, QUANTITY, TRAILING_BUY_AMOUNT) => {
    updateStateToReadyToBuyLong(state, TRAILING_BUY_AMOUNT)

    state.sellPrice = state.currentPrice
    const profitOrLoss = QUANTITY * (state.sellPrice - state.buyPrice)
    state.totalProfitOrLoss += profitOrLoss 
    state.totalTransations += 1
    state.totalProfitOrLossLong += profitOrLoss
    state.totalTransationsLong += 1
    state.soldOut = true

    logger.info(`Sell Price: ${state.sellPrice}`)
    logger.info(`Buy Price: ${state.buyPrice}`)
    logger.info(`Profit/Loss for this Long trade: $${profitOrLoss}`)
    logger.info("You are now sold out. Ready to buy again.")
}

const updateStateAfterSellShort = (state, QUANTITY, TRAILING_BUY_AMOUNT) => {
    updateStateToReadyToBuyShort(state, TRAILING_BUY_AMOUNT)

    state.sellPrice = state.currentPrice
    const profitOrLoss = QUANTITY * (state.buyPrice - state.sellPrice)
    state.totalProfitOrLoss += profitOrLoss 
    state.totalTransations += 1
    state.totalProfitOrLossShort += profitOrLoss
    state.totalTransationsShort += 1
    state.soldOut = true

    logger.info(`Sell Price: ${state.sellPrice}`)
    logger.info(`Buy Price: ${state.buyPrice}`)
    logger.info(`Profit/Loss for this Short trade: $${profitOrLoss}`)
    logger.info("You are now sold out. Ready to buy again.")
}

const updateStateOnLowestPriceAfterSell = (state, TRAILING_BUY_AMOUNT) => {
    updateStateToReadyToBuyLong(state, TRAILING_BUY_AMOUNT)

    logger.info(`Lowest Price updated to: ${state.lowestPriceAfterSell}`)
    logger.info(`Trailing Long Buy Price updated to: ${state.trailingBuyPriceLong}`)
}

const updateStateOnHighestPriceAfterSell = (state, TRAILING_BUY_AMOUNT) => {
    updateStateToReadyToBuyShort(state, TRAILING_BUY_AMOUNT)

    logger.info(`Highest Price updated to: ${state.lowestPriceAfterSell}`)
    logger.info(`Trailing Short Buy Price updated to: ${state.trailingBuyPriceShort}`)
}

const updateStateWithPrice = async (state, SYMBOL, LIVE, STRETCH_AMOUNT, TRAILING_BUY_AMOUNT) => {
    // const [price, timestamp, regular] = await getCurrentPrice(SYMBOL)
    const {bidPrice, askPrice, lastTradePrice, timeOfLastTrade, regularOrder} = await quoteBotFetch(SYMBOL) 

    state.lastPrice = state.currentPrice

    if (regularOrder) {
        state.currentPrice = Number(lastTradePrice).toFixed(2)
    } else {
        state.currentPrice = ((Number(bidPrice) + Number(askPrice)) / 2).toFixed(2)
    }


    // console.log(bidPrice, askPrice)
    // console.log(state.currentPrice)
    //     if (state.soldOut) {
    //         state.currentPrice = askPrice       
    //     } else {
    //         if (state.buyType === BUY_TYPE.LONG) {
    //             state.currentPrice = bidPrice
    //         } else {
    //             state.currentPrice = askPrice
    //         }
    //     }
    // }


    state.regularOrder = regularOrder

    if (! state.currentPrice || ! state.lastPrice) {
        logger.info("Error fetching current price!")
        return false
    } 

    state.currentTime = new Date(timeOfLastTrade * 1000)
    state.lastJump = state.lastPrice ? Math.abs(Number(state.currentPrice) - Number(state.lastPrice)).toFixed(2) : null

    state.elapsedTimeAfterSellLong = state.lowestPriceAfterSellTime ? (state.currentTime - state.lowestPriceAfterSellTime) / 1000 : 0
    state.elapsedTimeAfterSellShort = state.highestPriceAfterSellTime ? (state.currentTime - state.highestPriceAfterSellTime) / 1000 : 0

    if (! state.buyPriceLong) {
        state.buyPriceLong = state.currentPrice
    }

    if (! state.buyPriceShort) {
        state.buyPriceShort = state.currentPrice
    }

    if (! state.lowestPriceAfterSell || state.currentPrice < state.lowestPriceAfterSell) {
        updateStateOnLowestPriceAfterSell(state, TRAILING_BUY_AMOUNT)
    }

    if (! state.highestPriceAfterSell || state.currentPrice > state.highestPriceAfterSell) {
        updateStateOnHighestPriceAfterSell(state, TRAILING_BUY_AMOUNT)
    }

    logger.info(`------------------------${SYMBOL}----------------------------`)
    logger.info(`Live: ${LIVE}`)
    logger.info(`Total Misbuys: ${state.totalMisBuys}`)
    logger.info(`Total Transaction: ${state.totalTransations}, Long: ${state.totalTransationsLong}, Short: ${state.totalTransationsShort}`) 
    logger.info(`Total Profit/Loss: $${state.totalProfitOrLoss}, Long: $${state.totalProfitOrLossLong}, Short: $${state.totalProfitOrLossShort}`)
    logger.info(`Last Buy Price: $${state.buyPrice}, Long: $${state.buyPriceLong}, Short: $${state.buyPriceShort}`)
    logger.info(`Current Price: ${state.currentPrice} at ${state.currentTime}`)
    logger.info(`Elapsed Time since lowest price: ${state.elapsedTimeAfterSellLong} seconds, since highest price: ${state.elapsedTimeAfterSellShort} seconds`)
    logger.info(`Trailing Buy Price Long: ${state.trailingBuyPriceLong}, Short: ${state.trailingBuyPriceShort}`)
    logger.info(`Last Jump: ${state.lastJump}`)

    if (state.buyPriceLong - state.buyPriceShort >= STRETCH_AMOUNT) {
        state.buyPriceLong = state.currentPrice
        state.buyPriceShort = state.currentPrice
        logger.info(`Reseting buyPriceLong and buyPriceShort to ${state.currentPrice}`)
    }

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

const placeOrder = async (orderAction, symbol, quantity, live, regularOrder, currentPrice) => {
    if (!live) 
        return await Promise.resolve()

    const clientOrderId = Math.floor(Math.random() * (9999999999 - 1000000000) + 1000000000)

    try {
        const previewResponse = await previewBotOrder(clientOrderId, orderAction, symbol, quantity, regularOrder, currentPrice)
        console.log(previewResponse.statusCode)
        if (!previewResponse || Number(previewResponse.statusCode) !== 200) { 
            error(previewResponse)
            return null
        } 

        const placeResponse =  await placeBotOrder(clientOrderId, previewResponse.body.PreviewOrderResponse?.PreviewIds[0].previewId, orderAction, symbol, quantity, regularOrder, currentPrice)
        
        if (!placeResponse || Number(placeResponse.statusCode) !== 200) { 
            error(previewResponse)
            return null
        }
        return placeResponse
        
    } catch(e) {
        error(e)
        return null
    }

}


const previewBotOrder = (clientOrderId, orderAction, symbol, quantity, regularOrder, currentPrice) => {
    const orderTerm = regularOrder ? ORDER_TERM.GOOD_FOR_DAY : ORDER_TERM.GOOD_UNTIL_CANCEL
    const marketSession = regularOrder ? MARKET_SESSION_TYPE.REGULAR : MARKET_SESSION_TYPE.EXTENDED
    const priceType = regularOrder ? PRICE_TYPE.MARKET : PRICE_TYPE.LIMIT
    const limitPrice = regularOrder ? null : currentPrice

    return new Promise((resolve, reject) => {
        const requestObject = JSON.stringify({
            PreviewOrderRequest: {
                orderType: 'EQ',
                clientOrderId: `${clientOrderId}`,
                Order: [
                    {
                        allOrNone: false,
                        priceType,
                        orderTerm,
                        marketSession,
                        limitPrice,

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
                logger.info(`\n${JSON.stringify(requestObject, null, 4)}`)
                reject(err)  // Reject the promise with the error
            })
    })
}
  
const placeBotOrder = (clientOrderId, previewId, orderAction, symbol, quantity, regularOrder, currentPrice) => {
    const orderTerm = regularOrder ? ORDER_TERM.GOOD_FOR_DAY : ORDER_TERM.GOOD_UNTIL_CANCEL
    const marketSession = regularOrder ? MARKET_SESSION_TYPE.REGULAR : MARKET_SESSION_TYPE.EXTENDED
    const priceType = regularOrder ? PRICE_TYPE.MARKET : PRICE_TYPE.LIMIT
    const limitPrice = regularOrder ? null : currentPrice

  return new Promise((resolve, reject) => {
      const requestObject = JSON.stringify({
          PlaceOrderRequest: {
              orderType: 'EQ',
              clientOrderId: `${clientOrderId}`,
              Order: [
                  {
                      allOrNone: false,
                      priceType,
                      orderTerm,
                      marketSession,
                      limitPrice,
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
              logger.info(`\n${JSON.stringify(requestObject, null, 4)}`)
              error(`Receive error from place order: ${JSON.stringify(err)}`, false)
              reject(err)  // Reject the promise with the error
          })
  })
}


module.exports = {
    goSideWays,
    goShort: () => console.log('Not implemented')
}