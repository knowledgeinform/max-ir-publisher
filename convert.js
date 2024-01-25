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

// const sniff = require('./test.js')
const sniff = require('./sniff.js')

const EventEmitter = require('events')
var completePacketEmitter = new EventEmitter()

var bufMatch = Buffer.from('aa55807fb0', 'hex')
var sizeCheck = Buffer.from('100a', 'hex')
var data_len_offset = 5
var packet_type_offset = 7
var parseOffset = 17
var packetList = [Buffer.from('01', 'hex'), Buffer.from('02', 'hex'),Buffer.from('03', 'hex')]

var bufMetaMatch = Buffer.from('aa55807fb1', 'hex')
var offsetMap = {
  'Laser Frequency': {offset: 401, value: NaN},
  'Pressure': {offset: 441, value: NaN}
}

var partialPacket = Buffer.from('')
var lastPartialPacket = Buffer.from('')
var packet = []
var completePacket = []
var time = Date.now()
var currentIndex = 0
var concatingIGRAM = false
var concatingMeta = false
var partialPacketIndex = 0
var numIGRAMPackets = 16
var publishFlag = false

function publish() {
  console.log(publishFlag)
  console.log(partialPacketIndex)
  if (publishFlag) {
    console.log('publishing')
    publishFlag = false
    console.log('packet, time:', time)
    // console.log(packet)
    // console.log('offsetMap')
    // console.log(offsetMap)
    completePacketEmitter.emit('complete', {
      packet: packet,
      time: time,
      metaData: {
        pressure: offsetMap.Pressure.value,
        'Laser Frequency': offsetMap['Laser Frequency'].value,
      }
    })
  }
  packet = []
  concatingIGRAM = false
  partialPacketIndex = 0
}

function convert(fullBytePacket) {
  // console.log('converting')
  var num_buf = fullBytePacket.subarray(parseOffset)
  var data_len = fullBytePacket.subarray(data_len_offset, data_len_offset + 2)
  if (data_len.compare(sizeCheck) !== 0) {
    console.log('DATA LENGTH MISMATCH!!')
    console.log(data_len.compare(sizeCheck))
    console.log('data_len', data_len)
    console.log('sizeCheck', sizeCheck)
  }
  var packetType = fullBytePacket.subarray(packet_type_offset, packet_type_offset + 1)
  // console.log('packetType', packetType)
  if (packetType.compare(packetList[2]) === 0) publishFlag = true
  // console.log(num_buf)

  var type_size = 4 // bytes

  for (var i = 0; (i <= num_buf.length - type_size) && ((i / type_size) < 1024); i += type_size) {
    packet.push(num_buf.readFloatLE(i))
    // console.log(num_buf.readDoubleLE(i))
  }
  partialPacketIndex++
}

function convertMeta(fullBytePacket) {
  // console.log('converting meta')
  Object.entries(offsetMap).forEach(([key, value], i2) => {
    offsetMap[key].value = fullBytePacket.readFloatLE(value.offset)
  })
  console.log(offsetMap['Pressure'].value)
  publish()
  concatingMeta = false
}

function concatIGRAMPacket(bufMatchIndex, metaMatchIndex, newPacketBuffer) {
  // console.log('Building IGRAM')
  if (bufMatchIndex == 0 && !concatingIGRAM) {
    if (concatingMeta) {
      if (partialPacket.length > 770) {
        concatingMeta = false
        lastPartialPacket = Buffer.from(partialPacket)
        convertMeta(lastPartialPacket)
      }
    }
    concatingIGRAM = true
    partialPacket = Buffer.from(newPacketBuffer)
  } else if (bufMatchIndex < 0 && concatingIGRAM && metaMatchIndex < 0) {
    // console.log('concating IGRAM')
    partialPacket = Buffer.concat([partialPacket, Buffer.from(newPacketBuffer)])
  } else if (bufMatchIndex < 0 && concatingIGRAM && metaMatchIndex >= 0) {
    // handle the metadata
    concatingIGRAM = false

    partialPacket = Buffer.concat([partialPacket, Buffer.from(newPacketBuffer.subarray(0, metaMatchIndex))])
    lastPartialPacket = Buffer.from(partialPacket)
    // console.log('meta buf match')
    // console.log(lastPartialPacket.length)
    // console.log(lastPartialPacket.toString('hex'))
    convert(lastPartialPacket)

    partialPacket = Buffer.from(newPacketBuffer.subarray(metaMatchIndex))
    concatingMeta = true
  } else if (bufMatchIndex >= 0 && concatingIGRAM) {
    partialPacket = Buffer.concat([partialPacket, Buffer.from(newPacketBuffer.subarray(0, bufMatchIndex))])
    lastPartialPacket = Buffer.from(partialPacket)
    // console.log('IGRAM buf match')
    // console.log(lastPartialPacket.length)
    // console.log(lastPartialPacket.toString('hex'))
    convert(lastPartialPacket)
    partialPacket = Buffer.from(newPacketBuffer.subarray(bufMatchIndex))
  } else {
    console.log('IGRAM UNKNOWN Condition')
    console.log('bufMatchIndex', bufMatchIndex)
    console.log('metaMatchIndex', metaMatchIndex)
    console.log(newPacketBuffer.toString('hex'))
  }
}

function concatMetaPacket(metaMatchIndex, bufMatchIndex, newPacketBuffer) {
  // console.log('Building meta')
  if (metaMatchIndex == 0 && !concatingMeta) {
    // console.log('init meta')
    concatingMeta = true
    concatingIGRAM = false
    partialPacket = Buffer.from(newPacketBuffer)
  } else if (metaMatchIndex > 0 && !concatingMeta) {
    console.log('SHOULD NEVER BE HERE due to logic elsewhere')
  } else if (metaMatchIndex < 0 && concatingMeta) {
    partialPacket = Buffer.concat([partialPacket, Buffer.from(newPacketBuffer)])
    // console.log(partialPacket.length)
    // console.log(partialPacket.toString('hex'))
    if (partialPacket.length > 770) {
      lastPartialPacket = Buffer.from(partialPacket)
      convertMeta(lastPartialPacket)
    }
  } else {
    console.log('META UNKNOWN Condition')
    console.log('bufMatchIndex', bufMatchIndex)
    console.log('metaMatchIndex', metaMatchIndex)
    console.log(newPacketBuffer.toString('hex'))
  }
}

function handle(newPacketBuffer, t) {
  // console.log('handling')
  if (partialPacketIndex == 0) time = t // only setting the time for the first partial packet
  var bufMatchIndex = newPacketBuffer.indexOf(bufMatch)
  var metaMatchIndex = newPacketBuffer.indexOf(bufMetaMatch)
  // console.log('bufMatchIndex', bufMatchIndex, 'metaMatchIndex', metaMatchIndex)
  if (bufMatchIndex >= 0 || concatingIGRAM) {
    concatIGRAMPacket(bufMatchIndex, metaMatchIndex, newPacketBuffer)
  } else if (metaMatchIndex >= 0 || concatingMeta) {
    concatMetaPacket(metaMatchIndex, bufMatchIndex, newPacketBuffer)
  } else {
    // console.log('UNKNOWN CONDITION')
    // console.log('bufMatchIndex', bufMatchIndex)
    // console.log('metaMatchIndex', metaMatchIndex)
    // console.log(newPacketBuffer.toString('hex'))
  }
}

sniff.packetEmitter.on('packet', handle)

module.exports = {
  pktEmitter: completePacketEmitter,
  packet: {value: packet, time: time},
  handle: handle
}
