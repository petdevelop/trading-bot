const logger = require('./logger');
const sendMail = require('../utils/mailer')

module.exports = (message, exit) => {
  logger.info(message);
  console.error(message);
  // exit && process.exit(1);
  // sendMail('Trading Bot Error', message)
};
