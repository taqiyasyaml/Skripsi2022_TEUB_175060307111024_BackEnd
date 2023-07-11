const WebSocket = require('ws')
const db_wss = require('../project_block')

const project_model = require('./../../model/project')
const project_block_model = require('./../../model/project_block')
const router_helper = require('./../../helper/route')

const send_component_first_connect = async (ws, project_id) => {
    if (project_id === undefined || project_id === null || project_id === '') {
        console.error(new Date(), 'send_component_first_connect');
        console.error(new Error('Unknown Project'));
        throw new Error('Unknown Project')
    }
    project_id = isNaN(project_id) ? project_id : parseFloat(project_id)
    if ((ws?.readyState ?? WebSocket.CLOSED) > WebSocket.OPEN) {
        console.error(new Date(), 'send_component_first_connect');
        console.error(new Error('Can\'t send to WS'));
        throw new Error('Can\'t send to WS')
    }
    try {
        const project_data = await project_model.get_project_data(project_id)
        const io_change = project_block_model.project_page_io_change(await project_block_model.project_block_data(project_data))
        ws.send(JSON.stringify({ req: 'component_change', components: project_data?.components ?? [] }))
        ws.send(JSON.stringify(io_change.component))
        return
    } catch (error) {
        console.error(new Date(), 'send_component_first_connect');
        console.error(error);
        throw error
    }
}

const set_components = async (project_id, msgJSON) => {
    if (project_id === undefined || project_id === null || project_id === '') {
        console.error(new Date(), 'set_components');
        console.error(new Error('Unknown Project'));
        throw new Error('Unknown Project')
    }
    project_id = isNaN(project_id) ? project_id : parseFloat(project_id)
    try {
        await project_model.save_component(project_id, msgJSON?.components)
        const project_data = await project_model.get_project_data(project_id)
        console.log(new Date(), 'set_components');
        console.log(`New Project ${project_id} Component`);
        for (const ws of db_wss.getProjectComponentWSS(project_id))
            ws.send(JSON.stringify({ req: 'component_change', components: project_data?.components ?? [] }))
        return
    } catch (error) {
        console.error(new Date(), 'set_components');
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
        console.error(new Date(), 'component_ws_handler');
        console.error(`Unknown Project`);
        ws.send(JSON.stringify({ req: 'unknown_project' }))
        ws.close()
        return
    }
    db_wss.addProjectComponentWS(ws, project_id)
    ws.on('close', () => db_wss.deleteProjectComponentWS(ws, project_id))
    await send_component_first_connect(ws, project_id)
    ws.on('message', async msg => {
        let msgJSON = {}
        try {
            msgJSON = JSON.parse(msg)
        } catch (error) {
            console.error(new Date(), 'component_ws_handler');
            console.error(new Error(`Receive non JSON message WS ${ws.db_wss_id}`));
            console.error(msg);
        }
        const ip_client = req?.headers?.['x-forwarded-for'] ?? req?.socket?.remoteAddress
        const username_client = msgJSON?.username ?? ((ip_client != undefined && ip_client != null) ? `Seseorang (${ip_client})` : "Seseorang")
        try {
            if (msgJSON?.req == 'set_component') {
                await set_components(project_id, msgJSON)
                console.log(new Date(), 'component_ws_handler');
                console.log(`Set Components ${ws.db_wss_id}`);
                db_wss.sendNotification(project_id, `${username_client} berhasil menyimpan komponen`)
            } else if (msgJSON?.req == 'connect') {
                db_wss.sendNotification(project_id,
                    `${username_client} mencari rute ${msgJSON?.io_from ?? "(sesuatu)"} -> ${!isNaN(msgJSON?.press_us ?? 0) && parseInt(msgJSON?.press_us ?? 0) > 0 ? `${msgJSON?.io_press ?? "terputus"} (${msgJSON?.press_us} us) -> ` : ""
                    }${msgJSON?.io_release ?? "terputus"}`)
                const steps_connect = router_helper.steps_connect_io_by_state(msgJSON,
                    (await project_block_model.project_block_data(await project_model.get_project_data(project_id)))?.main_io_l_state ?? []
                )
                if (steps_connect.length < 1) {
                    db_wss.sendNotification(project_id, `${username_client} gagal mendapatkan rute koneksi`)
                    throw new Error("Fail find steps")
                }
                db_wss.sendNotification(project_id, `${username_client} sedang menjalankan perubahan rangkaian`)
                await db_wss.sendStepsBlock(
                    await project_model.get_blocks_steps(project_id, steps_connect)
                )
                db_wss.syncBlock((await project_model.get_project_data(project_id))?.block_depedencies ?? [])
                console.log(new Date(), 'component_ws_handler');
                console.log(`Connect Pins ${ws.db_wss_id}`);
                db_wss.sendNotification(project_id, `${username_client} berhasil merubah rangkaian`)
            } else if (msgJSON?.req == 'disconnect') {
                db_wss.sendNotification(project_id, `${username_client} sedang memutuskan ${msgJSON?.io_disconnect ?? "(sesuatu)"}${msgJSON?.io_keep != undefined && msgJSON?.io_keep != null ? ` dari ${msgJSON?.io_keep}` : ""
                    }`)
                await db_wss.sendStepsBlock(
                    await project_model.get_blocks_steps(project_id,
                        router_helper.steps_disconnect_io_by_state(msgJSON,
                            (await project_block_model.project_block_data(await project_model.get_project_data(project_id)))?.main_io_l_state ?? []
                        )
                    )
                )
                db_wss.syncBlock((await project_model.get_project_data(project_id))?.block_depedencies ?? [])
                console.log(new Date(), 'component_ws_handler');
                console.log(`Disconnect Pins ${ws.db_wss_id}`);
                db_wss.sendNotification(project_id, `${username_client} berhasil memutuskan ${msgJSON?.io_disconnect ?? "(sesuatu)"}${msgJSON?.io_keep != undefined && msgJSON?.io_keep != null ? ` dari ${msgJSON?.io_keep}` : ""
                    }`)
            } else {
                console.error(new Date(), 'component_ws_handler');
                console.error(new Error(`Receive unknown request WS ${ws.db_wss_id}`));
                console.error(msg);
            }
        } catch (error) {
            if (msgJSON?.req == 'set_component') {
                db_wss.sendNotification(project_id, `${username_client} gagal menyimpan rangkaian`)
                console.error(new Date(), 'component_ws_handler (set_component)');
                console.error(error);
            } else if (msgJSON?.req == 'connect') {
                db_wss.sendNotification(project_id, `${username_client} gagal menghubungkan`)
                console.error(new Date(), 'component_ws_handler (connect)');
                console.error(error);
            } else if (msgJSON?.req == 'disconnect') {
                db_wss.sendNotification(project_id, `${username_client} gagal memutuskan`)
                console.error(new Date(), 'component_ws_handler (disconnect)');
                console.error(error);
            } else {
                console.error(new Date(), 'component_ws_handler');
                console.error(error);
            }
        }
    })

}

module.exports = { ws_handler }