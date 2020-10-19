'use strict'

console.log('Loading function')

const aws = require('aws-sdk')
const util = require('util')
const got = require('got')

exports.handler = async (event, context) => {
    console.log(`Parameters: ${JSON.stringify(event)}`)

    await getTwitchClientInfo()
    .then((clientInfo) => getTwitchToken(clientInfo.CLIENT_ID, clientInfo.CLIENT_SECRET))
    .then((token) => console.log(`Token: ${token}`))
}

const getTwitchClientInfo = () => {
    var secretsManager = new aws.SecretsManager({ region: process.env.AWS_REGION })

    const getSecretValue = util.promisify(secretsManager.getSecretValue).bind(secretsManager)
    return getSecretValue({ SecretId: process.env.TWITCH_CLIENT_SECRET_NAME })
        .then((data) => {
            if ('SecretString' in data) {
                const secret = data.SecretString
                return secret
            } else {
                let buff = new Buffer(data.SecretBinary, 'base64');
                const decodedBinarySecret = buff.toString('ascii');
                return decodedBinarySecret
            }
        })
}

const getTwitchToken = (clientId, clientSecret) => {
    got.post(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`)
        .then((data) => {
            return data.access_token
        })
}