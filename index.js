const express = require('express');
const bodyParser = require('body-parser');

const app = express();

app.use(bodyParser.json());

app.post('/garmin/webhook', (request, result) => {
    console.log('Event received: ', request.body);
    result.status(200).send('OK');
});

const PORT = 3008;

app.listen(PORT, () => {
    console.log(`Now listening on port ${PORT}...`);
});