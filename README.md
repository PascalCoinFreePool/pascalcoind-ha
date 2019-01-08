# pascalcoind-ha

This node.js wrapper is used to spawn and keep alive `pascalcoin_daemon`.

## Installing

First make sure you have node.js installed. Then clone this repo and use `npm install`. Finally, copy `pascalcoin_daemon`, `libcrypto.so.1.1`, and your `pascalcoin_daemon.ini` file into the bin folder of this repo.

You can set a custom path to the daemon with the options in `service.js`. Additionally, you can set the `dataDir` variable so that you can run multiple instances of the daemon without them conflicting.

## Configuration

The following options are available to be set:

```
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
```

All other options should be set in your `pascalcoin_daemon.ini` file.

## Running

You can either use `node service.js` or more preferably, use `pm2`:

```
npm install -g pm2

pm2 startup
pm2 install pm2-logrotate

pm2 start service.js --name pascalcoin_daemon
pm2 save
```

## Extending

This library emits events when the status of the daemon changes. You can do whatever you want with these events, but by default the only even that does anything other than logging is the `stopped` event which triggers a restart of the daemon.

## Donations

Donations are accepted at 573198-21
