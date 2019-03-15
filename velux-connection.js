module.exports = function (RED) {
  'use strict'
  var klf = require('velux-klf200')
  var util = require('util')
  var debug = require('debug')('node-red-contrib-velux:veluxConnectionNode')

  function veluxConnectionNode(config) {
    RED.nodes.createNode(this, config)
    var node = this
    node.houseStatusMonitorEnable = false
    config.monitor = config.monitor||''
    if (config.monitor == "POLL10000") {node.houseStatusAlternative = 10000}
    else if (config.monitor == "POLL30000") {node.houseStatusAlternative = 30000}
    else if (config.monitor == "POLL60000") {node.houseStatusAlternative = 60000}
    else if (config.monitor == "POLL300000") {node.houseStatusAlternative = 300000}
    else if (config.monitor == "POLL600000") {node.houseStatusAlternative = 600000}
    else node.houseStatusMonitorEnable = true
    debug('config:',config)
    
    function restart() {
      debug('restart:')
      clearTimeout(node.restartTimer)
      node.restartTimer = setTimeout(()=>{
        connect()
      },5000)
    }
    
    function cleanup() {
      debug('cleanup:',(typeof node.velux !== "undefined"))
      if (typeof node.velux !== "undefined") {
        node.velux.event.removeListener('end',restart)
        node.velux.event.removeListener('nodeUpdate',node.nodeUpdate)
        node.velux.event.removeListener('nodeStatus',node.nodeStatus)
        node.velux.event.removeListener('NTF',node.apiNTF)
        node.velux.event.removeListener('GW_COMMAND_REMAINING_TIME_NTF',node.sceneRemainingTime)
        node.velux.event.removeListener('GW_COMMAND_RUN_STATUS_NTF',node.sceneRunStatus)
        node.velux.event.removeListener('GW_SESSION_FINISHED_NTF',node.sceneSessionFinished)
        delete (node.velux)
      }
    }
    
    function connected(v) {
      debug('connected:')
      cleanup()
      node.velux = v
      node.velux.event.on('error',(err)=>{
        node.error(util.format('Velux %s', err))
      })
      node.velux.event.on('end',restart)
      node.velux.event.on('nodeUpdate',node.nodeUpdate)
      node.velux.event.on('nodeStatus',node.nodeStatus)
      node.velux.event.on('NTF',node.apiNTF)
      node.velux.event.on('GW_COMMAND_REMAINING_TIME_NTF',node.sceneRemainingTime)
      node.velux.event.on('GW_COMMAND_RUN_STATUS_NTF',node.sceneRunStatus)
      node.velux.event.on('GW_SESSION_FINISHED_NTF',node.sceneSessionFinished)
      node.nodeUpdateAll()
    }
        
    /* connect to KLF200 */
    function connect() {
      debug('connect:')
      clearTimeout(node.restartTimer)
      klf.getVelux(config.host,config.password,{
        "houseStatusAlternative" : node.houseStatusAlternative,
        "houseStatusMonitorEnable" : node.houseStatusMonitorEnable
      })
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
          cleanup()
          done()
        }).then(()=>{
          clearTimeout(node.restartTimer)
          cleanup()
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
    
    /* velux scenes */
    RED.httpAdmin.get('/velux/scenes', function (req, res, next) {
      debug('/velux/scenes:')
      var scenes = []
      if (node.velux) {
        node.velux.scenes.getIDs().map((id)=>{
          var s = node.velux.scenes.scene[id]
          scenes.push({id:s.sceneID, name:s.sceneName})
        })
      }
      //scenes.sort(function(a, b){return b.order-a.order});
      var json = JSON.stringify(scenes)
      debug('/velux/scenes:',json)
      res.end(json)
    })    
    
    var sessionIDs = {}
    
    node.addSessionID = function (id,n) {
      debug('addSessionID:',id,(!(!n)))
      sessionIDs[id] = n
    }

    node.getNodeBySessionID = function (id) {
      debug('getNodeBySessionID:',id,(!(!sessionIDs[id])))
      return sessionIDs[id]
    }

    node.delSessionID = function (id) {
      debug('delSessionID:',id,(!(!sessionIDs[id])))
      delete sessionIDs[id]
    }

    node.getSceneByName = function (name) {
      debug('getSceneByName:')
      if (node.velux) {
        return node.velux.scenes.getIdByName(name)
      }
    }
    
    node.runScene = function (n,id,velocity){
      debug('runScene:')
      if (node.velux) {
        return new Promise((resolve, reject)=>{
          node.velux.scenes.runScene(id,velocity)
          .then((data)=>{
            node.addSessionID(data.sessionID,n)
            resolve(data)
           })
          .catch((err)=>{reject(err)})
        })
      }
    }

    node.sceneRemainingTime = function (data) {
      debug('sceneRemainingTime:',data)
      var n = node.getNodeBySessionID(data.sessionID)
      if (n) {
        n.publish(data)
      }
    }
    
    node.sceneRunStatus = function (data) {
      debug('sceneRunStatus:',data)
      var n = node.getNodeBySessionID(data.sessionID)
      if (n) {
        n.publish(data)
      }
    }
    
    node.sceneSessionFinished = function (data) {
      debug('sceneSessionFinished:',data)
      if (node.getNodeBySessionID(data.sessionID)) {
        var n = node.getNodeBySessionID(data.sessionID)
        node.delSessionID(data.sessionID)
        n.publish(data)
      }
    }
    
    node.getVelocityTagByName = function (name) {
      debug('getVelocityTagByName:',name)
      if (node.velux) {
        return node.velux.scenes.getVelocityTagByName(name)
      }
    }
    
    /* velux scenes */
    
    connect()
  }
  RED.nodes.registerType('velux-connection', veluxConnectionNode)

}
