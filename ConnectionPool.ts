import { IceCandidates } from "./IceCandidates";
import { Connection } from "./Connection";
export class ConnectionPool {
    connections: Connection[];
    constructor() {
        this.connections = [];
    }
    create(connectionId: string) : Connection {
        let c = { iceCandidates: new IceCandidates(), id: connectionId };
        this.connections.push(c);
        return c;
    }
    initialize(connectionId: string, offeringPeer: string, offer: RTCSessionDescription, timeout: number) {
        let c = this.connections.find(d => d.id == connectionId);
        if (!c) {
            c = this.create(connectionId);
        }
        c.offeringPeer = offeringPeer;
        c.offer = offer;
        c.expires = (+new Date()) + timeout;
        c.requested = false;
        return c;
    }
    request(connectionId: string, acceptingPeer: string) {
        let c = this.connections.find(d => d.id == connectionId);
        if (!c || c.requested || c.expires && c.expires < +new Date()) {
            return null;
        }
        else {
            c.requested = true;
            c.acceptingPeer = acceptingPeer;
        }
        return c;
    }
    find(connectionId: string) {
        return this.connections.find(d => d.id == connectionId);
    }
    findOrAdd(connectionId: string) : Connection {
        let c = this.connections.find(d => d.id == connectionId);
        if (c) {
            return c;
        }
        return this.create(connectionId);
    }
}
