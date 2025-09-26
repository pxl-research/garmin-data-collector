const express = require('express');
const bodyParser = require('body-parser');
const fs = require('node:fs');
const https = require('https');
const http = require('http');
//const https = require('https');  for production/staging

const app = express();

let isSavingToFile = false;

app.use(bodyParser.json({ limit: '5000kb' }));

app.post('/garmin/webhook-WZuUYtzlRbOKRUvIskLqPePaG', async (request, result) => {
    // (JB) Believe this solution to be acceptable given the very small number of users.
    while (isSavingToFile)
        await sleep(100);

    isSavingToFile = true;
    await appendDataToUserDataFile(JSON.stringify(request.body));
    await appendDataToSyncLogFile(JSON.stringify(request.body));
    await sendDataToStrapi(JSON.stringify(request.body));
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
            console.log("Data saved to userdata file.");
            isSavingToFile = false;
            return;
        }

        console.error(callback.message);
    });
}

async function appendDataToSyncLogFile(data)
{
    if (data == undefined)
        return;

    const parsedData = JSON.parse(data);
    const firstKey = Object.keys(parsedData)[0];
    const extractedData = parsedData[firstKey].map(item => ({
        userId: item.userId,
        userAccessToken: item.userAccessToken,
        summaryId: item.summaryId
    }));

    const logEntry = {
        timestamp: new Date().toISOString(),
        message: "New Garmin data sync received",
        type: firstKey,
        data: extractedData
    };

    await fs.writeFile('garmin_daily_logs_sync.json', JSON.stringify(logEntry) + ',\n', { flag: 'a+' }, callback => {
        if (callback == null)
        {
            console.log("Data saved to garmin_daily_logs_sync file.");
            isSavingToFile = false;
            return;
        }

        console.error("Error saving to log file:", callback.message);
    });
}

async function sendDataToStrapi(data)
{
    console.log("Checking data to send to Strapi.");
    if (data == undefined)
    {
        console.log("Data to send is undefined.");
        return;
    }

    try {
        const parsedData = JSON.parse(data);
        const firstKey = Object.keys(parsedData)[0];
        
        console.log(`First key in data: "${firstKey}"`);
        await sendDataToStrapiBackend(firstKey, data);
        console.log("Data sent to Strapi backend successfully.");
        
        // if (firstKey === "dailies") {
        //     console.log("Data contains 'dailies' - sending to Strapi backend.");
        //     await sendDataToStrapiBackend(firstKey, data);
        //     console.log("Data sent to Strapi backend successfully.");
        // } else {
        //     console.log(`Data contains '${firstKey}' - skipping Strapi backend (only 'dailies' data is sent).`);
        // }
    } catch (error) {
        console.error("Error processing data for Strapi:", error.message);
    }
}

async function sendDataToStrapiBackend(firstKey, data) {
    // change these based on the setup, take care of read/write rights for correct Strapi collections in this token
    const STRAPI_AUTH_TOKEN = 'a6d3633f61596f992cf33016bd509fd6052b58ca0feacd0aa609b1f992d3cddc6ac0e27ee5c415438934e868e16223acf429913469ac0f9550c49baae200c8c90dd1fdc46eef5272bb1d94346840a44adc2bbcc19e16bb453d181294f9ff9a57b0493ebac4c990022a4788593a15154f35dfc61ab54eb1a925a11e5805f0e1c6';
    
    const useLocalhost = true; // Set to false for staging, TODO: add production option
    const strapiConfig = useLocalhost ? {
        hostname: 'localhost',
        port: 1338,
        path: '/api/garmin-daily-syncs',
        useHttps: false
    } : {
        hostname: 'staging.mia-cms.pxlsmartict.eu',
        port: 443,
        path: '/api/garmin-daily-syncs',
        useHttps: true
    };

    const parsedData = JSON.parse(data);

    const dailiesData = parsedData[firstKey][0];
    const type = firstKey;
    const userId = dailiesData?.userId || 'unknown_user';
    const userAccessToken = dailiesData?.userAccessToken || 'unknown_userAccessToken';
    
    const dataToSend = {
        type: type,
        userId: userId,
        userAccessToken: userAccessToken,
        garminData: parsedData
    };
    
    if (dailiesData?.steps !== undefined) {
        dataToSend.steps = dailiesData.steps;
    }
    
    if (dailiesData?.met !== undefined) {
        dataToSend.met = dailiesData.met;
    }
    
    const postData = JSON.stringify({
        data: dataToSend
    });
    
    console.log("Prepared POST data:", postData);

    const options = {
        hostname: strapiConfig.hostname,
        port: strapiConfig.port,
        path: strapiConfig.path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'Authorization': `Bearer ${STRAPI_AUTH_TOKEN}`
        }
    };

    return new Promise((resolve, reject) => {
        // Choose the right module based on protocol/environment (local vs staging/production)
        const requestModule = strapiConfig.useHttps ? https : http;
        
        const req = requestModule.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(responseData);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(postData);
        req.end();
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