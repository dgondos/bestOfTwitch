const aws = require('aws-sdk')
const util = require('util')

exports.getSecret = (region, secretId) => {
    var secretsManager = new aws.SecretsManager({ region: region })

    const getSecretValue = util.promisify(secretsManager.getSecretValue).bind(secretsManager)
    return getSecretValue({ SecretId: secretId })
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

exports.getDynamoDBItem = (region, tableName, primaryKey, primaryValue) => {
    let dynamoDB = new aws.DynamoDB({ region: region })
    const getItem = util.promisify(dynamoDB.getItem).bind(dynamoDB)
    let req = {
        "Key": {
        },
        "TableName": tableName
    }
    req["Key"][primaryKey] = {
        S: primaryValue
    }
    return getItem(req)
}

exports.putDynamoDBItem = (region, tableName, item) => {
    let dynamoDB = new aws.DynamoDB({ region: region })
    const putItem = util.promisify(dynamoDB.putItem).bind(dynamoDB)
    let req = {
        "Item": item,
        "TableName": tableName
    }
    return putItem(req)
}

exports.pushSNS = (region, topic, subject, message) => {
    let sns = new aws.SNS({ region: region })
    const publish = util.promisify(sns.publish).bind(sns)
    let req = {
        Message: message,
        Subject: subject,
        TopicArn: topic
      }
    return publish(req)
}