const Datastore = require('nedb')
const block = new Datastore({ filename: __dirname + '/../nedb/block.db' })

const remove_all = () => new Promise((res, rej) => {
    block.loadDatabase((errLoad) => {
        if (errLoad) {
            console.error(new Date(), 'remove_all_block')
            console.error(new Error('Load Document Block Error'))
            return rej(errLoad)
        }
        block.remove({}, { multi: true }, (errRemove) => {
            if (errRemove) {
                console.error(new Date(), 'remove_all_block')
                console.error(new Error('Remove Document Block Error'))
                return rej(errRemove)
            }
            return res()
        })
    })
})

const remove_block = (block_id) => new Promise((res, rej) => {
    if (block_id === undefined || block_id === null || block_id === '') {
        console.error(new Date(), 'remove_block')
        console.error(new Error('Unknown Block ID'))
        return rej(new Error('Unknown Block ID'))
    }
    block_id = isNaN(block_id) ? block_id : parseFloat(block_id)
    block.loadDatabase((errLoad) => {
        if (errLoad) {
            console.error(new Date(), 'remove_block')
            console.error(new Error('Load Document Block Error'))
            return rej(errLoad)
        }
        block.remove({ _id: block_id }, (errRemove) => {
            if (errRemove) {
                console.error(new Date(), 'remove_block')
                console.error(new Error('Remove Document Block Error'))
                return rej(errRemove)
            }
            res()
        })
    })
})

const remove_internal_block = (block_id = null, internal_id = 0) => new Promise((res, rej) => {
    if (block_id === undefined || block_id === null || block_id === '') {
        console.error(new Date(), 'remove_internal_block')
        console.error(new Error('Unknown Block ID'))
        return rej(new Error('Unknown Block ID'))
    }
    block_id = isNaN(block_id) ? block_id : parseFloat(block_id)
    if (internal_id === undefined || internal_id === null || internal_id === '') {
        console.error(new Date(), 'remove_internal_block')
        console.error(new Error('Unknown Internal ID'))
        return rej(new Error('Unknown Internal ID'))
    }
    internal_id = isNaN(internal_id) ? internal_id : parseFloat(internal_id)
    block.loadDatabase((errLoad) => {
        if (errLoad) {
            console.error(new Date(), 'remove_internal_block')
            console.error(new Error('Load Document Block Error'))
            return rej(errLoad)
        }
        block.update({ _id: block_id },
            { $pull: { internal_block: { _id: internal_id } } }
            , {}, errUpdate => {
                if (errUpdate) {
                    console.error(new Date(), 'remove_internal_block')
                    console.error(new Error('Update Document Block Error'))
                    return rej(errUpdate)
                }
                return res()
            })
    })
})
const start_block = (block_id) => new Promise(async (res, rej) => {
    try {
        await remove_block(block_id)
        block_id = isNaN(block_id) ? block_id : parseFloat(block_id)
        block.insert({ _id: block_id, internal_block: [] }, (errInsert) => {
            if (errInsert) {
                console.error(new Date(), 'start_block')
                console.error(new Error('Insert Document Block Error'))
                return rej(errInsert)
            }
            return res()
        })
    } catch (error) {
        if (error) {
            console.error(new Date(), 'start_block')
            console.error(new Error('Remove Document Block Error'))
            return rej(error)
        }
    }
})

const save_io_adc = (block_id = null, internal_id = 0, io_adc = []) => new Promise((res, rej) => {
    if (block_id === undefined || block_id === null || block_id === '') {
        console.error(new Date(), 'save_io_adc')
        console.error(new Error('Unknown Block ID'))
        return rej(new Error('Unknown Block ID'))
    }
    block_id = isNaN(block_id) ? block_id : parseFloat(block_id)
    if (internal_id === undefined || internal_id === null || internal_id === '') {
        console.error(new Date(), 'save_io_adc')
        console.error(new Error('Unknown Internal ID'))
        return rej(new Error('Unknown Internal ID'))
    }
    internal_id = isNaN(internal_id) ? internal_id : parseFloat(internal_id)
    const tmp = { _id: internal_id, io_l_state: [], io_adc: [] }
    for (const adc of Array.isArray(io_adc) ? io_adc : [])
        tmp.io_adc.push(typeof adc == 'object' ? {
            e: adc?.e === true,
            m_adc: adc?.m_adc === undefined || adc?.m_adc === null || isNaN(adc?.m_adc) || (adc?.m_adc ?? 0) < 0 ? 0 : (adc.m_adc > 4095 ? 4095 : parseInt(adc.m_adc)),
            m_t_ms: adc?.m_t_ms === undefined || adc?.m_t_ms === null || isNaN(adc?.m_t_ms) || (adc?.m_t_ms ?? 0) < 0 ? 0 : parseInt(adc.m_t_ms),
            val: adc?.val === undefined || adc?.val === null || isNaN(adc?.val) || (adc?.val ?? 0) < 0 ? 0 : (adc.val > 4095 ? 4095 : parseInt(adc.val))
        } : { e: false, m_adc: 0, m_t_ms: 0, val: 0 })
    block.loadDatabase((errLoad) => {
        if (errLoad) {
            console.error(new Date(), 'save_io_adc')
            console.error(new Error('Load Document Block Error'))
            return rej(errLoad)
        }

        block.findOne({ _id: block_id }, (errFind, doc) => {
            if (errFind) {
                console.error(new Date(), 'save_io_adc')
                console.error(new Error('Can\'t get Block Data'))
                return rej(errFind)
            }
            if (doc === null)
                block.insert({ _id: block_id, internal_block: [tmp] }, (errInsert) => {
                    if (errInsert) {
                        console.error(new Date(), 'save_io_adc')
                        console.error(new Error('Insert Document Block Error'))
                        return rej(errInsert)
                    }
                    return res()
                })
            else {
                const i_doc = (doc?.internal_block ?? []).findIndex(p => p._id === internal_id)
                block.update({ _id: block_id },
                    !Array.isArray(doc?.internal_block) ? { $set: { internal_block: [tmp] } } : (
                        i_doc < 0 ? { $push: { internal_block: tmp } } : { $set: { [`internal_block.${i_doc}.io_adc`]: tmp.io_adc } }
                    )
                    , {}, (errUpdate) => {
                        if (errUpdate) {
                            console.error(new Date(), 'save_io_adc')
                            console.error(new Error('Update Document Block Error'))
                            return rej(errUpdate)
                        }
                        return res()
                    })
            }
        })
    })
})

const save_io_l_state = (block_id = null, internal_id = 0, io_l_state = []) => new Promise((res, rej) => {
    if (block_id === undefined || block_id === null || block_id === '') {
        console.error(new Date(), 'save_io_l_state')
        console.error(new Error('Unknown Block ID'))
        return rej(new Error('Unknown Block ID'))
    }
    block_id = isNaN(block_id) ? block_id : parseFloat(block_id)
    if (internal_id === undefined || internal_id === null || internal_id === '') {
        console.error(new Date(), 'save_io_l_state')
        console.error(new Error('Unknown Internal ID'))
        return rej(new Error('Unknown Internal ID'))
    }
    internal_id = isNaN(internal_id) ? internal_id : parseFloat(internal_id)
    const tmp = { _id: internal_id, io_l_state: [], io_adc: [] }
    let maxLine = 0
    let needFillNull = false
    for (const [i_io, io] of (Array.isArray(io_l_state) ? io_l_state : []).entries()) {
        tmp.io_l_state[i_io] = []
        for (const [i_l, line] of (Array.isArray(io) ? io : []).entries()) {
            if (i_io === 0) maxLine = i_l
            else if (i_l > maxLine) {
                maxLine = i_l
                needFillNull = true
            }
            tmp.io_l_state[i_io][i_l] = typeof line === 'boolean' ? line : null
        }
        if ((tmp.io_l_state[i_io].length - 1) != maxLine)
            needFillNull = true
    }
    if (needFillNull === true) {
        for (let i_io = 0; i_io < tmp.io_l_state.length; i_io++) {
            for (let i_l = 0; i_l <= maxLine; i_l++)
                tmp.io_l_state[i_io][i_l] = tmp.io_l_state[i_io]?.[i_l] ?? null
        }
    }
    block.loadDatabase((errLoad) => {
        if (errLoad) {
            console.error(new Date(), 'save_io_l_state')
            console.error(new Error('Load Document Block Error'))
            return rej(errLoad)
        }

        block.findOne({ _id: block_id }, (errFind, doc) => {
            if (errFind) {
                console.error(new Date(), 'save_io_l_state')
                console.error(new Error('Can\'t get Block Data'))
                return rej(errFind)
            }
            if (doc === null)
                block.insert({ _id: block_id, internal_block: [tmp] }, (errInsert) => {
                    if (errInsert) {
                        console.error(new Date(), 'save_io_l_state')
                        console.error(new Error('Insert Document Block Error'))
                        return rej(errInsert)
                    }
                    return res()
                })
            else {
                const i_doc = (doc?.internal_block ?? []).findIndex(p => p._id === internal_id)
                block.update({ _id: block_id },
                    !Array.isArray(doc?.internal_block) ? { $set: { internal_block: [tmp] } } : (
                        i_doc < 0 ? { $push: { internal_block: tmp } } : { $set: { [`internal_block.${i_doc}.io_l_state`]: tmp.io_l_state } }
                    )
                    , {}, (errUpdate) => {
                        if (errUpdate) {
                            console.error(new Date(), 'save_io_l_state')
                            console.error(new Error('Update Document Block Error'))
                            return rej(errUpdate)
                        }
                        return res()
                    })
            }
        })
    })
})

const get_block_data = (block_id) => new Promise((res, rej) => {
    if (block_id === undefined || block_id === null || block_id === '') {
        console.error(new Date(), 'get_block_data')
        console.error(new Error('Unknown Block ID'))
        return rej(new Error('Unknown Block ID'))
    }
    block_id = isNaN(block_id) ? block_id : parseFloat(block_id)
    block.loadDatabase((errLoad) => {
        if (errLoad) {
            console.error(new Date(), 'get_block_data')
            console.error(new Error('Load Document Block Error'))
            return rej(errLoad)
        }
        block.findOne({ _id: block_id }, (errFind, doc) => {
            if (errFind) {
                console.error(new Date(), 'get_block_data')
                console.error(new Error('Can\'t get Block Data'))
                return rej(errFind)
            }
            return res(doc === null ? { _id: block_id, internal_block: [] } : doc)
        })
    })
})

module.exports = {
    remove_all,
    remove_block,
    remove_internal_block,
    start_block,
    save_io_adc,
    save_io_l_state,
    get_block_data
}