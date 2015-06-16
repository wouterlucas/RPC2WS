# RPC 2 WebSocket

The RPC 2 WebSocket app takes JSON-RPC AJAX requests (HTTP GET) and converts them to WebSocket messages.

				  		 +--------+
			        	 |        |
Application o--AJAX-RPC--| RPC2WS |==WebSocket== Client
						 |        |
						 +--------+

## AJAX RPC Usage 

The RPC2WS service takes Remote Procedure Calls with the format of:

GET /clientId?json-rpc-object

Whereas:
* clientId {string} is the identification of the client as it connects on websockets
*  json-rpc-object {string} is the JSON-RPC 2.0 object to be sent on the WS

The RPC2WS expects a JSON-RPC 2.0 compliant response from the websocket client, if the client is
* Unavailable on the websocket or;
* Does not respond

The RPC call will time out.

## WebSocket Usage

The Client must connect with a client Id on the WS connection request. The clientId will be used to be able to route the AJAX RPC requests to the rightful websocket client.

# Implementation

The RPC2WS uses node.js and consists out of two components:
- The AJAX RPC listener, responsible for getting the AJAX request and publishing it to REDIS
- The WebSocket listener, responsible for establishing WS requests and subscribing to REDIS channels for messages