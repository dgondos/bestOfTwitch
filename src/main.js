'use strict'

console.log('Loading function')

const twitch = require('./twitchAPI')
const aws = require('./awsAPI')
const segmentProcessor = require('./segmentProcessor')

exports.handler = async (event, context) => {
    console.info(`Parameters: ${JSON.stringify(event)}`)

    await
        aws.getSecret(process.env.AWS_REGION, process.env.TWITCH_CLIENT_SECRET_NAME)
            .then((clientInfo) => getTwitchToken(clientInfo.CLIENT_ID, clientInfo.CLIENT_SECRET).then((twitchToken) => [clientInfo, twitchToken]))
            // .then(([clientInfo, twitchToken]) => twitch.getUser(event.twitchUser, twitchToken, clientInfo.CLIENT_ID).then((twitchUserID) => [clientInfo, twitchToken, twitchUserID]))
            // .then(([clientInfo, twitchToken, twitchUserID]) => twitch.getFollows(twitchToken, clientInfo.CLIENT_ID, twitchUserID).then((follows) => [clientInfo, twitchToken, follows]))
            .then(([clientInfo, twitchToken, follows]) => twitch.getClips(twitchToken, clientInfo.CLIENT_ID, follows, event.utcHoursFrom, event.utcHoursTo))
            .then((clipsData) => Promise.resolve(segmentProcessor.getTopSegments(clipsData.clips, event.segmentResolution, event.maxSegments)))
            .then((segments) => console.log(JSON.stringify(segments)))
}

const getTwitchToken = (clientId, clientSecret) => {
    return aws.getDynamoDBItem(process.env.AWS_REGION, process.env.DYNAMODB_TABLE_NAME, "ClientId", clientId)
        .then((data) => {
            console.debug(data)
            if (data.Item === undefined) {
                twitch.getToken(clientId, clientSecret)
                    .then((data) => {
                        console.debug(data)
                        return aws.putDynamoDBItem(process.env.AWS_REGION, process.env.DYNAMODB_TABLE_NAME, {
                            "ClientId": {
                                S: clientId
                            },
                            "APIToken": {
                                S: data.access_token
                            },
                            "Expiry": {
                                N: '' + (Math.floor(Date.now() / 1000) + data.expires_in)
                            }
                        })
                            .then((awsData) => {
                                console.debug(awsData)
                                return data.access_token
                            })
                            .catch((error) => {
                                console.error(`Error when storing twitch token in dynamodb: ${error}`)
                            })
                    })
                    .catch((error) => {
                        console.error(`Error when getting token from twitch: ${error}`)
                    })
            }
            else {
                return data.Item.APIToken.S
            }
        })
        .catch((error) => {
            console.error(`Error when retrieving twitch token from dynamoDB: ${error}`)
        })
}