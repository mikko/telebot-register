// https://telegram.me/tele_me_test_bot?start=myfineservice

const telegram = require('telegram-bot-api');
const storage = require('@google-cloud/storage')();
const uuidv5 = require('uuid/v5');
const env = require('./env.json');

const respond = (userID, message) => {
  console.log('Sending', message);
  const api = new telegram({
    token: env.botToken,
    updates: {
      enabled: false,
    },
  });
  api.sendMessage({
    chat_id: userID,
    text: message,
  });
};

const parseMessage = message => ({userID: message.from.id, msgText: message.text});

const handleStartCommand = (userID) => respond(userID, [
  'Hi.',
  'This is your friendly neighbourhood notification bot.',
  'You can subscribe to notifications with `/subscribe servicename`'].join('\n'));

const handleRegistrationCommand = (userID, msgText) => {
  const serviceName = msgText.split(' ')[1];

  if (serviceName === undefined || serviceName.length < 5) {
    respond(userID, '`/subscribe` requires a valid service name');
    return;
  }

  const mahBucket = storage.bucket(env.bucketName);
  const file = mahBucket.file(`service_${serviceName}.json`);

  file.download()
    .then(data => {
      const dataStore = JSON.parse(data.toString());

      const NAMESPACE = uuidv5(`${serviceName}${env.domainName}`, uuidv5.DNS);
      const userHash = uuidv5(userID, NAMESPACE);

      dataStore.users[userHash] = userID;

      file.save(JSON.stringify(dataStore, null, 2))
        .then(() => {
          respond(userID, `Your shared secret for ${serviceName}:\n${userHash}`);
        })
        .catch(err => {
          console.log(err);
          respond(userID, `Subscribe to ${serviceName} failed. Try again.`);
        });
    })
    .catch(err => {
      console.log(err);
      respond(userID, `Unknown service ${serviceName}`);
    });
};

/**
 * HTTP Cloud Function.
 *
 * @param {Object} req Cloud Function request context.
 * @param {Object} res Cloud Function response context.
 */
exports.registerBot = (req, res) => {
  if (req.body.message === undefined) {
    res.status(400).send('');
  }
  console.log(JSON.stringify(req.body.message, null, 2));
  const {userID, msgText} = parseMessage(req.body.message);

  const isStartCommand = msgText.indexOf('/start') !== -1;

  if (isStartCommand) {
    handleStartCommand(userID);
    res.send('');
    return;
  }

  const isRegisterCommand = msgText.indexOf('/subscribe') !== -1;

  // StartCommand should look like /start some.service.com
  if (isRegisterCommand) {
    handleRegistrationCommand(userID, msgText);
    res.send('');
  } else {
    res.send('');
  }
};
