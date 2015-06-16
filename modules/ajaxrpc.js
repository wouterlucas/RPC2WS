 /*
 * RPC2WS backend AJAXRPC Service
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
var url = require('url');
var events = require('events');

//our event
var newResponse = new events.EventEmitter();
newResponse.setMaxListeners(0); //Should we be doing this? Feels badass.

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
    redisListener.subscribe('responseChannel');
});


redisListener.on('error', function(err) {
    console.log('ajaxrpc.js - Redis Error: ' + err);
});

//====== Handle responses on the response channel ==========
redisListener.on('message', function(channel, message) {
    //we have a new message, generate a SSE
    
    /* message formats: 
     * { 
     *     id : <clientid>,
     *     msg: <message>
     * }
     */

    var response = JSON.parse(message);
    newResponse.emit(response.id, response.msg);
});

/**
 * Handles AJAX RPC requests on the front end.
 *
 * Function is an Express handler: expressjs.scom
 * Connects to the REDIS and publishes a new message to the channel
 * Waits for a response through the REDIS channel, if received returns the JSON-RPC object back as a HTTP response
 */
exports.handleAjaxRpcRequest = function(req, res){
    var clientId = req.params.clientId;
    var jsonRpcObj = req.query;

    console.log("Client request: " + req.connection.remoteAddress + ':' + req.connection.remotePort + ' - ' + req.method + ' ' + req.url);
    //console.log('New RPC request with clientId: ' + clientId + ' query: ' + jsonRpcObj);

    if (!clientId) {
        console.log('ajaxrpc.js - Missing client id')
        res.status(400).end('Missing clientId');
    }

    //check our redis connection
    if (redis.connected === false){
        console.log('ajaxrpc.js - Redis disconnected returning 503');
        res.status(503).end();
    }   

    // Publish to requestChannel on Redis
    // Format: <clientId>|jsonObject
    var request = {
        'id' : clientId,
        'msg' : jsonRpcObj
    };

    redis.publish('requestChannel', JSON.stringify(request));

    // Subscribe to our response event emitter, send a response if it does
    function _sendResponse(message){
        console.log('ajaxrpc.js - RPC response: ' + message);
        res.send(message);
        res.end();
    }
    newResponse.on(clientId, _sendResponse);

    req.on('end', function(){
        newResponse.removeListener(clientId, _sendResponse);
    })
};
