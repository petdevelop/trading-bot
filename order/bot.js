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
