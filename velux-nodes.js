module.exports = function (RED) {
  'use strict'
  //var util = require('util')
  var debug = require('debug')('node-red-contrib-velux:velux-nodes')

  function veluxNodes(config) {
    RED.nodes.createNode(this, config)
    var node = this

    node.veluxDatasource = RED.nodes.getNode(config.datasource)
    if (node.veluxDatasource) {
      node.hasTopic = (config.topic||'').length > 0
      debug('config:',config)
      node.veluxDatasource.subscribeNodes(node)
      
      node.getID = function(){
        return config.index
      }

      node.getName = function(){
        return node.veluxDatasource.nodeGetName(node.getID)
      }

      node.publish = function(data){
        debug('node.send:',(!(!data)))
        if (data) {
          var msg={}
          if (node.hasTopic) {
            msg.topic = config.topic
          } else {
            msg.topic = node.name
          }

          if (config.nodevalue == 'CURRENTPOSITION') {
            msg.payload = data.currentPosition.value
            msg.valueType = data.currentPosition.valueType
          } else if (config.nodevalue == 'TARGET') {
            msg.payload = data.target.value
            msg.valueType = data.target.valueType
          } else if (config.nodevalue == 'FP1') {
            msg.payload = data.fp1CurrentPosition.value
            msg.valueType = data.fp1CurrentPosition.valueType
          } else if (config.nodevalue == 'FP2') {
            msg.payload = data.fp2CurrentPosition.value
            msg.valueType = data.fp2CurrentPosition.valueType
          } else if (config.nodevalue == 'FP3') {
            msg.payload = data.fp3CurrentPosition.value
            msg.valueType = data.fp3CurrentPosition.valueType
          } else if (config.nodevalue == 'FP4') {
            msg.payload = data.fp4CurrentPosition.value
            msg.valueType = data.fp4CurrentPosition.valueType
          } else if (config.nodevalue == 'REMAININGTIME') {
            msg.payload = data.remainingTime
          } else {
            msg.payload = data
          } 

          node.send(msg)
        }
      }

      node.on("input", function(msg) {
        debug('input:','msg',msg)
        
        if (typeof msg.topic === 'string' && msg.topic !== '') {
          if (node.hasTopic && msg.topic == (config.topic||'')){
            node.veluxDatasource.nodeSendValue(node.getID(),msg.payload)
            return
          }
          var topicvals = msg.topic.split(":")
          if ((topicvals[0]||'').trim()== 'velux') {
            if (((topicvals[1]||'').trim()=='read')||((topicvals[1]||'').trim()=='load')) {
              var load = (topicvals[1].trim()=='load')
              if ((topicvals[2]||'').trim()=='id') {
                var id = parseInt(topicvals[3]||'')
                debug ('input:',id)
                if (id==-1) {
                  node.veluxDatasource.nodePublishAll(node, load)
                } else {
                  node.veluxDatasource.nodePublish(node, id, load)
                }
              } else if ((topicvals[2]||'').trim()=='name') {
                var len = topicvals[0].length + topicvals[1].length + topicvals[2].length + 3
                var name = msg.topic.substring(len).trim()
                var id = node.veluxDatasource.getIdByName(name)
                debug ('input:',name,id)
                if (id === null) return
                node.veluxDatasource.nodePublish(node, id,  load)
              } else {
                if (node.getID()==-1) {
                  node.veluxDatasource.nodePublishAll(node, load)
                } else {
                  node.veluxDatasource.nodePublish(node, node.getID(), load)
                }
              }
            } else if ((topicvals[1]||'').trim()=='write') {
              var val = {value: parseFloat(msg.payload), valueType: 'RELATIVE'}
              var id = node.getID()
              var name
              for (var i=2;i<topicvals.length;i++) {
                if ((topicvals[i]||'').trim()=='valuetype') {
                  i++
                  val.valueType = (topicvals[i]||'').trim()
                } else if ((topicvals[i]||'').trim()=='rawvalue') {
                  val = {rawValue: parseFloat(msg.payload)}
                } else if ((topicvals[i]||'').trim()=='id') {
                  i++
                  id = parseInt(topicvals[i]||'')
                } else if ((topicvals[i]||'').trim()=='name') {
                  i++
                  name = (topicvals[i]||'')
                } 
              }
              debug('input:','name',name)
              if (name) {
                id = node.veluxDatasource.getIdByName(name)
                if (id === null) return
              }
              debug('input:','name',name)
              node.veluxDatasource.nodeSendValue(id,val)
            }
            return
          }
          if (msg.topic) return
        } 
        if (!isNaN(parseFloat(msg.payload))) {
          node.veluxDatasource.nodeSendValue(node.getID(),parseFloat(msg.payload))
          return
        }
      })
      
      node.on('close', function (done) {
        debug('close:')
        node.veluxDatasource.unsubscribeNodes(node)
        done()
      })
    }
  }
  RED.nodes.registerType('Velux Nodes', veluxNodes)
}
