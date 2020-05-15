const startServer = require("./start-server");

var wss = startServer();

let clients = [];

let connections = {};

wss.on("connection", function connection(ws) {
    let client = { ws };
    console.log("connected");
    clients.push(client);
    ws.on("message", function incoming(message) {
        let parsed = JSON.parse(message);
        switch (parsed.type) {
            case "connected":
                client.id = parsed.id;
                break;
            case "initialize_connection":
                var { offer,
                    connectionId, timeout } = parsed;
                connections[connectionId] = {
                    id: connectionId,
                    offeringPeer: client.id,
                    offer: offer,
                    requested: false,
                    expires: (+new Date()) + timeout,
                    offeringIceCandidates : [],
                    acceptingIceCandidates : []
                };
                client.ws.send(JSON.stringify({
                    type: "connection_initialized",
                    connectionId
                }));
                break;
            case "request_connection":
                var { connectionId } = parsed;
                var connection = connections[connectionId];
                if (!connection || connection.requested || connection.expires < +new Date()) {
                    client.ws.send(JSON.stringify({
                        type: "connection_not_found",
                        connectionId
                    }));
                }
                else {
                    connection.requested = true;
                    connection.acceptingPeer = client.id;
                    client.ws.send(JSON.stringify({
                        type: "connection_offer",
                        connectionId,
                        offer: connection.offer
                    }));
                    for(var candidate of connection.acceptingIceCandidates) {
                        client.ws.send(JSON.stringify({
                            type: "new_ice_candidate",
                            connectionId,
                            candidate
                        }));
                    }
                }
                break;
            case "accept_connection":
                var { answer,
                    connectionId } = parsed;
                var connection = connections[connectionId];
                for(var candidate of connection.offeringIceCandidates) {
                    client.ws.send(JSON.stringify({
                        type: "new_ice_candidate",
                        connectionId,
                        candidate
                    }));
                }
                var peer = clients.find(v => v.id == connection.offeringPeer);
                if (null != peer) {
                    peer.ws.send(JSON.stringify({
                        type: "connection_accepted",
                        connectionId,
                        answer
                    }));
                }
                break;
            case "new_ice_candidate":
                var { id, candidate,
                    connectionId } = parsed;
                var connection = connections[connectionId];
                var isOffering = connection.offeringPeer === id;
                if (isOffering) {
                    connection.offeringIceCandidates.push(candidate);
                }
                else {
                    connection.acceptingIceCandidates.push(candidate);
                }
                var peerId = isOffering ? connection.acceptingPeer : connection.offeringPeer;
                var peer = clients.find(v => v.id === peerId);
                if (null != peer) {
                    peer.ws.send(JSON.stringify({
                        type: "new_ice_candidate",
                        connectionId,
                        candidate
                    }));
                }
                break;
        }
    });
    ws.on("error", function (msg) {
        console.error("ws error", msg);
        clients = clients.filter(v => v.ws != ws);
    });
    ws.on("close", function () {
        console.log("ws closed");
        clients = clients.filter(v => v.ws != ws);
        for (let c of clients) {
            c.ws.send(JSON.stringify({ type: "client_left", id: client.id }));
        }
    });
});
