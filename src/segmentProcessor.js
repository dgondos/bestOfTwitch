const groupPoints = (data) => {
    let prevPoint = data[0]
    let count = 0
    let groups = []
    for (const point of data) {
        if (point === prevPoint) {
            count++
        }
        else {
            groups.push({ point: prevPoint, count: count })
            count = 1
        }
        prevPoint = point
    }
    if (count > 0) {
        groups.push({ point: prevPoint, count: count })
    }
    return groups
}

const getInflexionPoints = (groups) => {
    let inflexionPoints = []
    if (groups.length === 0) {
        return inflexionPoints
    }
    if (groups.length === 1) {
        return [{ group: groups[0], maximum: true }]
    }
    let prevGroup = groups[0]
    let prevSign = groups[1].count < groups[0].count
    for (const group of groups) {
        const currentSign = group.count === prevGroup.count ? prevSign : group.count < prevGroup.count
        if (currentSign !== prevSign) {
            inflexionPoints.push({ group: group, maximum: currentSign })
        }
        prevSign = currentSign
        prevGroup = group
    }
    return inflexionPoints
}

const getSegments = (inflexionPoints, segmentResolution) => {
    let segments = []
    for (let i = 0; i < inflexionPoints.length; i++) {
        if (inflexionPoints[i].maximum) {
            const segmentStartPoint = i <= 0 ? inflexionPoints[0].group.point : inflexionPoints[i - 1].group.point
            const segmentEndPoint = i >= inflexionPoints.length - 1 ? inflexionPoints[inflexionPoints.length - 1].group.point : inflexionPoints[i + 1].group.point
            segments.push({ start: segmentStartPoint * 1000 * 60 * segmentResolution * 2, end: segmentEndPoint * 1000 * 60 * segmentResolution * 2, score: inflexionPoints[i].group.count })
        }
    }
    return segments
}

exports.getTopSegments = (clips, segmentResolution, maxSegments) => {
    const reducedResolutionTimeData = clips.map((clip) => Math.floor(((((Date.parse(clip.created_at)) / 1000) / 60) / segmentResolution) / 2))
    const segments = getSegments(getInflexionPoints(groupPoints(reducedResolutionTimeData)), segmentResolution)
    segments.sort((a, b) => {
        return b.score - a.score
    })
    return segments.slice(0, maxSegments)
}