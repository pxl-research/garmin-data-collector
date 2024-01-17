const express = require('express');
const bodyParser = require('body-parser');
const fs = require('node:fs');

const app = express();

let isSavingToFile = false;

app.use(bodyParser.json());

app.post('/garmin/webhook', async (request, result) => {
    while (isSavingToFile)
        await sleep(100);

    isSavingToFile = true;
    console.log('Event received...', request.body);
    console.log('Request data:');
    // await appendDataToUserDataFile(request.body.data.message);
    console.log(request);
    console.log('Result data:');
    console.log(result);
    result.status(200).send('OK');
    isSavingToFile = false;
});

const PORT = 3008;

app.listen(PORT, () => {
    console.log(`Now listening on port ${PORT}...`);
});

async function appendDataToUserDataFile(data)
{
    if (data == undefined)
        return;

    await fs.writeFile('userdata.json', data + '\n', { flag: 'a+' }, callback => {
        if (callback == null)
        {
            console.log("Data saved to file.");
            isSavingToFile = false;
            return;
        }
    });
}

function sleep(ms)
{
    return new Promise((resolve) => setTimeout(resolve, ms));
}