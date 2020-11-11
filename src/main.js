'use strict'

console.log('Loading function')

const twitch = require('./twitchAPI')
const aws = require('./awsAPI')
const segmentProcessor = require('./segmentProcessor')

exports.handler = async (event, context) => {
    console.info(`Parameters: ${JSON.stringify(event)}`)

    const getClientInfo = aws.getSecret(process.env.AWS_REGION, process.env.TWITCH_CLIENT_SECRET_NAME)
    const getTwitchToken = getClientInfo.then((clientInfo) => manageTwitchToken(clientInfo.CLIENT_ID, clientInfo.CLIENT_SECRET))
    const getTwitchUserId = Promise.all([getClientInfo, getTwitchToken]).then(([clientInfo, twitchToken]) => twitch.getUser(event.twitchUser, twitchToken, clientInfo.CLIENT_ID))
    const getFollows = Promise.all([getTwitchToken, getClientInfo, getTwitchUserId]).then(([twitchToken, clientInfo, twitchUserId]) => twitch.getFollows(twitchToken, clientInfo.CLIENT_ID, twitchUserId))
    await Promise.all([getTwitchToken, getClientInfo, getFollows]).then(([twitchToken, clientInfo, follows]) => {
        let linksPromises = []
        for (let follow of follows) {
            const getClips = twitch.getClips(twitchToken, clientInfo.CLIENT_ID, follow, event.utcHoursFrom, event.utcHoursTo)
            const getSegments = getClips.then((clipsData) => segmentProcessor.getTopSegments(clipsData.clips, event.segmentResolution, event.maxSegments))
            const getLinks = getSegments.then((segments) => getVodLinks(twitchToken, clientInfo.CLIENT_ID, follow, segments))
            linksPromises.push(getLinks.then((links) => {
                console.log(`For follow ${follow.to_name}`)
                console.log(JSON.stringify(links))
                let notifText = `# ${follow.to_name}\n\n`
                for (let link of links) {
                    notifText += `## Segment (Score: ${link.segment.score})\n\n`
                    notifText += `URL: ${link.url}\n`
                    notifText += `Start: ${link.segment.start}\n`
                    notifText += `End: ${link.segment.end}\n\n`
                }
                return notifText
            }))
        }
        Promise.all(linksPromises).then((notifTextSegments) => {
            let notifText = ""
            for (let notifTextSegment of notifTextSegments) {
                if (notifText !== "") {
                    notifText += "\n\n"
                }
                notifText += notifTextSegment
            }
            aws.pushSNS(process.env.AWS_REGION, event.snsTopicARN, "BestOfTwitch Digest", notifText)
        })
    })
}

const manageTwitchToken = (clientId, clientSecret) => {
    return aws.getDynamoDBItem(process.env.AWS_REGION, process.env.DYNAMODB_TABLE_NAME, "ClientId", clientId)
        .then((data) => {
            if (data.Item === undefined) {
                twitch.getToken(clientId, clientSecret)
                    .then((data) => {
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

const getVodLinks = (twitchToken, clientId, follow, segments) => {
    return twitch.getVods(twitchToken, clientId, follow)
        .then((vods) => {
            let links = []
            for (const segment of segments) {
                let vodFound = false
                for (let vod of vods) {
                    const created_at = Date.parse(vod.created_at)
                    const ended_at = created_at + twitch.convertFromTwitchDurationToMs(vod.duration)
                    if (segment.start >= created_at && segment.end <= ended_at) {
                        links.push({ url: `${vod.url}?t=${twitch.convertMsToTwitchDuration(segment.start - created_at)}`, segment: segment })
                        vodFound = true
                        break
                    }
                }
                if (!vodFound) {
                    console.error(`No vod found for follow ${follow.to_name}, segment ${segment.start}/${segment.end}!`)
                }
            }
            return links
        })
}