const db_wss = require('../project_block')

const ws_handler = (ws, req) => {
    const project_id = req.params?.project_id === undefined ||
        req.params?.project_id === null ||
        isNaN(req.params?.project_id)
        ? req.params?.project_id : parseFloat(req.params?.project_id)
    if (project_id === undefined || project_id === null || project_id === '') {
        console.error(new Date(), 'notification_ws_handler');
        console.error(`Unknown Project`);
        ws.send(JSON.stringify({ req: 'unknown_project' }))
        ws.close()
        return
    }
    db_wss.addProjectNotificationWS(ws, project_id)
    ws.on('close', () => db_wss.deleteProjectNotificationWS(ws, project_id))
    ws.on('message', async msg => {
        let msgJSON = {}
        try {
            msgJSON = JSON.parse(msg)
            console.error(new Date(), 'notification_ws_handler');
            console.error(new Error(`Receive unknown request WS ${ws.db_wss_id}`));
            console.error(msg);
        } catch (error) {
            console.error(new Date(), 'notification_ws_handler');
            console.error(new Error(`Receive non JSON message WS ${ws.db_wss_id}`));
            console.log(msg);
        }
    })
}

module.exports = { ws_handler }