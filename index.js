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
                var peers = clients.filter(p => null != p.id && client.id != p.id).map(p => p.id);
                if (peers.length) {
                    client.ws.send(JSON.stringify({ type: "peers", peers }));
                }
            case "offer":
                var { offeringPeer, acceptingPeer, offer,
                    connectionId } = parsed;
                connections[connectionId] = {
                    id: connectionId,
                    offeringPeer: offeringPeer,
                    acceptingPeer: acceptingPeer,
                    offer: offer
                };
                var peer = clients.find(v => v.id == acceptingPeer);
                if (null != peer) {
                    peer.ws.send(JSON.stringify({
                        type: "offer",
                        connectionId,
                        offeringPeer,
                        offer
                    }));
                }
                break;
            case "accept":
                var { acceptingPeer, accept,
                    connectionId } = parsed;
                var connection = connections[connectionId];
                var peer = clients.find(v => v.id == connection.offeringPeer);
                if (null != peer) {
                    peer.ws.send(JSON.stringify({
                        type: "accept",
                        connectionId,
                        acceptingPeer,
                        accept
                    }));
                }
                break;
            case "new_ice_candidate":
                var { id, candidate,
                    connectionId } = parsed;
                var connection = connections[connectionId];
                var isOffering = connection.offeringPeer === id;
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
