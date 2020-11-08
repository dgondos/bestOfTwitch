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

exports.convertFromTwitchDurationToMs = (twitchDuration) => {
    let hours = 0
    let minutes = 0
    let seconds = 0
    const regex = /^([0-9]{1,2}h){0,1}([0-9]{1,2}m){0,1}([0-9]{1,2}s){0,1}$/gm;
    let m;

    while ((m = regex.exec(twitchDuration)) !== null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (m.index === regex.lastIndex) {
            regex.lastIndex++;
        }

        // The result can be accessed through the `m`-variable.
        m.forEach((match, groupIndex) => {
            if (groupIndex === 1 && match !== undefined) {
                hours = parseInt(match.substring(0, match.length - 1))
            }
            else if (groupIndex === 2 && match !== undefined) {
                minutes = parseInt(match.substring(0, match.length - 1))
            }
            else if (groupIndex === 3 && match !== undefined) {
                seconds = parseInt(match.substring(0, match.length - 1))
            }
        });
    }
    return ((hours * 60 * 60) + (minutes * 60) + seconds) * 1000;
}

exports.convertMsToTwitchDuration = (msDuration) => {
    const hours = Math.floor(msDuration / (1000 * 60 * 60))
    const mins = Math.floor((msDuration - (hours * 1000 * 60 * 60)) / (1000 * 60))
    const secs = Math.floor((msDuration - (hours * 1000 * 60 * 60) - (mins * 1000 * 60)) / (1000))
    return `${hours}h${mins}m${secs}s`
}

exports.getVods = (twitchToken, clientId, follow) => {
    const request = (cursor, vods) => {
        let url = `https://api.twitch.tv/helix/videos?user_id=${follow.to_id}&first=100&period=day&sort=time&type=archive`
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
                    return request(data.pagination.cursor, vods.concat(data.data))
                }
                else {
                    console.debug(data)
                    return vods.concat(data.data)
                }
            })
            .catch((error) => {
                console.error(`Error when getting vods from twitch: ${error}`)
            })
    }
    return request(undefined, [])
}
