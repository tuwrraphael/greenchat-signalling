export class IceCandidates {
    private c: {
        [id: string]: RTCIceCandidate[];
    };
    constructor() {
        this.c = {};
    }
    *getForPeer(peerId: string | undefined) {
        if (peerId) {
            if (this.c[peerId]) {
                for (let c of this.c[peerId]) {
                    yield c;
                }
            }
        }
    }
    add(peerId: string, candidate: RTCIceCandidate) {
        if (!this.c[peerId]) {
            this.c[peerId] = [];
        }
        this.c[peerId].push(candidate);
    }
}
