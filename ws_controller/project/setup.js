const WebSocket = require('ws')
const db_wss = require('../project_block')

const project_model = require('./../../model/project')
const project_block_model = require('./../../model/project_block')

const send_setup_first_connect = async (ws, project_id) => {
    if (project_id === undefined || project_id === null || project_id === '') {
        console.error(new Date(), 'send_setup_first_connect');
        console.error(new Error('Unknown Project'));
        throw new Error('Unknown Project')
    }
    project_id = isNaN(project_id) ? project_id : parseFloat(project_id)
    if ((ws?.readyState ?? WebSocket.CLOSED) > WebSocket.OPEN) {
        console.log('readystate', ws?.readyState, WebSocket.OPEN);
        console.error(new Date(), 'send_setup_first_connect');
        console.error(new Error('Can\'t send to WS'));
        throw new Error('Can\'t send to WS')
    }
    try {
        const project_data = await project_model.get_project_data(project_id)
        const io_change = project_block_model.project_page_io_change(await project_block_model.project_block_data(project_data))
        ws.send(JSON.stringify({ req: 'setup_change', io_l_setup: project_data?.io_l_setup ?? [], adc_refs: project_data?.adc_refs ?? [] }))
        ws.send(JSON.stringify(io_change.setup))
        return
    } catch (error) {
        console.error(new Date(), 'send_setup_first_connect');
        console.error(error);
        throw error
    }
}

const set_data_setup = async (project_id, msgJSON) => {
    if (project_id === undefined || project_id === null || project_id === '') {
        console.error(new Date(), 'set_data_setup');
        console.error(new Error('Unknown Project'));
        throw new Error('Unknown Project')
    }
    project_id = isNaN(project_id) ? project_id : parseFloat(project_id)
    try {
        await project_model.save_io_l_adc(project_id, msgJSON?.io_l_setup, msgJSON?.adc_refs)
        const project_data = await project_model.get_project_data(project_id)
        const project_block_data = await project_block_model.project_block_data(project_data)
        console.log(new Date(), 'set_data_setup');
        console.log(`New Project ${project_id} ADC Setup`);
        for (const ws of db_wss.getProjectSetupWSS(project_id))
            ws.send(JSON.stringify({ req: 'setup_change', io_l_setup: project_data?.io_l_setup ?? [], adc_refs: project_data?.adc_refs ?? [] }))
        console.trace(project_block_data?.adc_setup_val)
        const block_io_adc = []
        for (const [i_io, adc_picked] of (Array.isArray(project_block_data?.adc_refs_picked) ? project_block_data.adc_refs_picked : []).entries()) {
            if (adc_picked?.block_id === undefined || adc_picked?.block_id === null || adc_picked?.block_id === '' ||
                adc_picked?.block_internal_id === undefined || adc_picked?.block_internal_id === null || adc_picked?.block_internal_id === '' ||
                adc_picked?.block_io === undefined || adc_picked?.block_io === null || isNaN(adc_picked?.block_io) || parseInt(adc_picked?.block_io) < 0
            )
                continue
            let i_picked = block_io_adc.findIndex(p => p?.block_id === adc_picked.block_id && p?.block_internal_id === adc_picked.block_internal_id)
            if (i_picked < 0) {
                const tmp_block = (project_block_data?.block_data ?? []).find(p => p?.block_id === adc_picked.block_id && p?.block_internal_id === adc_picked.block_internal_id)
                if (tmp_block !== undefined && tmp_block !== null && typeof tmp_block == 'object') {
                    i_picked = block_io_adc.length
                    block_io_adc.push(tmp_block)
                }
            }
            if (i_picked < 0 || !Array.isArray(block_io_adc[i_picked]?.io_adc))
                continue
            if (adc_picked.block_io >= block_io_adc[i_picked].io_adc.length) {
                for (let io = 0; io < adc_picked.block_io; io++)
                    block_io_adc[i_picked][io] = block_io_adc[i_picked]?.[io] ?? { e: false, m_adc: 0, m_t_ms: 0 }
            }
            block_io_adc[i_picked].io_adc[adc_picked.block_io] = {
                e: msgJSON?.adc_setup?.[i_io]?.can_read === true,
                m_adc: msgJSON?.adc_setup?.[i_io]?.margin_adc === undefined || msgJSON?.adc_setup?.[i_io]?.margin_adc === null || isNaN(msgJSON?.adc_setup?.[i_io]?.margin_adc) || parseInt(msgJSON?.adc_setup?.[i_io]?.margin_adc) < 0 ? 0 : (
                    parseInt(msgJSON?.adc_setup?.[i_io]?.margin_adc) > 4095 ? 4095 : parseInt(msgJSON?.adc_setup?.[i_io]?.margin_adc)
                ),
                m_t_ms: msgJSON?.adc_setup?.[i_io]?.margin_t_ms === undefined || msgJSON?.adc_setup?.[i_io]?.margin_t_ms === null || isNaN(msgJSON?.adc_setup?.[i_io]?.margin_t_ms) || parseInt(msgJSON?.adc_setup?.[i_io]?.margin_t_ms) < 0 ? 0 : parseInt(msgJSON?.adc_setup?.[i_io]?.margin_t_ms)
            }
        }
        for (const block of block_io_adc) {
            const ws = db_wss.getBlockWS(block?.block_id)
            if ((ws?.readyState ?? WebSocket.CLOSED) > WebSocket.OPEN)
                continue
            console.log(new Date(), 'set_data_setup');
            console.log(`Set ADC Block ${block?.block_id} Internal ${block?.block_internal_id}`);
            ws.send(JSON.stringify({ req: 'set_adc', internal_id: block?.block_internal_id, io_adc: block?.io_adc, srv_t_s: Math.round((new Date().getTime()) / 1000) }))
        }
        db_wss.syncBlock(project_data?.block_depedencies ?? [])
        return
    } catch (error) {
        console.error(new Date(), 'set_data_setup');
        console.error(error);
        throw error
    }
}

const ws_handler = async (ws, req) => {
    const project_id = req.params?.project_id === undefined ||
        req.params?.project_id === null ||
        isNaN(req.params?.project_id)
        ? req.params?.project_id : parseFloat(req.params?.project_id)
    if (project_id === undefined || project_id === null || project_id === '') {
        console.error(new Date(), 'setup_ws_handler');
        console.error(`Unknown Project`);
        ws.send(JSON.stringify({ req: 'unknown_project' }))
        ws.close()
        return
    }
    db_wss.addProjectSetupWS(ws, project_id)
    ws.on('close', () => db_wss.deleteProjectSetupWS(ws, project_id))
    await send_setup_first_connect(ws, project_id)
    ws.on('message', async msg => {
        let msgJSON = {}
        try {
            msgJSON = JSON.parse(msg)
        } catch (error) {
            console.error(new Date(), 'setup_ws_handler');
            console.error(new Error(`Receive non JSON message WS ${ws.db_wss_id}`));
            console.log(msg);
        }
        const ip_client = req?.headers?.['x-forwarded-for'] ?? req?.socket?.remoteAddress
        const username_client = msgJSON?.username ?? ((ip_client != undefined && ip_client != null) ? `Seseorang (${ip_client})` : "Seseorang")
        try {
            if (msgJSON?.req == 'set_data') {
                await set_data_setup(project_id, msgJSON)
                console.log(new Date(), 'setup_ws_handler');
                console.log(`Set IO Line ADC Refs ${ws.db_wss_id}`);
                db_wss.sendNotification(project_id, `${username_client} berhasil menyimpan Pengaturan I/O dan Jalur`)
            } else {
                console.error(new Date(), 'setup_ws_handler');
                console.error(new Error(`Receive unknown request WS ${ws.db_wss_id}`));
                console.error(msg);
            }
        } catch (error) {
            if (msgJSON?.req == 'set_data') {
                db_wss.sendNotification(project_id, `${username_client} gagal menyimpan Pengaturan I/O dan Jalur`)
                console.error(new Date(), 'setup_ws_handler (set_data)');
                console.error(error);
            } else {
                console.error(new Date(), 'setup_ws_handler');
                console.error(error);
            }
        }
    })

}

module.exports = { ws_handler }