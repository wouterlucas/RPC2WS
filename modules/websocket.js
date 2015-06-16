 /*
 * RPC2WS frontend WebSocket Service
 * 
 * Copyright (c) 2015 wouterlucas.com
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 * 
 * - The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 * - THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 *   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, 
 *   WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

var events = require('events');
var WebSocketServer = require('websocket').server;

//our event
var newRequest = new events.EventEmitter();
newRequest.setMaxListeners(0); //Should we be doing this? Feels badass.

// Connect to REDIS - handle the case where we are being launched inside Heroku with Redis To Go
// more info: https://devcenter.heroku.com/articles/redistogo
if (process.env.REDISTOGO_URL) {
    var rtg   = require('url').parse(process.env.REDISTOGO_URL);
    var redis = require('redis').createClient(rtg.port, rtg.hostname);
    var redisListener = require('redis').createClient(rtg.port, rtg.hostname); 

    redis.auth(rtg.auth.split(':')[1]);
    redisListener.auth(rtg.auth.split(':')[1]);
} else {
    var redis = require('redis').createClient();
    var redisListener = require('redis').createClient();
}

redis.on('error', function(err) {
  console.log('Error connecting to redis', err);
});

redisListener.on('connect', function(err) {
    redisListener.subscribe('requestChannel');
});

redisListener.on('error', function(err) {
    console.log('websocket.js - Redis Error: ' + err);
});

//====== Handle responses on the response channel ==========
redisListener.on('message', function(channel, message) {
    //we have a new message, generate a SSE
    
    /* message formats: 
     *      <clientid>|<hash>
     */

    console.log('websocket.js - Got new request: ' + message);
    
    var request = JSON.parse(message);
    newRequest.emit(request.id, request.msg);
});

/**
 * Handles WebSocket requests on the front end.
 *
 * Function is an Express handler: expressjs.scom
 * Connects to the REDIS and listens for a new message to the request channel
 * and returns a response on the REDIS response channel for handling by the AJAX RPC module
 */
exports.startWebSocketServer = function(server){
    var ws = new WebSocketServer();
    ws.mount({ httpServer: server });
    ws.on('request', function(websocketRequest) { 
        console.log("WebSocket Client request: " + websocketRequest.remoteAddress + ' @ ' + websocketRequest.resource + '  websocket version:' + websocketRequest.webSocketVersion);
        
        if (websocketRequest.resourceURL && websocketRequest.resourceURL.query && websocketRequest.resourceURL.query.clientId){
            var clientId = websocketRequest.resourceURL.query.clientId;
            // accept everything for now... we need to add a hosts checker for CORS
            wsConnection = websocketRequest.accept();
            handleWebSocket(wsConnection, clientId);            
        } else {
            websocketRequest.reject(); //no client id provided, bouncing it
        }
    });
    console.log('WebSocket server started');
};

function handleWebSocket(socket, clientId){
    console.log('Client ' + clientId + ' succesfully upgraded to a websocket connection');

    function _sendRequest(requestObject){
        var message = JSON.stringify(requestObject);
        console.log('websocket.js - Sending websocket request: ' + message);
        socket.send(message + '\n');
    }
    newRequest.on(clientId, _sendRequest);
 
    socket.on('message', function(message){
        if (message.type == 'utf8'){
            var response = {
                'id' : clientId,
                'msg': message.utf8Data
            };

            redis.publish('responseChannel', JSON.stringify(response));
        }
    });

    socket.on('close', function(){
        newRequest.removeListener(clientId, _sendRequest);
    });

    socket.on('error', function(){
       newRequest.removeListener(clientId, _sendRequest); 
    });

}