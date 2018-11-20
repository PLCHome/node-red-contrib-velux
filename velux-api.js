module.exports = function (RED) {
  'use strict'
  var util = require('util')
  var debug = require('debug')('node-red-contrib-velux:velux-api')

  function veluxApi(config) {
    RED.nodes.createNode(this, config)
    var node = this

    node.veluxDatasource = RED.nodes.getNode(config.datasource)
    if (node.veluxDatasource) {
      node.hasTopic = (config.topic||'').length > 0
      debug('config:',config)
      node.veluxDatasource.subscribeApi(node)


      node.on("input", function(msg) {
        debug('input:','msg',msg)
        if (!node.hasTopic || !msg.topic || config.topic == msg.topic) {
          var api = Object.assign({},msg.payload)
          if (!api.api && !api.apiText) {
            api.api = config.api
          }
          node.veluxDatasource.callAPI(api)
          .then((data)=>{
            var outmsg = {payload : data}
            if (node.hasTopic) {
              outmsg.topic = config.topic
            }
            node.send(outmsg)
          })
          .catch((err)=>{
            node.error(util.format('Velux API %s', err))
          })
        }
      })
      
      node.onNTF = function(data) {
        debug('apiNTF:',config.ntf.indexOf(data.api),data)
        config.ntf.map((ntf)=>{
          if (ntf == data.api) {
            var outmsg = {payload : data}
            if (node.hasTopic) {
              outmsg.topic = config.topic
            }
            node.send(outmsg)
          }
        })
      }
      
      node.on('close', function (done) {
        debug('close:')
        node.veluxDatasource.unsubscribeApi(node)
        done()
      })
    }
  }
  RED.nodes.registerType('Velux Api', veluxApi)
}
