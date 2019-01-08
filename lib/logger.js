/**
 * PascalCoind-ha
 * https://github.com/
 *
 * Logging system
 **/

var fs = require("fs");
var util = require("util");
var dateFormat = require("dateformat");
var clc = require("cli-color");

/**
 * Set CLI colors
 **/
var severityMap = {
    "info": clc.blue,
    "warn": clc.yellow,
    "error": clc.red
};

/**
 * Set severity levels
 **/
var severityLevels = ["info", "warn", "error"];

/**
 * Set log directory
 **/
var logDir = "logs";

/**
 * Create log directory if not exists
 **/
if(!fs.existsSync(logDir)) {
    try {
	fs.mkdirSync(logDir);
    } catch(e) {
	throw e;
    }
}

/**
 * Write log entries to file at specified flush interval
 **/
var pendingWrites = {};

setInterval(function() {
    for(var fileName in pendingWrites) {
	var data = pendingWrites[fileName];
	fs.appendFile(fileName, data, function(err) {
	    if(err) {
		console.log("Error writing log data to disk: %s", err);
		callback(null, "Error writing data to disk");
	    }
	});
	delete pendingWrites[fileName];
    }
}, 5000);

/**
 * Add new log entry
 **/
global.log = function(severity, system, text, data) {

    var time = dateFormat(new Date(), "yyyy-mm-dd HH:MM:ss");
    var formattedMessage = text;

    if(data) {
	data.unshift(text);
	formattedMessage = util.format.apply(null, data);
    }

    console.log(severityMap[severity](time) + clc.white.bold(" [" + system + "] ") + formattedMessage);

    var fileName = logDir + "/" + system + "_" + severity + ".log";
    var fileLine = time + " " + formattedMessage + "\n";
    pendingWrites[fileName] = (pendingWrites[fileName] || "") + fileLine;
};
