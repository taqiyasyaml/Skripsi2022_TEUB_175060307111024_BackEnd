const get_io_line_details = (io_l_state = []) => {
    const tmp = { io_l: [], l_io: [] }

    const tmpIOLState = []
    let maxLine = 0
    let needFillNull = false
    for (const [i_io, io] of (Array.isArray(io_l_state) ? io_l_state : []).entries()) {
        tmpIOLState[i_io] = []
        for (const [i_l, line] of (Array.isArray(io) ? io : []).entries()) {
            if (i_io === 0) maxLine = i_l
            else if (i_l > maxLine) {
                needFillNull = true
                maxLine = i_l
            }
            tmpIOLState[i_io][i_l] = typeof line == 'boolean' ? line : null
        }
        if ((tmpIOLState[i_io].length - 1) != maxLine)
            needFillNull = true
    }
    if (needFillNull === true) {
        for (let i_io = 0; i_io < tmpIOLState.length; i_io++) {
            for (let i_l = 0; i_l <= maxLine; i_l++)
                tmpIOLState[i_io][i_l] = typeof tmpIOLState?.[i_io]?.[i_l] == 'boolean' ? tmpIOLState[i_io][i_l] : null
        }
    }

    for (let i_io = 0; i_io < tmpIOLState.length; i_io++) {
        tmp.io_l[i_io] = { lines: [], max_line: maxLine }
        for (let i_l = 0; i_l <= maxLine; i_l++) {
            if (tmp.l_io?.[i_l] === undefined)
                tmp.l_io[i_l] = { io_s: [], skip_ios: [] }
            if (tmpIOLState[i_io][i_l] === null) {
                tmp.l_io[i_l].skip_ios.push(i_io)
                if (i_l <= tmp.io_l[i_io].max_line)
                    tmp.io_l[i_io].max_line = i_l - 1
            } else if (tmpIOLState[i_io][i_l] === true) {
                if (i_l <= tmp.io_l[i_io].max_line)
                    tmp.io_l[i_io].lines.push(i_l)
                tmp.l_io[i_l].io_s.push(i_io)
            }
        }
    }

    return tmp
}

const can_connect = (io_s = [], line = null, io_l_detail = { io_l: [], l_io: [] }) => {
    if (!Array.isArray(io_s) ||
        line === undefined || line === null || isNaN(line) || parseInt(line) < 0 ||
        !Array.isArray(io_l_detail?.io_l) || !Array.isArray(io_l_detail?.l_io?.[line]?.skip_ios)
    ) return false
    line = parseInt(line)
    const tmpIOs = []
    for (const io of io_s) {
        if (
            io === undefined || io === null || isNaN(io) || parseInt(io) < 0 ||
            io_l_detail.io_l?.[io]?.max_line === undefined || io_l_detail.io_l?.[io]?.max_line === null ||
            isNaN(io_l_detail.io_l?.[io]?.max_line) || line > parseInt(io_l_detail.io_l?.[io]?.max_line)
        ) return false
        tmpIOs.push(parseInt(io))
    }
    let min_io = Math.min(...tmpIOs)
    let max_io = Math.max(...tmpIOs)
    for (const io of io_l_detail.l_io[line].skip_ios) {
        if (io === undefined || io === null || isNaN(io) || parseInt(io) < 0) continue
        else if (min_io <= io && io <= max_io) return false
    }
    return true
}

const find_empty_line = (io_s = [], io_l_detail = { io_l: [], l_io: [] }, skip_lines = []) => {
    if (!Array.isArray(io_s) || !Array.isArray(io_l_detail?.io_l)) return null
    skip_lines = !Array.isArray(skip_lines) ? [] : skip_lines
    let max_line = Math.min(
        ...io_s.map(
            io => (
                io === undefined || io === null || isNaN(io) || parseInt(io) < 0 ||
                io_l_detail.io_l?.[io]?.max_line === undefined || io_l_detail.io_l?.[io]?.max_line === null ||
                isNaN(io_l_detail.io_l?.[io]?.max_line) || parseInt(io_l_detail.io_l?.[io]?.max_line) < 0
            ) ? 0 : parseInt(io_l_detail.io_l?.[io]?.max_line)
        )
    )
    if (max_line === 0) return null
    for (let line = max_line; line >= 0; line--) {
        if (
            !skip_lines.includes(line) &&
            Array.isArray(io_l_detail?.l_io?.[line]?.io_s) &&
            io_l_detail.l_io[line].io_s.length === 0 &&
            can_connect(io_s, line, io_l_detail)
        ) return line
    }
    return null
}

const steps_move_ios_from_l_to_l = (ios = [], from_l = null, to_l = null, skip_ios = []) => {
    ios = !Array.isArray(ios) ? [] : ios
    skip_ios = !Array.isArray(skip_ios) ? [] : skip_ios
    const connect_steps = []
    const disconnect_steps = []
    if (
        from_l === undefined || from_l === null || isNaN(from_l) || parseInt(from_l) < 0 ||
        to_l === undefined || to_l === null || isNaN(to_l) || parseInt(to_l) < 0
    ) return []
    for (const io of ios.filter(
        i => !skip_ios.includes(i) && i !== undefined && i !== null && !isNaN(i) && parseInt(i) >= 0
    )) {
        connect_steps.push({ io, l: to_l, st: true, b_us: 0, a_us: 0 })
        disconnect_steps.push({ io, l: from_l, st: false, b_us: 0, a_us: 0 })
    }
    return [...connect_steps, ...disconnect_steps]
}
const steps_move_line = (io = null, line = null, io_l_detail = { io_l: [], l_io: [] }, skip_ios = [], only_ios = []) => {
    skip_ios = !Array.isArray(skip_ios) ? [] : skip_ios
    only_ios = !Array.isArray(only_ios) ? [] : only_ios
    const steps = []
    if (
        io === undefined || io === null || isNaN(io) || parseInt(io) < 0 ||
        line === undefined || line === null || isNaN(line) || parseInt(line) < 0 ||
        !Array.isArray(io_l_detail?.l_io) || !Array.isArray(io_l_detail?.io_l?.[io]?.lines) ||
        skip_ios.includes(io) || (only_ios.length > 0 && !only_ios.includes(io))
    ) return steps
    io = parseInt(io)
    line = parseInt(line)
    steps.push({ io, l: line, st: true, b_us: 0, a_us: 0 })
    // const disconnect_steps = []
    for (const l of io_l_detail.io_l[io].lines.filter(l => l !== line)) {
        if (
            l === undefined || l === null || isNaN(l) || parseInt(l) < 0 ||
            !Array.isArray(io_l_detail?.l_io?.[l]?.io_s)
        ) continue
        const io_s = only_ios.length === 0 ? io_l_detail.l_io[l].io_s : io_l_detail.l_io[l].io_s.filter(i => only_ios.includes(i))
        steps.push(...steps_move_ios_from_l_to_l(io_s, l, line, [io, ...skip_ios]))
        steps.push({ io, l, st: false, b_us: 0, a_us: 0 })
    }
    // for (const i of io_l_detail.l_io[l].io_s.filter(
    //     i => !skip_ios.includes(i) && i !== io && i !== undefined && i !== null && !isNaN(i) && parseInt(i) >= 0
    // )) {
    //     steps.push({ io: i, l: line, st: true, b_us: 0, a_us: 0 })
    //     disconnect_steps.push({ io: i, l, st: false, b_us: 0, a_us: 0 })
    // }
    // disconnect_steps.push({ io, l, st: false, b_us: 0, a_us: 0 })
    // }
    // steps.push(...disconnect_steps)
    return steps
}

const connected_ios = (io = null, io_l_detail = { io_l: [], l_io: [] }, skip_ios = []) => {
    const io_s = []
    if (io === undefined || io === null || isNaN(io) || parseInt(io) < 0)
        return io_s
    io = parseInt(io)
    io_s.push(io)
    if (!Array.isArray(io_l_detail?.io_l?.[io]?.lines))
        return io_s
    skip_ios = Array.isArray(skip_ios) ? skip_ios : []
    for (const l of io_l_detail.io_l[io].lines) {
        if (!Array.isArray(io_l_detail?.l_io?.[l]?.io_s)) continue
        io_s.push(
            ...io_l_detail.l_io[l].io_s.filter(i => !io_s.includes(i) && !skip_ios.includes(i))
        )
    }
    return io_s
}

const find_available_line = (main_io = null, io_s = [], io_l_detail = { io_l: [], l_io: [] }, skip_lines = []) => {
    if (main_io === undefined || main_io === null || isNaN(main_io) || parseInt(main_io) < 0)
        return null
    main_io = parseInt(main_io)
    if (!Array.isArray(io_l_detail?.io_l?.[main_io]?.lines))
        return null
    io_s = Array.isArray(io_s) ? io_s : []
    skip_lines = Array.isArray(skip_lines) ? skip_lines : []
    for (const l of io_l_detail.io_l[main_io].lines.reverse()) {
        if (
            l === undefined || l === null ||
            isNaN(l) || parseInt(l) < 0 ||
            skip_lines.includes(l) ||
            !can_connect(io_s, l, io_l_detail)
        ) continue
        return l
    }
    return null
}

const steps_disconnect_io = ({ io_disconnect = null, io_keep = null, io_l_detail = { io_l: [], l_io: [] } }) => {
    const steps = []
    if (io_disconnect === undefined || io_disconnect === null || isNaN(io_disconnect) || parseInt(io_disconnect) < 0)
        return steps
    if (!Array.isArray(io_l_detail?.l_io))
        return steps
    io_disconnect = parseInt(io_disconnect)
    io_keep = io_keep === undefined || io_keep === null || isNaN(io_keep) || parseInt(io_keep) < 0 ? null : parseInt(io_keep)
    for (const [i_line, line] of io_l_detail.l_io.entries()) {
        if (!Array.isArray(line?.io_s)) continue
        if (line.io_s.includes(io_disconnect) &&
            (io_keep === null || line.io_s.includes(io_keep))
        ) {
            if (line.io_s.length == 2)
                steps.push(...[
                    { io: line.io_s[0], l: i_line, st: false, b_us: 0, a_us: 0 },
                    { io: line.io_s[1], l: i_line, st: false, b_us: 0, a_us: 0 }
                ])
            else
                steps.push({ io: io_disconnect, l: i_line, st: false, b_us: 0, a_us: 0 })
        }
    }
    return steps
}

// const steps_connect_io = ({ io_from = null, io_press = null, io_release = null, press_us = 0, propagation_us = 0 }, io_l_detail = { io_l: [], l_io: [] }) => {
//     const steps = []
//     if (io_from === undefined || io_from === null || isNaN(io_from) || parseInt(io_from) < 0)
//         return steps
//     io_from = parseInt(io_from)
//     io_press = io_press === undefined || io_press === null || isNaN(io_press) || parseInt(io_press) < 0 ? null : parseInt(io_press)
//     io_release = io_release === undefined || io_release === null || isNaN(io_release) || parseInt(io_release) < 0 ? null : parseInt(io_release)
//     press_us = press_us === undefined || press_us === null || isNaN(press_us) || parseInt(press_us) < 0 ? 0 : parseInt(press_us)
//     propagation_us = propagation_us === undefined || propagation_us === null || isNaN(propagation_us) || parseInt(propagation_us) < 0 ? 0 : parseInt(propagation_us)
//     if (
//         (io_press === io_from && io_release === io_from) ||
//         (io_press === null && press_us === null && io_release === io_press) ||
//         !Array.isArray(io_l_detail?.io_l?.[io_from]?.lines) ||
//         (io_release !== null && !Array.isArray(io_l_detail?.io_l?.[io_release]?.lines))
//     )
//         return steps
//     if (io_press === null && io_release === null) {
//         steps.push(...steps_disconnect_io({ io_disconnect: io_from, io_l_detail }))
//         return steps
//     }

//     const io_s = [io_from]
//     for (const line of io_l_detail.io_l[io_from].lines) {
//         if (!Array.isArray(io_l_detail?.l_io?.[line]?.io_s)) continue
//         io_s.push(
//             ...(io_l_detail?.l_io?.[line]?.io_s
//                 .filter(io => !io_s.includes(io) && io !== undefined && io !== null && !isNaN(io) && parseInt(io) >= 0)
//                 .map(io => parseInt(io))
//             )
//         )
//     }
//     if (io_press !== null && io_press !== io_from)
//         io_s.push(io_press)
//     if (io_release !== null && io_release !== io_from) {
//         for (const line of io_l_detail.io_l[io_release].lines) {
//             if (!Array.isArray(io_l_detail?.l_io?.[line]?.io_s)) continue
//             io_s.push(
//                 ...(io_l_detail?.l_io?.[line]?.io_s
//                     .filter(io => !io_s.includes(io) && io !== undefined && io !== null && !isNaN(io) && parseInt(io) >= 0)
//                     .map(io => parseInt(io))
//                 )
//             )
//         }
//     }

//     let pick_line = null
//     for (const line of io_l_detail.io_l[io_from].lines.reverse()) {
//         if (line === undefined || line === null || isNaN(line) || parseInt(line) < 0) continue
//         else if (can_connect(io_s, line, io_l_detail)) {
//             pick_line = line
//             break
//         }
//     }
//     if (pick_line === null)
//         pick_line = find_empty_line(io_s, io_l_detail)
//     if (pick_line === null)
//         return steps
//     steps.push(...steps_move_line(io_from, pick_line, io_l_detail))

//     if (io_release !== null && io_release !== io_from && (io_press !== null || (io_press === null && press_us > 0)))
//         steps.push({ io: io_release, l: pick_line, st: false, b_us: 0, a_us: propagation_us })
//     if (io_press !== null)
//         steps.push({ io: io_from, l: pick_line, st: true, b_us: 0, a_us: press_us })
//     else if (io_press === null && press_us > 0)
//         steps.push({ io: io_from, l: pick_line, st: false, b_us: 0, a_us: press_us })

//     if (io_press !== null && io_press !== io_from)
//         steps.push({ io: io_press, l: pick_line, st: false, b_us: 0, a_us: propagation_us })
//     if (io_release === null)
//         steps.push({ io: io_from, l: pick_line, st: false, b_us: 0, a_us: propagation_us })
//     else {
//         if (io_release !== io_from)
//             steps.push(...steps_move_line(io_release, pick_line, io_l_detail))
//         steps.push({ io: io_from, l: pick_line, st: true, b_us: 0, a_us: propagation_us })
//     }

//     return steps
// }
// const steps_connect_io = ({ io_from = null, io_press = null, io_release = null, press_us = 0, propagation_us = 0 }, io_l_detail = { io_l: [], l_io: [] }) => {
//     const steps = []
//     if (io_from === undefined || io_from === null || isNaN(io_from) || parseInt(io_from) < 0)
//         return steps
//     io_from = parseInt(io_from)
//     io_press = io_press === undefined || io_press === null || isNaN(io_press) || parseInt(io_press) < 0 ? null : parseInt(io_press)
//     io_release = io_release === undefined || io_release === null || isNaN(io_release) || parseInt(io_release) < 0 ? null : parseInt(io_release)
//     press_us = press_us === undefined || press_us === null || isNaN(press_us) || parseInt(press_us) < 0 ? 0 : parseInt(press_us)
//     propagation_us = propagation_us === undefined || propagation_us === null || isNaN(propagation_us) || parseInt(propagation_us) < 0 ? 0 : parseInt(propagation_us)
//     if (
//         (io_press === io_from && io_release === io_from) ||
//         (io_press === null && press_us === 0 && io_release === io_press) ||
//         !Array.isArray(io_l_detail?.io_l?.[io_from]?.lines) ||
//         (io_press !== null && !Array.isArray(io_l_detail?.io_l?.[io_press]?.lines)) ||
//         (io_release !== null && !Array.isArray(io_l_detail?.io_l?.[io_release]?.lines))
//     )
//         return []
//     if (io_press === null && io_release === null) {
//         steps.push(...steps_disconnect_io({ io_disconnect: io_from, io_l_detail }))
//         return steps
//     }

//     const io_s = [io_from]
//     for (const line of io_l_detail.io_l[io_from].lines) {
//         if (!Array.isArray(io_l_detail?.l_io?.[line]?.io_s)) continue
//         io_s.push(
//             ...(io_l_detail?.l_io?.[line]?.io_s
//                 .filter(io => !io_s.includes(io) && io !== undefined && io !== null && !isNaN(io) && parseInt(io) >= 0)
//                 .map(io => parseInt(io))
//             )
//         )
//     }
//     if (io_press !== null && io_press !== io_from)
//         io_s.push(io_press)
//     if (io_release !== null && io_release !== io_from) {
//         for (const line of io_l_detail.io_l[io_release].lines) {
//             if (!Array.isArray(io_l_detail?.l_io?.[line]?.io_s)) continue
//             io_s.push(
//                 ...(io_l_detail?.l_io?.[line]?.io_s
//                     .filter(io => !io_s.includes(io) && io !== undefined && io !== null && !isNaN(io) && parseInt(io) >= 0)
//                     .map(io => parseInt(io))
//                 )
//             )
//         }
//     }

//     const skip_new_line = []
//     let pick_line_from = null
//     for (const line of io_l_detail.io_l[io_from].lines.reverse()) {
//         if (line === undefined || line === null || isNaN(line) || parseInt(line) < 0) continue
//         else if (can_connect(io_s, line, io_l_detail)) {
//             pick_line_from = line
//             skip_new_line.push(pick_line_from)
//             break
//         }
//     }
//     if (pick_line_from !== null && io_l_detail.io_l[io_from].lines.length > 1)
//         steps.push(...steps_move_line(io_from, pick_line_from, io_l_detail))

//     let pick_line_release = null
//     if (io_release !== io_from && io_release !== null) {
//         for (const line of io_l_detail.io_l[io_release].lines.reverse()) {
//             if (line === undefined || line === null || isNaN(line) || parseInt(line) < 0 || line == pick_line_from) continue
//             else if (can_connect(io_s, line, io_l_detail)) {
//                 pick_line_release = line
//                 break
//             }
//         }
//         if (pick_line_release === null && io_press === null && press_us === 0)
//             pick_line_release = pick_line_from
//         if (pick_line_release === null)
//             pick_line_release = find_empty_line(io_s, io_l_detail, skip_new_line)
//         if (pick_line_release !== null) {
//             skip_new_line.push(pick_line_release)
//             if (io_l_detail.io_l[io_release].lines.length === 0)
//                 steps.push({ io: io_release, l: pick_line_release, st: true, b_us: 0, a_us: 0 })
//             else if (io_l_detail.io_l[io_release].lines.length > 1 || !io_l_detail.io_l[io_release].lines.includes(pick_line_release))
//                 steps.push(...steps_move_line(io_release, pick_line_release, io_l_detail, [io_from]))
//             if (io_press !== null && press_us >= 0)
//                 steps.push({ io: io_from, l: pick_line_release, st: false, b_us: 0, a_us: propagation_us })
//         }
//     } else {
//         if (pick_line_from === null) {
//             pick_line_from = find_empty_line(io_s, io_l_detail)
//             if (pick_line_from !== null) {
//                 skip_new_line.push(pick_line_from)
//                 if (io_l_detail.io_l[io_from].lines.length === 0)
//                     steps.push({ io: io_from, l: pick_line_from, st: true, b_us: 0, a_us: 0 })
//                 else
//                     steps.push(...steps_move_line(io_from, pick_line_from, io_l_detail))
//             }
//         }
//         pick_line_release = pick_line_from
//     }
//     if (pick_line_release === null)
//         return []

//     let pick_line_press = null
//     if (io_press !== io_from && io_press !== null) {
//         for (const line of io_l_detail.io_l[io_press].lines.filter(l => l !== pick_line_release).reverse()) {
//             if (line === undefined || line === null || isNaN(line) || parseInt(line) < 0 || line == pick_line_from || line == pick_line_release) continue
//             else if (can_connect(io_s, line, io_l_detail)) {
//                 pick_line_press = line
//                 break
//             }
//         }
//         if (pick_line_press === null)
//             pick_line_press = find_empty_line(io_s, io_l_detail, skip_new_line)
//         if (pick_line_press === null)
//             return []
//         else {
//             if (io_release !== io_from && io_release !== null)
//                 steps.push({ io: io_press, l: pick_line_release, st: false, b_us: 0, a_us: propagation_us })
//             if (!io_l_detail.io_l[io_press].lines.includes(pick_line_press))
//                 steps.push({ io: io_press, l: pick_line_press, st: true, b_us: 0, a_us: propagation_us })
//         }
//     }

//     if (io_press === io_from) {
//         if (pick_line_from !== null)
//             steps.push({ io: io_from, l: pick_line_from, st: true, b_us: 0, a_us: press_us })
//     } else if (io_press === null) {
//         if (press_us > 0 && pick_line_from !== null)
//             steps.push({ io: io_from, l: pick_line_from, st: false, b_us: 0, a_us: press_us })
//     } else {
//         steps.push({ io: io_from, l: pick_line_press, st: true, b_us: 0, a_us: press_us })
//         steps.push({ io: io_from, l: pick_line_press, st: false, b_us: 0, a_us: propagation_us })
//     }

//     if (io_release === io_from)
//         steps.push({ io: io_from, l: pick_line_from, st: true, b_us: 0, a_us: propagation_us })
//     else if (io_release === null)
//         steps.push({ io: io_from, l: pick_line_from, st: false, b_us: 0, a_us: propagation_us })
//     else
//         steps.push({ io: io_from, l: pick_line_release, st: true, b_us: 0, a_us: propagation_us })

//     return steps
// }

const steps_connect_io = ({ io_from = null, io_press = null, io_release = null, press_us = 0, propagation_us = 0 }, io_l_detail = { io_l: [], l_io: [] }) => {
    const steps = []
    if (io_from === undefined || io_from === null || isNaN(io_from) || parseInt(io_from) < 0)
        return steps
    io_from = parseInt(io_from)
    io_press = io_press === undefined || io_press === null || isNaN(io_press) || parseInt(io_press) < 0 ? null : parseInt(io_press)
    io_release = io_release === undefined || io_release === null || isNaN(io_release) || parseInt(io_release) < 0 ? null : parseInt(io_release)
    press_us = press_us === undefined || press_us === null || isNaN(press_us) || parseInt(press_us) < 0 ? 0 : parseInt(press_us)
    propagation_us = propagation_us === undefined || propagation_us === null || isNaN(propagation_us) || parseInt(propagation_us) < 0 ? 0 : parseInt(propagation_us)
    if (
        !Array.isArray(io_l_detail?.io_l?.[io_from]?.lines) ||
        (io_press !== null && !Array.isArray(io_l_detail?.io_l?.[io_press]?.lines)) ||
        (io_release !== null && !Array.isArray(io_l_detail?.io_l?.[io_release]?.lines))
    )
        return []

    if (io_press == io_release) {
        if (io_release === null) {
            //Artinya minta diputus
            steps.push(...steps_disconnect_io({ io_disconnect: io_from, io_l_detail }))
            return steps
        } else if (io_release == io_from)
            return [] //Ngapain io nya sama semua?
        //Yaudah langsung aja
        io_press = null
        press_us = 0
    }

    const io_s = []
    //Ambil pin yang terkait dengan from
    const ios_from = connected_ios(io_from, io_l_detail, [io_press == io_from ? null : io_press, io_release == io_from ? null : io_release])
    io_s.push(...ios_from)
    if (io_press != null && io_press != io_from)
        io_s.push(io_press)
    const ios_release = []
    //Ambil pin yang terkait dengan release
    if (io_release != null && io_release != io_from) {
        ios_release.push(...connected_ios(io_release, io_l_detail, io_s))
        io_s.push(...ios_release)
    }

    //Ambil jalur from kalau ada
    let pick_line_from = find_available_line(io_from, io_s, io_l_detail)
    let pick_line_release = null
    if (io_release !== null && io_release != io_from) {
        //Kalau langsung konek, yaa langsung pake jalur from
        if (io_press === null && io_release === 0)
            pick_line_release = pick_line_from
        //Kalau jalur from nggak ada atau ada simulasi tekan
        if (pick_line_release === null)
            pick_line_release = find_available_line(io_release, io_s, io_l_detail, [pick_line_from])
        //Kalau jalur release belum ada
        if (pick_line_release === null)
            pick_line_release = find_empty_line(io_s, io_l_detail)
        //Jalur PENUH !!!
        if (pick_line_release === null)
            return []
        //Kalau langsung konek, langsung samain
        if (io_press === null && io_release === 0)
            pick_line_from = pick_line_release
    }

    let pick_line_press = null
    //Kalau konek langsung, pasti sudah ada. Mungkin bisa cari dari press
    if (pick_line_from === null) {
        if (io_press !== null && io_press != io_from)
            pick_line_press = find_available_line(io_press, io_s, io_l_detail, [pick_line_release])
        //Kalau nggak ada dari press, yaa cari jalur
        if (pick_line_press === null)
            pick_line_from = find_empty_line(io_s, io_l_detail, pick_line_release === null ? [] : [pick_line_release])
        //Jalur PENUH !!!
        if (pick_line_from === null)
            return []
    }

    if (io_release !== null && io_release != io_from && (
        io_l_detail.io_l[io_release].lines.length > 1 || !io_l_detail.io_l[io_release].lines.includes(pick_line_release)
    )) steps.push(...steps_move_line(io_release, pick_line_release, io_l_detail, [], ios_release))

    if (pick_line_from === null) {
        //Jalur from gak ada, artinya pasti dapet dari press
        steps.push({ io: io_from, l: pick_line_press, st: true, b_us: 0, a_us: press_us + propagation_us })
        steps.push({ io: io_from, l: pick_line_press, st: false, b_us: 0, a_us: propagation_us })
        //Kalau realese null apalagi balik lagi yaa skip. Orang gak ada jalur.
        if (io_release !== null && io_release != io_from)
            steps.push(...steps_move_line(io_from, pick_line_release, io_l_detail, [], ios_from))
    } else {
        if (io_l_detail.io_l[io_from].lines.length > 1 || !io_l_detail.io_l[io_from].lines.includes(pick_line_from))
            steps.push(...steps_move_line(io_from, pick_line_from, io_l_detail, [], ios_from))
        if (io_press === null && io_release === 0)
            return steps

        if (io_press === null)
            steps.push({ io: io_from, l: pick_line_from, st: false, b_us: 0, a_us: (press_us + propagation_us) })
        else if (io_press == io_from)
            steps.push({ io: io_from, l: pick_line_from, st: true, b_us: 0, a_us: (press_us + propagation_us) })
        else {
            if (io_release !== null && io_release != null)
                steps.push({ io: io_press, l: pick_line_release, st: false, b_us: 0, a_us: propagation_us })
            steps.push({ io: io_press, l: pick_line_from, st: true, b_us: 0, a_us: press_us })
            steps.push({ io: io_press, l: pick_line_from, st: false, b_us: 0, a_us: propagation_us })
        }

        if (io_release === null)
            steps.push({ io: io_from, l: pick_line_from, st: false, b_us: 0, a_us: 0 })
        else if (io_release == io_from)
            steps.push({ io: io_from, l: pick_line_from, st: true, b_us: 0, a_us: 0 })
        else
            steps.push(...steps_move_ios_from_l_to_l(ios_from, pick_line_from, pick_line_release))
    }
    return steps
}

const steps_connect_io_by_state =
    (data = { io_from: null, io_press: null, io_release: null, press_us: 0, propagation_us: 0 }, main_io_l_state = []) =>
        steps_connect_io(data, get_io_line_details(main_io_l_state))
const steps_disconnect_io_by_state =
    (data = { io_disconnect: null, io_keep: null }, main_io_l_state = []) =>
        steps_disconnect_io({ io_disconnect: data?.io_disconnect, io_keep: data?.io_keep, io_l_detail: get_io_line_details(main_io_l_state) })


module.exports = { steps_connect_io_by_state, steps_disconnect_io_by_state }