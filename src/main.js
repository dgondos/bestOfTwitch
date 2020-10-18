'use strict'

console.log('Loading function')

const aws = require('aws-sdk')
const util = require('util')

exports.handler = async (event, context) => {
    console.log(`Parameters: ${JSON.stringify(event)}`)

    console.log(`Client info: ${await getTwitchClientInfo()}`)
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