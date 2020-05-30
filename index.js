const startServer = require("./start-server");

var wss = startServer();

let clients = [];

class IceCandidates {
    constructor() {
        this.c = {};
    }

    *getForPeer(peerId) {
        if (this.c[peerId]) {
            for (let c of this.c[peerId]) {
                yield c;
            }
        }
    }

    add(peerId, candidate) {
        if (!this.c[peerId]) {
            this.c[peerId] = [];
        }
        this.c[peerId].push(candidate);
    }
}

class ConnectionPool {
    constructor() {
        this.connections = [];
    }

    create(connectionId) {
        let c = { iceCandidates: new IceCandidates(), id: connectionId };
        this.connections.push(c);
        return c;
    }

    initialize(connectionId, offeringPeer, offer, timeout) {
        let c = this.connections.find(d => d.id == connectionId);
        if (!c) {
            c = this.create(connectionId);
        }
        c.offeringPeer = offeringPeer;
        c.offer = offer;
        c.expires = (+new Date()) + timeout;
        c.requested = false;
        console.log(this.connections);
        return c;
    }

    request(connectionId, acceptingPeer) {
        let c = this.connections.find(d => d.id == connectionId);
        if (!c || c.requested || c.expires < +new Date()) {
            return null;
        }
        else {
            c.requested = true;
            c.acceptingPeer = acceptingPeer;
        }
        return c;
    }

    find(connectionId) {
        return this.connections.find(d => d.id == connectionId);
    }

    findOrAdd(connectionId) {
        let c = this.connections.find(d => d.id == connectionId);
        if (c) {
            return c;
        }
        return this.create(connectionId);
    }
}

let pool = new ConnectionPool();

wss.on("connection", function connection(ws) {
    let client = { ws };
    console.log("connected");
    clients.push(client);
    ws.on("message", function incoming(message) {
        let parsed = JSON.parse(message);
        switch (parsed.type) {
            case "connected": {
                client.id = parsed.id;
                break;
            }
            case "initialize_connection":
                {
                    let { offer,
                        connectionId, timeout } = parsed;
                    pool.initialize(connectionId, client.id, offer, timeout);
                    client.ws.send(JSON.stringify({
                        type: "connection_initialized",
                        connectionId
                    }));
                    break;
                }
            case "request_connection": {
                let { connectionId } = parsed;
                let connection = pool.request(connectionId, client.id);
                if (!connection) {
                    client.ws.send(JSON.stringify({
                        type: "connection_not_found",
                        connectionId
                    }));
                }
                else {
                    client.ws.send(JSON.stringify({
                        type: "connection_offer",
                        connectionId,
                        offer: connection.offer
                    }));
                    for (let candidate of connection.iceCandidates.getForPeer(connection.offeringPeer)) {
                        client.ws.send(JSON.stringify({
                            type: "new_ice_candidate",
                            connectionId,
                            candidate
                        }));
                    }
                }
                break;
            }
            case "accept_connection": {
                let { answer,
                    connectionId } = parsed;
                let connection = pool.find(connectionId);
                let peer = clients.find(v => v.id == connection.offeringPeer);
                if (null != peer) {
                    peer.ws.send(JSON.stringify({
                        type: "connection_accepted",
                        connectionId,
                        answer
                    }));
                }
                break;
            }
            case "new_ice_candidate": {
                let { id, candidate,
                    connectionId } = parsed;
                let connection = pool.findOrAdd(connectionId);
                connection.iceCandidates.add(id, candidate);
                let isOffering = connection.offeringPeer === id;
                let peerId = isOffering ? connection.acceptingPeer : connection.offeringPeer;
                let peer = clients.find(v => v.id === peerId);
                if (null != peer) {
                    peer.ws.send(JSON.stringify({
                        type: "new_ice_candidate",
                        connectionId,
                        candidate
                    }));
                }
                break;
            }
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
