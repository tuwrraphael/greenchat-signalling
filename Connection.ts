import { IceCandidates } from "./IceCandidates";
export interface Connection {
    id: string;
    offeringPeer?: string;
    offer?: RTCSessionDescription;
    expires?: number;
    requested?: boolean;
    acceptingPeer?: string;
    iceCandidates: IceCandidates;
}
