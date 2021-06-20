# Vasco Meter

Vasco Meter is a Slack application that counts reactions with `:vasco:` emoji to determine how much Vascos teammates are giving you!

![Vasco](vasco.png)

## Setup

In order to run Vasco Meter you need:

1. MongoBD running locally on the same host and listening on port `27017`;
2. `SLACK_TOKEN` env variable set to a valid Slack API token (for meter to fetch user info);
3. `BOT_TOKEN` set to the token provided by bot in order to be protected from forged requests.