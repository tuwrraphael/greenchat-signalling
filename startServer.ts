import * as fs from "fs";
import minimist from "minimist";
import * as WebSocket from "ws";
import * as https from "https";

export function startServer() {

    let args = minimist(process.argv.slice(2), {
        default: {
            private: null,
            public: null,
            port: 33713
        }
    });
    let opts = {
        port: args.port
    };

    if (args.private && args.public) {
        console.log("using https");
        let privateKey = fs.readFileSync(args.private, 'utf8');
        let certificate = fs.readFileSync(args.public, 'utf8');
        let httpsServer = https.createServer({ key: privateKey, cert: certificate });
        httpsServer.listen(opts.port);
        let o = { server: httpsServer };
        return new WebSocket.Server(o);
    }

    return new WebSocket.Server(opts);
}