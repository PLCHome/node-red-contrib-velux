module.exports = function (RED) {
  'use strict'
  var util = require('util')
  var debug = require('debug')('node-red-contrib-velux:velux-scenes')

  function veluxScenes(config) {
    RED.nodes.createNode(this, config)
    var node = this

    node.veluxDatasource = RED.nodes.getNode(config.datasource)
    if (node.veluxDatasource) {
      node.hasTopic = (config.topic||'').length > 0
      debug('config:',config)
      //node.veluxDatasource.subscribeScenes(node)
      
      node.getID = function(){
        return config.index
      }

      node.getName = function(){
        return node.veluxDatasource.nodeGetName(node.getID)
      }

      node.getVelocity = function(){
        return node.veluxDatasource.getVelocityTagByName(config.velocity)
      }
      
      var timer = null
      node.runTimer = function(seconds){
        clearTimeout(timer)
        var s = seconds
        timer = setInterval(()=>{
          //n.status({fill:fillSystem,shape:shapeSystem,text:textSystem})
          node.status({text:""+--seconds+"sec"})
          if (seconds<1) {
            clearTimeout(timer)
          }
        },1000)
      }
      
      node.publish = function(data){
        debug('node.send:',(!(!data)))
        if (data) {
          if (data.apiText === "GW_COMMAND_REMAINING_TIME_NTF") {
            node.runTimer(data.seconds)
          }
          if (data.apiText === "GW_COMMAND_RUN_STATUS_NTF") {
            clearTimeout(timer)
            node.status({text:data.runStatusText})
          }
          var msg={}
          if (node.hasTopic) {
            msg.topic = config.topic
          } else {
            msg.topic = node.name
          }

          msg.payload = data

          node.send(msg)
        }
      }

      node.on("input", function(msg) {
        debug('input:','msg',msg)
        
        if (typeof msg.topic === 'string' && msg.topic !== '') {
          debug('input:','msg.topic === string')
          if (node.hasTopic && msg.topic == (config.topic||'')){
            node.veluxDatasource.runScene(node,node.getID(),node.getVelocity())
            .then((data)=>{node.publish(data)})
            .catch((err)=>{node.error(util.format('Velux %s', err))})
            return
          }
          var topicvals = msg.topic.split(":")
          if ((topicvals[0]||'').trim()== 'velux') {
            if ((topicvals[1]||'').trim()=='execute') {
              var id = node.getID()
              var velocity = node.getVelocity()
              for (var i=1;i<topicvals.length;i++) {
                if ((topicvals[i]||'').trim()=='id') {
                  i++
                  var text = (topicvals[i]||'')
                  debug('input:','id',text)
                  id = parseInt(text)
                } else if ((topicvals[i]||'').trim()=='name') {
                  i++
                  var text = (topicvals[i]||'')
                  debug('input:','name',text)
                  id = node.veluxDatasource.getSceneByName(text)
                } else if ((topicvals[i]||'').trim()=='velocityid') {
                  i++
                  var text = (topicvals[i]||'')
                  debug('input:','velocityid',text)
                  velocity = parseInt(text)
                } else if ((topicvals[i]||'').trim()=='velocity') {
                  i++
                  var text = (topicvals[i]||'')
                  debug('input:','velocity',text)
                  velocity = node.veluxDatasource.getVelocityTagByName(text)
                } 
              }
              node.veluxDatasource.runScene(node,id,velocity)
              .then((data)=>{node.publish(data)})
              .catch((err)=>{node.error(util.format('Velux %s', err))})
            }
            return
          }
          if (msg.topic) return
        } else {
          node.veluxDatasource.runScene(node,node.getID(),node.getVelocity())
          .then((data)=>{node.publish(data)})
          .catch((err)=>{node.error(util.format('Velux %s', err))})
          return
        }
      })
      
      node.on('close', function (done) {
        debug('close:')
        //node.veluxDatasource.unsubscribeScenes(node)
        done()
      })
    }
  }
  RED.nodes.registerType('Velux Scenes', veluxScenes)
}
