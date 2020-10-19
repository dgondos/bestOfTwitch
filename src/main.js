'use strict'

console.log('Loading function')

const aws = require('aws-sdk')
const util = require('util')
const got = require('got')
const { stringify } = require('querystring')

exports.handler = async (event, context) => {
    console.log(`Parameters: ${JSON.stringify(event)}`)

    await getTwitchClientInfo()
    .then((clientInfo) => getTwitchToken(clientInfo.CLIENT_ID, clientInfo.CLIENT_SECRET).then((twitchToken) => [clientInfo, twitchToken]))
    .then(([clientInfo, twitchToken]) => getFollows(twitchToken, clientInfo.CLIENT_ID, event.twitchUser).then((follows) => [clientInfo, twitchToken, follows]))
    .then(([clientInfo, twitchToken, follows]) => console.log(JSON.stringify(follows)))
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
            console.log(`Couldn't retrieve secret: ${error}`)
        })
}

// TODO implement check to only get new token when needed
const getTwitchToken = (clientId, clientSecret) => {
    return got.post(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`)
        .json()
        .then((data) => {
            return data.access_token
        })
        .catch((error) => {
            console.log(`Error when getting token from twitch: ${error}`)
        })
}

// TODO test, get user ID from user login
const getFollows = (twitchToken, clientId, user) => {
    const followsRequest = (cursor, follows) => {
        let url = `https://api.twitch.tv/helix/users/follows?from_id=${user}&first=100`
        if (cursor !== undefined) {
            url = url + `&after=${cursor}`
        }
        console.log(url)
        return got.get(url, {
            headers: {
                "Authorization": `Bearer ${twitchToken}`,
                "Client-Id": clientId
            }
        })
        .json()
        .then((data) => {
            if (data.pagination !== undefined && data.pagination.cursor !== undefined) {
                console.log(`paginating: ${data.pagination.cursor}`)
                return followsRequest(data.pagination.cursor, follows.concat(data.data))
            }
            else {
                return follows.concat(data.data)
            }
        })
        .catch((error) => {
            console.log(`Error when getting follows from twitch: ${error}`)
        })
    }
    return followsRequest(undefined, [])
}