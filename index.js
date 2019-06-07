const puppeteer = require('puppeteer');
const fetch = require('node-fetch');
const _ = require('lodash');

// -------------------------

async function load(params) {
  const HJ_SITE = params.hotjarSiteId;
  const HJ_POLL = params.hotjarPollId;
  const INDEX_URL = params.currentIndexUrl;
  const WEBHOOK_URL = params.slackWebhookUrl;
  const u = params.username;
  const p = params.password;
  
  if (!HJ_POLL || !HJ_SITE || !INDEX_URL || !WEBHOOK_URL || !u || !p) {
    return Error('Configuration error: Missing parameters');
  }
  
  const HJ_PAGE_URL = `https://insights.hotjar.com/sites/${HJ_SITE}/polls/responses/${HJ_POLL}`;
  const HJ_API_URL = `https://insights.hotjar.com/api/v1/sites/${HJ_SITE}/polls/${HJ_POLL}/responses`;
  
  // Get index of last response (eg: 10), anything with a higher index
  // is a new response (eg: 11, 12) and should be posted to Slack
  const LAST_INDEX = await getIndex(INDEX_URL);
  if (!_.isNumber(LAST_INDEX)) {
    return Error('Failed to load index position');
  }
  
  // Setup puppeteer instance which will log into Hotjar as they have no API
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Create a listener which intercepts the API request
  page.on('response', response => {
    if (response.url() === HJ_API_URL) {
      console.log('API call successfully intercepted')
      response.json()
      .then(grepResponses)
      .then(postToSlack)
      .then(updateIndex)
      .then(browser.close);
    }
  });
  
  // Navigate to page and login
  console.log('Loading hotjar login');
  await page.goto(HJ_PAGE_URL, { waitUntil: 'networkidle2' });
  console.log('-> Page loaded');
  console.log('Attempting login');
  const usernameField = await page.$('#email');
  await usernameField.type(u);
  const passwordField = await page.$('#password');
  await passwordField.type(p);
  await passwordField.press('Enter');
  console.log('-> Submitted login');
  await page.waitForNavigation({ waituntil: 'networkidle2' });
  console.log('Navigation awaited!');
  
  // After this point the earlier listener should be invoked
  
  // -------------------------
  
  async function getIndex(url) {
    console.log('Fetch current index point');
    return fetch(url)
    .then(res => res.json())
    .then((response) => {
      console.log(`-> Received ${response.lastIndex}`);
      return response.lastIndex;
    });
  }
  
  function updateIndex(index, url) {
    console.log(`Update index to ${index}`);
    if (!index || !_.isNumber(index)) {
      console.log('-> Skip updating or index is not a number');
      return;
    }
    return fetch(url, {
      method: 'put',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        lastIndex: index
      })
    })
  }
  
  function grepResponses(data) {
    const { responses } = data;
    console.log(`Parse ${responses.length} responses from HotJar API`);
    return _(responses)
    .filter((item) => {
      return item.index > LAST_INDEX;
    })
    .tap(console.log)
    .map((item) => {
      return {
        index: item.index,
        url: item.response_url,
        answers: item.content.answers,
        country_code: item.country_code,
        country_name: item.country_name,
        browser: item.os + ' - ' + item.browser,
      }
    })
    .value();
  }
  
  function postToSlack(responses) {
    if (!responses.length) {
      console.log(`No new responses`);
      return;
    }
    console.log(`Post ${responses.length} responses to Slack`);
    const newHighestIndex = _.maxBy(responses, 'index').index;
    const responseBlocks = _.map(responses, (response) => {
      const { answers, url, country_code, country_name, browser } = response;
      // Iterate over (possibly) multi question surveys
      const responsesToQuestions = _.map(answers, (item) => {
        return {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `*${item.question}*\n${item.answer}`
          }
        }
      });
      
      // Add user context and a divider
      responsesToQuestions.push({
        "type": "context",
        "elements": [
          {
            "type": "mrkdwn",
            "text": `*Page:* ${url}`
          },
          {
            "type": "mrkdwn",
            "text": `*Country:* :flag-${country_code}: ${country_name}`
          },
          {
            "type": "mrkdwn",
            "text": `*Browser:* ${browser}`
          }
        ]
      });
      
      responsesToQuestions.push({
        "type": "divider"
      })
      
      return responsesToQuestions;
    });
    
    // Append final "View All" action
    const blocks = _.flattenDeep(responseBlocks);
    blocks.push({
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": `View ${newHighestIndex} Responses`
          },
          "url": HJ_PAGE_URL
        }
      ]
    });
    
    // Post to Slack
    return fetch(WEBHOOK_URL, {
      method: 'post',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel: '#team-careers',
        blocks: blocks
      })
    }).then(() => {
      // Return index of last response
      return newHighestIndex;
    });
    
  }
  
}

module.exports = load;