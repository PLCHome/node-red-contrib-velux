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
      node.velux.event.on('nodeStatus',node.nodeStatus)
      node.velux.event.on('NTF',node.apiNTF)
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

    /* velux api */
    RED.httpAdmin.get('/velux/req', function (req, res, next) {
      debug('/velux/req:')
      var api = []
      if (node.velux) {
        Object.keys(klf.API).map((name)=>{
          if (name.endsWith('_REQ')) {
            api.push({id:klf.API[name], name:name})
          }
        })
      }
      var json = JSON.stringify(api)
      debug('/velux/req:',json)
      res.end(json)
    })
    
    RED.httpAdmin.get('/velux/ntf', function (req, res, next) {
      debug('/velux/ntf:')
      var api = []
      if (node.velux) {
        Object.keys(klf.API).map((name)=>{
          if (name.endsWith('_NTF')) {
            api.push({id:klf.API[name], name:name})
          }
        })
      }
      var json = JSON.stringify(api)
      debug('/velux/ntf:',json)
      res.end(json)
    })
    
    node.callAPI = function (api) {
      return new Promise((resolve, reject)=>{
        if (node.velux) {
          node.velux.callAPI(api)
          .then((data)=>{resolve(data)})
          .catch((err)=>{reject(err)})
        } else {
          var error = new Error('klf-200 not connected')
          reject(error)
        }
      })
    }
    
    node.apiNTF = function (data) {
      debug('apiNTF:',data)
      nodeApi.map((n)=>{
        n.onNTF(data)
      })
    }
    
    var nodeApi = []
    node.subscribeApi = function (n) {
      var index = nodeApi.push(n)
      debug('subscribeNodes:',index)
    }

    node.unsubscribeApi = function (n) {
      var index = nodeApi.indexOf(n)
      debug('unsubscribeNodes:',index)
      nodeApi.splice(index,1)
    }
    /* velux api */
    
    /* velux nodes */
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
          node.nodePublish (n,id,false)
        }
      })
    }

    node.nodeStatus = function (data) {
      debug('nodeStatus:',data)
      var fillSystem = "grey"
      nodeNodes.map((n)=>{
        if (n.getID() == data.index) {
          switch(data.statusReplyTyp) {
            case 'UNKNOWN_STATUS_REPLY':
            case 'NO_CONTACT':
            case 'MANUALLY_OPERATED':
            case 'BLOCKED':
            case 'WRONG_SYSTEMKEY':
            case 'PRIORITY_LEVEL_LOCKED':
            case 'REACHED_WRONG_POSITION':
            case 'ERROR_DURING_EXECUTION':
            case 'NO_EXECUTION':
            case 'CALIBRATING':
            case 'POWER_CONSUMPTION_TOO_HIGH':
            case 'POWER_CONSUMPTION_TOO_LOW':
            case 'LOCK_POSITION_OPEN':
            case 'MOTION_TIME_TOO_LONG__COMMUNICATION_ENDED':
            case 'THERMAL_PROTECTION':
            case 'PRODUCT_NOT_OPERATIONAL':
            case 'FILTER_MAINTENANCE_NEEDED':
            case 'BATTERY_LEVEL':
            case 'TARGET_MODIFIED':
            case 'MODE_NOT_IMPLEMENTED':
            case 'COMMAND_INCOMPATIBLE_TO_MOVEMENT':
            case 'USER_ACTION':
            case 'DEAD_BOLT_ERROR':
            case 'AUTOMATIC_CYCLE_ENGAGED':
            case 'WRONG_LOAD_CONNECTED':
            case 'COLOUR_NOT_REACHABLE':
            case 'TARGET_NOT_REACHABLE':
            case 'BAD_INDEX_RECEIVED':
            case 'COMMAND_OVERRULED':
            case 'INFORMATION_CODE':
            case 'PARAMETER_LIMITED':
            case 'LIMITATION_BY_LOCAL_USER':
            case 'LIMITATION_BY_USER':
            case 'LIMITATION_BY_RAIN':
            case 'LIMITATION_BY_TIMER':
            case 'LIMITATION_BY_UPS':
            case 'LIMITATION_BY_UNKNOWN_DEVICE':
            case 'LIMITATION_BY_SAAC':
            case 'LIMITATION_BY_WIND':
            case 'LIMITATION_BY_MYSELF':
            case 'LIMITATION_BY_AUTOMATIC_CYCLE':
            case 'LIMITATION_BY_EMERGENCY':
              fillSystem = "red"
              break
            case 'NODE_WAITING_FOR_POWER':
              fillSystem = "yellow"
              break
            case 'COMMAND_COMPLETED_OK':
              fillSystem = "green"
              break
          }
          n.status({fill:fillSystem,shape:"dot",text:data.statusReplyText})
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
    /* velux nodes */
    
    connect()
  }
  RED.nodes.registerType('velux-connection', veluxConnectionNode)

}
