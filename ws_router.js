const express = require('express')
const router = express.Router()

const block = require('./ws_controller/block')
const setup = require('./ws_controller/project/setup')
const component = require('./ws_controller/project/component')
const matrix = require('./ws_controller/project/matrix')
const notification = require('./ws_controller/project/notification')

router.ws('/block/:block_id', block.ws_handler)
router.ws('/project/:project_id/setup', setup.ws_handler)
router.ws('/project/:project_id/component', component.ws_handler)
router.ws('/project/:project_id/matrix', matrix.ws_handler)
router.ws('/project/:project_id/notification', notification.ws_handler)

module.exports = router