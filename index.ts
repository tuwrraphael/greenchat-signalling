import { startServer } from "./startServer";
import { ConnectionPool } from "./ConnectionPool";

var wss = startServer();

class WsClient {
    id!: string;
    ws: any;
}

let clients: WsClient[] = [];

let pool = new ConnectionPool();

let hubs: string[] = [];

wss.on("connection", function connection(ws) {
    let client = new WsClient();
    client.ws = ws;
    console.log("connected");
    clients.push(client);
    ws.on("message", function incoming(message: string) {
        let parsed = JSON.parse(message);
        switch (parsed.type) {
            case "connected": {
                client.id = parsed.id;
                break;
            }
            case "get_hubs": {
                client.ws.send(JSON.stringify({
                    type: "hubs",
                    hubs
                }));
                break;
            }
            case "announce_hub": {
                hubs.push(client.id);
                break;
            }
            case "connect_hub": {
                let { hubId, offer, connectionId, timeout } = parsed;
                if (!hubs.find(id => id == hubId)) {
                    client.ws.send(JSON.stringify({
                        type: "hub_not_found",
                        hubId,
                        connectionId
                    }));
                } else {
                    client.ws.send(JSON.stringify({
                        type: "connection_initialized",
                        connectionId
                    }));
                    pool.initialize(connectionId, client.id, offer, timeout || 120000);
                    let hub = clients.find(v => v.id == hubId);
                    if (hub) {
                        hub.ws.send(JSON.stringify({
                            type: "connect_hub",
                            connectionId
                        }));
                    }
                }
                break;
            }
            case "initialize_connection":
                {
                    let { offer, connectionId, timeout } = parsed;
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
                if (connection) {
                    let offeringPeer = connection.offeringPeer;
                    if (offeringPeer) {
                        let peer = clients.find(v => v.id == offeringPeer);
                        if (null != peer) {
                            peer.ws.send(JSON.stringify({
                                type: "connection_accepted",
                                connectionId,
                                answer
                            }));
                        }
                    }
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
        hubs = hubs.filter(id => id != client.id);
    });
    ws.on("close", function () {
        console.log("ws closed");
        clients = clients.filter(v => v.ws != ws);
        hubs = hubs.filter(id => id != client.id);
        for (let c of clients) {
            c.ws.send(JSON.stringify({ type: "client_left", id: client.id }));
        }
    });
});
