const WebSocket = require('ws')
const block_model = require('./../model/block')
let ws_id = 1

const data = {
    blocks: {},
    projects: {}
}

const getBlockWS = (block_id) => {
    if (block_id === undefined || block_id === null || block_id === '')
        return undefined
    block_id = isNaN(block_id) ? block_id : parseFloat(block_id)
    return data.blocks?.[block_id]
}

const setBlockWS = (ws, block_id, force_duplicate) => {
    if (ws === undefined || block_id === undefined || block_id === null || block_id === '')
        return false
    block_id = isNaN(block_id) ? block_id : parseFloat(block_id)
    if (force_duplicate !== true && (getBlockWS(block_id)?.readyState ?? WebSocket.CLOSED) <= WebSocket.OPEN)
        return null
    ws.db_wss_id = `ws_component_${ws_id++}_${Math.round(9 * Math.random())}`
    data.blocks[block_id] = ws
    console.log(new Date(), 'set_block_dbwss');
    console.log(`WS ${ws.db_wss_id} added`);
    return true
}

const deleteBlockWS = (ws, block_id, force_delete) => {
    if (ws === undefined || block_id === undefined || block_id === null || block_id === '')
        return false
    block_id = isNaN(block_id) ? block_id : parseFloat(block_id)
    if (ws?.db_wss_id !== undefined && ws?.db_wss_id !== getBlockWS(block_id)?.db_wss_id && force_delete !== true)
        return null
    delete data.blocks[block_id]
    console.log(new Date(), 'delete_block_dbwss');
    console.log(`WS ${ws.db_wss_id} deleted`);
    return true
}

const syncBlock = (block_depedencies = []) => {
    for (const block of Array.isArray(block_depedencies) ? block_depedencies : []) {
        if (block?._id === undefined || block?._id === null || block?._id === '')
            continue
        const ws = getBlockWS(block?._id)
        if ((ws?.readyState ?? WebSocket.CLOSED) > WebSocket.OPEN)
            continue
        if(typeof ws?.ping_custom == 'function')
            ws.ping_custom()
        for (const internal_id of Array.isArray(block?.internal_ids) ? block.internal_ids : []) {
            if (internal_id === undefined || internal_id === null || internal_id === '')
                continue
            block_model.remove_internal_block(block?._id, internal_id)
                .then(() => {
                    console.log(new Date(), 'sync_block');
                    console.log(`Sync Block ${block?._id} Internal ${internal_id}`);
                    ws.send(JSON.stringify({ req: 'get_state', internal_id, srv_t_s: Math.round((new Date().getTime()) / 1000) }))
                    ws.send(JSON.stringify({ req: 'get_adc', internal_id, srv_t_s: Math.round((new Date().getTime()) / 1000) }))
                })
                .catch(err => {
                    console.error(new Date(), 'sync_block');
                    console.error(`Error Block ${block?._id} Internal ${internal_id}`);
                    console.error(err);
                })
        }
    }
}

const sendStepsBlock = async (blocks_steps = []) => {
    if (!Array.isArray(blocks_steps))
        throw new Error('Unknown Steps')
    try {
        for (const block of blocks_steps) {
            if (block?.block_id === undefined || block?.block_id === null || block?.block_id === '')
                continue
            const ws = getBlockWS(block?.block_id)
            if ((ws?.readyState ?? WebSocket.CLOSED) > WebSocket.OPEN)
                continue
            await ws.sendSync({ req: 'set_states', steps: block?.steps ?? [], srv_t_s: Math.round((new Date().getTime()) / 1000) }, 120 + block?.estimate_timeout ?? 0)
        }
    } catch (error) {
        console.error(new Date(), 'sendStepsBlock');
        console.error(error);
        throw error
    }
    return true
}

const validationProject = (project_id) => {
    if (project_id === undefined || project_id === null || project_id === '')
        return false
    project_id = isNaN(project_id) ? project_id : parseFloat(project_id)
    if (data?.projects?.[project_id] === undefined)
        data.projects[project_id] = { setup: [], matrix: [], component: [], notifications: [] }
    else
        data.projects[project_id] = {
            setup: data.projects[project_id].setup.filter(ws => (ws?.readyState ?? WebSocket.CLOSED) <= WebSocket.OPEN),
            matrix: data.projects[project_id].matrix.filter(ws => (ws?.readyState ?? WebSocket.CLOSED) <= WebSocket.OPEN),
            component: data.projects[project_id].component.filter(ws => (ws?.readyState ?? WebSocket.CLOSED) <= WebSocket.OPEN),
            notifications: data.projects[project_id].notifications.filter(ws => (ws?.readyState ?? WebSocket.CLOSED) <= WebSocket.OPEN),
        }
    return true
}

const addProjectWS = (ws, project_id, page) => {
    if (validationProject(project_id) !== true || ws === undefined || page === undefined || !(['setup', 'matrix', 'component', 'notifications']).includes(page))
        return false
    project_id = isNaN(project_id) ? project_id : parseFloat(project_id)
    ws.db_wss_id = `ws_project_${page}_${ws_id++}_${Math.round(9 * Math.random())}`
    data.projects[project_id][page].push(ws)
    console.log(new Date(), `add_project_${page}_dbwss`);
    console.log(`WS ${ws.db_wss_id} added`);
    console.log(`Total ${data.projects[project_id][page].length} on ${page} ${project_id}`);
    return true
}

const deleteProjectWS = (ws, project_id, page) => {
    if (validationProject(project_id) !== true || ws === undefined || ws?.db_wss_id === undefined || page === undefined || !(['setup', 'matrix', 'component', 'notifications']).includes(page))
        return false
    project_id = isNaN(project_id) ? project_id : parseFloat(project_id)
    data.projects[project_id][page] = data.projects[project_id][page].filter(w => w?.db_wss_id !== ws.db_wss_id)
    console.log(new Date(), `delete_project_${page}_dbwss`);
    console.log(`WS ${ws.db_wss_id} deleted`);
    console.log(`Left ${data.projects[project_id][page].length} on ${page} ${project_id}`);
    return
}
const getProjectWSS = (project_id, page) => {
    const wss = []
    if (validationProject(project_id) !== true)
        return wss
    if (page !== undefined || (['setup', 'matrix', 'component', 'notifications']).includes(page))
        wss.push(...data.projects[project_id][page])
    else
        wss.push(...data.projects[project_id].setup, ...data.projects[project_id].matrix, ...data.projects[project_id].component, ...data.projects[project_id].notifications)
    return wss
}

const onlineProjectIDs = () => Object.keys(data.projects).filter(
    pr_id => {
        validationProject(pr_id)
        return (data.projects?.[pr_id]?.setup ?? []).length > 0 ||
            (data.projects?.[pr_id]?.matrix ?? []).length > 0 ||
            (data.projects?.[pr_id]?.component ?? []).length > 0
    })

const addProjectSetupWS = (ws, project_id) => addProjectWS(ws, project_id, 'setup')
const deleteProjectSetupWS = (ws, project_id) => deleteProjectWS(ws, project_id, 'setup')
const getProjectSetupWSS = (project_id) => getProjectWSS(project_id, 'setup')

const addProjectComponentWS = (ws, project_id) => addProjectWS(ws, project_id, 'component')
const deleteProjectComponentWS = (ws, project_id) => deleteProjectWS(ws, project_id, 'component')
const getProjectComponentWSS = (project_id) => getProjectWSS(project_id, 'component')

const addProjectMatrixWS = (ws, project_id) => addProjectWS(ws, project_id, 'matrix')
const deleteProjectMatrixWS = (ws, project_id) => deleteProjectWS(ws, project_id, 'matrix')
const getProjectMatrixWSS = (project_id) => getProjectWSS(project_id, 'matrix')

const addProjectNotificationWS = (ws, project_id) => addProjectWS(ws, project_id, 'notifications')
const deleteProjectNotificationWS = (ws, project_id) => deleteProjectWS(ws, project_id, 'notifications')
const getProjectNotificationWSS = (project_id) => getProjectWSS(project_id, 'notifications')

const sendNotification = (project_id, message) => {
    if (!validationProject(project_id) || (typeof message != 'string' && typeof message != 'number')) return false
    const wss = getProjectNotificationWSS(project_id)
    console.log(new Date(), `send_notification_project`);
    console.log(`Send notification to ${wss.length} projects with project id ${project_id}`);
    for (const ws of wss)
        ws.send(JSON.stringify({ req: 'new_notification', message }))
    return true
}

module.exports = {
    getBlockWS, setBlockWS, deleteBlockWS,
    syncBlock, sendStepsBlock,
    onlineProjectIDs, getProjectWSS,
    addProjectSetupWS, deleteProjectSetupWS, getProjectSetupWSS,
    addProjectComponentWS, deleteProjectComponentWS, getProjectComponentWSS,
    addProjectMatrixWS, deleteProjectMatrixWS, getProjectMatrixWSS,
    addProjectNotificationWS, deleteProjectNotificationWS, getProjectNotificationWSS, sendNotification
}