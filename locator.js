var factory = require('./factory');
var _ = require('underscore');
var locator = require('./locator');
var util = require('./util');
var frontend = require('./frontend');
var events = require("events");
var EventEmitter = require("events").EventEmitter;

var dataPoints = {};
var persons = {};
var devices = {};
var sensors = {};
var datas = {};
var sensorsReference = null;
exports.persons = persons;
exports.devices = devices;
exports.sensors = sensors;
exports.dataPoints = dataPoints;
// TODO: test!
exports.start = function(){
	// Do initialization here, if any
};

exports.registerSensor = function(sensor){
    frontend.io.sockets.emit("refreshWebClientSensors", {});
    console.log('received sensor: ' +JSON.stringify(sensor));
    console.log("REFERENCE IS: " + sensorsReference);
    if(sensorsReference == null){
        //sensor.calibration = {Rotation: 0, TransformX: 0, TransformY: 0,xSpaceTransition:0,ySpaceTransition:0, StartingLocation: {X: 0, Y: 0, Z: 0}};
        sensor.isCalibrated = true;
        sensorsReference = sensor;
        console.log("setting default reference");
        sensors[sensor.socketID] = sensor;
    }
    else{
        sensors[sensor.socketID] = sensor;
    }
};

exports.calibrateSensors = function(sensorOnePoints, sensorTwoPoints){
    console.log("Calibrating sensors...")
    return util.getTranslationRule(sensorOnePoints[0], sensorOnePoints[1], sensorTwoPoints[0], sensorTwoPoints[1])
}


exports.removeIDsNoLongerTracked = function(socket, newListOfPeople){
    for(var key in persons){
        if(persons.hasOwnProperty(key)){
            // for all the keys in current person's ID list
            for(var IDkey in persons[key].ID){
                //if current sensor socket ID is exists in the current person's ID list, and this sensor ID doesn't exit in the new list of people
                if(persons[key].ID[IDkey] == socket.id && util.findWithAttr(newListOfPeople, "ID", IDkey) == undefined){
                    try{
                        if(persons[key].currentlyTrackedBy == persons[key].ID[IDkey] && Object.keys(persons[key].ID).length > 1){
                            console.log('Person :'+persons[key].uniquePersonID+' currentlyTrackedBy before: ' + persons[key].currentlyTrackedBy +' seen by: '+ JSON.stringify(persons[key].ID) + ' deleting : '+persons[key].ID[IDkey]);//persons[key].ID[Object.keys(persons[key].ID)[0]]);
                            delete persons[key].ID[IDkey];
                            persons[key].currentlyTrackedBy = persons[key].ID[Object.keys(persons[key].ID)[0]];//Object.keys(persons[key].ID)[0];
                            console.log('person ' + key + ' is changed to seen by: ' + persons[key].currentlyTrackedBy);
                        }else if (Object.keys(persons[key].ID).length = 1){
							console.log('->-> person: ' + persons[key].uniquePersonID + ' deleting: ' + persons[key].ID[IDkey]);
							delete persons[key].ID[IDkey];
						}

                    }
                    catch(err){
                        console.log("failed to update currentlyTrackedBy to new socket.id: " + err);
                    }

                }
            }
        }
        try{
            locator.removeUntrackedPeople();
        }
        catch(err){
            console.log("error trying to remove untracked people: " + err);
        }
    }
}

/*
 * Function that check if a string is empty
 * */
function isEmpty(str) {
    return (!str || 0 === str.length);
}

/*
*  Grab data from targetObject to requestObject
*
* **/
function grabDataInRange(requestObject,targetObject){
    var distance,dataRange;
    if(targetObject.data != undefined) {
        // if there exists data in side of an object, grab all the data
        distance = util.distanceBetweenPoints(requestObject.location,targetObject.location); // get distance between data and object
        for (var dataKey in targetObject.data) {
            if(targetObject.data.hasOwnProperty(dataKey)) {
                dataRange = targetObject.data[dataKey].range;
                            // get range of this point
                if (requestObject.data[dataKey] == undefined && distance <= dataRange) {
                    // if the data is not exited in the requestObject.
                    requestObject.data[dataKey] = targetObject.data[dataKey];
                    console.log('-> Object grabbed:' + JSON.stringify(requestObject.data[dataKey]) + ' From targetobject: ' + JSON.stringify(targetObject));
                }
            }
        }
    }
}
//*
// Request Object grab all the data from targetObject
// *//
function grabAllData(requestObject,targetObject){
    if(targetObject.data != undefined) {
        // if there exists data in side of an object, grab all the data
        for (var dataKey in targetObject.data) {
            if(targetObject.data.hasOwnProperty(dataKey)) {
                requestObject.data[dataKey] = targetObject.data[dataKey];
                console.log('-> Object grabbed:' + JSON.stringify(requestObject.data[dataKey]) + ' From targetobject: ' + JSON.stringify(targetObject));
            }
        }
    }
}


/**
 *  Drop data from current location of the requestsObject with a range
 *  if the location is within the range of
 *
 * */
exports.dropData = function(socket,requestObject,dropRange,fn){
    console.log('drop data request from: '+ JSON.stringify(requestObject));
    var dataPointCounter = 0;
    var dataPointsLength = Object.keys(dataPoints).length;
    if(requestObject.location!=undefined && dropRange != undefined && Object.keys(requestObject.data).length != 0){
        //var dropLocation = requestObject.location;
        for(var key in dataPoints) {
            if(dataPoints.hasOwnProperty(key)){
                // if reach the end of the dataPoints list
                    dataPointCounter ++;
                    console.log('Current DP: ' + JSON.stringify(dataPoints[key]));
                    console.log(dataPointCounter+ ' / '+ dataPointsLength);
                    var distance, dataPointDropRange;
                    dataPointDropRange = dataPoints[key].dropRange;              // get range of this point
                    console.log('->-> Calculating: ' + JSON.stringify(requestObject.location) + ' with DP:' + dataPoints[key].ID + ' location: ' + JSON.stringify(dataPoints[key].location));
                    distance = util.distanceBetweenPoints(requestObject.location, dataPoints[key].location); // get distance between data and object
                    if (distance <= dataPointDropRange) {
                        grabAllData(dataPoints[key], requestObject);    //dump the data once and return.
                        console.log('-> Dumping data to data point: ' + dataPoints[key].ID + ' since the distance: ' + distance + ' within dropRange: ' + dropRange);
                        if (fn != undefined) {
                            fn('dumping data to dataPoint ' + dataPoints[key].ID);
                        }
                        frontend.io.sockets.emit("refreshStationaryLayer", {}); // refresh the fronted layer
                        return;
                    }else if(dataPointCounter==dataPointsLength) {
                        var currentLocation = {X:requestObject.location.X,Y:requestObject.location.Y,Z:requestObject.location.Z};
                        locator.registerDataPoint(socket,{location:currentLocation,data:Object.keys(requestObject.data),dropRange:dropRange},fn); //dataPointInfo.location,socket.id,dataPointInfo.range,registerData
                    }

            }// end of hasOwnproperty
        }
        // if it is not in any dataPoints range

    }else{
        fn('Dump data requestObject is not well defined.');
    }
}

/*
* check all the data location and grab data if within range
*   param: object  -> can be people , devices , dataPoints
* **/
function grabDataFromDataPoints(object){
    //var distance;
    //var dataRange;
    for( var key in dataPoints){
        if(dataPoints.hasOwnProperty(key)){
            //dataRange = dataPoints[key].range;              // get range of this point
            //distance = util.distanceBetweenPoints(object.location,dataPoints[key].location); // get distance between data and object
            grabDataInRange(object,dataPoints[key]); // try to grab data from all the dataPoints
            //if(distance <= dataRange){
                // starting transfer data
                //var data = {dataPath:dataPoints[key].data};// copy data path from dataPoints to person;
                //grabDataInRange(object,dataPoints[key]);
            //}
        }
    }
}

exports.updatePersons = function(receivedPerson, socket){

    if(Object.keys(persons).length == 0){
        //nobody being tracked, add new person
        if(Object.keys(persons).indexOf(key) == Object.keys(persons).length - 1){
            //person was not found
            if(receivedPerson.ID != undefined && receivedPerson.location != undefined){ //if provided an ID and a location, update
                var person = new factory.Person(receivedPerson.ID, receivedPerson.location, socket);
                person.lastUpdated = new Date();
                person.currentlyTrackedBy = socket.id;
                person.gesture = receivedPerson.gesture;
                persons[person.uniquePersonID] = person;
				
            }
        }
    }
    else{
        //there are people being tracked, see if they match
        var counter = Object.keys(persons).length;
        var nearestDistance = 1000;
        for(var key in persons){
            counter --;
            if(persons.hasOwnProperty(key)){
                //console.log(persons[key].currentlyTrackedBy + " == " + socket.id)
                // the received the person's ID exists in a person's ID list AND this person is tracked by this sensor
                if(persons[key].ID[receivedPerson.ID] != undefined && persons[key].currentlyTrackedBy == socket.id){
                    //person found and updating person's new information nd device information
                    //console.log('Found and updating person :' + key);
                    try{
                        persons[key].location.X = receivedPerson.location.X.toFixed(3);
                        persons[key].location.Y = receivedPerson.location.Y.toFixed(3);
                        persons[key].location.Z = receivedPerson.location.Z.toFixed(3);
                        persons[key].lastUpdated = new Date();
                        persons[key].gesture = receivedPerson.gesture;
                        if(persons[key].ownedDeviceID != null){
                            devices[persons[key].ownedDeviceID].location.X = receivedPerson.location.X.toFixed(3);
                            devices[persons[key].ownedDeviceID].location.Y = receivedPerson.location.Y.toFixed(3);
                            devices[persons[key].ownedDeviceID].location.Z = receivedPerson.location.Z.toFixed(3);
                        }
                        grabDataFromDataPoints(persons[key]); // try to grab data if any data is within range
                    }
                    catch(err){
                        console.log("Error updating person: " + err)
                        //if null or cannot read for some other reason... remove null
                        if(persons[key] == null){
                            delete persons[key];
                        }
                    }
                    break;
                }
                // this person comes in with a new ID
                else{
                    //console.log('counter: '+counter);
                    //// updating the nearest person
					if(util.distanceBetweenPoints(persons[key].location, receivedPerson.location) < nearestDistance){
                        
                        nearestDistance= util.distanceBetweenPoints(persons[key].location, receivedPerson.location);

                        // reach the end of the people list
                        if(counter == 0){
							
                            // check if the nearest person is within the threshold, merge the person into the existing person
                            if(nearestDistance < 0.4 || persons[key].ID[receivedPerson.ID]!=undefined){
                                //nearestPerson.ID[receivedPerson.ID] = socket.id; // add the sensor ID to the the nearest person's ID
								
                                // if the sensor hasn't been registered to the person's seen-by-sensor list
                                if(persons[key].ID[receivedPerson.ID]==undefined){
                                    console.log('person '+persons[key].uniquePersonID+' is now tracked by ' + socket.id);
									locator.removeDuplicateInstancesOfTrackedPerson(persons[key].ID, receivedPerson.ID,socket)
                    
                                    console.log('merging person to '+persons[key].uniquePersonID+' with nearestDistance : ' + nearestDistance);
                                    persons[key].ID[receivedPerson.ID] = socket.id;
                                    persons[key].gesture = receivedPerson.gesture;
									console.log('->-> Person ID list ('+Object.keys(persons[key].ID).length+') with details: '+JSON.stringify(persons[key].ID));
                                }
                                //console.log('only updating nearest person');
                                
                                locator.removeUntrackedPeople();
                            }
                            else{
                                console.log('the distance off by '+ nearestDistance+  '. Register new person : ' + JSON.stringify(receivedPerson.location) +' by sensor :' + socket.id);
                                ///end of iterations, person not found and not near a tracked person
                                if(receivedPerson.ID != undefined && receivedPerson.location != undefined){ //if provided an ID and a location, update
                                    var person = new factory.Person(receivedPerson.ID, receivedPerson.location, socket);
                                    person.lastUpdated = new Date();
                                    person.currentlyTrackedBy = socket.id;
                                    person.gesture = receivedPerson.gesture;
                                    persons[person.uniquePersonID] = person;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};



exports.removeDuplicateInstancesOfTrackedPerson = function(personIDList,receivedPersonID,sensorSocket){
    // if received person is not in person's list
	if(personIDList[receivedPersonID]==undefined){
		// if the sensor socket.id exists
		var existingID = util.findKeyWithAttr(personIDList,sensorSocket.id);
		if(existingID!=null){
			console.log('-> Deleting '+existingID+'from' + JSON.stringify(personIDList));
			delete personIDList[existingID];
		}
	}
	/*for(var key in personIDList){
		if(personIDList.hasOwnProperty(key)){
			//if(util.findKeyWithAttr(personIDList,))
			
		}
	}*/
}
/*
exports.removeDuplicateInstancesOfTrackedPerson = function(uniquePersonID, personID){
    for(var key in persons){
        // for all the people other than this person
        if(key != uniquePersonID){
            // for all the keys in the person's ID list
            for(var IDkey in persons[key].ID){
                if(IDkey == personID){
                    delete persons[key].ID[IDkey];
                    console.log('removing '+personID+' from uniquePersonID: ' + uniquePersonID);
                }
            }
        }
        try{
            locator.removeUntrackedPeople();
        }
        catch(err){
            console.log("error while trying to remove untracked people after checking for duplicate instances of tracked people: \n" + err);
        }
    }
}
*/
exports.pairDevice = function(deviceSocketID, uniquePersonID,socket){
    var statusMsg = "Device Socket ID: " + deviceSocketID +
        "\nPerson ID: " + uniquePersonID;

    if(devices[deviceSocketID] != undefined && persons[uniquePersonID] != undefined){
        if(devices[deviceSocketID].pairingState == "unpaired" && persons[uniquePersonID].pairingState == "unpaired"){
            devices[deviceSocketID].ownerID = uniquePersonID;
            devices[deviceSocketID].pairingState = "paired";
            persons[uniquePersonID].ownedDeviceID = deviceSocketID;
            persons[uniquePersonID].pairingState = "paired";
            statusMsg += "\n Pairing successful.";
        }
        else{
            statusMsg += "\nPairing attempt unsuccessful";
            if(devices[deviceSocketID].pairingState != "unpaired"){
                statusMsg += "Device unavailable for pairing.";
            }
            if(persons[uniquePersonID].pairingState != "unpaired"){
                statusMsg += "Person unavailable for pairing.";
            }
        }
    }
    else{
            statusMsg += "Pairing attempt unsuccessful. One or both objects were not found.";
    }
    socket.send(JSON.stringify({"status": statusMsg, "ownerID": uniquePersonID}));
}

//tested
exports.printPersons = function(){
	console.log("People tracked: ");
    var output;
    console.log(persons);
    try{
        console.log("There are "+object.keys(persons).length+" people in this view."); // adding sensor ID if possible

        for(var key in persons){
            if(persons.hasOwnProperty(key)){
                console.log("The "+object.keys(persons).indexOf(key)+"th Person --> "
                    + JSON.stringify(persons[key], null, 2));
                console.log(JSON.stringify(persons[key].uniquePersonID))
            }
        }
    }
    catch(err){
        console.log("Error printing people: " + err);
        return false;
    }
	console.log("///////////////////////////////////////////////////////////////");
    return true;
}

exports.setPairingState = function(deviceSocketID){
    if(devices[deviceSocketID] != null){
        devices[deviceSocketID].pairingState = "pairing";
    }
}

exports.unpairDevice = function(deviceSocketID){
    if(devices[deviceSocketID] != undefined){
        if(devices[deviceSocketID].ownerID != null){
            try{
                persons[devices[deviceSocketID].ownerID].pairingState = "unpaired";
                persons[devices[deviceSocketID].ownerID].ownedDeviceID = null;
                persons[devices[deviceSocketID].ownerID].orientation = null;
            }
            catch(err){
                console.log(err + "\tError unpairing device > removing person associations > most likely person does not exist?")
            }
        }
        try{
            devices[deviceSocketID].pairingState = "unpaired";
            devices[deviceSocketID].location.X = null;
            devices[deviceSocketID].location.Y = null;
            devices[deviceSocketID].location.Z = null;
            devices[deviceSocketID].ownerID = null;
        }
        catch(err){
            console.log(err + "\tError resetting pairing state of device, possibly device is not tracked anymore?")
        }

    }
}
exports.unpairAllDevices = function(){
    for(var key in devices){
        if(devices.hasOwnProperty(key)){
            locator.unpairDevice(key);
        }
    }
}

exports.printDevices = function(){
    console.log("devices tracked: ");
    try{
        for(var key in devices){
            if(devices.hasOwnProperty(key)){
                console.log(JSON.stringify(devices));
            }
        }
    }
    catch(err){
        console.log("Error printing devices: " + err);
        return false;
    }
    console.log("///////////////////////////////////////////////////////////////");
    return true;
}

exports.updateDeviceOrientation = function(orientation, socket){
    if(devices[socket.id] != undefined){
        try{
            devices[socket.id].orientation = orientation;
            devices[socket.id].lastUpdated = new Date();
            if(devices[socket.id].ownerID != null){
                persons[devices[socket.id].ownerID].orientation = orientation;
            }
        }
        catch(err){
            //if null or cannot read for some other reason... remove null
            if(devices[socket.id] == null){
                delete devices[socket.id]
            }
        }
    }
    else{
        if(orientation != undefined){
            var device = new factory.Device(socket);
            device.orientation = orientation;
            device.lastUpdated = new Date();
            devices[socket.id] = device;
        }
    }
}

exports.unpairAllPeople = function(){
    for(var key in persons){
        if(persons.hasOwnProperty(key)){
            locator.unpairPerson(key);
        }

    }
}

exports.unpairPerson = function(socketID){
    try{
        if(persons[socketID] != null){
            console.log("Unpairing person with ID: " + socketID);
            persons[socketID].pairingState = 'unpaired';
            persons[socketID].ownedDeviceID = null;
            persons[socketID].orientation = null;
        }
    }
    catch(err){
        console.log("Error unpairing persion: " + err);
    }
    if(persons[socketID].ownedDeviceID != null){
        try{
            devices[persons[socketID].ownedDeviceID].location = {X: null, Y: null, Z: null};
            devices[persons[socketID].ownedDeviceID].pairingState = "unpaired";
            devices[persons[socketID].ownedDeviceID].ownerID = null;
        }
        catch(err){
            console.log(err + "\tError unpairing persons > removing device associations > most likely device does not exist?")
        }

    }
}

exports.removeUntrackedPeople = function(){
    for(var key in persons){
        if(persons.hasOwnProperty(key)){
            if(Object.keys(persons[key].ID).length === 0){
                delete persons[key];
            }
        }
    }
}


/*
*   clean up the dataPoints that is disconnected
* */
exports.cleanUpDataPoint = function(socketID){
    // simply delete this data point for now
    for(var key in dataPoints){
        if(dataPoints.hasOwnProperty(key) && dataPoints[key].socketID == socketID){
            console.log('-> dataPoints Client: '+ key+' has been cleaned');
            // clean up the dataPoints that is disconnected
            delete locator.dataPoints[key];
        }
    }

    //refresh visualizer
    frontend.io.sockets.emit("refreshStationaryLayer", {});
}

exports.cleanUpDevice = function(socketID){
    var personID = devices[socketID].ownerID;
    if(devices[socketID].pairingState == "paired" && personID != null){
        if(persons[personID] != undefined){
            persons[personID].ownedDeviceID = null;
            persons[personID].pairingState = "unpaired";
            persons[personID].orientation = null;
        }
        else{
            //person is no longer tracked
        }
    }

    delete devices[socketID];
    frontend.io.sockets.emit("refreshStationaryLayer", {});
}

exports.cleanUpSensor = function(socketID){
    frontend.io.sockets.emit("refreshWebClientSensors", {});
    delete sensors[socketID];
    var counter = Object.keys(persons).length;

    for(var key in persons){
        counter--;
        if(persons.hasOwnProperty(key)){
            for(var IDkey in persons[key].ID){
                if(persons[key].ID.hasOwnProperty(IDkey)){
                    if(persons[key].ID[IDkey] == socketID){
                        delete persons[key].ID[IDkey];
                        if(counter == 0){
                            locator.removeUntrackedPeople();
                        }
                    }
                }
            }
        }
    }

    /////
    if(sensorsReference.socketID == socketID){
        if(Object.keys(sensors).filter(function(key){return(sensors[key].isCalibrated)}).length > 0){
            var secondCalibratedSensor = sensors[Object.keys(sensors).filter(function(key){return(sensors[key].isCalibrated)})[0]];
            // set the second calibrat
            secondCalibratedSensor.isCalibrated = true;
            secondCalibratedSensor.calibration = secondCalibratedSensor.calibration; //{Rotation: 0, TransformX: 0, TransformY: 0,xSpaceTransition:0,ySpaceTransition:0, StartingLocation: {X: 0, Y: 0, Z: 0}};
            sensorsReference = secondCalibratedSensor;
            console.log('Reference sensor is set to ' + JSON.stringify(sensorsReference));
        }
        else{
                if(Object.keys(sensors).length != 0){
                    sensors[Object.keys(sensors)[0]].isCalibrated = true;
                    sensorsReference = sensors[Object.keys(sensors)[0]]
                }
                else{
                    sensorsReference = null;
                }
        }
    }
    else{
        console.log("All good, removed sensor is not reference");
    }
}
/*
    Update a registered device with a new device info
 */
exports.updateDevice = function(socket,deviceInfo,fn){

    if(devices[socket] != undefined){
        console.log('Updating Device ' + devices[socket].uniqueDeviceID +' with device info: '+JSON.stringify(deviceInfo));
        for(var key in deviceInfo){
            devices[socket][key] = deviceInfo[key];
        }
    }else{
        console.log("got a device update request but the device hasn't been registered yet");
    }

    if(fn!=undefined){
        fn(devices[socket]);
    }
}
/*
*  Update the data with new information
* */
exports.updateData = function(ID,dataInfo,fn){
    for(var key in dataInfo){
        if(dataInfo.hasOwnProperty(key)){

        }
    }
}


/*
* Registering data with data info
*
* */
exports.registerData = function (dataInfo,fn){
    //console.log('received data: ' + JSON.stringify(dataInfo));
    try{
        if(datas[dataInfo.name]==undefined){
            var newData = new factory.data(dataInfo.name,dataInfo.type,dataInfo.dataPath,dataInfo.range);
            datas[newData.name] = newData;
            console.log('-> registered data: '+ JSON.stringify(datas[newData.name]));
        }else{
            console.log('-> '+ dataInfo.name+  ' has been registered');
        }
    }catch(err){
        console.log('Unable to register data due to: '+ err);
    }
}



 /*
*   Registering dataPoint with dataPoint info
* */
exports.registerDataPoint = function(socket,dataPointInfo,fn){
    console.log('received dataPoint' + JSON.stringify(dataPointInfo));
    var registerData = {};
    try{
        var registerData;
        dataPointInfo.data.forEach(function(dataName){
            registerData[dataName]=datas[dataName];
        })
        console.log('register data: ' + JSON.stringify(registerData));
        var dataPoint = new factory.dataPoint(dataPointInfo.location,socket.id,dataPointInfo.dropRange,registerData);
        frontend.clients[socket.id].clientType = "dataPointClient";
        dataPoints[dataPoint.ID] = dataPoint; // reigster dataPoint to the list with its ID as its key
        console.log('all data points: ' +JSON.stringify(dataPoints));
        if(fn!=undefined){
            fn(dataPoints[socket.id]);
        }
        // fresh visualizer
        frontend.io.sockets.emit("refreshStationaryLayer", {});
    }catch(err){
        console.log('failed registering data point due to: '+err);
    }

}
exports.registerDevice = function(socket, deviceInfo,fn){
    if(devices[socket.id] != undefined){
        devices[socket.id].height = deviceInfo.height;
        devices[socket.id].width = deviceInfo.width;
        devices[socket.id].deviceType = deviceInfo.deviceType;

        console.log("Device initiated late, updating height and width");
    }
    else{
        // if client is running on server side, the socket IP will be localhost ip
        // here to set that to actual server IP
        var socketIP;
        if(socket.handshake.address.address=='127.0.0.1' && frontend.serverAddress!=undefined){
            console.log(socket.handshake.address.address+' --> ' + frontend.serverAddress);
            socketIP = frontend.serverAddress;
        }else{
            socketIP = socket.handshake.address.address;
        }
        console.log("IP: "+socketIP);
        //console.log('got deviceInfo.ID'+ deviceInfo.ID);
        var device = new factory.Device(socket, {ID: deviceInfo.ID, orientation: deviceInfo.orientation});
        if(deviceInfo.name != null && deviceInfo.name != undefined){
            device.name = deviceInfo.name;
        }
        else{
            device.name = "Device " + device.ID;
        }
        if (fn != undefined) {
            console.log('callback with' + {deviceID:device.uniqueDeviceID,socketID:socket.id});
            fn({deviceID:device.uniqueDeviceID,socketID:socket.id,currentDeviceNumber:Object.keys(locator.devices).length});
        }


        device.height = deviceInfo.height;
        device.width = deviceInfo.width;
        device.deviceType = deviceInfo.deviceType;
        device.FOV = deviceInfo.FOV;
        device.lastUpdated = new Date();
        device.deviceIP = socketIP;
        // for station
        if(deviceInfo.stationary == true){
            device.stationary = deviceInfo.stationary;
            device.location = {X: deviceInfo.locationX, Y: deviceInfo.locationY, Z: deviceInfo.locationZ}
            frontend.io.sockets.emit("refreshStationaryLayer", {});
        }
        // JSclient may register deivce with location as well.
        if(deviceInfo.location!=undefined){
            device.location = {X: deviceInfo.location.X, Y: deviceInfo.location.Y, Z: deviceInfo.location.Z}
        }


        devices[socket.id] = device; // officially register the device to locator(server)
        console.log("Registering device: " + JSON.stringify(device));
        console.log('emitting registered device ID : '+ deviceInfo.ID);
        frontend.clients[socket.id].emit('registered',{deviceID:deviceInfo.ID});
    }
}

// TODO: implement!
// TODO: test!
exports.getDevicesInView = function(observerSocketID, devicesInFront){
    //console.log("devicesInFront: " + JSON.stringify(devicesInFront));
	// TODO: test
    //console.log(devices[observerSocketID]);
	//var returnDevices = {};
    var returnDevices = {};
    var observerLineOfSight = factory.makeLineUsingOrientation(devices[observerSocketID].location, devices[observerSocketID].orientation);
    for(var i = 0; i <= devicesInFront.length; i++){

        if(i == devicesInFront.length){
            return returnDevices;
        }
        else{
            if(devices[devicesInFront[i]]!= undefined){
                if(devices[devicesInFront[i]].width != null){
                    var sides = util.getLinesOfShape(devices[devicesInFront[i]]);
                    var intersectionPoints = [];
                    //console.log("Sides: " + JSON.stringify(sides))

                    sides.forEach(function(side){
                        var intPoint = util.getIntersectionPoint(observerLineOfSight, side);
                        if(intPoint != null){
                            console.log("Added an intersection point")
                            intersectionPoints.push(intPoint);
                        }
                    });

                    if(intersectionPoints.length != 0){
                        console.log("intersection points not empty");
                        //this.continue;
                        var nearestPoint = intersectionPoints[0];
                        var shortestDistance = util.distanceBetweenPoints(devices[observerSocketID].location, nearestPoint);

                        intersectionPoints.forEach(function(point){
                            var distance = util.distanceBetweenPoints(devices[observerSocketID].location, point);
                            if(distance < shortestDistance){
                                nearestPoint = point;
                                shortestDistance = distance;
                            }
                        });

                        var ratioOnScreen = util.GetRatioPositionOnScreen(devicesInFront[i], nearestPoint);

                        devices[devicesInFront[i]].intersectionPoint.X = ratioOnScreen.X;
                        devices[devicesInFront[i]].intersectionPoint.Y = ratioOnScreen.Y;
                        console.log("Pushed a target for sending!");
                        returnDevices[devicesInFront[i]] = devices[devicesInFront[i]];
                    }
                }
            }
            else{
                console.log("devices:\n " + JSON.stringify(devices))
                console.log("devicesInFront:\n " + JSON.stringify(devicesInFront));
                console.log("i:\n " + JSON.stringify(i));
            }

        }
    };
}

// TODO: implement!
// TODO: test!
exports.getDevicesInFront = function(observerSocketID, deviceList){
	// TODO: implement!
	// List<Device> returnDevices = new List<Device>();
    var observer = devices[observerSocketID];
    var returnDevices = [];

    //(CB - Should we throw an exception here? Rather then just returning an empty list?)
    try{
        if (observer.location == null || observer.orientation == null)
             return returnDevices;
         if (observer.FOV == 0.0)
             return returnDevices;
    }
    catch(err){
        console.log("Error getting devices in front of device " + devices[observerSocketID].uniqueDeviceID + ": " + err);
    }

	// // We imagine the field of view as two vectors, pointing away from the observing device. Targets between the vectors are in view.
	// // We will use angles to represent these vectors.
    try{
        //get the angle to sens
        var angleToSensor =util.getPersonOrientation(observer.location.X,observer.location.Z);
        var leftFieldOfView = util.normalizeAngle(360 - observer.orientation  - 90 - angleToSensor+ 15);
        var rightFieldOfView = util.normalizeAngle(360 - observer.orientation  - 90 -angleToSensor- 15);

        //console.log("Left FOV = " + leftFieldOfView)
        //console.log("Right FOV = " + rightFieldOfView)

        return Object.keys(deviceList).filter(function(key){
            //var angle = util.normalizeAngle(Math.atan2(devices[key].location.Y - observer.location.Y, devices[key].location.X - observer.location.X) * 180 / Math.PI);


            if(deviceList[key] != observer && deviceList[key].location != undefined){
                if (leftFieldOfView > rightFieldOfView &&
                    (util.normalizeAngle(Math.atan2(deviceList[key].location.Z - observer.location.Z, deviceList[key].location.X - observer.location.X) * 180 / Math.PI)) < leftFieldOfView &&
                    (util.normalizeAngle(Math.atan2(deviceList[key].location.Z - observer.location.Z, deviceList[key].location.X - observer.location.X) * 180 / Math.PI)) > rightFieldOfView){
                    return true;
                }
                else if (leftFieldOfView < rightFieldOfView)
                {
                    if ((util.normalizeAngle(Math.atan2(deviceList[key].location.Z - observer.location.Z, deviceList[key].location.X - observer.location.X) * 180 / Math.PI)) < leftFieldOfView ||
                        (util.normalizeAngle(Math.atan2(deviceList[key].location.Z - observer.location.Z, deviceList[key].location.X - observer.location.X) * 180 / Math.PI)) > rightFieldOfView){
                        return true;
                    }
                }
            }
        })
    }
    catch(err){
        console.log("Error getting devices in front of device " + devices[observerSocketID].uniqueDeviceID + ": " + err);
    }
}

// TODO: test!
exports.getNearestDevice = function (observer, listDevices) {
    //recursive function to return nearest device, given an observer and a list of devices to compare
    var compareNextDeviceInList = function (keyIndexOfDeviceList, currentClosestDevice) {
        //if not end of recursion
        if (keyIndexOfDeviceList >= 0) {
            if(listDevices[Object.keys(listDevices)[keyIndexOfDeviceList]].uniqueDeviceID == observer.uniqueDeviceID){
                return compareNextDeviceInList(keyIndexOfDeviceList - 1, currentClosestDevice);
            }
            else{
                //first call passes null as currentClosestDevice, pick device from list as currentClosestDevice
                if (currentClosestDevice == null) {
                    return compareNextDeviceInList(keyIndexOfDeviceList - 1, listDevices[Object.keys(listDevices)[keyIndexOfDeviceList]])
                }

                //if device in list is closer to observer than currentClosestDevice, replace currentClosestDevice with device in list
                else if (util.distanceBetweenPoints(listDevices[Object.keys(listDevices)[keyIndexOfDeviceList]].location, observer.location) <
                    util.distanceBetweenPoints(currentClosestDevice.location, observer.location)) {
                    return compareNextDeviceInList(keyIndexOfDeviceList - 1, listDevices[Object.keys(listDevices)[keyIndexOfDeviceList]]);
                }
                //currentClosestDevice is closer to observer than device in list, no change
                else {
                    return compareNextDeviceInList(keyIndexOfDeviceList - 1, currentClosestDevice);
                }
            }
        }
        //end of recursion
        else {
            if(currentClosestDevice == null){
                return {};
            }
            else{
                var container = {};
                container[currentClosestDevice.socketID] = currentClosestDevice;
                return container;
            }
        }
    }

    return compareNextDeviceInList(Object.keys(listDevices).length - 1, null)
};

// TODO: test!
exports.getDevicesWithinRange = function (observer, maxRange, listDevices) {

    var filterDeviceListByRange = function (keyIndexOfDeviceList, listDevicesToReturn) {
        if (keyIndexOfDeviceList >= 0) {
            if(listDevices[Object.keys(listDevices)[keyIndexOfDeviceList]].uniqueDeviceID == observer.uniqueDeviceID){
                return filterDeviceListByRange(keyIndexOfDeviceList - 1, listDevicesToReturn);
            }
            else if (util.distanceBetweenPoints(listDevices[Object.keys(listDevices)[keyIndexOfDeviceList]].location, observer.location) > maxRange) {
                console.log(util.distanceBetweenPoints(listDevices[Object.keys(listDevices)[keyIndexOfDeviceList]].location, observer.location));
                console.log(maxRange);
                return filterDeviceListByRange(keyIndexOfDeviceList - 1, listDevicesToReturn);
            }
            else {
                //check to see list is modified before sending as param in return recursive call
                listDevicesToReturn[Object.keys(listDevices)[keyIndexOfDeviceList]] = listDevices[Object.keys(listDevices)[keyIndexOfDeviceList]];
                return filterDeviceListByRange(keyIndexOfDeviceList - 1, listDevicesToReturn);
            }
        }
        //end of recursion
        else {
            return listDevicesToReturn;
        }
    }


    return filterDeviceListByRange(Object.keys(listDevices).length-1, {});
};
/*
* get all the devices that is been paried
* **/
exports.getPairedDevice = function(listDevices){
    var pairedDevices = {};
    if(Object.keys(listDevices).length!=0){
        for(var key in devices){
            if(devices.hasOwnProperty(key) && listDevices[key].pairingState == 'paired'){
                pairedDevices[key] = devices[key];
            }
        }
    }
    return pairedDevices;
}

exports.getDeviceByID = function (ID){
    try{
        var container = {};

        if(ID != undefined){
            if(devices[util.getDeviceSocketIDByID(ID)] != undefined){
                container[util.getDeviceSocketIDByID(ID)] = devices[util.getDeviceSocketIDByID(ID)];
                return container;
            }
            else{
                //no device with that ID
                return {};
            }
        }
        else{
            //ID undefined
            return {};
        }
    }
    catch(err){
        console.log('Error trying to get single device with ID(' + ID + '): ' + err);
    }
}
