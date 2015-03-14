var path = require('path');
var express = require('express');
var app = express();



var servePath = function(folder){

	app.use("/" + folder,express.static(path.join(__dirname, "..", folder)));
}
servePath("audio");
servePath("public");
servePath("studio");

var port = process.env.PORT || 3000;
app.listen(port);

console.log("server listening on port " + port);
