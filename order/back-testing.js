/* eslint-disable no-undef */
const logger = require('../utils/logger')
const session = require('../utils/session')
const error = require('../utils/error')
const { quoteBotFetch } = require('../quotes/quote')
const yahooFinance = require('yahoo-finance2').default;



const goLong = () => {
    const conf2 = {
        TRAILING_BUY_AMOUNT: 0.3,
        TRAILING_STOP_AMOUNT: 0.2,
        SYMBOL: 'TSLA',
        QUANTITY: 10,
        TIME_SLEEP: 1.8,
        TIME_LAPSE: 5,
        RESET_SELL_PRICE_EVERY: 70,
        LIVE: true
    }
    run(conf2)

    const conf3 = {
      TRAILING_BUY_AMOUNT: 0.20,
      TRAILING_STOP_AMOUNT: 0.10,
      SYMBOL: 'NVDA',
      QUANTITY: 10,
      TIME_SLEEP: 2,
      TIME_LAPSE: 5,
      RESET_SELL_PRICE_EVERY: 70,
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
        LIVE,
        DATA
    } = params || {}

    // Back test setting
    let counter = 0
    if (DATA) {
        LIVE = false
    }


    let state = {
        trailingBuyPrice: 0.0,
        trailingSellPrice: 0.0,
        highestPriceAfterBuy: 0.0,
        lowestPriceAfterSell: null,
        lowestPriceTime: null,
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

    const setStateReadyToBuy = () => {
        state.lowestPriceAfterSell = state.currentPrice
        state.lowestPriceTime = state.currentTime
        state.trailingBuyPrice = Number(state.lowestPriceAfterSell + TRAILING_BUY_AMOUNT)

        logger.info(`Lowest Price updated to: ${state.lowestPriceAfterSell}`)
        logger.info(`Trailing Buy Price updated to: ${state.trailingBuyPrice}`)
    }

    const updateStateAfterMisBuy = () => {
        setStateReadyToBuy()
        state.totalMisBuys += 1

        if (RESET_SELL_PRICE_EVERY && state.totalMisBuys % RESET_SELL_PRICE_EVERY === 0) {
            state.sellPrice = state.currentPrice
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
        logger.info(`Current Time: ${state.currentTime}`)
    }

    const updateStateAfterBuy = () => {
        state.buyPrice = state.currentPrice
        state.highestPriceAfterBuy = state.currentPrice
        state.trailingSellPrice = state.highestPriceAfterBuy - TRAILING_STOP_AMOUNT
        state.lowestPriceAfterSell = state.currentPrice
        state.lowestPriceTime = state.currentTime
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
        state.elapsedTime = (state.currentTime - state.lowestPriceTime) / 1000
        // console.log(state.currentTime, state.lowestPriceTime, state.elapsedTime)
        logger.info(`Elapsed Time since lowest price: ${state.elapsedTime} seconds`)
    }

    const updateStateWithCurrentPriceAndTime = async () => {
        const [price, timestamp] = await getCurrentPrice(SYMBOL)
        state.currentPrice = price
        state.currentTime = new Date(timestamp * 1000)
        if (state.currentPrice === null) {
            logger.info("Error fetching current price!")
            return false
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

    while (true) {
        state.lastPrice = state.currentPrice

        if (! DATA) {
            await sleep(TIME_SLEEP * 1000)
            if (! await updateStateWithCurrentPriceAndTime()) continue
        } else {
            if (DATA[counter]) {
                state.currentPrice = DATA[counter].open
                const todayEST = new Date();
                state.currentTime = new Date(new Date(DATA[counter].date).getTime() + todayEST.getTimezoneOffset() * 60000);
                
                if (counter % 60 === 0)
                    console.log(state.currentTime, DATA[counter].date)

                counter += 1

                if (!isMarketHour())
                    continue
            } else 
                break
        }


        logStateSummary()

        if (state.soldOut) {
            if (state.lowestPriceAfterSell === null || state.currentPrice < state.lowestPriceAfterSell) {
                setStateReadyToBuy()
            }

            logger.info(`Trailing Buy Price: ${state.trailingBuyPrice}`)

            updateStateWithElapsedTime()

            if (state.currentPrice >= state.trailingBuyPrice) { //&& !isMarketAboutToClose()
                if (state.currentPrice >= state.sellPrice && 
                    state.currentPrice >= state.lastPrice) {
                        
                    logger.info("Price has risen above trailing buy price and elapsed time is within the allowed range, placing buy order.")
                    const buyResponse = await placeOrder('BUY', SYMBOL, QUANTITY, LIVE)
    
                    if (buyResponse === null) {
                        logger.info("Error placing buy order.")
                        continue
                    }
    
                    updateStateAfterBuy()
                } else {
                    updateStateAfterMisBuy()

                    logger.info(`Price has risen above trailing buy price BUT ${state.currentPrice} is below ${state.sellPrice}. Resetting to current price`)
                }
            } else if (state.elapsedTime >= TIME_LAPSE)  {
                updateStateAfterMisBuy()

                logger.info(`Elapsed time ${state.elapsedTime} exceeds ${TIME_LAPSE}. Resetting to current price`)
            } else {
                logger.info(`Price ${state.currentPrice} is below ${state.trailingBuyPrice} and ${state.elapsedTime} is bellow ${TIME_LAPSE} seconds`)
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
                    continue
                } else {
                    updateStateAfterSell()
                }
            }
        }

    }
}

const batckTest = (params) => {
    const {symbol, period1, period2, TRAILING_BUY_AMOUNT, TRAILING_STOP_AMOUNT, TIME_LAPSE} = params
    // Fetch historical data for a specific ticker (e.g., AAPL)
    const fetchData = async () => {
      try {
        const result = await yahooFinance.chart(symbol, {
          period1, // Start date (YYYY-MM-DD)
          period2, // End date (YYYY-MM-DD)
          interval: '1m'  // Interval (1d for daily data)
        });

        const conf = {
            TRAILING_BUY_AMOUNT,
            TRAILING_STOP_AMOUNT,
            SYMBOL: symbol,
            QUANTITY: 10,
            TIME_SLEEP: 60 * 1,
            TIME_LAPSE,
            RESET_SELL_PRICE_EVERY: 10,
            LIVE: false,
            DATA: result.quotes
        }
        run(conf)

      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    
    fetchData();
}

const runBacktest = async () => {
    batckTest({
        symbol: 'TSLA', 
        // period1: '2025-02-17', 
        // period2: '2025-02-21',
        // period1: '2025-02-24', 
        // period2: '2025-02-28',
        period1: '2025-03-03', 
        period2: '2025-03-07',
        TRAILING_BUY_AMOUNT: 1.2, 
        TRAILING_STOP_AMOUNT: 0.3, 
        TIME_LAPSE: 60 * 1.1 //time lapse in seconds
    })
}

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


const getCurrentPrice = async (symbol) => {
    try {
        const [currentPrice, currentTime] = await quoteBotFetch(symbol)
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
  goLong,
  runBacktest
}