const Datastore = require('nedb')
const project = new Datastore({ filename: __dirname + '/../nedb/project.db' })

const save_io_l_adc = (project_id, io_l_setup = [], adc_refs = []) => new Promise((res, rej) => {
    if (project_id === undefined || project_id === null || project_id === '') {
        console.error(new Date(), 'save_io_l_adc')
        console.error(new Error('Unknown Project ID'))
        return rej(new Error('Unknown Project ID'))
    }
    project_id = isNaN(project_id) ? project_id : parseFloat(project_id)
    const tempSave = { io_l_setup: [], adc_refs: [], block_depedencies: [] }
    let maxLine = 0
    let needFillNull = false
    for (const [i_io, io] of (Array.isArray(io_l_setup) ? io_l_setup : []).entries()) {
        tempSave.io_l_setup[i_io] = []
        tempSave.adc_refs[i_io] = null
        for (const [i_l, line] of (Array.isArray(io) ? io : []).entries()) {
            if (i_io == 0) maxLine = i_l
            else if (i_l > maxLine) {
                maxLine = i_l
                needFillNull = true
            }
            if (
                typeof line != 'object' ||
                line?.block_id === undefined || line?.block_id === null || line?.block_id === '' ||
                line?.block_internal_id === undefined || line?.block_internal_id === null || line?.block_internal_id === '' ||
                line?.block_io === undefined || line?.block_io === null || isNaN(line?.block_io) || parseInt(line?.block_io) < 0 ||
                line?.block_line === undefined || line?.block_line === null || isNaN(line?.block_line) || parseInt(line?.block_line) < 0
            ) tempSave.io_l_setup[i_io][i_l] = null
            else {
                tempSave.io_l_setup[i_io][i_l] = {
                    block_id: isNaN(line.block_id) ? line.block_id : parseFloat(line.block_id),
                    block_internal_id: isNaN(line.block_internal_id) ? line.block_internal_id : parseFloat(line.block_internal_id),
                    block_io: parseInt(line?.block_io), block_line: parseInt(line?.block_line)
                }
                if (tempSave.adc_refs[i_io] === null && (adc_refs?.[i_io] !== undefined || adc_refs?.[i_io] !== null) && typeof adc_refs?.[i_io] == 'object' &&
                    adc_refs[i_io]?.block_id !== undefined && adc_refs[i_io]?.block_id !== null &&
                    adc_refs[i_io]?.block_internal_id !== undefined && adc_refs[i_io]?.block_internal_id !== null &&
                    adc_refs[i_io]?.block_io !== undefined && adc_refs[i_io]?.block_io !== null && !isNaN(adc_refs[i_io]?.block_io) &&
                    parseInt(adc_refs[i_io]?.block_io) === tempSave.io_l_setup[i_io][i_l].block_io &&
                    (isNaN(adc_refs[i_io]?.block_id) ? adc_refs[i_io]?.block_id : parseFloat(adc_refs[i_io]?.block_id)) === tempSave.io_l_setup[i_io][i_l].block_id &&
                    (isNaN(adc_refs[i_io]?.block_internal_id) ? adc_refs[i_io]?.block_internal_id : parseFloat(adc_refs[i_io]?.block_internal_id)) === tempSave.io_l_setup[i_io][i_l].block_internal_id
                ) tempSave.adc_refs[i_io] = {
                    block_id: isNaN(adc_refs[i_io].block_id) ? adc_refs[i_io].block_id : parseFloat(adc_refs[i_io].block_id),
                    block_internal_id: isNaN(adc_refs[i_io].block_internal_id) ? adc_refs[i_io].block_internal_id : parseFloat(adc_refs[i_io].block_internal_id),
                    block_io: parseInt(adc_refs[i_io]?.block_io)
                }
                const dep_i = tempSave.block_depedencies.findIndex(d => d?._id === tempSave.io_l_setup[i_io][i_l].block_id)
                if (dep_i < 0) tempSave.block_depedencies.push({ _id: tempSave.io_l_setup[i_io][i_l].block_id, internal_ids: [tempSave.io_l_setup[i_io][i_l].block_internal_id] })
                else if (!tempSave.block_depedencies[dep_i].internal_ids.includes(tempSave.io_l_setup[i_io][i_l].block_internal_id))
                    tempSave.block_depedencies[dep_i].internal_ids.push(tempSave.io_l_setup[i_io][i_l].block_internal_id)
            }
        }
        if ((tempSave.io_l_setup[i_io].length - 1) != maxLine)
            needFillNull = true
    }

    if (needFillNull === true) {
        for (let io = 0; io < tempSave.io_l_setup.length; io++) {
            for (let line = 0; line <= maxLine; line++)
                tempSave.io_l_setup[io][line] = tempSave.io_l_setup[io]?.[line] ?? null
        }
    }
    project.loadDatabase((errLoad) => {
        if (errLoad) {
            console.error(new Date(), 'save_io_l_adc')
            console.error(new Error('Load Document Project Error'))
            return rej(errLoad)
        }

        project.findOne({ _id: project_id }, (errFind, doc) => {
            if (errFind) {
                console.error(new Date(), 'save_io_l_adc')
                console.error(new Error('Can\'t get Project Data'))
                return rej(errFind)
            }
            if (doc === null)
                project.insert({ _id: project_id, ...tempSave, components: [] }, (errInsert) => {
                    if (errInsert) {
                        console.error(new Date(), 'save_io_l_adc')
                        console.error(new Error('Insert Document Project Error'))
                        return rej(errInsert)
                    }
                    return res()
                })
            else
                project.update({ _id: project_id }, { $set: { "io_l_setup": tempSave.io_l_setup, "adc_refs": tempSave.adc_refs, "block_depedencies": tempSave.block_depedencies } }, {}, (errUpdate) => {
                    if (errUpdate) {
                        console.error(new Date(), 'save_io_l_adc')
                        console.error(new Error('Update Document Project Error'))
                        return rej(errUpdate)
                    }
                    return res()
                })
        })
    })
})

const save_component = (project_id, components) => new Promise((res, rej) => {
    if (project_id === undefined || project_id === null || project_id === '') {
        console.error(new Date(), 'save_component')
        console.error(new Error('Unknown Project ID'))
        return rej(new Error('Unknown Project ID'))
    }
    project_id = isNaN(project_id) ? project_id : parseFloat(project_id)
    const tempSave = []
    const componentIDs = []
    const pinIDs = []
    for (c of Array.isArray(components) ? components : []) {
        if (c?.id === undefined || c?.id === null || c?.id === '')
            continue
        const tmpComponent = {
            id: isNaN(c.id) ? c.id : parseFloat(c.id),
            name: c?.name ?? c.id,
            value: c?.value ?? "",
            pins_rblt: [[], [], [], []]
        }
        if (componentIDs.includes(tmpComponent.id)) continue
        else componentIDs.push(tmpComponent.id)
        for (let i_rblt = 0; i_rblt < 4; i_rblt++) {
            if (!Array.isArray(c?.pins_rblt?.[i_rblt]))
                continue
            for (const pin of c.pins_rblt[i_rblt]) {
                const tmpPin = {
                    id: pin?.id === undefined || pin?.id === null || isNaN(pin?.id) || parseInt(pin?.id) < 0 ? null : parseInt(pin.id),
                    name: pin?.name ?? ""
                }
                if (tmpPin.id !== null) {
                    if (pinIDs.includes(tmpPin)) tmpPin.id = null
                    else pinIDs.push(tmpPin.id)
                }
                tmpComponent.pins_rblt[i_rblt].push(tmpPin)
            }
        }
        tempSave.push(tmpComponent)
    }

    project.loadDatabase((errLoad) => {
        if (errLoad) {
            console.error(new Date(), 'save_component')
            console.error(new Error('Load Document Project Error'))
            return rej(errLoad)
        }

        project.findOne({ _id: project_id }, (errFind, doc) => {
            if (errFind) {
                console.error(new Date(), 'save_component')
                console.error(new Error('Can\'t get Project Data'))
                return rej(errFind)
            }
            if (doc === null)
                project.insert({ _id: project_id, io_l_setup: [], adc_refs: [], block_depedencies: [], components: tempSave }, (errInsert) => {
                    if (errInsert) {
                        console.error(new Date(), 'save_component')
                        console.error(new Error('Insert Document Project Error'))
                        return rej(errInsert)
                    }
                    return res()
                })
            else
                project.update({ _id: project_id }, { $set: { "components": tempSave } }, {}, (errUpdate) => {
                    if (errUpdate) {
                        console.error(new Date(), 'save_component')
                        console.error(new Error('Update Document Project Error'))
                        return rej(errUpdate)
                    }
                    return res()
                })
        })
    })
})

const get_project_data = (project_id) => new Promise((res, rej) => {
    if (project_id === undefined || project_id === null || project_id === '') {
        console.error(new Date(), 'get_project_data')
        console.error(new Error('Unknown Project ID'))
        return rej(new Error('Unknown Project ID'))
    }
    project_id = isNaN(project_id) ? project_id : parseFloat(project_id)
    project.loadDatabase((errLoad) => {
        if (errLoad) {
            console.error(new Date(), 'get_project_data')
            console.error(new Error('Load Document Project Error'))
            return rej(errLoad)
        }

        project.findOne({ _id: project_id }, (errFind, doc) => {
            if (errFind) {
                console.error(new Date(), 'get_project_data')
                console.error(new Error('Can\'t get Project Data'))
                return rej(errFind)
            }
            if (doc === null)
                project.insert({ _id: project_id, io_l_setup: [], adc_refs: [], block_depedencies: [], components: [] }, (errInsert, newDoc) => {
                    if (errInsert) {
                        console.error(new Date(), 'get_project_data')
                        console.error(new Error('Insert Document Project Error'))
                        return rej(errInsert)
                    }
                    return res(newDoc)
                })
            else return res(doc)
        })
    })
})
const get_projects_by_block = (block_id, block_internal_id, project_online_ids) => new Promise((res, rej) => {
    if (block_id === undefined || block_id === null || block_id === '') {
        console.error(new Date(), 'get_projects_by_block')
        console.error(new Error('Unknown Block ID'))
        return rej(new Error('Unknown Block ID'))
    }
    block_id = isNaN(block_id) ? block_id : parseFloat(block_id)
    block_internal_id = block_internal_id === undefined || block_internal_id === null || block_internal_id === '' ? undefined : (isNaN(block_internal_id) ? block_internal_id : parseFloat(block_internal_id))
    let query = { block_depedencies: { $elemMatch: { _id: block_id } } }
    if (block_internal_id !== undefined)
        query.block_depedencies.$elemMatch.internal_ids = { $elemMatch: block_internal_id }
    if (Array.isArray(project_online_ids))
        query._id = { $in: project_online_ids.map(pr => isNaN(pr) ? pr : parseFloat(pr)) }
    project.loadDatabase((errLoad) => {
        if (errLoad) {
            console.error(new Date(), 'get_projects_by_block')
            console.error(new Error('Load Document Project Error'))
            return rej(errLoad)
        }

        project.find(query, (errFind, doc) => {
            if (errFind) {
                console.error(new Date(), 'get_projects_by_block')
                console.error(new Error('Can\'t get Project Data'))
                return rej(errFind)
            }
            res(doc)
        })
    })
})

const get_block_internal_ids = async (block_id) => {
    try {
        const internal_ids = []
        const projects = await get_projects_by_block(block_id)
        for (const project_data of projects)
            internal_ids.push(...(
                (
                    (project_data?.block_depedencies ?? [])
                        .filter(b => b?._id === block_id)?.[0]
                    ?? []
                )?.internal_ids ?? []
            )
                .filter(ib => !internal_ids.includes(ib))
            )
        return internal_ids
    } catch (error) {
        console.error(new Date(), 'get_block_internal_ids')
        console.error(error)
        throw error
    }
}

const get_blocks_steps = async (project_id = null, steps = []) => {
    if (project_id === undefined || project_id === null || project_id === '') {
        console.error(new Date(), 'get_blocks_steps')
        console.error(new Error('Unknown Project ID'))
        throw new Error('Unknown Project ID')
    }
    project_id = isNaN(project_id) ? project_id : parseFloat(project_id)
    steps = Array.isArray(steps) ? steps : []
    const blocks_steps = []
    try {
        const project_data = await get_project_data(project_id)
        for (const step of steps) {
            if (
                step?.io === undefined || step?.io === null || step?.io === '' || isNaN(step?.io) || parseInt(step?.io) < 0 ||
                step?.l === undefined || step?.l === null || step?.l === '' || isNaN(step?.l) || parseInt(step?.l) < 0 ||
                project_data?.io_l_setup?.[parseInt(step?.io)]?.[parseInt(step?.l)]?.block_id === undefined ||
                project_data?.io_l_setup?.[parseInt(step?.io)]?.[parseInt(step?.l)]?.block_id === null ||
                project_data?.io_l_setup?.[parseInt(step?.io)]?.[parseInt(step?.l)]?.block_id === ''
            )
                continue
            const tmpStep = {
                i_id: project_data?.io_l_setup?.[parseInt(step?.io)]?.[parseInt(step?.l)]?.block_internal_id,
                io: project_data?.io_l_setup?.[parseInt(step?.io)]?.[parseInt(step?.l)]?.block_io,
                l: project_data?.io_l_setup?.[parseInt(step?.io)]?.[parseInt(step?.l)]?.block_line,
                st: step?.st === true,
                b_us: step?.b_us === undefined || step?.b_us === null || step?.b_us === '' || isNaN(step?.b_us) || parseInt(step?.b_us) < 0 ? 0 : parseInt(step?.b_us),
                a_us: step?.a_us === undefined || step?.a_us === null || step?.a_us === '' || isNaN(step?.a_us) || parseInt(step?.a_us) < 0 ? 0 : parseInt(step?.a_us),
            }
            if (
                blocks_steps.length === 0 ||
                blocks_steps?.[blocks_steps.length - 1]?.block_id !== project_data?.io_l_setup?.[parseInt(step?.io)]?.[parseInt(step?.l)]?.block_id
            )
                blocks_steps.push({
                    block_id: project_data?.io_l_setup?.[parseInt(step?.io)]?.[parseInt(step?.l)]?.block_id,
                    estimate_timeout: 1 + tmpStep.b_us + tmpStep.a_us,
                    steps: [tmpStep]
                })
            else {
                blocks_steps[blocks_steps.length - 1].estimate_timeout += 1 + tmpStep.b_us + tmpStep.a_us
                blocks_steps[blocks_steps.length - 1].steps.push(tmpStep)
            }
        }
        return blocks_steps
    } catch (error) {
        console.error(new Date(), 'get_blocks_steps')
        console.error(error)
        throw error
    }
}

module.exports = { save_io_l_adc, save_component, get_project_data, get_projects_by_block, get_block_internal_ids, get_blocks_steps }