# BestOfTwitch

Gives you a digest of your followed streamers - the digest includes the suggested best timestamp to start watching today's vod (the suggestion is guessed based on the frequency of clips).

# Usage

Implemented as an AWS Lambda function (serverless).

- Change `serverless.yml` to your liking
- Create a secret in AWS SecretsManager with the key you specify in `serverless.yml` for `TWITCH_CLIENT_SECRET_NAME`. The secret should contain a JSON in this format: `{"CLIENT_ID":"<twitch cliend ID>","CLIENT_SECRET","<twitch client secret>"}`
- Create a DynamoDB table with the name you specify in `serverless.yml` for `DYNAMODB_TABLE_NAME`. This will be used to store your API token from twitch. Set the TTL attribute to `Expiry`.
- Deploy with `npx serverless deploy`
- Test with `npx serverless invoke -f main -l -d <event data>`

# Event data

The event data the function is called with should be in this format:

```
{
    "twitchUser": "<user to retrieve followers from>"
}
```