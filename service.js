var PascalCoind = require("./");
require("./lib/logger.js");

/**
 * Monitor Settings:
 *
 * daemonPath: The path to the daemon binary
 * dataDir: The parent directory where PascalCoin or PascalCoin_TESTNET is located
 * testnet: If using testnet, set to true
 *
 * rpcMonitor: Enable RPC monitoring for connected peer count
 * rpcProtocol: Normally http:// unless your daemon is only accessible over https://
 * rpcHost: IP or hostname the daemon listens to
 * rpcPort: Port that the daemon is bound to
 * rpcInterval: The interval in seconds that we will make an RPC call
 * rpcTimeout: Max number of seconds to wait for an RPC response before considering it failed
 * rpcMaxFailures: Max consecutive RPC failures before restarting
 *
 * minerMonitor: Enable miner port monitoring for last sent block age
 * minerTimeout: Max number of seconds to wait for a new miner notify before failing
 * minerMaxBlockTime: Max number of seconds for a new block before failing
 *
 * clearPendingBufferOnStart: Enable clearing of pendingbuffer.ops when starting daemon
 * clearBlockchainOnStart: Enable clearing the whole Data directory when starting
 * delayBeforeForceKill: Number of seconds to wait after sending SIGINT before sending SIGKILL
 */

var daemon = new PascalCoind({
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

    minerMonitor: false,
    minerHost: "127.0.0.1",
    minerPort: "4009",
    minerTimeout: 60 * 1,
    minerMaxBlockTime: 60 * 60,

    clearPendingBufferOnStart: true,
    clearBlockchainOnStart: false,
    delayBeforeForceKill: 60
});

daemon.on("started", () => {
});

daemon.on("stopped", () => {
    log("info", "monitor", "restarting pascalcoin_daemon");
    daemon.start()
});

daemon.on("info", (text, data) => {
    log("info", "monitor", text, data)
});

daemon.on("daemon", (text) => {
    /**
     * If you want to hide daemon output on the console, comment the following line
     */
    log("info", "daemon", text.substring(text.indexOf("[")));
});

daemon.on("warn", (text, data) => {
    log("warn", "monitor", text, data)
});

daemon.on("error", (text, data) => {
    log("error", "monitor", text, data)
});

daemon.start();
