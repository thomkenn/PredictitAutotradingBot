const Discord = require('discord.js');
var auth = require('./auth.json');
var temp = "";
var z = "";
var access_token = "";
var contracts = [];
var backupcontracts = contracts.slice(0);
const max = 500; // change this to lower max shares you want to own in a market
var lowest = 100; // make sure this is less then max
var lastpi = "";
var output = 0;
var i = 0;
var currnegrisk = "";
var negriskcounter = 0;
var negrisktracker = 0;
var idofMarket = 0;
var lastOwned = "";
var message = "";

const bot = new Discord.Client();

bot.login(auth.token)
 .then(console.log("loggedin"));

bot.on('ready', function (evt) {
	console.log("ready");
});

login(); //comment out in final build

setTimeout(function(){
	ownedShares();
}, 5000);

setInterval(function(){
	ownedShares();
}, 1800001);

setInterval(function(){
	login();
}, 18000000);

setInterval(function(){ 
	getPIdata();
},60000);

function login() {
	var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
	var oReq = new XMLHttpRequest();
	var formData = [];
	formData.push('email','(email here)');
	formData.push('password','(password here)');
	formData.push('grant_type','password');
	formData.push('rememberMe','false');
	
	var urlEncodedData = "";
	var urlEncodedDataPairs = [];

  // Turn the data object into an array of URL-encoded key/value pairs.
	for(var i = 0; i < 8; i += 2) {
		urlEncodedDataPairs.push(encodeURIComponent(formData[i]) + '=' + encodeURIComponent(formData[i+1]));
	}
	
	urlEncodedData = urlEncodedDataPairs.join('&').replace(/%20/g, '+');
	
	oReq.addEventListener("load", loginhandler);
	oReq.open("POST", "https://www.predictit.org/api/Account/token", true);
	oReq.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
	oReq.send(urlEncodedData);
};

function loginhandler() {
	var mydata = JSON.parse(this.responseText);
	access_token = mydata.access_token;
	console.log(mydata.access_token + "\nLogged in");
	//checkorderbook(contracts[contracts.length-1]);
};

function ownedShares() { //marked for deletion
	var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
	var oReq = new XMLHttpRequest();
	url = "https://www.predictit.org/api/Profile/Shares";
	oReq.open("GET", url);
	oReq.addEventListener("load", ownedSharesHandler);
	var temp = "Bearer " + access_token;
	oReq.setRequestHeader("Authorization", temp);
	oReq.send();
};

function ownedSharesHandler() { //replace this with check against stored // marked for deletion
	lastOwned = JSON.parse(this.responseText);
	
	lastOwned = lastOwned["markets"];
};

function checkorderbook(url) {
	var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
	var oReq = new XMLHttpRequest();
	url = "https://www.predictit.org/api/Trade/" + url + "/OrderBook";
	oReq.open("GET", url, true);
	oReq.addEventListener("load", orderbookhandler);
	var temp = "Bearer " + access_token;
	oReq.setRequestHeader("Authorization", temp);
	oReq.send();
};

function orderbookhandler() {//this one recursively loops through contracts and uses those 
	var mydata = JSON.parse(this.responseText);

	console.log(contracts);
	if (mydata.noOrders != "" && mydata.noOrders != null)
	{
		negrisktracker = negrisktracker + mydata.noOrders[0].costPerShareYes;
		if (mydata.noOrders[0].quantity < lowest)
		{
			lowest = mydata.noOrders[0].quantity;
		}
	}
	contracts.pop();
	if (lowest == 0)
	{
		console.log("quantity:" + mydata.noOrders[0].quantity);
	}
	if (contracts != ""){
		checkorderbook(contracts[contracts.length-1]);
	}
	else
	{
		//console.log(lowest); //this is where we'll call the final function
		//console.log("storing in contracts: " + backupcontracts);
		contracts = backupcontracts.slice(0);
		//console.log("sending to ownedShare: " + contracts);
		console.log("pre lowest:" + lowest);
		compareOwned();
	}
};

function compareOwned() {
	var index = lastOwned.findIndex(mkt=> mkt.marketId === idofMarket);
	
	var temp = 0;
	if (index != -1)
	{
		for (i in lastOwned[index].marketContracts)
		{
			temp = lastOwned[index].marketContracts[i].userQuantity;
			if ((temp + lowest) > max && lowest != 0) //change this to a low number to ensure it never buys too many sahres
			{
				if (temp >= max)
				{
					console.log("temp: " + temp + "\n setting lowest to 0");
					lowest = 0;
				}
				else 
					lowest = max - temp;
			}
		}
	};
	console.log("Lowest after compare owned: " + lowest);
	if (lowest != 0)
		prepareTrade(lowest, contracts);
	else
	{
		if (index != -1)
		for (i in lastOwned[index].marketContracts)
		{
			console.log("In contract: " + lastOwned[index].marketContracts[i].contractName + "\nWe own " + lastOwned[index].marketContracts[i].userQuantity);
		}
		console.log("\nNegRiskTracker" + negrisktracker);
	}
}

function prepareTrade(lowest, contracts) {	
	var i = contracts.length;

	console.log("negrisktracker: " + negrisktracker + " lowest " + lowest + " contracts " + contracts + " num contracts " + i);
	
	if (i == 2) {
		if (negrisktracker < 1.06)
		{
			return;
		}
	}
	else if (i == 3) {
		if (negrisktracker < 1.08)
			return;			
	}
	else if (i == 4 || i == 5) {
		if (negrisktracker < 1.09)
			return;
	}	
	else if (i >= 5 && i <= 10) {
		if (negrisktracker < 1.10)
			return;
	}
	else if (i > 10) {
		if (negrisktracker < 1.11)
			return;
	}
	
	if (lowest > 0)
	for (i = 0; i < contracts.length; i++) {
		finalizeTrade(lowest, contracts[i]);
	}
	
	if (message != "")
		setTimeout(function(){
		finalize();
		}, 2000);
	else
		setTimeout(function(){
			process.exit();
		}, 5000);
	 //uncomment when ready to start buying
};

function finalize() {
	var oldcopy = lastOwned.slice(0);
	ownedShares();
	setTimeout(function(){
		var oldindex = oldcopy.findIndex(mkt=> mkt.marketId === idofMarket);
		var newindex = lastOwned.findIndex(mkt=> mkt.marketId === idofMarket);
		
		if (oldindex == -1 && newindex != -1)
		{
			message = "New market. New risk: " + lastOwned[newindex].userInvestment + "\nBought in " + lastOwned[newindex].marketName + "\n" + message;
		}
		else if (newindex != -1 && oldindex != -1)
		{
			temp = lastOwned[newindex].userInvestment - oldcopy[oldindex].userInvestment;
			message = "Old market. New risk: " + temp + "\nBought in " + lastOwned[newindex].marketName + "\n" + message;
		}
		else if ( newindex != -1 && oldindex != -1 ) { 
			message = "No trade\n" + message + "\nLowest: " + lowest;
		}
		else if (newindex == -1 && oldindex != -1) {
			message = "This shouldnt show up\n" + message + "\nLowest: " + lowest;
		}
		else {
			message = "this REALLLy shouldnt show up\n" + message + "\nLowest: " + lowest;
		}
		bot.users.get(auth.owner).send(message);
		setTimeout(function(){
			process.exit();
		}, 7000);
	}, 2000);
};

function finalizeTrade(lowest, url) {
	var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
	var oReq = new XMLHttpRequest();
	var formData = [];
	formData.push('quantity',lowest);
	formData.push('pricePerShare',99);
	formData.push('contractId',url);
	formData.push('tradeType','0');
	
	var urlEncodedData = "";
	var urlEncodedDataPairs = [];

  // Turn the data object into an array of URL-encoded key/value pairs.
	for(var i = 0; i < 8; i += 2) {
		urlEncodedDataPairs.push(encodeURIComponent(formData[i]) + '=' + encodeURIComponent(formData[i+1]));
	}
	
	urlEncodedData = urlEncodedDataPairs.join('&').replace(/%20/g, '+');
	
	var temp = "Bearer " + access_token;
	
	oReq.open("POST", "https://www.predictit.org/api/Trade/SubmitTrade", true);
	oReq.setRequestHeader("Authorization", temp);
	oReq.addEventListener("load", verifytrade);
	oReq.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
	oReq.send(urlEncodedData);
	
	message += "bought " + lowest + " shares of " + url + "\n";
};

function verifytrade() {
	var mydata = JSON.parse(this.responseText);
	console.log("bought shares\n" + lowest);
};


function contractmaker(market) {
	//console.log(market.contracts);
	contracts = [];
	i = market.contracts.length - 1;
	while (i >= 0)
	{
		//console.log(i);
		contracts.push(market.contracts[i].id);
		i--;
	};
	//console.log(contracts);
	backupcontracts = contracts.slice(0);
	
	//build contracts from neg risk
	checkorderbook(contracts[contracts.length-1]);
};

function getPIdata () {
	try {
		var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
		var oReq = new XMLHttpRequest();
		oReq.addEventListener("load", checkneg);
		oReq.open("GET", "https://www.predictit.org/api/marketdata/all/");
		oReq.send();
	}
	catch (err) {
		console.log("error getting dem nom");
	} 
}

function checkneg() {
	var lastpi = JSON.parse(this.responseText);
	z = [];
	output = 0;
	for (increment in lastpi.markets)
	{
		//console.log(mydata.markets[increment].name);
		if (lastpi.markets[increment].contracts.length >= 2)
		{
			i = 0;
			for(innerinc in lastpi.markets[increment].contracts)
			{
				if (lastpi.markets[increment].contracts[innerinc].bestBuyNoCost == null)
					i += 0;
				else 
					i += (1 - lastpi.markets[increment].contracts[innerinc].bestBuyNoCost);
			}
			a = lastpi.markets[increment].contracts.length;
			if (a == 2) {
				if (i >= 1.06)
				{
					z.push(lastpi.markets[increment].name);
					output = 1;
				}
			}
			else if (a == 3) {
				if (i >= 1.08)
				{
					z.push(lastpi.markets[increment].name);
					output = 1;
				}							}
			else if (a == 4 || a == 5) {
				if (i >= 1.09)
				{
					z.push(lastpi.markets[increment].name);
					output = 1;
				}							}
			else if (a >= 5 && a <= 10) {
				if (i >= 1.10)
				{
					z.push(lastpi.markets[increment].name);
					output = 1;
				}							}
			else if (a > 10) {
				if (i >= 1.11)
				{
					z.push(lastpi.markets[increment].name);
					output = 1;
				}
			}
		}
	}
	//console.log(z);
	lat = [];
	negriskcounter = negriskcounter + 1;
	console.log(negriskcounter);
	if (currnegrisk == "" || negriskcounter == 80)
	{
		console.log(z.toString() + "is being added");
		currnegrisk = z.toString();
		negriskcounter = 0;
	}
	else if (output != 0) {
		for (inc in z)
		{
			if (!currnegrisk.includes(z[inc]))
			{
				console.log("adding " + z[inc] + " to " + currnegrisk);
				lat.push(z[inc]);
				currnegrisk = currnegrisk + " " +  z[inc].toString();
			}
		};
		//console.log("z: " + z);
		console.log("currnegrisk =" + currnegrisk);
		console.log(lat);
		if (lat != "")
		{
			console.log("starting print statement: " + lat);
			for (increment in lastpi.markets)
			{
				if (lat[0] == lastpi.markets[increment].name)
				{
					negrisktracker = 0;
					idofMarket = lastpi.markets[increment].id;
					lowest = 100;
					contractmaker(lastpi.markets[increment]);
					break;
				}
			}
		}
	};
};