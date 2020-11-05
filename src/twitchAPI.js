const got = require('got')

exports.getClips = (twitchToken, clientId, follow, utcHoursFrom, utcHoursTo) => {
    // const fs = require('fs')
    // return Promise.resolve(JSON.parse(fs.readFileSync("sample.json")))

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
                    return {
                        id: follow.to_id,
                        name: follow.to_name,
                        clips: clips.concat(data.data)
                    }
                }
            })
            .catch((error) => {
                console.error(`Error when getting clips from twitch for follow ${follow.to_name}: ${error}`)
            })
    }
    return clipsRequest(undefined, [])
}

exports.getFollows = (twitchToken, clientId, user) => {
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

exports.getUser = (twitchLogin, twitchToken, clientId) => {
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

exports.getToken = (clientId, clientSecret) => {
    let url = `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`
    console.debug(url)
    return got.post(url).json()
}