"use strict";
var MongoClient = require('mongodb').MongoClient
  , assert = require('assert');
 
require('isomorphic-fetch');
var request = require("request");
 
var mongoUrl = 'mongodb://localhost:27017/untouched-place';
const bitmapURL = 'https://www.reddit.com/api/place/board-bitmap'; 

//var bitmapArray = new Uint8Array(1000*1000);
var bitmapArray = [];

var firstRun = false;

MongoClient.connect(mongoUrl, function(err, db) {
	assert.equal(null, err);
	console.log("Connected correctly to server");
	var numWhite = 149729;

	if (firstRun) {
		var r = db.collection('whitePixels').insertMany(getWhitePixels);
		console.log(r.insertedCount, "inserted");
	}

	setInterval(checkRandom,1000);

	setInterval(checkBitmap,10000);
	
	function getWhitePixels() {
		fetch(bitmapURL).then(function(response) {
			return response.buffer();
		}).then(function(buffer){
			console.log(buffer.length);
		//	var timestamp = new Int32Array(bitmapBuffer.slice(0,4));
		//	console.log(timestamp);
			var array8 = buffer.slice(4,500004);
			console.log(array8.length)
			for (var i=0;i<array8.length;i+=1) {
				bitmapArray[2*i] = (array8[i] & 0xF0) >> 4;
				bitmapArray[2*i+1] = array8[i] & 0x0F;
			}
			console.log(bitmapArray.length);
			var whitePixels = []
			var x
			var y
			for (var i=0;i<bitmapArray.length;i+=1) {
				if (bitmapArray[i] === 0) {
					var y=Math.floor(i/1000);
					var x=i%1000;
					whitePixels.push({x:x,y:y});
				}
			}
			console.log(whitePixels.length);
			return whitePixels;
		});
	}
	
	function checkBitmap() {
		var whitePixels = getWhitePixels();
		db.collection('whitePixels').find({"user_name":null}).forEach(function(whitePixel) {
			console.log(whitePixel)
		});
	}
	
	function checkRandom() {
		db.collection('whitePixels').aggregate([{$match: {"user_name":null}},{$sample: { size: 1 }}]).next().then(checkPixel);
	}
	
	function checkPixel(pixel){
		request({
			url: "https://www.reddit.com/api/place/pixel.json?x="+pixel.x+"&y="+pixel.y,
			json: true,
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
			}
		}, function (error, response, body) {
			if (!error && response.statusCode === 200) {
				var numUntouched = db.collection('whitePixels').count({"user_name":{$exists:true,$eq:null}});
				Promise.all([
					db.collection('whitePixels').count({"user_name":{$exists:true}}),
					db.collection('whitePixels').count({"user_name":{$exists:true,$eq:null}})
				]).then(values => {
					console.log(parseInt(values[1]/values[0]*numWhite), values[0], values[1], pixel.x, pixel.y, body.user_name); //Print the json response
					db.collection('whitePixels').update({"_id":pixel._id},{$set: {user_name:body.user_name, timestamp:Date.now()}});
					db.collection('stats').insert({timestamp:Date.now(),numChecked:values[0], numUntouched:values[1]})
				});
			} else {
				console.log("ERROR!")
				console.log(error)
				console.log(response.statusCode)
			}
		});
	}
});

	/*
    response.blob().then(function(myBlob) {
        var arrayBuffer;
        var fileReader = new FileReader();
        fileReader.onload = function() {
            console.log(this);
            console.log(this.result);
            var timestamp = new Int32Array(this.result.slice(0,4))[0];
            console.log(timestamp);
            var array8 = new Uint8Array(this.result.slice(4));
            for (var i=0;i<array8.length;i+=1) {
                bitmapArray[2*i] = (array8[i] & 0xF0) >> 4;
                bitmapArray[2*i+1] = array8[i] & 0x0F;
            }
            console.log(bitmapArray);
            var numWhite = bitmapArray.reduce(function(n, pixel) {
                return n + (pixel === 0);
            }, 0);
            console.log(numWhite);
        };
        fileReader.readAsArrayBuffer(myBlob);

    });
	*/
//});