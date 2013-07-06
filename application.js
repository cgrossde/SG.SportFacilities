// select * from html where url="http://www.ssc.gov.sg/publish/Corporate/en/participation/hotspot/sports_facility.html" and xpath="//td[contains(div,'Information on Facilities')]/div[position() > 2]/a[not(contains(.,'School'))]"
var facilityTypeQuery = "http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20html%20where%20url%3D%22http%3A%2F%2Fwww.ssc.gov.sg%2Fpublish%2FCorporate%2Fen%2Fparticipation%2Fhotspot%2Fsports_facility.html%22%20and%20xpath%3D%22%2F%2Ftd%5Bcontains(div%2C'Information%20on%20Facilities')%5D%2Fdiv%5Bposition()%20%3E%202%5D%2Fa%5Bnot(contains(.%2C'School'))%5D%22&format=json&callback=displayFacilityTypes";
// select * from html where url="http://www.ssc.gov.sg/publish/Corporate/en/participation/hotspot/sports_facility/sports_hall.html" and xpath="//table[contains(tr/td,'Address')]/tr/td[contains(.,'Address')]"
var facilityQuery = function(url) {
		if (url.indexOf("ssc.gov") == -1) {
			return "http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20html%20where%20url%3D%22http%3A%2F%2Fwww.ssc.gov.sg" + url.replace("/", "%2F") + "%22%20and%20xpath%3D%22%2F%2Ftd%5Bcontains(.%2C'Address')%20and%20not(table)%5D%22";
		} else {
			return "http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20html%20where%20url%3D%22" + url.replace("/", "%2F").replace(":", "%3A") + "%22%20and%20xpath%3D%22%2F%2Ftd%5Bcontains(.%2C'Address')%20and%20not(table)%5D%22";
		}
	}

var locationCache = new Array();
var markerCache = new Array();

var markersArray = new Array();
var map;
var oms;
var infoWindow = new google.maps.InfoWindow;
var geocode = new google.maps.Geocoder;
var loadCounter = 0;
var loadTarget = 0;


$(document).ready(function() {
	var cachedData = $.jStorage.get("menu");
	if(cachedData != undefined) {
		displayFacilityTypes(cachedData);
	} else {
		// Lock UI while requesting data
		blockUI();
		$.get(facilityTypeQuery);
	}
	google.maps.event.addDomListener(window, 'load', initializeGoogleMaps);
});


function displayFacilityTypes(data) {
	$.jStorage.set("menu", data);
	// Build menu
	$.each(data.query.results.a, function(index, item) {
		$('.nav-facility-type').append('<li><a href="#"" class="nav-facility-type-item-' + index + '">' + item.content + '</a></li>');
		$('.nav-facility-type-item-' + index).on('click', function() {
			// Only start loading if the previos action has finished loading
			if(loadTarget == loadCounter) {
				loadCounter = -1;
				// Lock UI from interaction
				blockUI();
				item.key = $.md5(item.content);
				getFacilities(item);
			} else {
				console.log("Still loading...");
			}			
		});
	});
	// After menu is setup unlock the UI
	unBlockUI();
}

function getFacilities(type) {
	// check if we already got the data
	var cachedData = $.jStorage.get(type.key);
	console.log("typeData ", cachedData);
	if(cachedData != undefined) {
		transformFacilityData(cachedData);
	} else {
		$.get(facilityQuery(type.href)).success(function(data){
			$.jStorage.set(type.key, data);
			transformFacilityData(data);
		});
	}
}

// Transform data to something useful
function transformFacilityData(data) {
	text = $(data).text().replace(/  /g, "").replace(/\n\n\n/g, "").replace("closure.", "closure").split("closure");
	var facilities = new Array();
	$.each(text, function(index, text) {
		text = text.split("\n");
		var facility = {};
		$.each(text, function(index, value) {
			if (index == 0) {
				if (value.indexOf("(Click") == -1) {
					facility.name = value.replace(".", "");
				} else {
					facility.name = value.substring(0, value.indexOf("(Click")).replace(".", "");
				}
			}

			if (value.indexOf("Address") !== -1) {
				facility.address = text[index + 1] + ' singapore';
			}

			if (value.indexOf("Operating Hour") !== -1) {
				facility.operationHour = value.replace("Operating Hours: ", "");
			}

			if (value.indexOf("Facilities Type") !== -1) {
				facility.facilityInfo = value.replace("Facilities Type: ", "");
			}

		});
		if (facility.name != "" && facility.name != " " && facility.name != undefined && facility.name != "undefined") {
			facilities.push(facility);
		}
	});

	// Reset loadCounter and set loadTarget
	loadCounter = 0;
	loadTarget = facilities.length;

	displayFacilities(facilities);
}

function displayFacilities(facilities) {
	// Clear all markers
	$.each(markersArray, function(index, marker) {
		oms.removeMarker(marker);
		marker.setMap(null);
		//google.maps.event.clearListeners(marker, 'click');
	});

	// Add new markers
	$.each(facilities, function(index, facility) {
		addFacility(facility, true);
	});
}

function showFacilityTooltip(marker) {
	console.log("startShow");
	var facility = marker.facility;
	var content = '<h4>' + facility.name + '</h4>';

	if (facility.address != "") {
		content += "<b>Facility address: </b>" + facility.address + '<br/>';
	}
	if (facility.operationHour) {
		content += "<b>Operating Hours: </b>" + facility.operationHour + '<br/>';
	}
	if (facility.facilityInfo) {
		content += "<b>Additional Infos: </b>" + facility.facilityInfo + '<br/>';
	}

	infoWindow.setContent(content);
	infoWindow.open(map, marker);
	console.log("Show");
}

function initializeGoogleMaps() {
	var mapOptions = {
		center: new google.maps.LatLng(1.369, 103.815),
		zoom: 11,
		mapTypeId: google.maps.MapTypeId.ROADMAP,
		zoomControlOptions: {
			style: google.maps.ZoomControlStyle.SMALL
		}
	};

	map = new google.maps.Map(document.getElementById("map-canvas"), mapOptions);
	oms = new OverlappingMarkerSpiderfier(map);
	oms.addListener('click', showFacilityTooltip);
}

function addFacility(facility) {
	var addressKey = $.md5(facility.address);
	var location = $.jStorage.get(addressKey);

	if(location == undefined) {
		getLocationByAddress(facility);
	} else {
		console.log("CACHED ", location);
		addMarker(facility, location);
	}
}

function getLocationByAddress(facility) {
	var address = facility.address;
	var addressKey = $.md5(facility.address);

	geocode.geocode({
		'address': address
	}, function(results, status) {
		if (status === google.maps.GeocoderStatus.OK) {
			// Add location to cache
			$.jStorage.set(addressKey, results[0].geometry.location);
			console.log("NEW ", results[0].geometry.location);
			addFacility(facility);
		} else if (status === google.maps.GeocoderStatus.OVER_QUERY_LIMIT) {
			setTimeout(function() {
				addFacility(facility);
			}, 200);
		} else {
			console.log("Geocode was not successful for the following reason:" + status);
		}
	});
}

function addMarker(facility, location) {
	var location = new google.maps.LatLng(location.jb, location.kb);
	// Increase loadCounter
	loadCounter++;

	// Check marker cache
	var marker = getCachedMarker(facility.address + facility.name);

	if(marker == false) {
		var image = specialImage(facility.name);
		marker = new google.maps.Marker({
			map: map,
			position: location,
			facility: facility,
			icon: image
		});		
	} else {
		marker.setMap(map);
	}

	// Add eventListener for tooltip
	markersArray.push(marker);
	oms.addMarker(marker);

	// Enable UI again after loading is done
	if(loadCounter == loadTarget) {
		unBlockUI();
	}
}

function getCachedMarker(identifier) {
	var markerInCache = false;

	$.each(markerCache, function(index, marker) {
		if (marker.identifier == identifier) {
			markerInCache = marker.data;
		} 
	});

	if (markerInCache == false) {
		return false;
	} else {
		return markerInCache;
	}
}

function specialImage(name) {
	var basePath = "assets/img/";

	var mapping = [
		{
			key: "tennis", 
			image: "tenniscourt.png"},
		{
			key: "squash",
			image: "squash-2.png"
		},
		{
			key: "swimming",
			image: "swimming2.png"
		}];

	var image = undefined;
	$.each(mapping, function(index, mapping) {
		if(contains(mapping.key, name)) {
			image =  basePath + mapping.image;
		}
	});

	return image;
}

function contains(key, haystack) {
	haystack = haystack.toLowerCase()
	key = key.toLowerCase();
	if(haystack.indexOf(key) != -1) {
		return true;
	} else {
		return false;
	}
}

function blockUI() {
	$.blockUI({message: '<p class="text-center" style="padding-top: 10px"><img src="assets/img/ajax-loader.gif" /> Loading ...</p>'});	
}

function unBlockUI() {
	$.unblockUI();
}


