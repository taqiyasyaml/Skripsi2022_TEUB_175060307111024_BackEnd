const ngrok_enable = false
const ngrok_authtoken = ''
//United State (us), Europe (eu), Australia (au), Asia Pacific (ap), South Afrca (sa), Japan (jp), India (in)
const ngrok_region = 'ap'
const port = 3001

const ngrok = require('ngrok')
const express = require('express')
const app = express()
const expressWs = require('express-ws')
expressWs(app)

const ws_router = require('./ws_router')

app.use(ws_router)
app.use(express.static(__dirname + '/public'))
app.get("*", (req, res) => res.sendFile(__dirname + '/public/index.html'))
const srv = app.listen(port, () => {
    console.log('Sudah Berjalan pada port ' + srv.address().port)
    if (ngrok_enable === true && typeof ngrok_authtoken == 'string' && ngrok_authtoken.length > 0) {
        console.log('Mengaktifkan ngrok')
        ngrok.connect({
            addr: srv.address().port,
            region: typeof ngrok_region == 'string' && (['us', 'eu', 'au', 'ap', 'sa', 'jp', 'in']).includes(ngrok_region) ? ngrok_region : 'ap',
            authtoken: ngrok_authtoken
        }).then(ngrok_url => console.log(`ngrok Aktif ${ngrok_url}`))
    } else
        console.log('ngrok Tidak Aktif')
})