# RPC 2 WebSocket

The RPC 2 WebSocket app takes JSON-RPC AJAX requests (HTTP GET) and converts them to WebSocket messages.

                             +--------+                     
                             |        |                     
    Application o--AJAX-RPC--| RPC2WS |==WebSocket==[ Client
                             |        |                     
                             +--------+                     

## AJAX RPC Usage 

The RPC2WS service takes Remote Procedure Calls with the format of:

`GET /clientId/ajax?json-rpc-object`

Whereas:

* clientId {string} is the identification of the client as it connects on websockets

*  json-rpc-object {string} is the JSON-RPC 2.0 object to be sent on the WS


The RPC2WS expects a JSON-RPC 2.0 compliant response from the websocket client, if the client is

* Unavailable on the websocket or;

* Does not respond

The RPC call will time out.

## WebSocket Usage

The Client must connect with a client Id on the WS connection request. The clientId will be used to be able to route the AJAX RPC requests to the rightful websocket client.

Connect to websocket using ?clientId=clientId query parameter on the connect url to identify who you are on the websocket connection.
For example: `ws://10.0.0.1:5000/?clientId=client1`

# Implementation

The RPC2WS uses node.js and consists out of two components:

- The AJAX RPC listener, responsible for getting the AJAX request and publishing it to REDIS (ajaxrpc.js)

- The WebSocket listener, responsible for establishing WS requests and subscribing to REDIS channels for messages (websocket.js)

This program is prepared to run in Heroku with Redis2Go
There is a very simple test page in public/
