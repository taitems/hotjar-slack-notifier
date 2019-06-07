## Hotjar to Slack Notifier
This script was created to run periodically on my machine, with the purpose of forwarding the latest Hotjar responses to a Slack channel.

![Sample Slack post from the Hotjar integration](https://i.imgur.com/WiGN7wX.png)

### Setup Instructions
1. `npm install hotjar-slack-notifier` or `yarn add hotjar-slack-notifier`
2. Create a JSON storage endpoint that will store data in the shape of `{ lastIndex: 0 }`
Free tools include [https://jsonstorage.net](https://jsonstorage.net) [http://myjson.com](http://myjson.com) [https://jsonbin.io](https://jsonbin.io) or even Firebase. Keep the **API** version of the URL handy.
3. [Create a Slack webhook](https://api.slack.com/incoming-webhooks) and keep the URL handy
4. Find the two Hotjar values you need: your site ID and the ID of the poll you wish to monitor
5. Invoke the code as per the below value

### Example call
```
const HJSlack = require('hotjar-slack-notifier');

HJSlack({
    hotjarSiteId: 123456,
    hotjarPollId: 789012,
    currentIndexUrl: 'https://...',
    slackWebhookUrl: 'https://hooks.slack.com/...',
    username: 'email@domain.com',
    password: 'hunter2',
});
```

### Parameters
The two Hotjar values can best be discovered by dissassembling the URL of the page containing the responses to the poll you're interested in.

| Parameter | Description | Type |
| --- | --- | --- |
| hotjarSiteId | This is the ID associated with your Hotjar instance | String/Integer
| hotjarPollId | This is the ID associated the particular poll you are interested in monitoring the responses to | String/Integer
| currentIndexUrl | The URL of an endpoint that accepts GET/PUT API calls to both fetch and update the index (Integer) of the last Hotjar poll response | String (URL)
| slackWebhookUrl | The URL of the Slack webhook to invoke | String (URL)
| username | **DANGER:** Your Hotjar account username (appears to be an email address). | String
| password | **DANGER:** Your Hotjar password | String


### FAQs/Known Issues

#### Why does this script need my username and password?
At the time of authoring, Hotjar does not offer a public API nor a Slack plugin. While writing one would facilitate the other, Hotjar have stated that a Slack plugin is not going to be included in their roadmap. While Hotjar does have an API, it is for their internal use only and there is no public access to it.

#### Why does this run in a headless browser (Puppeteer)?
For the above reason, there is no other way to authenticate with their (private) API than to login as yourself and intercept the API requests used to build the poll responses page

#### Why are you using free, unauthenticated online JSON storage?
Because all they are storing is a single integer, the index of the last response that was "seen" by the script and posted to Slack.

#### I'm getting a timeout error
Sometimes puppeteer can be a bit flakey, even with high speed fibre internet. It may struggle to load and find the login form on the page.

#### The script won't get past fetching the index
Ensure that you are:
- Using the API version of your desired JSON storage service (eg: `api.service.com/id/` vs `service.com/id`)
- The first time it loads will be indistinguishable from an error, so ensure that you have data in the shape of `{ lastIndex: 0 }` for the first load

#### It skipped the first response
Maybe the line above should have been `-1` not `0` 🤷‍♀

#### The script won't update the index to the new position
Ensure that the JSON storage service you are using supports PUTs.

### License/Warranty
This software is provided as is. You are entering your username and password into a third party script. You do so at your own risk.