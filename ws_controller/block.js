const ping_interval_ms = 15000
const pong_timeout_ms = 5000
const second_pong_timeout_ms = 2000

const WebSocket = require('ws')
const db_wss = require('./project_block')

const block_model = require('./../model/block')
const project_model = require('./../model/project')
const project_block_model = require('./../model/project_block')

const add_block = (ws, block_id) => {
    if (block_id === undefined || block_id === null || block_id === '') {
        console.error(new Date(), 'add_block');
        console.error(`Unknown Block`);
        ws.send(JSON.stringify({ req: 'unknown_block', srv_t_s: Math.round((new Date().getTime()) / 1000) }))
        ws.close()
        return false
    }
    if ((db_wss.getBlockWS(block_id)?.readyState ?? WebSocket.CLOSED) <= WebSocket.OPEN) {
        console.warn(new Date(), 'add_block');
        console.warn(`Duplicated block ${block_id}`);
        db_wss.getBlockWS(block_id).send(JSON.stringify({ req: 'duplicate_block', srv_t_s: Math.round((new Date().getTime()) / 1000) }))
        db_wss.getBlockWS(block_id).close()
        ws.send(JSON.stringify({ req: 'duplicate_block', srv_t_s: Math.round((new Date().getTime()) / 1000) }))
        ws.close()
        return false
    }
    db_wss.setBlockWS(ws, block_id, true)
    console.log(new Date(), 'add_block');
    console.log(`Block ${block_id} connected to ${ws.block_id_rand}`);
    block_model.start_block(block_id)
        .then().catch(err => {
            if (err) {
                console.error(new Date(), 'add_block');
                console.error(`Can't start DB block ${block_id}`);
                console.error(err);
                if (ws?.readyState === WebSocket.OPEN)
                    ws.close()
            }
        })
    ws.on('close', () => {
        if (db_wss.getBlockWS(block_id)?.block_id_rand === ws.block_id_rand) {
            db_wss.deleteBlockWS(ws, block_id, true)
            console.log(new Date(), 'add_block');
            console.log(`Block ${block_id} disconnected from ${ws.block_id_rand}`);
            block_model.remove_block(block_id)
                .then(() => sync_project(block_id))
                .then()
                .catch(err => {
                    if (err) {
                        console.error(new Date(), 'add_block');
                        console.error(`Can't remove DB block ${block_id}`);
                        console.error(err);
                    }
                })
        } else {
            console.warn(new Date(), 'add_block');
            console.warn(`Block ${block_id} still connected to ${db_wss.getBlockWS(block_id)?.block_id_rand ?? 'UNKNOWN'}`);
        }
    })
    return true
}

const set_ping_pong = (ws) => {
    ws.func_timeout_pong = null
    ws.func_second_timeout_pong = null
    ws.last_ping = 0
    ws.last_pong = 0
    ws.ping_custom = () => {
        clearTimeout(ws.func_timeout_pong)
        clearTimeout(ws.func_second_timeout_pong)
        if (ws.last_ping > ws.last_pong) {
            console.error(new Date(), 'set_ping_pong');
            console.error(`WS ${ws.block_id_rand} ping at ${ws.last_ping} and didn't receive pong`);
        }
        ws.last_ping = (new Date()).getTime()
        ws.func_timeout_pong = setTimeout(() => {
            clearTimeout(ws.func_second_timeout_pong)
            ws.last_ping = (new Date()).getTime()
            console.error(new Date(), 'set_ping_pong');
            console.error(`WS ${ws.block_id_rand} try second ping`);
            ws.ping()
            ws.func_second_timeout_pong = setTimeout(() => {
                console.error(new Date(), 'set_ping_pong');
                console.error(`WS ${ws.block_id_rand} pong timeout`);
                ws.close()
            }, second_pong_timeout_ms)
        }, pong_timeout_ms)
        console.error(new Date(), 'set_ping_pong');
        console.error(`WS ${ws.block_id_rand} ping sent`);
        ws.ping()
    }
    ws.func_interval_ping = setInterval(() => {
        ws.ping_custom()
    }, ping_interval_ms)
    ws.on('pong', () => {
        clearTimeout(ws.func_timeout_pong)
        clearTimeout(ws.func_second_timeout_pong)
        console.log(new Date(), 'set_ping_pong')
        if (ws.last_ping < ws.last_pong) {
            console.error(new Date(), 'set_ping_pong');
            console.log(`WS ${ws.block_id_rand} unknown pong received`);
        } else {
            ws.last_pong = (new Date()).getTime()
            console.log(`WS ${ws.block_id_rand} pong received with RTT ${ws.last_pong - ws.last_ping}ms (last ping)`);
        }
    })
    ws.on('close', () => {
        clearInterval(ws.func_interval_ping)
        clearTimeout(ws.func_timeout_pong)
        clearTimeout(ws.func_second_timeout_pong)
    })
}

const first_get_data = async (ws, block_id) => {
    if (block_id === undefined || block_id === null || block_id === '')
        throw new Error("Unknown Block ID")
    if ((ws?.readyState ?? WebSocket.CLOSED) > WebSocket.OPEN)
        throw new Error("Block Offline")
    try {
        const internal_ids = await project_model.get_block_internal_ids(block_id)
        for (const internal_id of internal_ids) {
            console.log(new Date(), 'first_get_data');
            console.log(`Sync Block ${block_id} Internal ${internal_id}`);
            ws.send(JSON.stringify({ req: 'get_state', internal_id, srv_t_s: Math.round((new Date().getTime()) / 1000) }))
            ws.send(JSON.stringify({ req: 'get_adc', internal_id, srv_t_s: Math.round((new Date().getTime()) / 1000) }))
        }
        return true
    } catch (error) {
        throw error
    }
}

const sync_project = async (block_id, block_internal_id, sync_notif_type) => {
    if (block_id === undefined || block_id === null || block_id === '')
        throw new Error("Unknown Block ID")
    try {
        const projects_data = await project_model.get_projects_by_block(block_id, block_internal_id, db_wss.onlineProjectIDs())
        for (const project_data of projects_data) {
            const io_change = project_block_model.project_page_io_change(await project_block_model.project_block_data(project_data))
            for (const page of (['setup', 'matrix', 'component'])) {
                const wss = db_wss.getProjectWSS(project_data?._id, page)
                if (wss.length > 0) {
                    console.log(new Date(), 'sync_project');
                    console.log(`Sync ${wss.length} ${page} Project ${project_data?._id}`);
                    for (const ws of wss) {
                        if ((ws?.readyState ?? WebSocket.CLOSED) > WebSocket.OPEN)
                            continue
                        ws.send(JSON.stringify(io_change[page]))
                    }
                }
            }
            db_wss.sendNotification(project_data?._id, `Terdapat perubahan ${sync_notif_type ?? "data"} pada ${block_id} ${block_internal_id ?? ""}`)
        }
    } catch (error) {
        throw error
    }
}

const broadcast_notification_project = async (message, block_id, block_internal_id) => {
    if (typeof message != 'string' || typeof message != 'number' || message == '')
        throw new Error("Unknown Message")
    if (block_id === undefined || block_id === null || block_id === '')
        throw new Error("Unknown Block ID")
    try {
        const projects_data = await project_model.get_projects_by_block(block_id, block_internal_id, db_wss.onlineProjectIDs())
        for (const project_data of projects_data)
            db_wss.sendNotification(project_data?._id, `${message} pada ${block_id} ${block_internal_id ?? ""}`)
        return true
    } catch (error) {
        throw error
    }
}

const set_sync_send = (ws) => {
    ws.sync_queue = []
    ws.sendSync = (msg, timeout_s = 120) => new Promise((res, rej) => {
        if (ws?.readyState !== WebSocket.OPEN)
            return rej(new Error('WS Not Opened'))
        const sync_id = parseInt(`${Math.round(8 * Math.random()) + 1}${Math.round((new Date()).getTime() / 1000) % 3600}`)
        const ontimeout = setTimeout(() => {
            ws.sync_queue = ws.sync_queue.filter(q => q?.sync_id !== sync_id)
            rej('WS Send Sync Timeout')
        }, timeout_s * 1000)
        const onresolve = (msg, msgJSON) => {
            clearTimeout(ontimeout)
            ws.sync_queue = ws.sync_queue.filter(q => q?.sync_id !== sync_id)
            res(msg, msgJSON)
        }
        const onreject = (err) => {
            clearTimeout(ontimeout)
            ws.sync_queue = ws.sync_queue.filter(q => q?.sync_id !== sync_id)
            rej(err)
        }
        ws.sync_queue.push({ sync_id, ontimeout, onresolve, onreject })
        if (msg !== null && typeof msg == 'object')
            ws.send(JSON.stringify({ ...msg, sync_id }))
        else
            ws.send(JSON.stringify({ sync_id, sync_data: msg }))
    })
    ws.on('close', () => {
        for (const queue of ws.sync_queue) {
            if (typeof queue?.onreject === 'function')
                queue?.onreject(new Error('WS Closed'))
            if (queue?.ontimeout !== undefined)
                clearTimeout(queue?.ontimeout)
        }
    })
}

const ws_handler = (ws, req) => {
    const block_id = req.params?.block_id === undefined ||
        req.params?.block_id === null ||
        isNaN(req.params?.block_id)
        ? req.params?.block_id : parseFloat(req.params?.block_id)
    ws.block_id_rand = `block_${block_id ?? 'UNKNOWN'}_${Math.round(Math.random() * 9)}`
    ws.send(JSON.stringify({ srv_t_s: Math.round((new Date().getTime()) / 1000) }))
    console.log(new Date(), 'block_ws_handler');
    console.log(`WS ${ws.block_id_rand} connected`);
    ws.on('close', () => {
        console.log(new Date(), 'block_ws_handler');
        console.log(`WS ${ws.block_id_rand} disconnected`);
    })
    set_ping_pong(ws)
    add_block(ws, block_id)
    first_get_data(ws, block_id).then().catch(err => {
        console.error(new Date(), 'block_ws_handler');
        console.error('Can\'t get Internal IDs');
        console.error(err);
    })
    set_sync_send(ws)
    ws.on('message', async msg => {
        let msgJSON = {}
        try {
            msgJSON = JSON.parse(msg)
        } catch (error) {
            console.error(new Date(), 'block_ws_handler');
            console.error(new Error(`Receive non JSON message WS ${ws.block_id_rand}`));
            console.error(msg);
        }
        if (!isNaN(msgJSON?.clb_t_s) && parseInt(msgJSON?.clb_t_s ?? 0) > 0) {
            console.log(new Date(), 'block_ws_handler');
            console.log(`Block ${ws.block_id_rand} time diff ${Math.round((new Date()).getTime() / 1000) - parseInt(msgJSON?.clb_t_s ?? 0)}`);
        }
        try {
            if (msgJSON?.reply_sync_id !== undefined) {
                const sync_id = isNaN(msgJSON?.reply_sync_id) ? msgJSON?.reply_sync_id : parseFloat(msgJSON?.reply_sync_id)
                const queue = (ws?.sync_queue ?? []).find(q => q?.sync_id === sync_id)
                if (typeof queue?.onresolve != 'function')
                    throw new Error('No Sync Resolve Function ' + sync_id)
                else
                    queue.onresolve(msg, msgJSON)
            } else if (msgJSON?.req == 'set_adc') {
                await block_model.save_io_adc(block_id, msgJSON?.internal_id, msgJSON?.io_adc)
                await sync_project(block_id, msgJSON?.internal_id, "rangkaian")
                console.log(new Date(), 'block_ws_handler');
                console.log(`Set ADC WS ${ws.block_id_rand}`);
            } else if (msgJSON?.req == 'set_state') {
                await block_model.save_io_l_state(block_id, msgJSON?.internal_id, msgJSON?.io_l_state)
                await sync_project(block_id, msgJSON?.internal_id, "nilai")
                console.log(new Date(), 'block_ws_handler');
                console.log(`Set State WS ${ws.block_id_rand}`);
            } else {
                console.error(new Date(), 'block_ws_handler');
                console.error(new Error(`Receive unknown request WS ${ws.block_id_rand}`));
                console.error(msg);
            }
        } catch (error) {
            if (msgJSON?.reply_sync_id !== undefined) {
                const sync_id = isNaN(msgJSON?.reply_sync_id) ? msgJSON?.reply_sync_id : parseFloat(msgJSON?.reply_sync_id)
                const queue = (ws?.sync_queue ?? []).find(q => q?.sync_id === sync_id)
                if (typeof queue?.onreject == 'function')
                    queue.onreject('No Sync Resolve Function')
                else {
                    console.error(new Date(), 'block_ws_handler');
                    console.error(new Error('No Sync Reject Function ' + sync_id));
                }
                console.error(new Date(), 'block_ws_handler (sync mode)');
                console.error(error);
            } else if (msgJSON?.req == 'set_adc') {
                broadcast_notification_project("Gagal menyimpan status blok", block_id, msgJSON?.internal_id)
                    .catch(err => {
                        console.error(new Date(), 'block_ws_handler (broadcast_notification)');
                        console.error(err);
                    })
                console.error(new Date(), 'block_ws_handler (set_adc)');
                console.error(error);
            } else if (msgJSON?.req == 'set_state') {
                broadcast_notification_project("Gagal menyimpan nilai blok", block_id, msgJSON?.internal_id)
                    .catch(err => {
                        console.error(new Date(), 'block_ws_handler (broadcast_notification)');
                        console.error(err);
                    })
                console.error(new Date(), 'block_ws_handler');
                console.error(error);
            } else {
                console.error(new Date(), 'block_ws_handler');
                console.error(error);
            }
        }
    })
}

module.exports = {
    ws_handler
}