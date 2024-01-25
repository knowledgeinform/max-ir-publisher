/// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2019 The Johns Hopkins University Applied Physics Laboratory LLC (JHU/APL).  All Rights Reserved.
//
// This material may be only be used, modified, or reproduced by or for the U.S. Government pursuant to the license
// rights granted under the clauses at DFARS 252.227-7013/7014 or FAR 52.227-14. For any other permission, please
// contact the Office of Technology Transfer at JHU/APL: Telephone: 443-778-2792, Internet: www.jhuapl.edu/ott
//
// NO WARRANTY, NO LIABILITY. THIS MATERIAL IS PROVIDED 'AS IS.' JHU/APL MAKES NO REPRESENTATION OR WARRANTY WITH
// RESPECT TO THE PERFORMANCE OF THE MATERIALS, INCLUDING THEIR SAFETY, EFFECTIVENESS, OR COMMERCIAL VIABILITY, AND
// DISCLAIMS ALL WARRANTIES IN THE MATERIAL, WHETHER EXPRESS OR IMPLIED, INCLUDING (BUT NOT LIMITED TO) ANY AND ALL
// IMPLIED WARRANTIES OF PERFORMANCE, MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT OF
// INTELLECTUAL PROPERTY OR OTHER THIRD PARTY RIGHTS. ANY USER OF THE MATERIAL ASSUMES THE ENTIRE RISK AND LIABILITY
// FOR USING THE MATERIAL. IN NO EVENT SHALL JHU/APL BE LIABLE TO ANY USER OF THE MATERIAL FOR ANY ACTUAL, INDIRECT,
// CONSEQUENTIAL, SPECIAL OR OTHER DAMAGES ARISING FROM THE USE OF, OR INABILITY TO USE, THE MATERIAL, INCLUDING,
// BUT NOT LIMITED TO, ANY DAMAGES FOR LOST PROFITS.
/// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const express = require('express')
const cors = require('cors')
const maxAdapter = require('./convert.js')

var completePacket = {
    packet: [],
    time: Date.now(),
    metaData: {
      pressure: -1,
      'Laser Frequency': -1,
  }
}

var completeMeta = {
    packet: [],
    time: Date.now(),
    metaData: {
      pressure: -1,
      'Laser Frequency': -1,
  }
}

var packetPointer = {}
packetPointer['a'] = completePacket

maxAdapter.pktEmitter.on('complete', (p) => {
  console.log('received')
  completePacket = p
})
maxAdapter.pktEmitter.on('completeMeta', (p) => {
  console.log('received2')
  completeMeta = p
})

const addr = 'localhost'
const port = '3004'

var baseAPIPath = '/api/'

const app = express()

var whitelist = ['http://localhost:3004']

app.use(cors({
  origin: function (origin, callback) {
    // console.log('origin')
    // console.log(origin)
    // allow requests with no origin
    if (!origin) return callback(null, true)
    if (whitelist.indexOf(origin) === -1) {
      var message = 'The CORS policy for this origin doesn\'t ' +
                'allow access from the particular origin.'
      return callback(new Error(message), false)
    }
    return callback(null, true)
  },
}))

app.get(baseAPIPath + 'meta', (req, res) => {
  res.json(completeMeta)
})

app.get(baseAPIPath + 'igram', (req, res) => {
  res.json(completePacket)
})

app.listen(port, addr, error => {
  if (error) {
    return console.log('something bad happened', error)
  }

  console.log(`Server running at http://${addr}:${port}`)
})
