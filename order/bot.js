/* eslint-disable no-undef */
const logger = require('../utils/logger')
const session = require('../utils/session')
const error = require('../utils/error')
const { quoteBotFetch } = require('../quotes/quote')



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

const getCurrentTimestamp = () => {
    return Math.floor(new Date().getTime() / 1000)
}

const getCurrentPrice = async (symbol) => {
    let price
    try {
        price = await quoteBotFetch(symbol)
    } catch(err) {
        price = 0.0
    }
    return Number(price)
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


const runBot = () => {
    // const conf1 = {
    //     TRAILING_BUY_AMOUNT: 0.2,
    //     TRAILING_STOP_AMOUNT: 0.1,
    //     SYMBOL: 'INTC',
    //     QUANTITY: 100,
    //     TIME_SLEEP: 1.5,
    //     TIME_LAPSE: 5,
    //     LIVE: true
    // }
    // run(conf1)

    const conf2 = {
        TRAILING_BUY_AMOUNT: 0.35,
        TRAILING_STOP_AMOUNT: 0.15,
        SYMBOL: 'TSLA',
        QUANTITY: 50,
        TIME_SLEEP: 1,
        TIME_LAPSE: 5,
        RESET_SELL_PRICE_EVERY: 50,
        LIVE: true
    }
    run(conf2)

    const conf3 = {
      TRAILING_BUY_AMOUNT: 0.18,
      TRAILING_STOP_AMOUNT: 0.07,
      SYMBOL: 'NVDA',
      QUANTITY: 50,
      TIME_SLEEP: 1.1,
      TIME_LAPSE: 5,
      RESET_SELL_PRICE_EVERY: 50,
      LIVE: true
    }
    run(conf3)

  const conf4 = {
    TRAILING_BUY_AMOUNT: 0.15,
    TRAILING_STOP_AMOUNT: 0.05,
    SYMBOL: 'AAPL',
    QUANTITY: 50,
    TIME_SLEEP: 1.2,
    TIME_LAPSE: 5,
    RESET_SELL_PRICE_EVERY: 50,
    LIVE: true
  }
  run(conf4)

  const conf5 = {
    TRAILING_BUY_AMOUNT: 0.05,
    TRAILING_STOP_AMOUNT: 0.02,
    SYMBOL: 'INTL',
    QUANTITY: 10,
    TIME_SLEEP: 1.3,
    TIME_LAPSE: 5,
    RESET_SELL_PRICE_EVERY: 50,
    LIVE: true
  }
  run(conf5)

}


const run = async (params) => {
    const {
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
        lowestPriceTimestamp: null,
        currentPrice: null,
        soldOut: true,
        buyPrice: 0.0,
        sellPrice: 0.0,
        totalProfitOrLoss: 0.0,
        totalTransations: 0,
        totalMisBuys: 0,
        elapsedTime: 0,
    }

    const setStateReadyToBuy = () => {
        state.lowestPriceAfterSell = state.currentPrice
        state.lowestPriceTimestamp = getCurrentTimestamp()
        state.trailingBuyPrice = Number(state.lowestPriceAfterSell + TRAILING_BUY_AMOUNT)

        logger.info(`Lowest Price updated to: ${state.lowestPriceAfterSell}`)
        logger.info(`Trailing Buy Price updated to: ${state.trailingBuyPrice}`)
    }

    const updateStateAfterMisBuy = () => {
        setStateReadyToBuy()
        state.totalMisBuys += 1

        if (state.totalMisBuys % RESET_SELL_PRICE_EVERY === 0) {
            state.sellPrice = 0.0
        } 
    }

    const updateStateAfterSell = () => {
        state.sellPrice = state.currentPrice
        const profitOrLoss = QUANTITY * (state.sellPrice - state.buyPrice)
        state.totalProfitOrLoss += profitOrLoss 
        state.lowestPriceAfterSell = state.sellPrice
        state.totalTransations += 1
        state.soldOut = true

        logger.info(`Sell Price: ${state.sellPrice}`)
        logger.info(`Buy Price: ${state.buyPrice}`)
        logger.info(`Profit/Loss for this trade: $${profitOrLoss}`)
        logger.info("You are now sold out. Ready to buy again.")
    }

    const logStateSummary = () => {
        logger.info(`------------------------${SYMBOL}----------------------------`)
        logger.info(`Live: ${LIVE}`)
        logger.info(`Total Transaction: ${state.totalTransations}`) 
        logger.info(`Total Profit/Loss: $${state.totalProfitOrLoss}`)
        logger.info(`Total Misbuys: ${state.totalMisBuys}`)
        logger.info(`Current Price: ${state.currentPrice}`)
    }

    const updateStateAfterBuy = () => {
        state.buyPrice = state.currentPrice
        state.highestPriceAfterBuy = state.currentPrice
        state.trailingSellPrice = state.highestPriceAfterBuy - TRAILING_STOP_AMOUNT
        state.lowestPriceAfterSell = state.currentPrice
        state.lowestPriceTimestamp = getCurrentTimestamp()
        state.soldOut = false

        logger.info(`Price after Buy: ${state.buyPrice}`)
        logger.info(`Trailing Sell Price set to: ${state.trailingSellPrice}`)
        logger.info("You are no longer sold out. Tracking for trailing stop loss.")
    }

    const onHighestPriceAfterBuy = () => {
        state.highestPriceAfterBuy = state.currentPrice
        state.trailingSellPrice = Number(state.highestPriceAfterBuy - TRAILING_STOP_AMOUNT)
        logger.info(`New Highest Price After Buy: ${state.highestPriceAfterBuy}`)
    }

    const updateStateWithElapsedTime = () => {
        state.elapsedTime = getCurrentTimestamp() - state.lowestPriceTimestamp
        logger.info(`Elapsed Time since lowest price: ${state.elapsedTime} seconds`)
    }

    const updateStateWithCurrentPrice = async () => {
        state.currentPrice = await getCurrentPrice(SYMBOL)
        if (state.currentPrice === 0.0) {
            logger.info("Error fetching current price!")
            return false
        }
        logger.info(`Current Price: ${state.currentPrice}`)
        return true
    }

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

    while (true) {
        await sleep(TIME_SLEEP * 1000)

        if (! await updateStateWithCurrentPrice()) continue

        logStateSummary()

        if (state.soldOut) {
            if (state.lowestPriceAfterSell === null || state.currentPrice < state.lowestPriceAfterSell) {
                setStateReadyToBuy()
            }

            logger.info(`Trailing Buy Price: ${state.trailingBuyPrice}`)

            updateStateWithElapsedTime()

            if (state.currentPrice >= state.trailingBuyPrice) {
                if (state.currentPrice >= state.sellPrice) {
                    logger.info("Price has risen above trailing buy price and elapsed time is within the allowed range, placing buy order.")
                    const buyResponse = await placeOrder('BUY', SYMBOL, QUANTITY, LIVE)
    
                    if (buyResponse === null) {
                        logger.info("Error placing buy order.")
                        continue
                    }
    
                    updateStateAfterBuy()
                } else {
                    updateStateAfterMisBuy()

                    logger.info(`${state.currentPrice} is below ${state.sellPrice}. Resetting to current price`)
                }
            } else if (state.elapsedTime >= TIME_LAPSE)  {
                updateStateAfterMisBuy()

                logger.info(`Elapsed time ${state.elapsedTime} exceeds ${TIME_LAPSE}. Resetting to current price`)
            } else {
                logger.info(`Price ${state.currentPrice} is below ${state.trailingBuyPrice} and ${state.elapsedTime} is bellow ${TIME_LAPSE}`)
            }
                
        } else {

            if (state.currentPrice > state.highestPriceAfterBuy) {
                onHighestPriceAfterBuy()
            }

            logger.info(`Trailing Sell Price: ${state.trailingSellPrice}`)

            if (state.currentPrice <= state.trailingSellPrice) {
                logger.info("Price has dropped to the trailing sell price, selling now.")
                const sellResponse = await placeOrder('SELL', SYMBOL, QUANTITY, LIVE)

                if (sellResponse === null) {
                    error("Error placing sell order.")
                } else {
                    updateStateAfterSell()
                }
            }
        }

    }
}


module.exports = {
  runBot
}