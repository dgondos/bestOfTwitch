'use strict'

console.log('Loading function')

const aws = require('aws-sdk')
const util = require('util')
const got = require('got')

exports.handler = async (event, context) => {
    console.info(`Parameters: ${JSON.stringify(event)}`)

    await getTwitchClientInfo()
        .then((clientInfo) => getTwitchToken(clientInfo.CLIENT_ID, clientInfo.CLIENT_SECRET).then((twitchToken) => [clientInfo, twitchToken]))
        .then(([clientInfo, twitchToken]) => getUser(event.twitchUser, twitchToken, clientInfo.CLIENT_ID).then((twitchUserID) => [clientInfo, twitchToken, twitchUserID]))
        .then(([clientInfo, twitchToken, twitchUserID]) => getFollows(twitchToken, clientInfo.CLIENT_ID, twitchUserID).then((follows) => [clientInfo, twitchToken, follows]))
        .then(([clientInfo, twitchToken, follows]) => getClips(twitchToken, clientInfo.CLIENT_ID, follows[0], event.utcHoursFrom, event.utcHoursTo))
}

const getTwitchClientInfo = () => {
    var secretsManager = new aws.SecretsManager({ region: process.env.AWS_REGION })

    const getSecretValue = util.promisify(secretsManager.getSecretValue).bind(secretsManager)
    return getSecretValue({ SecretId: process.env.TWITCH_CLIENT_SECRET_NAME })
        .then((data) => {
            if ('SecretString' in data) {
                const secret = data.SecretString
                return JSON.parse(secret)
            } else {
                let buff = new Buffer(data.SecretBinary, 'base64');
                const decodedBinarySecret = buff.toString('ascii');
                return JSON.parse(decodedBinarySecret)
            }
        })
        .catch((error) => {
            console.error(`Couldn't retrieve secret: ${error}`)
        })
}

const getTwitchToken = (clientId, clientSecret) => {
    let dynamoDB = new aws.DynamoDB({ region: process.env.AWS_REGION })
    const getItem = util.promisify(dynamoDB.getItem).bind(dynamoDB)
    const putItem = util.promisify(dynamoDB.putItem).bind(dynamoDB)
    return getItem({
        "Key": {
            "ClientId": {
                S: clientId
            }
        },
        "TableName": process.env.DYNAMODB_TABLE_NAME
    })
    .then((data) => {
        console.debug(data)
        if (data.Item === undefined) {
            let url = `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`
            console.debug(url)
            return got.post(url)
                .json()
                .then((data) => {
                    console.debug(data)
                    return putItem({
                        "Item": {
                            "ClientId": {
                                S: clientId
                            },
                            "APIToken": {
                                S: data.access_token
                            },
                            "Expiry": {
                                N: '' + (Math.floor(Date.now() / 1000) + data.expires_in)
                            }
                        },
                        "TableName": process.env.DYNAMODB_TABLE_NAME
                    })
                    .then((twitchData) => {
                        console.debug(twitchData)
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
        console.error(error)
    })
    
}

const getFollows = (twitchToken, clientId, user) => {
    const followsRequest = (cursor, follows) => {
        let url = `https://api.twitch.tv/helix/users/follows?from_id=${user}&first=100`
        if (cursor !== undefined) {
            url = url + `&after=${cursor}`
        }
        console.debug(url)
        return got.get(url, {
            headers: {
                "Authorization": `Bearer ${twitchToken}`,
                "Client-Id": clientId
            }
        })
            .json()
            .then((data) => {
                if (data.pagination !== undefined && data.pagination.cursor !== undefined) {
                    console.debug(`paginating: ${data.pagination.cursor}`)
                    console.debug(data)
                    return followsRequest(data.pagination.cursor, follows.concat(data.data))
                }
                else {
                    console.debug(data)
                    return follows.concat(data.data)
                }
            })
            .catch((error) => {
                console.error(`Error when getting follows from twitch: ${error}`)
            })
    }
    return followsRequest(undefined, [])
}

const getUser = (twitchLogin, twitchToken, clientId) => {
    let url = `https://api.twitch.tv/helix/users?login=${twitchLogin}`
    console.debug(url)
    return got.get(url, {
        headers: {
            "Authorization": `Bearer ${twitchToken}`,
            "Client-Id": clientId
        }
    })
        .json()
        .then((data) => {
            console.debug(data)
            return data.data[0].id
        })
        .catch((error) => {
            console.error(`Error when getting user id from twitch: ${error}`)
        })
}

const getClips = (twitchToken, clientId, follow, utcHoursFrom, utcHoursTo) => {
    const clipsRequest = (cursor, clips) => {
        const startedAt = new Date()
        startedAt.setUTCHours(utcHoursFrom, 0)
        const endedAt = new Date()
        endedAt.setUTCHours(utcHoursTo, 0)
        let url = `https://api.twitch.tv/helix/clips?broadcaster_id=${follow.to_id}&first=100&started_at=${startedAt.toISOString()}&ended_at=${endedAt.toISOString()}`
        if (cursor !== undefined) {
            url = url + `&after=${cursor}`
        }
        console.debug(url)
        return got.get(url, {
            headers: {
                "Authorization": `Bearer ${twitchToken}`,
                "Client-Id": clientId
            }
        })
            .json()
            .then((data) => {
                if (data.pagination !== undefined && data.pagination.cursor !== undefined) {
                    console.debug(`paginating: ${data.pagination.cursor}`)
                    console.debug(data)
                    return clipsRequest(data.pagination.cursor, clips.concat(data.data))
                }
                else {
                    console.debug(data)
                    return clips.concat(data.data)
                }
            })
            .catch((error) => {
                console.error(`Error when getting clips from twitch for follow ${follow.to_name}: ${error}`)
            })
    }
    return clipsRequest(undefined, [])
}