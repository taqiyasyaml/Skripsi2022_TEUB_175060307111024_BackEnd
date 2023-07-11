const project_model = require('./project')
const block_model = require('./block')

const project_block_data = (project_data = { io_l_setup: [], adc_refs: [], block_depedencies: [] }) => new Promise(async (res, rej) => {
    try {
        const tmp_project_data = {
            io_l_setup: Array.isArray(project_data?.io_l_setup) ? project_data.io_l_setup : [],
            adc_refs: Array.isArray(project_data?.adc_refs) ? project_data.adc_refs : [],
            block_depedencies: Array.isArray(project_data?.block_depedencies) ? project_data.block_depedencies : [],
        }
        const block_data = []
        for (const dep of tmp_project_data?.block_depedencies ?? []) {
            block_data.push(
                ...((await block_model.get_block_data(dep?._id))?.internal_block ?? [])
                    .filter(d => (dep?.internal_ids ?? []).includes(d?._id))
                    .map(({ _id, io_l_state, io_adc }) => ({ block_id: dep?._id, block_internal_id: _id, io_l_state, io_adc }))
            )
        }
        const adc_refs_picked = []
        const adc_setup_val = []
        const main_io_l_state = []
        for (const [i_io, io] of (tmp_project_data?.io_l_setup ?? []).entries()) {
            adc_refs_picked[i_io] = null
            const adc_auto_ref = (tmp_project_data?.adc_refs?.[i_io] ?? null) === null
            let adc_manual_ref = false
            main_io_l_state[i_io] = []
            const firstADCRefs = { stateBool: undefined, stateTrue: undefined, canRead: undefined, canReadTrue: undefined }
            const last_block_io_l = { block_id: null, block_internal_id: null, block_io: null }
            for (const [i_l, line] of (io ?? []).entries()) {
                main_io_l_state[i_io][i_l] = line === null ||
                    line?.block_id === undefined || line?.block_id === null ||
                    line?.block_internal_id === undefined || line?.block_internal_id === null ||
                    line?.block_io === undefined || line?.block_io === null ||
                    line?.block_line === undefined || line?.block_line === null ?
                    null :
                    block_data.find(b => b?.block_id === line?.block_id && b?.block_internal_id === line?.block_internal_id)?.io_l_state?.[line?.block_io]?.[line?.block_line] ?? null
                if (typeof main_io_l_state[i_io][i_l] === 'boolean') {
                    const adc_ref = { block_id: line?.block_id, block_internal_id: line?.block_internal_id, block_io: line?.block_io }
                    if (adc_auto_ref === true) {
                        if (
                            last_block_io_l?.block_id != adc_ref?.block_id ||
                            last_block_io_l?.block_internal_id != adc_ref?.block_internal_id ||
                            last_block_io_l?.block_io != adc_ref?.block_io
                        ) {
                            if (firstADCRefs?.stateBool === undefined)
                                firstADCRefs.stateBool = adc_ref
                            if (firstADCRefs?.stateTrue === undefined && main_io_l_state[i_io][i_l] === true)
                                firstADCRefs.stateTrue = adc_ref
                            if (firstADCRefs?.canRead === undefined || firstADCRefs?.canReadTrue === true) {
                                if (
                                    (block_data
                                        .find(b => b?.block_id === adc_ref?.block_id && b?.block_internal_id === adc_ref?.block_internal_id)
                                        ?.io_adc?.[adc_ref?.block_io]?.e ?? false) === true
                                ) {
                                    if (firstADCRefs?.canRead === undefined)
                                        firstADCRefs.canRead = adc_ref
                                    if (firstADCRefs?.canReadTrue === undefined && main_io_l_state[i_io][i_l] === true)
                                        firstADCRefs.canReadTrue = adc_ref
                                }
                            }
                        }
                    } else if (adc_manual_ref !== true &&
                        line?.block_id !== undefined && tmp_project_data.adc_refs[i_io]?.block_id === line?.block_id &&
                        line?.block_internal_id !== undefined && tmp_project_data.adc_refs[i_io]?.block_internal_id === line?.block_internal_id &&
                        line?.block_io !== undefined && tmp_project_data.adc_refs[i_io]?.block_io === line?.block_io
                    )
                        adc_manual_ref = true
                    last_block_io_l.block_id = adc_ref.block_id
                    last_block_io_l.block_internal_id = adc_ref.block_internal_id
                    last_block_io_l.block_io = adc_ref.block_io
                }
            }
            if (adc_auto_ref === true)
                adc_refs_picked[i_io] = firstADCRefs?.canReadTrue ?? firstADCRefs?.canRead ?? firstADCRefs?.stateTrue ?? firstADCRefs?.stateBool ?? null
            else if (adc_manual_ref === true)
                adc_refs_picked[i_io] = tmp_project_data.adc_refs[i_io]
            if (adc_refs_picked[i_io] === null ||
                adc_refs_picked[i_io]?.block_id === undefined || adc_refs_picked[i_io]?.block_id === null ||
                adc_refs_picked[i_io]?.block_internal_id === undefined || adc_refs_picked[i_io]?.block_internal_id === null ||
                adc_refs_picked[i_io]?.block_io === undefined || adc_refs_picked[i_io]?.block_io === null)
                adc_setup_val[i_io] = { e: false, m_adc: 0, m_t_ms: 0, val: 0 }
            else {
                const ioADC = block_data
                    .find(b => b?.block_id === adc_refs_picked[i_io]?.block_id && b?.block_internal_id === adc_refs_picked[i_io]?.block_internal_id)
                    ?.io_adc?.[adc_refs_picked[i_io]?.block_io]
                adc_setup_val[i_io] = {
                    e: ioADC?.e === true,
                    m_adc: ioADC?.m_adc === undefined || ioADC?.m_adc === null || isNaN(ioADC?.m_adc) || parseInt(ioADC?.m_adc) < 0 ? 0 : (parseInt(ioADC?.m_adc) > 4095 ? 4095 : parseInt(ioADC?.m_adc)),
                    m_t_ms: ioADC?.m_t_ms === undefined || ioADC?.m_t_ms === null || isNaN(ioADC?.m_t_ms) || parseInt(ioADC?.m_t_ms) < 0 ? 0 : parseInt(ioADC?.m_t_ms),
                    val: ioADC?.val === undefined || ioADC?.val === null || isNaN(ioADC?.val) || parseInt(ioADC?.val) < 0 ? 0 : (parseInt(ioADC?.val) > 4095 ? 4095 : parseInt(ioADC?.val)),
                }
            }
        }
        res({ main_io_l_state, adc_refs_picked, adc_setup_val, block_data })
    } catch (error) {
        rej(error)
    }
})

const setup_page_adc = (d_project_block) => {
    const adc_setup = []
    if (Array(d_project_block?.adc_setup_val)) {
        for (const ioADC of d_project_block?.adc_setup_val)
            adc_setup.push({
                can_read: ioADC?.e === true,
                margin_adc: ioADC?.m_adc === undefined || ioADC?.m_adc === null || isNaN(ioADC?.m_adc) || parseInt(ioADC?.m_adc) < 0 ? 0 : (parseInt(ioADC?.m_adc) > 4095 ? 4095 : parseInt(ioADC?.m_adc)),
                margin_t_ms: ioADC?.m_t_ms === undefined || ioADC?.m_t_ms === null || isNaN(ioADC?.m_t_ms) || parseInt(ioADC?.m_t_ms) < 0 ? 0 : parseInt(ioADC?.m_adc),
            })
    }
    return adc_setup
}
const project_page_io_change = (d_project_block) => {
    const adc_val = []
    const line = []
    const line_component = []
    const adc_setup = []

    if (Array(d_project_block?.adc_setup_val)) {
        for (const ioADC of d_project_block?.adc_setup_val) {
            adc_setup.push({
                can_read: ioADC?.e === true,
                margin_adc: ioADC?.m_adc === undefined || ioADC?.m_adc === null || isNaN(ioADC?.m_adc) || parseInt(ioADC?.m_adc) < 0 ? 0 : (parseInt(ioADC?.m_adc) > 4095 ? 4095 : parseInt(ioADC?.m_adc)),
                margin_t_ms: ioADC?.m_t_ms === undefined || ioADC?.m_t_ms === null || isNaN(ioADC?.m_t_ms) || parseInt(ioADC?.m_t_ms) < 0 ? 0 : parseInt(ioADC?.m_t_ms),
            })
            adc_val.push(ioADC?.val === undefined || ioADC?.val === null || isNaN(ioADC?.val) || parseInt(ioADC?.val) < 0 ? 0 : (parseInt(ioADC?.val) > 4095 ? 4095 : parseInt(ioADC?.val)))
        }
    }

    if (Array.isArray(d_project_block?.main_io_l_state)) {
        for (const [i_io, io] of d_project_block.main_io_l_state.entries()) {
            if (!Array.isArray(io)) continue
            for (const [i_l, l] of io.entries()) {
                if (!Array.isArray(line[i_l])) line[i_l] = []
                if (typeof l != 'boolean') continue
                if (l === true)
                    line[i_l].push(i_io)
            }
        }
    }

    for (const [i_l, ios] of line.entries())
        line_component.push({ id: i_l, pins_id: ios })

    return {
        setup: { req: 'io_change', adc_setup },
        matrix: {
            req: 'io_change',
            io_l_state: Array.isArray(d_project_block?.main_io_l_state) ? d_project_block?.main_io_l_state : [],
            adc_val
        },
        component: { req: 'io_change', line: line_component, adc_val }
    }
}

module.exports = { project_block_data, setup_page_adc, project_page_io_change }