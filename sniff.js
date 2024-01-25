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

var Cap = require('cap').Cap;
const EventEmitter = require('events')
var packetEmitter = new EventEmitter()

var decoders = require('cap').decoders;
var PROTOCOL = decoders.PROTOCOL;

var c = new Cap();
var device = Cap.findDevice('192.12.3.221');
var filter = 'tcp';
var bufSize = 10 * 1024 * 1024;
var buffer = Buffer.alloc(65535);

var linkType = c.open(device, filter, bufSize, buffer);

c.setMinBytes && c.setMinBytes(0);

c.on('packet', function(nbytes, trunc) {
  var time = Date.now()
  // console.log('packet: length ' + nbytes + ' bytes, truncated? '
  //             + (trunc ? 'yes' : 'no'));

  // raw packet data === buffer.slice(0, nbytes)

  if (linkType === 'ETHERNET') {
    var ret = decoders.Ethernet(buffer);

    if (ret.info.type === PROTOCOL.ETHERNET.IPV4) {
      // console.log('Decoding IPv4 ...');

      ret = decoders.IPV4(buffer, ret.offset);
      if (ret.info.srcaddr === '192.12.3.148') {
        // console.log('from: ' + ret.info.srcaddr + ' to ' + ret.info.dstaddr);

        if (ret.info.protocol === PROTOCOL.IP.TCP) {
          var datalen = ret.info.totallen - ret.hdrlen;

          // console.log('Decoding TCP ...');

          ret = decoders.TCP(buffer, ret.offset);
          // console.log(' from port: ' + ret.info.srcport + ' to port: ' + ret.info.dstport);
          // console.log(ret.info)
          datalen -= ret.hdrlen;
          // console.log(buffer.toString('hex', ret.offset, ret.offset + datalen));
          packetEmitter.emit('packet', buffer.slice(ret.offset, ret.offset + datalen), time)
        } else if (ret.info.protocol === PROTOCOL.IP.UDP) {
          console.log('Decoding UDP ...');

          ret = decoders.UDP(buffer, ret.offset);
          console.log(' from port: ' + ret.info.srcport + ' to port: ' + ret.info.dstport);
          console.log(buffer.toString('hex', ret.offset, ret.offset + ret.info.length));
        } else
          console.log('Unsupported IPv4 protocol: ' + PROTOCOL.IP[ret.info.protocol]);
      }

    } else
      console.log('Unsupported Ethertype: ' + PROTOCOL.ETHERNET[ret.info.type]);
  }
});

module.exports = {
  packetEmitter: packetEmitter
}
