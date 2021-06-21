const express = require('express');
const app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
var request = require("request");
var nodemailer = require('nodemailer');

var clientid = "<insert-client-id>"; //BigCommerce API id
var acctoken = "<insert-access-token>" //BigCommerce Access token

var fs = require('fs')


function locklizardreg(prodid,prodsku,custname,custemail,orderid,subscription) {
	
	//Need to lookup product id and sku to find right locklizard id/ref.
	//For all except Volvo the bigcommerce sku is the same as the locklizard name, which the PHP script uses for lookup
	//However, choosing options (eBook/Portable Key) adds suffix to sku (e/USB) which needs to be removed
	//if (prodsku.endsWith("USB")) {
		//should end processing here since portable key products are not intended to allow this access
		//var passprod = "";
	//} else if (prodsku.endsWith("e")) {
	var len = prodsku.length;
	var passprod = prodsku.substring(0, len-1);
	//console.log(passprod);
	//}
	
	const http = require("http");

	var options = { method: 'POST',
	  url: '<insert forward PHP processor>',
	  headers: 
	   { 'cache-control': 'no-cache',
		 Connection: 'keep-alive',
		 Referer: '<insert forward PHP processor>',
		 'Accept-Encoding': 'gzip, deflate',
		 'Postman-Token': '366a4301-ef3c-4302-905f-9ca2cdf98710,4116e3a2-a4a1-4a99-a2ed-3b2744451eed',
		 'Cache-Control': 'no-cache',
		 Accept: '*/*',
		 'User-Agent': 'PostmanRuntime/7.15.2',
		 'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW' },
	  formData: 
	   { fullname: custname,
		 email: custemail,
		 confemail: custemail,
		 company: '',
		 pubref: passprod,
		 bcid: orderid,
		 subscribe: subscription} };

	 
	request(options, function (error, response, body) {
	  if (error) throw new Error(error);

});

	
}


function updatebigcommorder(orderid) {

	var options = { method: 'PUT',
	  url: 'https://api.bigcommerce.com/stores/17460/v2/orders/' + orderid,
	  headers: 
	   { 'Postman-Token': '5b0888e9-42ea-4bf3-9320-8e971e7ffd54',
		 'cache-control': 'no-cache',
		 'X-Auth-Token': acctoken,
		 'X-Auth-Client': clientid,
		 'Content-Type': 'application/json',
		 Accept: 'application/json' },
	  body: { status_id: 10 }, //id = 10 means order complete
	  json: true };

	request(options, function (error, response, body) {
	  if (error) throw new Error(error);

	  console.log(body);
	});
	
}


function checkbigcommorder_status(orderid) {

	const https = require("https");
	var custemail = "";
	var ordstatus = "";
	var prodcode = "";
	var jsonres = {};

	const options = {
	  "method": "GET",
	  "hostname": "api.bigcommerce.com",
	  "path": "/stores/17460/v2/orders/" + orderid,// + "/shipping_addresses",
	  "headers": {
		"Accept": "application/json",
		"Content-Type": "application/json",
		"X-Auth-Client": clientid,
		"X-Auth-Token": acctoken
		}
	};
	
	var req = https.request(options, function (res) {
	  var chunks = [];

	  console.log('statusCode:', res.statusCode);
	  
	  res.on("data", function (chunk) {
		chunks.push(chunk);
	  });

	  res.on("end", function () {
		var body = Buffer.concat(chunks);
		jsonres = JSON.parse(body.toString());

		ordstatus = jsonres.status_id;
		console.log(ordstatus);

		if (ordstatus==11) {
			fs.appendFile('testcheck.txt', 'ordstatus=' + ordstatus.toString(), function (err) {
			if (err) throw err;
				console.log('Saved!');
			});
			getorderinf(orderid);
			//updatebigcommorder("Completed",orderid);
			//locklizardreg(prodid,prodsku,custname,custemail,orderid); //Register customer with Locklizard title
		} else {
			fs.appendFile('testcheck.txt', 'ordstatus=' + ordstatus.toString(), function (err) {
			if (err) throw err;
				console.log('Saved!');
			});
		}
		

	  });
	  
	  req.on('error', (e) => {
	  console.error(e);
		});
	  
	});
	
	req.end();
}


function genemail_produrl(prodsku,custemail) {
	var transporter = nodemailer.createTransport({
		host: "<insert mail server>",
		port: 26,
		auth: {
			user: "<insert smtp account>",
			pass: "<insert smtp password>"
		}
	});
	
	const message = {
		from: "<insert from email>",
		to: custemail,
		subject: "Your otpubs title access URL",
		text: "Visit " + "jaguar.otpubs.com/" + prodsku + " to access your purchased title"
	};
	
	transporter.sendMail(message, function(err, info) {
		if (err) {
			console.log(err);
		} else {
			console.log(info);
		}
	});
}


function processprod(custname,custemail,orderid, item, index) {
	prodid = item.product_id;
	prodsku = item.sku;
	console.log(prodid);
			fs.appendFile('testcheck.txt', prodsku, function (err) {
			if (err) throw err;
				console.log('Saved!');
			});
	if (prodsku.substr(prodsku.length - 1)=="e") { //checks that is e-book product SKU
		//checkbigcommorder_status(orderid); //Update Big Commerce order status to say complete - first check if already marked complete, in case of duplicate webhook triggers
		//console.log("yo");
		locklizardreg(prodid,prodsku,custname,custemail,orderid,0);
		//genemail_produrl(prodsku,custemail); //Need to send customer an email containing correct url of their registered title
		//email generator commented out because now doing email generation in PHP script on otpubs.com server
		return "e";
	} else if (prodsku.substr(prodsku.length - 1)=="s") {
		locklizardreg(prodid,prodsku,custname,custemail,orderid,1);
	} else {
		return "USB";
	}
}

function getorderprods(orderid,custname,custemail) {

	const https = require("https");
	var jsonres = {};
	var prodid = "";
	var prodsku = "";
	
	const options = {
	  "method": "GET",
	  "hostname": "api.bigcommerce.com",
	  "path": "/stores/17460/v2/orders/" + orderid + "/products",
	  "headers": {
		"Accept": "application/json",
		"Content-Type": "application/json",
		"X-Auth-Client": clientid,
		"X-Auth-Token": acctoken
		}
	};
	
	var req = https.request(options, function (res) {
	  var chunks = [];

	  console.log('statusCode:', res.statusCode);
	  
	  res.on("data", function (chunk) {
		chunks.push(chunk);
	  });

	  res.on("end", function () {
		var body = Buffer.concat(chunks);
		jsonres = JSON.parse(body.toString());
		
		prodform = [];
		jsonres.forEach(function(item,index) {
			prodform.push(processprod(custname,custemail,orderid,item,index))
		});
		
		if (prodform.includes('USB')) {
			
		} else {
			updatebigcommorder(orderid)
		}
		
	  });
	  
	  req.on('error', (e) => {
	  console.error(e);
		});
	  
	});
	
	req.end();
	
}	
	
	

function getorderinf(orderid) {

	const https = require("https");
	var custemail = "";
	var custname = "";
	var prodcode = "";
	var jsonres = {};

	const options = {
	  "method": "GET",
	  "hostname": "api.bigcommerce.com",
	  "path": "/stores/17460/v2/orders/" + orderid + "/shipping_addresses",
	  "headers": {
		"Accept": "application/json",
		"Content-Type": "application/json",
		"X-Auth-Client": clientid,
		"X-Auth-Token": acctoken
		}
	};
	
	
	var req = https.request(options, function (res) {
	  var chunks = [];

	  console.log('statusCode:', res.statusCode);
	  
	  res.on("data", function (chunk) {
		chunks.push(chunk);
	  });
	  
		
	  res.on("end", function () {
		var body = Buffer.concat(chunks);
		jsonres = JSON.parse(body.toString());
		custname = jsonres[0].first_name + " " + jsonres[0].last_name;
		custemail = jsonres[0].email;
		console.log(custname);
		console.log(custemail);
		
			fs.appendFile('testcheck.txt', custname, function (err) {
			if (err) throw err;
				console.log('Saved!');
			});
		
		getorderprods(orderid,custname,custemail);
	  });
	  
	  req.on('error', (e) => {
	  console.error(e);
		});
	  
	});
	
	req.end();
	
}


app.get('/otp', function (req, res) {
	res.send('GOT');
});

// when there's a post request to /otp...
app.post('/otp', function (req, res) {
	//respond with 200 OK
	res.send('OK');
	console.log('statusCode:', res.statusCode);
	var ordid = req.body.data.id;
	console.log('id:', ordid);
	//res.send(ordid.toString());
	checkbigcommorder_status(ordid);
	
});

app.listen(process.env.PORT, function() {
	console.log('Listening for webhooks on port ' + process.env.PORT);
})