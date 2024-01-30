const express = require('express');
const bodyParser = require('body-parser');
const fs = require('node:fs');

const app = express();

let isSavingToFile = false;

app.use(bodyParser.json({ limit: '5000kb' }));

app.post('/garmin/webhook-WZuUYtzlRbOKRUvIskLqPePaG', async (request, result) => {
    // (JB) Believe this solution to be acceptable given the very small number of users.
    while (isSavingToFile)
        await sleep(100);

    isSavingToFile = true;
    await appendDataToUserDataFile(JSON.stringify(request.body));
    result.status(200).send('OK');
    isSavingToFile = false;
});

const PORT = 3008;

app.listen(PORT, () => {
    console.log(`Now listening for Garmin user data syncs on port ${PORT}...`);
});

async function appendDataToUserDataFile(data)
{
    if (data == undefined)
        return;


    await fs.writeFile(`userdata_${getCustomDate()}.json`, data + ',\n', { flag: 'a+' }, callback => {
        if (callback == null)
        {
            console.log("Data saved to file.");
            isSavingToFile = false;
            return;
        }

        console.error(callback.message);
    });
}

function sleep(ms)
{
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCustomDate()
{
    let date = new Date(Date.now());

    let day;
    date.getDate() < 10 ? day = `0${date.getDate()}` : day = date.getDate();

    let month;
    (date.getMonth() + 1) < 10 ? month = `0${date.getMonth() + 1}` : month = date.getMonth() + 1;

    return `${date.getFullYear()}-${month}-${day}`;
}