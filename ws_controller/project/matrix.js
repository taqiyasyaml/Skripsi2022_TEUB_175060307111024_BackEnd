const WebSocket = require('ws')
const db_wss = require('../project_block')

const project_model = require('./../../model/project')
const project_block_model = require('./../../model/project_block')

const send_matrix_first_connect = async (ws, project_id) => {
    if (project_id === undefined || project_id === null || project_id === '') {
        console.error(new Date(), 'send_matrix_first_connect');
        console.error(new Error('Unknown Project'));
        throw new Error('Unknown Project')
    }
    project_id = isNaN(project_id) ? project_id : parseFloat(project_id)
    if ((ws?.readyState ?? WebSocket.CLOSED) > WebSocket.OPEN) {
        console.error(new Date(), 'send_matrix_first_connect');
        console.error(new Error('Can\'t send to WS'));
        throw new Error('Can\'t send to WS')
    }
    try {
        ws.send(
            JSON.stringify(
                project_block_model.project_page_io_change(
                    await project_block_model.project_block_data(
                        await project_model.get_project_data(project_id)
                    )
                ).matrix
            )
        )
        return
    } catch (error) {
        console.error(new Date(), 'send_matrix_first_connect');
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
        console.error(new Date(), 'matrix_ws_handler');
        console.error(`Unknown Project`);
        ws.send(JSON.stringify({ req: 'unknown_project' }))
        ws.close()
        return
    }
    db_wss.addProjectMatrixWS(ws, project_id)
    ws.on('close', () => db_wss.deleteProjectMatrixWS(ws, project_id))
    await send_matrix_first_connect(ws, project_id)
    ws.on('message', async msg => {
        let msgJSON = {}
        try {
            msgJSON = JSON.parse(msg)
        } catch (error) {
            console.error(new Date(), 'matrix_ws_handler');
            console.error(new Error(`Receive non JSON message WS ${ws.db_wss_id}`));
            console.error(msg);
        }
        const ip_client = req?.headers?.['x-forwarded-for'] ?? req?.socket?.remoteAddress
        const username_client = msgJSON?.username ?? ((ip_client != undefined && ip_client != null) ? `Seseorang (${ip_client})` : "Seseorang")
        try {
            if (msgJSON?.req == 'set_states') {
                db_wss.sendNotification(project_id, `${username_client} sedang menjalankan perubahan rangkaian`)
                await db_wss.sendStepsBlock(await project_model.get_blocks_steps(project_id, msgJSON?.steps))
                db_wss.syncBlock((await project_model.get_project_data(project_id))?.block_depedencies ?? [])
                console.log(new Date(), 'matrix_ws_handler');
                console.log(`Set States ${ws.db_wss_id}`);
                db_wss.sendNotification(project_id, `${username_client} berhasil merubah rangkaian`)
            } else if (msgJSON?.req == 'sync_block') {
                db_wss.sendNotification(project_id, `${username_client} sedang mensinkronisasi data`)
                db_wss.syncBlock((await project_model.get_project_data(project_id))?.block_depedencies ?? [])
                console.log(new Date(), 'matrix_ws_handler');
                console.log(`Sync Block ${ws.db_wss_id}`);
            } else if (msgJSON?.req == 'read_adc') {
                if (msgJSON?.io === undefined || msgJSON?.io === null || isNaN(msgJSON?.io) || parseInt(msgJSON?.io) < 0)
                    throw new Error('Unknown IO Read ADC')
                const adc_refs_picked = (await project_block_model.project_block_data(await project_model.get_project_data(project_id)))?.adc_refs_picked ?? []
                if (adc_refs_picked[msgJSON?.io] !== undefined && adc_refs_picked[msgJSON?.io] !== null &&
                    adc_refs_picked[msgJSON?.io]?.block_id !== undefined && adc_refs_picked[msgJSON?.io]?.block_id !== null &&
                    adc_refs_picked[msgJSON?.io]?.block_internal_id !== undefined && adc_refs_picked[msgJSON?.io]?.block_internal_id !== null &&
                    adc_refs_picked[msgJSON?.io]?.block_io !== undefined && adc_refs_picked[msgJSON?.io]?.block_io !== null) {
                    const ws = db_wss.getBlockWS(adc_refs_picked[msgJSON?.io]?.block_id)
                    if ((ws?.readyState ?? WebSocket.CLOSED) <= WebSocket.OPEN) {
                        db_wss.sendNotification(project_id, `${username_client} sedang mengambil nilai pada alat`)
                        ws.send(JSON.stringify({
                            req: 'read_adc',
                            internal_id: adc_refs_picked[msgJSON?.io]?.block_internal_id,
                            io: adc_refs_picked[msgJSON?.io]?.block_io,
                            srv_t_s: Math.round((new Date().getTime()) / 1000)
                        }))
                    } else
                        throw new Error('Block Offline')
                } else
                    throw new Error('Unknown Selected Block')
            } else {
                console.error(new Date(), 'matrix_ws_handler');
                console.error(new Error(`Receive unknown request WS ${ws.db_wss_id}`));
                console.error(msg);
            }
        } catch (error) {
            if (msgJSON?.req == 'set_states') {
                db_wss.sendNotification(project_id, `${username_client} gagal merubah rangkaian`)
                console.error(new Date(), 'matrix_ws_handler (set_states)');
                console.error(error);
            } else if (msgJSON?.req == 'sync_block') {
                db_wss.sendNotification(project_id, `${username_client} gagal sinkronisasi`)
                console.error(new Date(), 'matrix_ws_handler (read_adc)');
                console.error(error);
            } else if (msgJSON?.req == 'read_adc') {
                db_wss.sendNotification(project_id, `${username_client} gagal mengambil nilai`)
                console.error(new Date(), 'matrix_ws_handler (read_adc)');
                console.error(error);
            } else {
                console.error(new Date(), 'matrix_ws_handler');
                console.error(error);
            }
        }
    })

}

module.exports = { ws_handler }