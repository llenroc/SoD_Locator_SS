

var calibrationFrames = {};
var sensorOnePoints = [];
var sensorTwoPoints = [];
var sensors = {};
var depthArrays = {};

var referenceSensorCalibration;

/*
 take a location from sub-kinect and translate to the location to the MASTER kinect
 @param:
 location        -- the location of a point from the sub-kinect
 translateRules  -- the rules each sub-kinect has for translate the points in its plane to the MASTER-kinect
 @return:
 rotatedPoint    -- the translated location of point in the subKinect to the MASTER kinect
 */
function translateToCoordinateSpace(location, translateRules) {
    function getVector(locationA, locationB) {
        //console.log('locationA: '+ JSON.stringify(locationA.X));
        //console.log('locationB: '+ JSON.stringify(locationB.X));
        return {X: locationB.X - locationA.X, Y: 0, Z: locationB.Z - locationA.Z};
        //typeof callback === 'function' && callback();
    };

    function matrixTransformation(personLocation, angle) {
        var returnLocation = {X: 0, Y: 0, Z: 0};
        var returnX = personLocation.X * Math.cos(angle * DEGREES_TO_RADIANS) + personLocation.Z * Math.sin(angle * DEGREES_TO_RADIANS);
        var returnZ = personLocation.Z * Math.cos(angle * DEGREES_TO_RADIANS) - (personLocation.X * Math.sin(angle * DEGREES_TO_RADIANS));
        returnLocation.X = Math.round(returnX * this.ROUND_RATIO) / this.ROUND_RATIO;
        returnLocation.Z = Math.round(returnZ * this.ROUND_RATIO) / this.ROUND_RATIO;
        return returnLocation; // for testing
    };
    console.log('location: '+ JSON.stringify(location));
    console.log('translateRules: '+ JSON.stringify(translateRules));
    var vectorToStartingPoint = getVector(translateRules.StartingLocation, location);
    var rotatedPoint = matrixTransformation(vectorToStartingPoint, translateRules.Rotation);
    rotatedPoint.X += translateRules.TransformX + translateRules.StartingLocation.X;
    rotatedPoint.Z += translateRules.TransformY + translateRules.StartingLocation.Z;
    console.log('traslated point : ' + JSON.stringify(rotatedPoint));
    return rotatedPoint;
};


function getPosition(canvasID, sid, event)
{

    var rect = document.getElementById(canvasID).getBoundingClientRect();
    var xInPixels = event.x - rect.left;
    console.log('rect.left : ' + rect.left+ '\trect.top: '+rect.top);
    var y = event.y - rect.top;
    // this Z value is actully very close to reality value O_O
    var z = depthArrays[sid][Math.round(xInPixels+(y*sensors[sid].frameWidth))];//depthArrays[sid][xInPixels+(y*sensors[sid].frameWidth)];
    console.log('z: '+ z);

    console.log('event.x: '+ event.x + '\tevent.y: ' + event.y);
    var xInMM;
    if(sensors[sid].sensorType == "Kinect2"){
        var zForCalc = z*10;
        xInMM = 2*(event.x - rect.left-(sensors[sid].frameWidth/2))/(sensors[sid].frameWidth)*(zForCalc>>>3)*(Math.tan(sensors[sid].FOV/2))
    }


    //z = z/10;
    //console.log("xInMM :" + xInMM);

    var pointFromDepthFrame;
    var translatedPoint;
    if(canvasID == "cnvSensorOne"){
        if(sensorOnePoints.length < 2 && z > 0){
            pointFromDepthFrame = {X: xInMM, Y: y, Z: z};
            translatedPoint = translateToCoordinateSpace(pointFromDepthFrame,referenceSensorCalibration)
            sensorOnePoints.push(translatedPoint);
            showGreenStatus('Points saved.');
        }else if(sensorOnePoints.length >= 2){
            showRedStatus('Enough Points.');
        }else if(z<=0){
            showRedStatus('Depth is out of range, please choose another point!');
        }

        //console.log("sensorOnePoints: "+ JSON.stringify(sensorOnePoints));
        if(sensorOnePoints.length==1){
            $( 'input[name=master_point1X]' ).val(JSON.stringify(Math.round(sensorOnePoints[0].X*ROUND_RATIO)/ROUND_RATIO));
            $( 'input[name=master_point1Y]' ).val(JSON.stringify(Math.round(sensorOnePoints[0].Z*ROUND_RATIO)/ROUND_RATIO));
        }else if(sensorOnePoints.length==2){
            $( 'input[name=master_point2X]' ).val(JSON.stringify(Math.round(sensorOnePoints[1].X*ROUND_RATIO)/ROUND_RATIO));
            $( 'input[name=master_point2Y]' ).val(JSON.stringify(Math.round(sensorOnePoints[1].Z*ROUND_RATIO)/ROUND_RATIO));
        }else if(z<=0){
            showRedStatus('Depth is out of range, please choose another point!');
        }
    }
    else if(canvasID == "cnvSensorTwo"){
        if(sensorTwoPoints.length < 2 && z > 0){
            sensorTwoPoints.push({X: xInMM, Y: y, Z: z});
            showGreenStatus('Points Saved');
        }else if(sensorTwoPoints.length >= 2) {
            showRedStatus('Enough points.');
        }
        //$('#sensorTwoStatus').html(JSON.stringify(sensorTwoPoints));
        if(sensorTwoPoints.length==1){
            $( 'input[name=sensor_point1X]' ).val(JSON.stringify(Math.round(sensorTwoPoints[0].X*ROUND_RATIO)/ROUND_RATIO));
            $( 'input[name=sensor_point1Y]' ).val(JSON.stringify(Math.round(sensorTwoPoints[0].Z*ROUND_RATIO)/ROUND_RATIO));
        }else if(sensorTwoPoints.length==2){
            $( 'input[name=sensor_point2X]' ).val(JSON.stringify(Math.round(sensorTwoPoints[1].X*ROUND_RATIO)/ROUND_RATIO));
            $( 'input[name=sensor_point2Y]' ).val(JSON.stringify(Math.round(sensorTwoPoints[1].Z*ROUND_RATIO)/ROUND_RATIO));
        }else if(z<=0){
            showRedStatus('Depth is out of range, please choose another point!')
        }
    }



    /*
        var xInMM = 2*(event.x - rect.left-(sensors[sid].frameWidth/2))/(sensors[sid].frameWidth)*(z>>>3)*(Math.tan(sensors[sid].FOV/2))
        //console.log("xInMM :" + xInMM);


        if(canvasID == "cnvSensorOne"){
            if(sensorOnePoints.length < 2 && z > 0){
                sensorOnePoints.push({X: xInMM, Y: y, Z: z >>> 3});
               showGreenStatus('Points saved.');
            }else if(sensorOnePoints.length >= 2){
                showRedStatus('Enough Points.');
            }else if(z<=0){
                showNormalStatus('Depth is out of range, please choose another point!');
            }

            //console.log("sensorOnePoints: "+ JSON.stringify(sensorOnePoints));
            if(sensorOnePoints.length==1){
                $( 'input[name=master_point1X]' ).val(JSON.stringify(Math.round(sensorOnePoints[0].X*ROUND_RATIO)/ROUND_RATIO));
                $( 'input[name=master_point1Y]' ).val(JSON.stringify(Math.round(sensorOnePoints[0].Z*ROUND_RATIO)/ROUND_RATIO));
            }else if(sensorOnePoints.length==2){
                $( 'input[name=master_point2X]' ).val(JSON.stringify(Math.round(sensorOnePoints[1].X*ROUND_RATIO)/ROUND_RATIO));
                $( 'input[name=master_point2Y]' ).val(JSON.stringify(Math.round(sensorOnePoints[1].Z*ROUND_RATIO)/ROUND_RATIO));
            }else{
                showRedStatus("Wrong Number of Points for Sensor 1");
            }
        }
        else if(canvasID == "cnvSensorTwo"){
            if(sensorTwoPoints.length < 2 && z > 0){
                sensorTwoPoints.push({X: xInMM, Y: y, Z: z >>> 3});
                $('.status').html("<span class='green_status'>Point saved!</span>");
                $('.green_status').fadeIn(600);
            }else if(sensorTwoPoints.length >= 2){
                $('.status').html("<span class='red_status'>Enough Points.</span>");
                $('.red_status').fadeIn(600);
            }else if(z<=0){
                $('.status').html("<span class='red_status'>Depth is out of range, please choose another point!</span>");
                $('.red_status').fadeIn(600);
            }
            //$('#sensorTwoStatus').html(JSON.stringify(sensorTwoPoints));
            if(sensorTwoPoints.length==1){
            $( 'input[name=sensor_point1X]' ).val(JSON.stringify(Math.round(sensorTwoPoints[0].X*ROUND_RATIO)/ROUND_RATIO));
            $( 'input[name=sensor_point1Y]' ).val(JSON.stringify(Math.round(sensorTwoPoints[0].Z*ROUND_RATIO)/ROUND_RATIO));
            }else if(sensorTwoPoints.length==2){
            $( 'input[name=sensor_point2X]' ).val(JSON.stringify(Math.round(sensorTwoPoints[1].X*ROUND_RATIO)/ROUND_RATIO));
            $( 'input[name=sensor_point2Y]' ).val(JSON.stringify(Math.round(sensorTwoPoints[1].Z*ROUND_RATIO)/ROUND_RATIO));
            }else{
                showRedStatus("Wrong Number of Points for Sensor 2");
            }

        }

    */
}

// clear the select options
function clearSelect(IDElement){
    $(IDElement).empty();
}


function refreshSensors(){
    clearSelect("#referenceSensorList");
    clearSelect("#uncalibratedSensorList");
    //$("#referenceSensorList").empty();
    //$("#uncalibratedSensorList").empty();
    var referenceSensorList = document.getElementById("referenceSensorList");
    var uncalibratedSensorList = document.getElementById("uncalibratedSensorList");
    io.emit('getSensorsFromServer', {}, function(data){
        sensors = {};
        //var referenceSensorList = document.getElementById("referenceSensorList")
        //var uncalibratedSensorList = document.getElementById("uncalibratedSensorList")
        //console.log("there are "+Object.keys(data).length + " sensors in the server.");
        for(var key in data){
            if(data.hasOwnProperty(key)){
                sensors[key] = data[key];
                var option = document.createElement("option");
                option.text = data[key].ID;
                //option.text = data[key].socketID;
                $('select[name=referenceSensorList] option:eq(0)').attr('selected', 'selected');
                //console.log('adding option: '+option.text + ' to uncalibrtedSensorList');
                if(uncalibratedSensorList!=null && uncalibratedSensorList!=undefined){
                    uncalibratedSensorList.add(option);
                }
                //console.log('referenceSelected: ' + ($('select[name=referenceSensorList] option:selected').text()));
                if(data[key].isCalibrated == true){
                    var option2 = document.createElement("option");
                    option2.text=data[key].ID
                    //option2.text = data[key].socketID;
                    if(referenceSensorList!=null && referenceSensorList!=undefined){
                        referenceSensorList.add(option2);
                    }
                }

            }
            // automaticly select uncalibratedSensorList to the second sensors

        }
        $('select[name=uncalibratedSensorList] option:eq(1)').attr('selected', 'selected');
    });
}

//io = io.connect()
io.on("connect", function(){
    io.emit("registerWebClient", {});
});

io.on("anything", function(data){
    $('.status').html("MESSAGE RECEIVED: " + data);
})

//data is the frame data from sensor
io.on("setCalibrationFrame", function(data){

    //check if data was sent from reference sensor or the sensor selected to be calibrated
    if(calibrationFrames["reference"] == data.sourceID || calibrationFrames["uncalibrated"] == data.sourceID){
        depthArrays[data.sourceID] = data.payload;
        var depthMultiplier;
        if(sensors[data.sourceID].sensorType == "Kinect1"){
            depthMultiplier = 7000;
        }
        else{
            depthMultiplier = 5;//how is this
        }


        // if the frame data is from reference sensor
        if(calibrationFrames["reference"] == data.sourceID){
            //empty the canvas before drawing them.
            $('#reference_wrap').empty();
            $('#clear_master_points').trigger('click');
            $('#reference_wrap').html('<canvas id="cnvSensorOne" width="640" height="480"style="z-index: 4;"></canvas>');
            var canvas = document.getElementById("cnvSensorOne");
            var ctx = canvas.getContext("2d");
            ctx.clearRect(0,0,canvas.width,canvas.height);
            // draw the data based on the kinect frameWidth and frame hight
            var bytearray = new Uint8Array(data.payload);
            var imgdata = ctx.getImageData(0,0, sensors[data.sourceID].frameWidth, sensors[data.sourceID].frameHeight);
            ctx.canvas.width = sensors[data.sourceID].frameWidth;
            ctx.canvas.height = sensors[data.sourceID].frameHeight;
            var imgdatalen = imgdata.data.length;
            //payload is where the frame array data stored.
            for(var i=0;i<(imgdatalen/4);i++){
                var depth = (data.payload[i]>>>3)*255/depthMultiplier; // what is this 255?

              //   console.log('depth :' +depth);
                imgdata.data[4*i] = depth;
                imgdata.data[4*i+1] = depth;
                imgdata.data[4*i+2] = depth;
                imgdata.data[4*i+3] = 255;
            }
            ctx.putImageData(imgdata,0,0)

            function clickHandler1(event){
                console.log('!!!!!!!!!!!!!!!!!!get position!');
                getPosition("cnvSensorOne", data.sourceID, event);
            }

            canvas.addEventListener("mousedown", clickHandler1,false);
            //$('#sensorOneStatus').html(depthMultiplier);
        }
        else if(calibrationFrames["uncalibrated"] == data.sourceID){
            //empty the canvas before drawing them.
            $('#calibrate_wrap').empty();
            $('#clear_sensorTwo_points').trigger('click');
            $('#calibrate_wrap').html('<canvas id="cnvSensorTwo" width="640" height="480"style="z-index: 4;">');
            var canvas = document.getElementById("cnvSensorTwo");
            var ctx = canvas.getContext("2d");
            ctx.clearRect(0,0,canvas.width,canvas.height);
            var bytearray = new Uint8Array(data.payload);
            var imgdata = ctx.getImageData(0,0, sensors[data.sourceID].frameWidth, sensors[data.sourceID].frameHeight);
            ctx.canvas.width = sensors[data.sourceID].frameWidth;
            ctx.canvas.height = sensors[data.sourceID].frameHeight;
            var imgdatalen = imgdata.data.length;
            for(var i=0;i<(imgdatalen/4);i++){
                var depth = (data.payload[i]>>>3)*255/depthMultiplier;

                imgdata.data[4*i] = depth;
                imgdata.data[4*i+1] = depth;
                imgdata.data[4*i+2] = depth;
                imgdata.data[4*i+3] = 255;
            }
            function clickHandler2(event){
                console.log('!!!!!!!!!!!!!!!!!!get position!');
                getPosition("cnvSensorTwo", data.sourceID, event);
            }


            ctx.putImageData(imgdata,0,0);
            canvas.addEventListener("mousedown", clickHandler2,false);
            //$('#sensorTwoStatus').html(depthMultiplier);
        }
        if(data.payload!=null){
            showGreenStatus('Received Frames. Drawing on the Graph.')
        }
    }

});

$(function(){

    $('#getCalibrationFrames').click(function(){ /*listening to the button click using Jquery listener*/
        var referenceSensorID = $('select#referenceSensorList option:selected').text();
        var calibrateSensorID = $('select#uncalibratedSensorList option:selected').text();
        var referenceSensorSocketID,calibrateSensorSocketID;

        // get calibration rule for reference sensor
        io.emit('getSensorsFromServer',{},function(sensors){
            for(var key in sensors){
                if(sensors.hasOwnProperty(key) && sensors[key].ID == referenceSensorID){
                    //console.log('reference sensor key:'+sensors[key].ID);
                    console.log(JSON.stringify(sensors[key].calibration));
                    referenceSensorCalibration = sensors[key].calibration;
                    referenceSensorSocketID = sensors[key].socketID;
                }
                if(sensors.hasOwnProperty(key) && sensors[key].ID == calibrateSensorID){
                    calibrateSensorSocketID = sensors[key].socketID;
                }
            }

            console.log((referenceSensorID.length != 0)+ ' -- ' + (calibrateSensorID.length!=0));

            console.log(referenceSensorSocketID + ' -- ' + calibrateSensorSocketID);

            if((referenceSensorID.length != 0) && (calibrateSensorID.length != 0)){
                if(referenceSensorSocketID!=calibrateSensorSocketID){
                    while(calibrationFrames.length > 0){
                        calibrationFrames.pop();
                    }
                    calibrationFrames["reference"] = referenceSensorSocketID;
                    calibrationFrames["uncalibrated"] = calibrateSensorSocketID;
                    showNormalStatus('Getting Frames..');
                    io.emit("getCalibrationFrames", {referenceSensorID: referenceSensorSocketID, uncalibratedSensorID: calibrateSensorSocketID});
                }else{
                    showRedStatus('reference sensor should be different from sensor for calibrate. ');
                }
            }else{
                showRedStatus('Please select reference sensor and sensor needs calibrate');
            }


        });




        var e1 = document.getElementById("referenceSensorList");
        var e2 = document.getElementById("uncalibratedSensorList");


    });

    $('#resetPointsOne').click(function(){
        sensorOnePoints.splice(0,sensorOnePoints.length);
        showNormalStatus(JSON.stringify(sensorOnePoints));
    })

    $('#resetPointsTwo').click(function(){
        sensorTwoPoints.splice(0,sensorTwoPoints.length);
        showNormalStatus(JSON.stringify(sensorTwoPoints));
    })

    $('#calibrate').click(function(){


        if(sensorOnePoints.length == 2 && sensorTwoPoints.length == sensorOnePoints.length){
            io.emit("calibrateSensors", {referenceSensorID: calibrationFrames["reference"], uncalibratedSensorID: calibrationFrames["uncalibrated"],
                sensorOnePoints: sensorOnePoints, sensorTwoPoints: sensorTwoPoints}, function(data){
                if(data.degree!=null){
                    showGreenStatus('Calibration Success! Angle between sensors: '+JSON.stringify(Math.round(data.degree * ROUND_RATIO)/ROUND_RATIO) +' degree');
                }else{
                    showRedStatus('Calibration Failed! Maybe due to the points selected donot match. Please reselect the points.')
                }
            })
        }
        else{
           showRedStatus('Error: There are not enough points for calibration.');
        }
    })
});