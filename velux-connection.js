module.exports = function (RED) {
  'use strict'
  var klf = require('velux-klf200')
  var util = require('util')
  var debug = require('debug')('node-red-contrib-velux:veluxConnectionNode')

  function veluxConnectionNode(config) {
    RED.nodes.createNode(this, config)
    var node = this
    debug('config:',config)
    
    function restart() {
      debug('restart:')
      clearTimeout(node.restartTimer)
      node.restartTimer = setTimeout(()=>{
        connect()
      },5000)
    }
    
    function connected(v) {
      debug('connected:')
      node.velux = v
      node.velux.event.on('error',(err)=>{
        node.error(util.format('Velux %s', err))
      })
      node.velux.event.on('end',restart)
      node.velux.event.on('nodeUpdate',node.nodeUpdate)
      node.nodeUpdateAll()
    }
   
        
    /* connect to KLF200 */
    function connect() {
      debug('connect:')
      clearTimeout(node.restartTimer)
      klf.getVelux(config.host,config.password,{})
      .then(connected)
      .catch((err)=>{
        node.error(util.format('Velux %s', err))
        restart()
      })
    }
    
    /* node RIP */
    node.on('close', function (done) {
      debug('close:')
      clearTimeout(node.restartTimer)
      if (node.velux) {
        node.velux.end().catch((err)=>{
          node.error(util.format('Velux %s', err))
          done()
        }).then(()=>{
          clearTimeout(node.restartTimer)
          done()
        })
      }
    })

    RED.httpAdmin.get('/velux/nodes', function (req, res, next) {
      debug('/velux/nodes:')
      var nodes = []
      if (node.velux) {
        node.velux.nodes.getIDs().map((id)=>{
          var n = node.velux.nodes.node[id]
          nodes.push({id:n.nodeID, name:n.nodeName, order:n.order})
        })
      }
      nodes.sort(function(a, b){return b.order-a.order});
      var json = JSON.stringify(nodes)
      debug('/velux/nodes:',json)
      res.end(json)
    })
    
    var nodeNodes = []
    node.subscribeNodes = function (n) {
      var index = nodeNodes.push(n)
      debug('subscribeNodes:',index)
    }

    node.unsubscribeNodes = function (n) {
      var index = nodeNodes.indexOf(n)
      debug('unsubscribeNodes:',index)
      nodeNodes.splice(index,1)
    }

    node.nodeUpdate = function (id) {
      debug('nodeUpdate:',id)
      nodeNodes.map((n)=>{
        if (n.getID() == -1 || n.getID() == id) {
          node.nodePublish (n,id)
        }
      })
    }

    node.nodePublish = function (n,id, update) {
      debug('nodePublish:',id, update)
      if (node.velux) {
        if (update) {
          node.velux.nodes.getNodeInformation(id)
          .then(()=>{n.publish(node.velux.nodes.getNode(id))})
          .catch((err)=>{node.error(util.format('Velux %s', err))})
        } else {
          n.publish(node.velux.nodes.getNode(id))
        }
      }
    }

    node.nodeUpdateAll = function () {
      debug('nodeUpdateAll:')
      if (node.velux) {
        node.velux.nodes.getIDs().map((id)=>{node.nodeUpdate(id)})
      }
    }

    node.nodePublishAll = function (n,update) {
      debug('nodeUpdateAll:')
      if (node.velux) {
        function call(n) {
          node.velux.nodes.getIDs().map((id)=>{node.nodePublish(n,id,false)})
        }
        
        if (update) {
          node.velux.nodes.getAllNodesInformation()
          .then(()=>{call(n)})
          .catch((err)=>{node.error(util.format('Velux %s', err))})
        } else {
          call(n)
        }
      }
    }
    
    node.nodeGetName = function (id) {
      debug('nodeGetName:')
      if (node.velux) {
        return node.velux.nodes.getNodeName(id)
      }
    }

    node.getIdByName = function (name) {
      debug('getIdByName:')
      if (node.velux) {
        return node.velux.nodes.getIdByName(name)
      }
    }
    
    node.nodeUpdateName = function (n,name,update) {
      debug('nodeUpdateName:')
      if (node.velux) {
        node.nodePublish(n,node.velux.nodes.getIdByName(name),update)
      }
    }
    
    node.nodeSendValue = function (id,value) {
      debug('nodeSendValue: id:',id,'value:',value)
      if (node.velux) {
        node.velux.nodes.sendValue(id,value)
      }
    }
    
    connect()
  }
  RED.nodes.registerType('velux-connection', veluxConnectionNode)

}
