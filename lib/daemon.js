const fs = require("fs");
const os = require("os");
const path = require("path");
const net = require("net");
const request = require("request");
const childProcess = require("child_process");
const StreamSplitter = require("stream-splitter");
const EventEmitter = require("events").EventEmitter;


function PascalCoind(_opts) {

    this.lastBlock = 0; // height of the last block
    this.lastBlockTime = 0; // time of the last block
    this.failCount = 0; // number of times RPC has failed consecutively
    this.rpcId = 0; // internal RPC count
    this.status = 0; // 0 = not initialized, 1 = RPC initialized, 2 = Miner port initialized

    this.heartbeat = null; // interval for RPC
    this.forceKill = null; // timeout for force kill
    this.minerResponse = null; // timeout for lack of miner reponse
    this.client = new net.Socket(); // net.socket for miner port

    var _this = this;

    // Default settings
    var opts = {
        daemonPath: "./bin/pascalcoin_daemon",
        dataDir: "~",
        testnet: false,

        rpcMonitor: true,
        rpcProtocol: "http://",
        rpcHost: "127.0.0.1",
        rpcPort: "4003",
        rpcInterval: 15,
        rpcTimeout: 10,
        rpcMaxFailures: 10,

        minerMonitor: true,
        minerHost: "127.0.0.1",
        minerPort: "4009",
        minerTimeout: 60 * 2,
        minerMaxBlockTime: 60 * 60,

        clearPendingBufferOnStart: true,
        clearBlockchainOnStart: false,
        delayBeforeForceKill: 15
    };

    // Merge user settings
    Object.keys(_opts).forEach(function (k) {
        opts[k] = _opts[k];
    });

    opts.dataDir = path.resolve(opts.dataDir.replace("~", os.homedir()));
    opts.daemonPath = path.resolve(opts.daemonPath.replace("~", os.homedir()));

    this.start = function() {

        this.lastBlock = 0;
        this.lastBlockTime = 0;
        this.rpcId = 0;
        this.status = 0;
        this.failCount = 0;

        if(this.exitNow === true) return;

        this.emit("info", "starting pascalcoin_daemon");

        if(!fs.existsSync(opts.daemonPath)) {
            this.emit("error", "pascalcoin_daemon was not found at: %s", [opts.daemonPath]);
            return false;
        }

        var dataDir = path.join(opts.dataDir, opts.testnet ? "PascalCoin_TESTNET" : "PascalCoin");
        if(!fs.existsSync(dataDir)) {
            this.emit("info", "creating datadir at %s", [dataDir]);
            fs.mkdirSync(dataDir, {recursive: true, mode: 0750})
        }

        if(opts.clearPendingBufferOnStart) {
            var file = path.join(dataDir, "Data", "pendingbuffer.ops");
            if(fs.existsSync(file)) {
                this.emit("info", "clearing %s", [file]);
                fs.unlinkSync(file);
            }
        }

        if(opts.clearBlockchainOnStart) {
            var dir = path.join(dataDir, "Data");
            if(fs.existsSync(dir)) {
                this.emit("info", "clearing %s", [dir]);
                fs.readdirSync(dir).forEach(function(file, index) {
                    file = path.join(dir, file);
                    fs.unlinkSync(file);
                });
            }
        }

        this.daemonProcess = childProcess.spawn(opts.daemonPath, ["-r"], {
            cwd: path.dirname(opts.daemonPath),
            env: {
                HOME: opts.dataDir
            },
            detached: true
        });

        this.daemonProcess.stdout.pipe(StreamSplitter("\n")).on("token", (token) => {
            this.emit("daemon", token.toString());
            if(token.indexOf("RPC server is active on port") !== -1) {
                this.emit("info", "RPC server is active");
                this.status++;
            }
            if(token.indexOf("Activating RPC Miner Server") !== -1) {
                this.emit("info", "mining port is active");
                this.status++;
            }
            if(token.indexOf("Stoping RPC-JSON Server") !== -1) {
                this.emit("error", "RPC server went down");
                this.emit("stopped");
            }
            if(this.status == 2) {
                this.status = 0;
                this.emit("started");
            }
        });
        this.daemonProcess.on("error", (err) => {
            this.emit("error", "pascalcoin_daemon encountered an error");
            this.emit("error", err);
            setTimeout(() => {
                this.emit("stopped");
            }, 10000)
        });
        this.daemonProcess.on("close", (code) => {
            this.emit("error", "pascalcoin_daemon quit with code %s", [code]);
            if(this.heartbeat) {
                clearInterval(this.heartbeat);
                this.heartbeat = null;
            }
            if(this.forceKill) {
                clearTimeout(this.forceKill);
                this.forceKill = null;
            }
            if(this.minerResponse) {
                clearTimeout(this.minerResponse);
                this.minerResponse = null;
            }
            if(this.client) {
                this.client.destroy();
            }
            if(this.exitNow === true) {
                process.exit();
            } else {
                setTimeout(() => {
                    this.emit("stopped");
                }, 10000);
            }
        });
    }

    this.stop = function() {
        this.emit("info", "stopping pascalcoin_daemon");
        this.daemonProcess.kill("SIGINT");
        this.forceKill = setTimeout(() => {
            this.emit("info", "pascalcoin_daemon not responding to SIGINT, sending SIGKILL");
            this.daemonProcess.kill("SIGKILL");
        }, opts.delayBeforeForceKill * 1000);
    }

    this.on("started", () => {
        this.emit("info", "pascalcoin_daemon has started");
        if(opts.rpcMonitor) {
            this.emit("info", "starting RPC monitoring");
            this.heartbeat = setInterval(_this.doHeartbeat, opts.rpcInterval * 1000);
        }
        if(opts.minerMonitor) {
            this.emit("info", "starting miner monitoring");
            setTimeout(() => {
                // 30 second timeout before connecting to miner port
                this.client.connect(opts.minerPort, opts.minerHost, () => {
	            this.emit("info", "connected to miner port %s:%s", [opts.minerHost, opts.minerPort]);
                });
            }, 30000);
        }
    });

    this.on("stopped", () => {
        this.emit("info", "pascalcoin_daemon has stopped");
    });

    this.client.on("error", (error) => {
        this.emit("error", "error with miner port: %s", [error]);
    });

    this.client.on("data", (data) => {
	/**
	 * The miner port sends some garbage sometimes
	 * so we clean it up here.
	 **/

	// trim null and newlines from end
	while(data[data.length-1] == 0x0 ||
	      data[data.length-1] == 0x0A ||
	      data[data.length-1] == 0x0D) {
	    data = data.slice(0, data.length-1);
	}

	// add a single new line to end to make splitting easier
	data = Buffer.concat([data, Buffer.from([0x0A])]);

	// sometimes daemon sends two messages at once. might be separated
	// by either 0x0A (newline), 0x0D (carriage return) or 0x0 (null)
	// so, let's just replace any 0x0D & 0x0 with 0x0A so we can split
	for(var i = 0; i < data.length; i++) {
	    if(data[i] == 0x0D || data[i] == 0x0) {
		data[i] = 0x0A;
	    }
	}

	// split buffer into newlines,
	var lines = [],
	    index = 0;
	while(data.indexOf(0x0A, index) !== -1) {
            var tmp = data.slice(index, index = data.indexOf(0x0A, index) + 1);
	    // trim null and newlines from end
	    while(tmp[tmp.length-1] == 0x0 ||
	          tmp[tmp.length-1] == 0x0A ||
	          tmp[tmp.length-1] == 0x0D) {
	        tmp = tmp.slice(0, tmp.length-1);
	    }
            // make sure we don't have an empty line
            if(tmp.length) {
	        lines.push(tmp);
            }
	}

	for(var i = 0; i < lines.length; i++) {
	    try {
		var json = JSON.parse(lines[i]);
		if(json.hasOwnProperty("method") && json.method == "miner-notify") {
                    var height = json.params[0].block;
		    this.emit("info", "miner-notify received at height %s", [height]);

                    if(this.minerResponse) {
                        clearTimeout(this.minerResponse);
                        this.minerResponse = null;
                    }

                    if(this.lastBlock != height) {
                        this.lastBlock = height;
                        this.lastBlockTime = Date.now() / 1000;
                    }

                    if((Date.now() / 1000) - this.lastBlockTime > opts.minerMaxBlockTime) {
                        this.emit("error", "block %s older than %s seconds, killing", [height, opts.minerMaxBlockTime]);
                        break;
                    }

                    this.minerResponse = setTimeout(() => {
		        this.emit("error", "not received miner-notify in %s seconds, killing", [opts.minerTimeout]);
                        this.stop();
                    }, opts.minerTimeout * 1000);

		}

	    } catch(error) {
		log("error", logSystem, "Parse error from %s", [data.toString("hex")]);
	    }
	}
    });


    this.doHeartbeat = function() {
        _this.sendRpc("nodestatus", {}, (data) => {
            if(data.hasOwnProperty("error")) {
                _this.failCount++;
                _this.emit("error", "error: %s, fail count: %s", [data.error.message, _this.failCount]);
                if(_this.failCount >= opts.rpcMaxFailures) {
                    _this.emit("error", "max fail count, stopping");
                    _this.stop();
                }
            } else {
                _this.failCount = 0;
                _this.emit("info", "RPC: %s", [data.result.ready_s ? data.result.ready_s : data.result.status_s]);
                _this.emit("info", "RPC: blockcount %s, connected to %s peers", [data.result.blocks, data.result.netstats.active]);
                if(data.result.netstats.active == 0) {
                    _this.emit("error", "no peers, stopping");
                    _this.stop();
                }
            }
        }, opts.rpcTimeout);
    }

    this.sendRpc = function(method, params={}, callback, timeout=0) {
        var options = {
            url: `${opts.rpcProtocol}${opts.rpcHost}:${opts.rpcPort}/json_rpc`,
            method: "POST",
            json: true,
            body: {
                jsonrpc: "2.0",
                id: ++this.rpcId,
                method: method
            },
        };
        if (Object.keys(params).length !== 0) {
            options.body.params = params
        }
        if(timeout) {
            options.timeout = timeout
        }

        return request(options, (error, httpResponse, body) => {
            if(error) {
                callback({
                    method: method,
                    params: params,
                    error: {
                        code: -1,
                        message: "Cannot connect to daemon",
                        cause: error.code
                    }
                });
                return;
            }

            if(body.hasOwnProperty("error")) {
                callback({
                    method: method,
                    params: params,
                    error: body.error
                });
                return;
            }
            callback({
                method: method,
                params: params,
                result: body.result
            });
            return;
        });
    }

    process.on("SIGINT", () => {
        this.emit("error", "caught SIGINT, please wait...");
        this.exitNow = true;
        this.stop();
    });
    process.on("SIGTERM", () => {
        this.daemonProcess.kill("SIGKILL");
    });

}
PascalCoind.prototype.__proto__ = EventEmitter.prototype;
module.exports = PascalCoind;
