import jQuery from "jquery";
$ = window.$ = window.jQuery = jQuery;
import 'jquery-ui-bundle';
require('chart.js');
require('chosen-js');
require ('jstree');
require ('canvas2svg/canvas2svg2');

import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import ol_Overlay from 'ol/Overlay';
import {unByKey} from 'ol/Observable.js';
import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer.js';
import TileWMS from 'ol/source/TileWMS.js';
import BingMaps from 'ol/source/BingMaps.js';
import VectorSource from 'ol/source/Vector.js';
import {transform} from 'ol/proj.js';
import TileGrid from 'ol/tilegrid/TileGrid.js';
import ol_Interaction_Draw from 'ol/interaction/Draw.js';
import {defaults as defaultControls, ScaleLine, Attribution} from 'ol/control.js';
import ol_Feature from 'ol/Feature.js';
import ol_Geom_Point from 'ol/geom/Point.js';
import ol_Geom_Polygon from 'ol/geom/Polygon.js';
import ol_Geom_LineString from 'ol/geom/LineString.js';
import ol_Style from 'ol/style/Style.js';
import ol_Style_Fill from 'ol/style/Fill.js';
import ol_Style_Stroke from 'ol/style/Stroke.js';
import ol_Style_Text from 'ol/style/Text.js';
import ol_Style_Circle from 'ol/style/Circle.js';
import ol_Style_Icon from 'ol/style/Icon.js';
import ol_Format_WKT from 'ol/format/WKT.js';

import saveAs from 'file-saver';
import regression from 'regression';
import hopscotch from 'hopscotch';
import datatables from 'datatables';

// default language
var language = "en";
// max size of the drawn polygon
var maxPolygonSize = 1e10; // sq. meters
// app version 
var version = "App. Version 1.0.3";
// various global variables
var labels, map, layerList, draw, formData, svgString, SVGChart, monthNames, usageStatisticsHTML, treeView, languages;
var c_mode = 0;
var treeViewExecuted = false;
var visibleRadiance = "";
var domain = 'https://lighttrends.lightpollutionmap.info';
var serviceUrl = domain + "/query/";	
var serviceUrl1 = serviceUrl + "getlayerlist.ashx";
var serviceUrl2 = serviceUrl + "exportchart.ashx";
var serviceUrl3 = serviceUrl + "getstatistics.ashx";
var serviceUrl4 = serviceUrl + "getcounters.ashx";
var serviceUrl5 = serviceUrl + "getrasterpolygon.ashx";

var currentLayerLights = "";
const seriesNames = ['DMSP F10','DMSP F12','DMSP F14','DMSP F15','DMSP F16','DMSP F18','DMSP (cal.)','VIIRS NPP','VIIRS NPP2'];
const Bkey = "hUVe19f6SzYXsN1ha4yU~Mhp5LMs1dbWhj9qvFqir2A~AkvKw-1qKzfiq7rmw5Pudr70N9IM9cyw8x63iKwBGzKv6Iq5rtSwf3BuHiG1eFnz";
var datasets = [];
var chartValues = [];
var graphData = {};

var chartMinXValue = Date.parse('2050-01-01');
var chartMinYValue = 0;
var chartMaxYValue = 0;
var chartMaxXValue = 0;
var YaxisMode = "default";

//series
var data_dmsp_f10 = [];
var data_dmsp_f12 = [];
var data_dmsp_f14 = [];
var data_dmsp_f15 = [];
var data_dmsp_f16 = [];
var data_dmsp_f18 = [];
var data_dmsp_cal = [];
var data_viirs_npp = [];
var data_viirs_npp2 = [];

var activeControl = "";
			
// application version
var d = new Date(document.lastModified); 
var isoDate = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString();
$('#appVersion').html(version + " (" + isoDate.replace("T"," ").replace(".000Z","") + ")");

// handle window resize and start
$(window).resize(function() {
	// responsive top bar
	if ($(window).width() < 770) {
		$( "#topBar_menu" ).addClass( "topBar_menu" );
		$( "#topBar_menu_button" ).show();
		$("#topBar_menu > div").css("float","left");
		$("#topBar_menu").css("display","none");
		
	} else {
		$( "#topBar_menu" ).removeClass( "topBar_menu" );
		$( "#topBar_menu_button" ).hide();
		$("#topBar_menu > div").css("float","right");
		$("#topBar_menu").css("display","block");
	}
	
	
	// resize chart on window resize
	if ($("#chartWindow").is(":visible")) {
		var chartWidth = $("#chartWindowContent").width();
		$(".chart").css("width", chartWidth-22 + "px")
		$(".chart").css("height", Math.round(chartWidth/2) + "px")
	}
});
$(window).trigger("resize");

// apply language to UI
applyLanguage(language);

// top bar button handler
$('.topBarButtonModal').click(function(e){
	var buttonId = $(this)[0].id;		
	
	if (buttonId.indexOf("statistics") > -1) {
		// fill statistics table first time
		$('#' + buttonId + "Content").fadeIn(function(){
			if ($("#statisticsHeader").html() == "") {
				usageStatistics('month');
			}		
		});	
	} else if (buttonId.indexOf("help") > -1) {
		// start guided tour
		$("#tourButton").click();
	} else {
		$('#' + buttonId + "Content").fadeIn();			
	}	
});

// closer button handler
$(".fsContent_closer").click(function() {
	$($(this).parent()).parent().fadeOut();
});	

// langauge change
$("#topBar_language").on("click", function(evt) {
	language = $("#topBar_language_label_2").html();
	var index = languages.indexOf(language);	
	if (index + 1 > languages.length-1) {
		index = 0;
	} else {
		index += 1;
	}
	$("#topBar_language_label_2").html(languages[index]);
	applyLanguage(languages[index]);
});

// tooltip override
$(function() {
	$(document).tooltip({
		hide: { effect: "fade", duration: 500},
		track: true,
		content:function(){
			return this.getAttribute("title");
		},
		open: function (event, ui) {
				setTimeout(function () {
					$(ui.tooltip).hide("fade", 500);
				}, 5000)},	
		show: {delay: 500}
	});
});

//add Bing background maps (default: canvasDark)
var layers = [];
layers.push(new TileLayer({
	visible: true,
	preload: Infinity,
	name: 'LayerBingCanvasDark',
	source: new BingMaps({
	  key: Bkey,
	  imagerySet: 'canvasDark'
	})
}));

layers.push(new TileLayer({
	visible: false,
	preload: Infinity,
	name: 'LayerBingAerial',
	source: new BingMaps({
	  key: Bkey,
	  imagerySet: 'aerial'
	})
}));

layers.push(new TileLayer({
	visible: false,
	preload: Infinity,
	name: 'LayerBingRoad',
	source: new BingMaps({
	  key: Bkey,
	  imagerySet: 'road'
	})
}));

// set scale line
var scaleLine = new ScaleLine({
	units: 'metric', 
	minWidth : 100
});

var attribution = new Attribution({collapsible: false});
	
// map definition
map = new Map({
  layers: layers,
  target: 'map',
  renderer: 'canvas',
  loadTilesWhileAnimating: true,
  loadTilesWhileInteracting: true,
  controls: defaultControls({ attribution: false, rotate:false, zoom: false }).extend([ scaleLine, attribution]),
  view: new View({
	center: [0, 4000000],
	extent: [-20037600,-9611615,20037600,12932243],
	resolutions: [39135.9061246600029296875, 19567.95306233000146484375, 9783.976531165000732421875, 4891.9882655825003662109375, 2445.99413279125018310546875, 1222.997066395625091552734375, 611.4985331978125457763671875,305.74811309814453,152.87405654907226,76.43702827453613, 38.218514137268066, 19.109257068634033,9.554628534317017, 4.777314267158508,2.388657133579254],
	zoom: 0
  })
});

// disable native canvas image interpolation
/*
map.on('precompose', function(evt) {
  evt.context.imageSmoothingEnabled = false;
  evt.context.webkitImageSmoothingEnabled = false;
  evt.context.mozImageSmoothingEnabled = false;
  evt.context.msImageSmoothingEnabled = false;
});
*/

// search result pin layer	
var layerLocation = new VectorLayer({
	name: "layerLocation",
	zIndex: 3,
	source: new VectorSource({
		features: []
	})
});
map.addLayer(layerLocation);

// searchbox
$("#searchBox").autocomplete({
	source: function (request, response) {
	
		// IE polyfill
		Number.isInteger = Number.isInteger || function(value) {
		  return typeof value === 'number' && 
			isFinite(value) && 
			Math.floor(value) === value;
		};

		if (Number.isInteger(parseInt(request.term[0])) || request.term[0] == "-" || request.term[0] == "+") {
			// handle coordinate search if starts with a number, + or - sign
			var arr = request.term.replace(" ","").split(",");
			if (arr.length > 1) {
				var item = {};
				item.data = {};
				item.data.point = {};
				item.point = {};
				item.point.coordinates = arr;
				item.data.point.coordinates = [parseFloat(arr[0]), parseFloat(arr[1])];
				item.name = arr[0] + "," + arr[1];
				
				// check if coordinates are valid, return otherwise
				if (Math.abs(item.data.point.coordinates[0]) > 180 || Math.abs(item.data.point.coordinates[1]) > 90 ) {
					return;
				}			
				
				//var result = data.resourceSets[0];
				var result = item;
				response($.map(result.point, function (item) {
					
					var item2 = {};
					item2.point = {};
					item2.point.coordinates = [parseFloat(item[1]), parseFloat(item[0])];
					item2.name = item[0] + ", " + item[1];						
					return {
						data: item2,
						label: item[0] + "," + item[1],
						value: item[0] + "," + item[1]
					}
				}));			
			}		
		} else {
			$.ajax({
				url: "https://dev.virtualearth.net/REST/v1/Locations",
				dataType: "jsonp",
				data: {
					key: Bkey,
					q: request.term
				},
				jsonp: "jsonp",
				success: function (data) {
					var result = data.resourceSets[0];
					if (result) {
						if (result.estimatedTotal > 0) {
							response($.map(result.resources, function (item) {
								return {
									data: item,
									label: item.name + ' (' + item.address.countryRegion + ')',
									value: item.name
								}
							}));
						}
					}
				}
			});
			
		}
		
	},
	minLength: 4,
	delay: 750,
	change: function (event, ui) {
		if (!ui.item || $("#searchBox").val() == "") {
				$("#searchBox").val('');
				clearVectorLayer("layerGeolocation");
		}
	},
	select: function (event, ui) {
		zoomToSearchResult(ui.item.data);
	}
});

//try to read permalink
if (window.location.hash !== ''){ 
	try {
		var permalinkZoom = parseInt(GetHashString("zoom"));
		var permalinkLat = parseFloat(GetHashString("lat"));
		var permalinkLon = parseFloat(GetHashString("lon"));
		if (!isNaN(permalinkZoom) && !isNaN(permalinkLat) && !isNaN(permalinkLon)) {
			var centerXY = transform([permalinkLon, permalinkLat], 'EPSG:4326', 'EPSG:3857');	
			map.getView().setCenter(centerXY);
			map.getView().setZoom(permalinkZoom);
		}
	} catch (err) {}
}


//configure permalink
var updatePermalink = function() {
	var view = map.getView();
	var center = view.getCenter();
	var centerWGS = transform(center, 'EPSG:3857', 'EPSG:4326');	
	
	var hash = '#zoom=' +
	view.getZoom() + '&lon=' +
	centerWGS[0].toFixed(5) + '&lat=' +
	centerWGS[1].toFixed(5);
	//do not clutter history with new hash entries when moving the map 
	window.history.replaceState(undefined, undefined, hash);
};
  



// mouse controls
map.on('pointermove', function(e) {
	var latlon = transform(e.coordinate, 'EPSG:3857', 'EPSG:4326');	
	var lonlatarr = formatDegMinSec(latlon, c_mode);
	$("#coordinates").html(lonlatarr[0] + " " + lonlatarr[1]);	
});
$("#coordinates").click(toggleCoorDisplayType);


// handle click on map (to remove marker...)
map.on('click', clickOnMap);

// permalink updater
map.on('moveend', function() {
	updatePermalink();
	// redraw graticule on map move
	if ($("#layerGraticuleCtrl").is(':checked')) {
		drawGraticule();
	}
});

// zoomIn and zoomOut buttons
$("#zoomInButton").click(function() {
	map.getView().cancelAnimations();
	map.getView().animate({
		zoom: map.getView().getZoom() + 1,
		duration: 300
	});
});
$("#zoomOutButton").click(function() {
	map.getView().cancelAnimations();
	map.getView().animate({
		zoom: map.getView().getZoom() - 1,
		duration: 300
	});
});

// Measure Length Ctrl event
$("#rulerButton").click(function() {
	// do not do anything if in tour mode unless at tour step lower than 3
	if (typeof hopscotch.getCurrStepNum() != 'undefined') {
		if (hopscotch.getCurrStepNum() > 2) { 
			return;
		}
	}
	removeInteractions();
	
	if (activeControl == 'Measure') {
		activeControl = '';
		//map.on('click', defaultInfo);
		$(this).css("background-image","url(img/ruler_off.png)");
	} else {
		activeControl = 'Measure';
		measureCtrl();
		$(this).css("background-image","url(img/ruler_on.png)");
	}
});

// Layer icon animation
$("#layerIcon").click(function() {
	if ($("#layerConfigWindow").width() > 100) {
		//minimize
		$("#layerConfigWindow").animate({
			width: 58,
			height: 58 
		});
		$("#layerConfigWindowContainer h3").animate({
			marginTop: 55
		});
	} else {
		//maximize
		$("#layerConfigWindow").animate({
			width: 270,
			height: 500 
		});
		$("#layerConfigWindowContainer h3").animate({
			marginTop: 5
		});
		$("#layerConfigWindow").css({"max-height" : "600px"});
		$("#layerConfigWindowContent").css({"overflow-y" : "auto"});
		
	}
});

// Pixel Analysis Ctrl event
$("#pixelAnalysisButton").click(function() {
	// do not do anything if in tour mode unless at tour step 3
	if (typeof hopscotch.getCurrStepNum() != 'undefined') {
		if (hopscotch.getCurrStepNum() != 2 && hopscotch.getCurrStepNum() != 0) { 
			return;
		}
	}
	removeInteractions();
		
	if (activeControl == 'pixelAnalysis') {		
		activeControl = '';
		document.getElementById('map').style.cursor = 'default';
		$(this).css("background-image","url(img/pixelAnalysis_off.png)");
	} else {
		activeControl = 'pixelAnalysis';
		map.on('click', pixelAnalysis);		
		setTimeout(function () {analysisConfigWindow('pixel');}, 500);
		document.getElementById('map').style.cursor = 'crosshair';
		$(this).css("background-image","url(img/pixelAnalysis_on.png)");
		$("#pixelAnalysisButton").removeClass("tourHighlight");
	}			
});
// Area Analysis Ctrl event	
$("#areaAnalysisButton").click(function() {
	// do not do anything if in tour mode unless at tour step 11
	if (typeof hopscotch.getCurrStepNum() != 'undefined') {
		if (hopscotch.getCurrStepNum() != 10 && hopscotch.getCurrStepNum() != 0) { 
			return;
		}
	}
	removeInteractions();
	
	if (activeControl == 'areaAnalysis') {
		activeControl = '';
		$(this).css("background-image","url(img/areaAnalysis_off.png)");
	} else {
		activeControl = 'areaAnalysis';
		areaAnalysis();
		setTimeout(function () {analysisConfigWindow('area');}, 500);	
		$(this).css("background-image","url(img/areaAnalysis_on.png)");	
		$("#areaAnalysisButton").removeClass("tourHighlight");
	}
});

// langauge change
$("#changeLanguage").on("change", function(evt) {
	language = $(this).val();
	applyLanguage(language);
});

// usage statistics
$("#usageStatistics_select").chosen({disable_search_threshold: 10, width: "110px" }).on("change", function(evt) {		
	usageStatistics($(this).chosen().val());
});

// Bing Maps attribution

$("#BingMapsAttribution").click( function(evt) {
	$(".ol-attribution").fadeToggle();
});

// ----  END INIT
// --------  END INIT
// ------------  END INIT

function makeLayerTreeView() {
	// run TreeView only once
	if (treeViewExecuted) {
		return;
	}
	treeViewExecuted = true;
	
	$.ajax({
		type: "GET",
		url: serviceUrl1,
		dataType: "json",
		success: function(data) {
			layerList = data;	
			for (Object.key in layerList) {
				if (Object.key.indexOf("dmsp_u") > -1) {							
					$("#dmsp_u_tree ul").append("<li id='jstree_"+Object.key+"' data-lt='"+Object.key+"' data-jstree='{\"icon\":\"img/satellite.png\"}'>"+layerList[Object.key].datestart.substring(0,4)+" (" + layerList[Object.key].sattypes  +")</li>");
				} else if (Object.key.indexOf("viirs") > -1) {
					if (layerList[Object.key].period == 'annual') {
						$("#viirs_tree_annual ul").append("<li id='jstree_"+Object.key+"' data-lt='"+Object.key+"' data-jstree='{\"icon\":\"img/satellite.png\"}'>"+layerList[Object.key].datestart.substring(0,4)+" (" + layerList[Object.key].sattypes  +")</li>");
					} else {					
						$("#viirs_tree_monthly ul").append("<li id='jstree_"+Object.key+"' data-lt='"+Object.key+"' data-jstree='{\"icon\":\"img/satellite.png\"}'>"+layerList[Object.key].datestart.substring(0,4)+" "+monthNames[parseInt(layerList[Object.key].datestart.substring(5,7))-1]+" (" + layerList[Object.key].sattypes  +")</li>");
					}								
				} else if (Object.key.indexOf("dmsp_c") > -1) {
					$("#dmsp_c_tree ul").append("<li id='jstree_"+Object.key+"' data-lt='"+Object.key+"' data-jstree='{\"icon\":\"img/satellite.png\"}'>"+layerList[Object.key].datestart.substring(0,4)+" (" + layerList[Object.key].sattypes  +")</li>");							
				}																			
			}
			
			$('#layerTree').on('changed.jstree', function (e, data) {
				// get rasterColumn name
				var rasterColumn = data.instance.get_node(data.selected[0]).data.lt;
				currentLayerLights = rasterColumn;
				//change layer
				
				// add loading icon after layer name at start
				if (map.getView().getZoom() <= 12) {
					var loadingIndicator = "<div class='loadingIconLayer' style='height: 24px;width: 24px;float: right;'><object data='img/loading.svg' type='image/svg+xml'></object></div>";
					var tree_item_id = data.instance.get_node(data.selected[0]).id;
					if ($(".loadingIconLayer" ).length == 0) {
						$("#" + tree_item_id + "_anchor").append(loadingIndicator);
					}				
				}
				
				var layerLights = getLayerByName('LayerLights');
				if (typeof layerLights != "undefined") {
					map.removeLayer(layerLights);
				}
				layerLights = new TileLayer({
					visible: true,
					opacity: $("#opacityCtrl" ).slider("value")/100,
					name: 'LayerLights',
					source: new TileWMS({
					  url: domain + '/geoserver/gwc/service/wms',
					  //tileLoadFunction: tileLoader,
					  params: {'TILED': true, 'SRS' : 'EPSG:3857', 'FORMAT': 'image/png', 'LAYERS': 'lighttrends:' + rasterColumn, 'STYLES': getLayerStyle(rasterColumn)},
					  tileGrid: new TileGrid({origin: [0,0],resolutions: [39135.9061246600029296875, 19567.95306233000146484375, 9783.976531165000732421875, 4891.9882655825003662109375, 2445.99413279125018310546875, 1222.997066395625091552734375, 611.4985331978125457763671875]})
					})
				})
				
				map.addLayer(layerLights);
				
				
				// progress bar when loading overlay
				
				var progress = new Progress(document.getElementById('progressBar'));
				getLayerByName('LayerLights').getSource().on('tileloadstart', function() {
					progress.addLoading();				
				});

				getLayerByName('LayerLights').getSource().on('tileloadend', function() {
					progress.addLoaded();
					$(".loadingIconLayer" ).remove();
				});
				getLayerByName('LayerLights').getSource().on('tileloaderror', function() {
					progress.addLoaded();
				});							

				// redraw graticule
				if ($("#layerGraticuleCtrl").is(':checked')) {
					drawGraticule();
				}
			});						
		
			$(function () { $('#layerTree').jstree({
					"core" : {
						"multiple" : false
					}
				});
			});
			
  	
			initializeDialogWindowsAndMenus();
			
			// show layerConfigWindow
			$("#layerConfigWindow").fadeIn();

			// refresh overlay by resize event
			$(window).trigger("resize");
		}
	});
}
function clickOnMap(coordinates) {
	// removes a marker from the map if clicked on it
	removeMarker(coordinates);
	//$('#layerTree').jstree('select_node', 'jstree_viirs_npp_201600');
}

function getLayerByName(name) {
	var layers = map.getLayers().getArray();
	var result;
	for (Object.key in layers) {
		if (layers[Object.key].get('name') == name) {
			result = layers[Object.key];
			break;
		}
	}
	return result;
}
function numberWithPoints(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
function zoomToSearchResult(item) {
	var positionFeature = new ol_Feature();
	positionFeature.setStyle(new ol_Style({
		image: new ol_Style_Icon({
			anchorXUnits: 'pixels',
			anchorYUnits: 'pixels',
			anchor: [9,38],
			src: 'img/location_pin_red_shadow.png'
		})
	}));
	
	var proj = map.getView().getProjection();	
	var point = new ol_Geom_Point(transform([item.point.coordinates[1], item.point.coordinates[0]], 'EPSG:4326', proj));		
	positionFeature.setGeometry(point);
	
	var layer = getLayerByName("layerLocation");
	clearVectorLayer(layer.get('name'));
	layer.getSource().addFeature(positionFeature);
	var zoom = 10;
	// zoom in more if search already contains coordinates
	if ( Number.isInteger(parseInt(item.name[0])))   {
		zoom = 13;
	}
	flyTo(positionFeature.getGeometry().getCoordinates(),zoom);  
}
function removeMarker(evt) {
	var layer = getLayerByName("layerLocation");
	var coordinate = evt.coordinate;
	var pixel = evt.pixel;
	
	// set extent tolerance big enough to cover the icon
	var pixelTolerance = 25;
	
	//check if cliked on the icon
	var coordinate1 = map.getCoordinateFromPixel([pixel[0]+pixelTolerance,pixel[1]+pixelTolerance]);
	var coordinate2 = map.getCoordinateFromPixel([pixel[0]-pixelTolerance,pixel[1]-pixelTolerance]);

	var extent, existingFeaturesatLocation;
	try {
		extent = [coordinate2[0],coordinate1[1],coordinate1[0],coordinate2[1]];
		existingFeaturesatLocation = layer.getSource().getFeaturesInExtent(extent);
	} catch(err) {
		existingFeaturesatLocation = [];
	}
		
	//clears it 
	if (existingFeaturesatLocation.length > 0) {
		for (var i = 0; i < existingFeaturesatLocation.length; i++) {
			layer.getSource().removeFeature(existingFeaturesatLocation[i]);
		}
	}	
}
function clearVectorLayer(layerName) {
	var layer = getLayerByName(layerName);
	if (typeof layer != 'undefined') {
		layer.getSource().clear();
	}	
}
function flyTo(coordinates, zoom) {
	var view = map.getView();
	var duration = 2000;
	var parts = 2;
	var called = false;
	var zoomout = 1;

	function callback(complete) {
		--parts;
		if (called) {
			return;
		}
		if (parts === 0 || !complete) {
			called = true;
		}
	}
	
	view.animate({
		center : coordinates,
		duration : duration,
		zoom : zoom
	}, callback);
}
function formatDecimalNumberArea(number) {
	let a = number/1e6;
	if (a < 100) {
		a = a.toPrecision(2);
	} else {
		a = Math.round(a);
	}
	return a;
}
function formatDecimalCoordinate(coordinate_text) {
	let a = coordinate_text.replace("&nbsp;","").replace(" ","").split(",");
	let lon = parseFloat(a[0]);
	let lat = parseFloat(a[1]);
	let lonDir = "";
	let latDir = "";
	
	// direction
	var sign = lon && lon / Math.abs(lon);
	if (sign > 0) {
		lonDir = "E";
	} else {
		lonDir = "W";
	}
	sign = lat && lat / Math.abs(lat);
	if (sign > 0) {
		latDir = "N";
	} else {
		latDir = "S";
	}	 
	return Math.abs(lon).toFixed(4) + " " + lonDir + ", " + Math.abs(lat).toFixed(4) + " " + latDir
}
function toggleCoorDisplayType(e) {
	var coorDivText = document.getElementById("coordinates").innerHTML;
	c_mode = 0;
	var decimal = coorDivText.indexOf(" ");
	
	if (decimal == 0) {
		c_mode = 1;
	} else {
		c_mode = 0;
	}	
	if (e != undefined) { 
		var latlon = map.getCoordinateFromPixel([e.clientX,e.clientY]);
		var latlonWGS = transform(latlon, 'EPSG:3857', 'EPSG:4326');	
		var lonlatarr = formatDegMinSec(latlonWGS, c_mode);
		document.getElementById("coordinates").innerHTML = "" +lonlatarr[0] + " " + lonlatarr[1];
	}	
}
function addLeadingZero(val) {			
	var a = val.toString().split('.');
	for (var i = 0; i < a.length; i++) {
		if (a[i].length == 1) {a[i] = "0" + a[i];}
	}
	if (a.length == 1) {
		return a[0];
	} else {
		return a[0]+"."+a[1].substring(1, 2);
	}		
}
function formatDegMinSec(lonLat, c_mode) {
	var dir0, dir1;
	if  (Math.abs(lonLat[0]) > 180) {
		if (lonLat[0] > 0) {
			while (lonLat[0] > 180) {
				lonLat[0] -= 360;
			}
		} else {
			while (lonLat[0] < -180) {
				lonLat[0] += 360;
			}
		}
	}
	if (lonLat[0] >= 0) {dir0 = 'E'} else {dir0 = 'W'}
	if (lonLat[1] >= 0) {dir1 = 'N'} else {dir1 = 'S'}
	var lonlatarr = [Math.abs(lonLat[0]), Math.abs(lonLat[1])]
	
	var output = [];
	if (c_mode == 1) {
		for (var i = 0; i < 2; i++) {
			var degrees, minutes, seconds;
			var val =  lonlatarr[i];
			degrees = Math.floor( val );
			minutes = Math.floor( (val - degrees ) * 60 );
			seconds = ((val - degrees - ( minutes / 60 )) * 3600).toFixed(1);
			output[i] = degrees+"&#176; "+addLeadingZero(minutes)+"' "+addLeadingZero(seconds);
			if (i==0) {output[i] += " " + dir0} else {output[i] += " " + dir1}
		}
	} else {
		output = [' '+lonLat[0].toFixed(5), lonLat[1].toFixed(5)];
	}
	return output;
}

//gets hash parameter value from url
function GetHashString(name) {
	name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
	var regexS = "[\\#&]" + name + "=([^&#]*)";
	var regex = new RegExp(regexS);
	var results = regex.exec(window.location.hash);
	if (results == null)
		return "";
	else
		return decodeURIComponent(results[1].replace(/\+/g, " "));
}

// calculates distance
function getDistance(c1, c2) {
  const radius = 6378137;
  const lat1 = toRadians(c1[1]);
  const lat2 = toRadians(c2[1]);
  const deltaLatBy2 = (lat2 - lat1) / 2;
  const deltaLonBy2 = toRadians(c2[0] - c1[0]) / 2;
  const a = Math.sin(deltaLatBy2) * Math.sin(deltaLatBy2) +
      Math.sin(deltaLonBy2) * Math.sin(deltaLonBy2) *
      Math.cos(lat1) * Math.cos(lat2);
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function getArea(geometry) {
	const radius = 6378137;
	let area = 0;
	let coordinates, i, ii;
	coordinates = geometry.getCoordinates();
/*	
	for (let i = 0; i < coordinates.length; i++) {
		let temp_area = Math.abs(getAreaInternal(coordinates[i], radius));
		if (!isNaN(temp_area)) {
			area += temp_area;
		}
	}
*/	
	area = Math.abs(getAreaInternal(coordinates[0], radius));
  return area;
}
function getAreaInternal(coordinates, radius) {
  let area = 0;
  const len = coordinates.length;
  let x1 = coordinates[len - 1][0];
  let y1 = coordinates[len - 1][1];
  for (let i = 0; i < len; i++) {
    const x2 = coordinates[i][0];
    const y2 = coordinates[i][1];
    area += toRadians(x2 - x1) *
        (2 + Math.sin(toRadians(y1)) +
        Math.sin(toRadians(y2)));
    x1 = x2;
    y1 = y2;
  }
  return area * radius * radius / 2.0;
}
function toRadians(angleInDegrees) {
  return angleInDegrees * Math.PI / 180;
}

function setLayerOpacity(value) {
	var layer = getLayerByName('LayerLights');
	if (typeof layer != "undefined") {
		layer.setOpacity(value/100);
	}
}
//gets style name
function getLayerStyle(rasterColumn) {
	var style = "";

	var layerStyleValue = $("#layerStyle" ).chosen().val();
	
	if (rasterColumn.indexOf("dmsp_u") > -1) {
		style = "dmsp_u_" + layerStyleValue;
	} else if (rasterColumn.indexOf("dmsp_c") > -1) {
		style = "dmsp_c_" + layerStyleValue;
	} else if (rasterColumn.indexOf("viirs") > -1) {
		style = "viirs_" + layerStyleValue;
		if (layerStyleValue == "g1") {
			style = "raster";
		}
	}
	return style;
}

//tile authentication...not used
function tileLoader(tile, src) {
	var client = new XMLHttpRequest();
	
	client.open('GET', src);
	client.responseType = 'arraybuffer';
	// Uncomment to pass authentication header
	//client.setRequestHeader("Authorization", "Basic dGVzdHVzZXIxOnRlc3R1c2VyMQ=="); // + window.btoa('testuser1:testuser1'));
	
	client.onload = function () {
		const arrayBufferView = new Uint8Array(this.response);
		const blob = new Blob([arrayBufferView], { type: 'image/png' });
		const urlCreator = window.URL;
		const imageUrl = urlCreator.createObjectURL(blob);
		tile.getImage().src = imageUrl;
	};
	client.send();
}

//Renders a progress bar.
function Progress(el) {
	this.el = el;
	this.loading = 0;
	this.loaded = 0;
}

//Increment the count of loading tiles.
Progress.prototype.addLoading = function () {
	if (this.loading === 0) {
		this.show();
	}
	++this.loading;
	this.update();
};

// Increment the count of loaded tiles.
Progress.prototype.addLoaded = function () {
	var this_ = this;
	setTimeout(function () {
		++this_.loaded;
		this_.update();
	}, 100);
};

// Update the progress bar.
Progress.prototype.update = function () {
	var width = (this.loaded / this.loading * 100).toFixed(1) + '%';
	this.el.style.width = width;
	if (this.loading === this.loaded) {
		this.loading = 0;
		this.loaded = 0;
		var this_ = this;
		setTimeout(function () {
			this_.hide();
		}, 500);
	}
};

// Show the progress bar.
Progress.prototype.show = function () {
	this.el.style.visibility = 'visible';
};

// Hide the progress bar.
Progress.prototype.hide = function () {
	if (this.loading === this.loaded) {
		this.el.style.visibility = 'hidden';
		this.el.style.width = 0;
	}
};

function removeInteractions() {
	// removes items from map and returns to default state
	var currentInteractions = map.getInteractions();
	currentInteractions.forEach( function (evt) {
		if (evt instanceof ol_Interaction_Draw) {
			map.removeInteraction(evt);
		}
		
	}, this)

	var layer = getLayerByName('layerMeasureLength');
	if (typeof(layer) != 'undefined') {
		map.removeLayer(getLayerByName('layerMeasureLength'));	
	}
	layer = getLayerByName('layerAnalysisArea');
	if (typeof(layer) != 'undefined') {
		map.removeLayer(getLayerByName('layerAnalysisArea'));	
		$("#analysisConfigWindow").fadeOut();
		$("#chartWindow").fadeOut();
	}
	
	clearOverlays('all');
	map.un('click', pixelAnalysis);
	map.un('click', areaAnalysis);

	//map.un('click', defaultInfo);
	document.getElementById('pixelAnalysisButton').style.backgroundImage = 'url(img/pixelAnalysis_off.png)';
	document.getElementById('areaAnalysisButton').style.backgroundImage = 'url(img/areaAnalysis_off.png)';	
	document.getElementById('rulerButton').style.backgroundImage = 'url(img/ruler_off.png)';
	document.getElementById('map').style.cursor = 'default';
	
}
function clearOverlays(mode) {
	//remove all or overlays with specified id
	var overlays = map.getOverlays();
	var overlaysArray = overlays.getArray().slice(0);
	
	for (var i = 0; i < overlaysArray.length; i++) {
		var o_id = overlaysArray[i].getId();
		if (mode == 'all') {
				overlays.remove(overlaysArray[i]);
		} else {
			if (o_id.indexOf(mode) != -1) {
				overlays.remove(overlaysArray[i]);
			}
		}
	}
}

function pixelAnalysis(evt) {
	// do not do anything if in tour mode unless at tour step 3
	if (typeof hopscotch.getCurrStepNum() != 'undefined') {
		if (hopscotch.getCurrStepNum() != 2 && hopscotch.getCurrStepNum() != 0) { 
			return;
		}
	}
	
	var coordinatesWGS = transform(evt.coordinate, 'EPSG:3857', 'EPSG:4326');
	
	// clear map
	clearOverlays('all');
	
	//zoom to pixel level if not zoomed in enough to show WGS84 VIIRS/DMSP pixel bounding box
	var view = map.getView();
	var zoom = view.getZoom();


// Draw VIIRS/DMSP pixel bounding box	
	var layer = getLayerByName('layerAnalysisArea');
	if (typeof layer == 'undefined') {
	// create new vector layer if it does not exist
		var layerAnalysisArea = new VectorLayer({
			name: "layerAnalysisArea",
			zIndex:2,
			updateWhileAnimating: true,
			source: new VectorSource({
				features: []
			})
		});
		
		map.addLayer(layerAnalysisArea);
		layer = getLayerByName('layerAnalysisArea');
		
	} else {
	// clear previous polygons
		layer.getSource().clear();
		
	}
	
	const gridSizeDMSP = 0.0083333333;
	const gridSizeVIIRS = 0.0041666667;

// draw VIIRS polyon
	var feature = new ol_Feature();	
	var cornerLon = Math.floor(coordinatesWGS[0] / gridSizeVIIRS)*gridSizeVIIRS + gridSizeVIIRS/2;
	var cornerLat = Math.floor(coordinatesWGS[1] / gridSizeVIIRS)*gridSizeVIIRS + gridSizeVIIRS/2;
	
	var ring = [[
		[cornerLon, cornerLat],
		[cornerLon + gridSizeVIIRS, cornerLat],
		[cornerLon + gridSizeVIIRS, cornerLat + gridSizeVIIRS],
		[cornerLon, cornerLat + gridSizeVIIRS],
		[cornerLon, cornerLat]
	]];
	
	var polygon = new ol_Geom_Polygon(ring);
		
	if (polygon.intersectsCoordinate(coordinatesWGS) == false) {
		polygon.translate(-gridSizeVIIRS, -gridSizeVIIRS);
		if (polygon.intersectsCoordinate(coordinatesWGS) == false) {
			polygon.translate(0, gridSizeVIIRS);
			if (polygon.intersectsCoordinate(coordinatesWGS) == false) {
				polygon.translate(0, gridSizeVIIRS);
				if (polygon.intersectsCoordinate(coordinatesWGS) == false) {
					polygon.translate(gridSizeVIIRS, 0);
					if (polygon.intersectsCoordinate(coordinatesWGS) == false) {
						polygon.translate(gridSizeVIIRS, 0);
						if (polygon.intersectsCoordinate(coordinatesWGS) == false) {
							polygon.translate(0, -gridSizeVIIRS);
							if (polygon.intersectsCoordinate(coordinatesWGS) == false) {
								polygon.translate(0, -gridSizeVIIRS);
								if (polygon.intersectsCoordinate(coordinatesWGS) == false) {
									polygon.translate(-gridSizeVIIRS, 0);	
								}
							}
						}
					}
				}
			}
		}
	}
	
	polygon = polygon.transform('EPSG:4326', 'EPSG:3857');	
	feature.setGeometry(polygon);
	var style = new ol_Style({
            stroke: new ol_Style_Stroke({ color: 'rgba(255, 0, 0, 1.0)', width: 2 }),
            text: new ol_Style_Text({
                text: "VIIRS",
				textAlign: 'end',
				placement: 'line',
				textBaseline: 'top',
                font: 'bold 12px Arial',
                fill: new ol_Style_Fill({ color: 'rgba(255, 0, 0, 1.0)' }),
                stroke: new ol_Style_Stroke({
                    color: '#000', width: 1
                })
            })
        });
	
	feature.setStyle(style)
	layer.getSource().addFeature(feature);
	
	
//draw DMSP polygon
	feature = new ol_Feature();	
	cornerLon = Math.floor(coordinatesWGS[0] / gridSizeDMSP)*gridSizeDMSP + gridSizeDMSP/2;
	cornerLat = Math.floor(coordinatesWGS[1] / gridSizeDMSP)*gridSizeDMSP + gridSizeDMSP/2;
	
	ring = [[
		[cornerLon, cornerLat],
		[cornerLon + gridSizeDMSP, cornerLat],
		[cornerLon + gridSizeDMSP, cornerLat + gridSizeDMSP],
		[cornerLon, cornerLat + gridSizeDMSP],
		[cornerLon, cornerLat]
	]];
	
	polygon = new ol_Geom_Polygon(ring);
	
	if (polygon.intersectsCoordinate(coordinatesWGS) == false) {
		polygon.translate(-gridSizeDMSP, -gridSizeDMSP);
		if (polygon.intersectsCoordinate(coordinatesWGS) == false) {
			polygon.translate(0, gridSizeDMSP);
			if (polygon.intersectsCoordinate(coordinatesWGS) == false) {
				polygon.translate(0, gridSizeDMSP);
				if (polygon.intersectsCoordinate(coordinatesWGS) == false) {
					polygon.translate(gridSizeDMSP, 0);
					if (polygon.intersectsCoordinate(coordinatesWGS) == false) {
						polygon.translate(gridSizeDMSP, 0);
						if (polygon.intersectsCoordinate(coordinatesWGS) == false) {
							polygon.translate(0, -gridSizeDMSP);
							if (polygon.intersectsCoordinate(coordinatesWGS) == false) {
								polygon.translate(0, -gridSizeDMSP);
								if (polygon.intersectsCoordinate(coordinatesWGS) == false) {
									polygon.translate(-gridSizeDMSP, 0);	
								}
							}
						}
					}
				}
			}
		}
	}
	
	polygon = polygon.transform('EPSG:4326', 'EPSG:3857');	
	feature.setGeometry(polygon);
	var style = new ol_Style({
            stroke: new ol_Style_Stroke({ color: 'rgba(255, 255, 0, 1.0)',  width: 2 }),
            text: new ol_Style_Text({
                text: "DMSP",
				textAlign: 'end',
				placement: 'line',
				textBaseline: 'top',
                font: 'bold 12px Arial',
                fill: new ol_Style_Fill({ color: 'rgba(255, 255, 0, 1.0)' }),
                stroke: new ol_Style_Stroke({
                    color: '#000', width: 1
                })
            })
        });
	
	feature.setStyle(style)
	layer.getSource().addFeature(feature);
	
// zoom to polygons with offset	and open analysisConfigWindow
	var extent = layer.getSource().getExtent();
	
	var padding = [0, 0, 0, 300];
	
	// check if layer config window is open
	if ($("#layerConfigWindow").width() > 100) {
		padding = [0, $("#layerConfigWindow").width(), 0, 300];
	}
	
	map.getView().fit(extent, {
		duration: 500,
		padding: padding,
		maxZoom: 13,
		callback: showPixelAnalysisConfigWindow(coordinatesWGS)
	});
	
}

function showPixelAnalysisConfigWindow(clickCoordinate) {
	
// coordinates
	var layer = getLayerByName('layerAnalysisArea');
	var geomVIIRS = (layer.getSource().getFeatures()[0].getGeometry().clone()).transform('EPSG:3857', 'EPSG:4326');
	var geomDMSP = (layer.getSource().getFeatures()[1].getGeometry().clone()).transform('EPSG:3857', 'EPSG:4326')

	$('#analysisConfigWindow_click').html(formatDegMinSec(clickCoordinate,1).join(", &nbsp;"));
	$('#analysisConfigWindow_click_d').html((clickCoordinate[0]).toFixed(6) + ", &nbsp;" + (clickCoordinate[1]).toFixed(6));
	$('#analysisConfigWindow_viirsCentroid').html("VIIRS: &nbsp;"+ formatDegMinSec(geomVIIRS.getInteriorPoint().getCoordinates(),1).join(", &nbsp;"));
	$('#analysisConfigWindow_dmspCentroid').html("DMSP: "+ formatDegMinSec(geomDMSP.getInteriorPoint().getCoordinates(), 1).join(", &nbsp;"));
	$('#analysisConfigWindow_viirsCentroid_d').html("VIIRS: &nbsp;"+ (geomVIIRS.getInteriorPoint().getCoordinates()[0]).toFixed(6) + ", &nbsp;" + (geomVIIRS.getInteriorPoint().getCoordinates()[1]).toFixed(6));
	$('#analysisConfigWindow_dmspCentroid_d').html("DMSP: "+ (geomDMSP.getInteriorPoint().getCoordinates()[0]).toFixed(6) + ", &nbsp;" + (geomDMSP.getInteriorPoint().getCoordinates()[1]).toFixed(6));
	
// area calculation	
	var areaVIIRS = getArea(geomVIIRS);
	var areaDMSP = getArea(geomDMSP);

	$('#analysisConfigWindow_viirsArea').html("VIIRS: "+ Math.round(100 * areaVIIRS/1000000)/100 +" km&#178;");
	$('#analysisConfigWindow_viirsArea').prop('title', areaVIIRS.toFixed() + " m^2");
	$('#analysisConfigWindow_dmspArea').html("DMSP: "+ Math.round(100 * areaDMSP/1000000)/100 +" km&#178;");
	$('#analysisConfigWindow_dmspArea').prop('title', areaDMSP.toFixed() + " m^2");

	
	
	
// show window if not visible
	if (!$("#analysisConfigWindow").is(":visible")) {
		$("#analysisConfigWindow" ).fadeToggle(function(){
			// Guided tour
			if (hopscotch.getCurrStepNum() == 2) {
				hopscotch.nextStep();
			}		
		});
	} else {
		// close chart if visible since new coordinates selected
		if ($("#chartWindow").is(":visible")) {
			$("#chartWindow").fadeToggle();
		}
	}
	
// scroll to top when new coordinates selected
	$("#analysisConfigWindowContent").animate({ scrollTop: 0 }, "slow");
}

function areaAnalysis() {

	map.removeInteraction(draw);

	var source = new VectorSource({wrapX: false});
	
	var vector = new VectorLayer({
		name: "layerAnalysisArea",
		zIndex: 2,
		source : source,
		style : new ol_Style({
			fill : new ol_Style_Fill({
				color : 'rgba(255, 0, 0, 0.1)'
			}),
			stroke : new ol_Style_Stroke({
				color : 'rgba(255, 0, 0, 1.0)',
				//lineDash : [10, 10],
				width : 3
			}),
			image : new ol_Style_Circle({
				radius : 7,
				fill : new ol_Style_Fill({
					color : 'rgba(255, 255, 255, 0.2)'
				})
			})
		})
	});
	
	map.addLayer(vector);
	
	function addInteraction() {
		draw = new ol_Interaction_Draw({
			source : source,
			type : 'Polygon',
			style : new ol_Style({
				fill : new ol_Style_Fill({
					color : 'rgba(255, 0, 0, 0.1)'
				}),
				stroke : new ol_Style_Stroke({
					color : 'rgba(255, 0, 0, 1.0)',
					width : 3
				}),
				image : new ol_Style_Circle({
					radius : 5,
					stroke : new ol_Style_Stroke({
						color : 'rgba(255, 0, 0, 1.0)'
					}),
					fill : new ol_Style_Fill({
						color : 'rgba(255, 255, 255, 0.2)'
					})
				})
			})
		});
		
		map.addInteraction(draw);
		
		draw.on('drawstart',
			function () {
			clearOverlays('all');
			vector.getSource().clear();
			analysisConfigWindow();
			// close analysisConfigWindow when starting to draw the polygon again
			if ($("#analysisConfigWindow").is(":visible")) {
				$("#analysisConfigWindow").fadeToggle();
				if ($("#chartWindow").is(":visible")) {
					$("#chartWindow" ).fadeToggle();
					
				}				
			}
		}, this);
		
		draw.on('drawend',	function (evt) {
			// draws feature
			drawFeature(evt.feature);
			
		}, this);
		
	}
	addInteraction();
}
function showAreaAnalysisConfigWindow(geom) {

// area calculation	
	var coordinatesWGS = geom.getLinearRing(0).getCoordinates();
	coordinatesWGS = coordinatesWGS.map(function(arr){
		return [(Math.round(arr[0] * 1e13) / 1e13).toFixed(13) + ", " + (Math.round(arr[1] * 1e13) / 1e13).toFixed(13)];
	});
	$('#analysisConfigWindow_polygon').html(coordinatesWGS.join("<br/>"));
	
// calculate area	
	var area_m = getArea(geom);
			
	$('#analysisConfigWindow_polygonArea').html(formatDecimalNumberArea(area_m) +" km&#178;");
	//$('#analysisConfigWindow_polygonArea').prop('title', area_m.toFixed() + " m^2");

						
//draw polygon that displays individual pixels only if area is small enough (1500 sq. km) 
	displayRasterPolygons();
	
// get centroid 
	$('#analysisConfigWindow_PolygonCentroid').html(formatDegMinSec(geom.getInteriorPoint().getCoordinates(), 1).join(", &nbsp;"));
	$('#analysisConfigWindow_PolygonCentroid_d').html((geom.getInteriorPoint().getCoordinates()[0]).toFixed(6) + ", &nbsp;" + (geom.getInteriorPoint().getCoordinates()[1]).toFixed(6));
	
// show window if not visible
	if (!$("#analysisConfigWindow").is(":visible")) {
		if (typeof hopscotch.getCurrStepNum() == 'undefined' || hopscotch.getCurrStepNum() == 0) {
			$("#analysisConfigWindow").fadeIn();		
		}
	} else {
		// close chart if visible since new coordinates selected
		if ($("#chartWindow").is(":visible")) {
			$("#chartWindow").fadeToggle();
		}
	}
	
// scroll to top when newly opened or refreshed
	$("#analysisConfigWindowContent").animate({ scrollTop: 0 }, "slow");
}
// Measure control
function measureCtrl() {
	var source = new VectorSource();
	var vector = new VectorLayer({
			name: "layerMeasureLength",
			zIndex: 2,
			source : source,
			style : new ol_Style({
				fill : new ol_Style_Fill({
					color : 'rgba(255, 0, 0, 1.0)'
				}),
				stroke : new ol_Style_Stroke({
					color : 'rgba(255, 0, 0, 1.0)',
					lineDash : [10, 10],
					width : 3
				}),
				image : new ol_Style_Circle({
					radius : 7,
					fill : new ol_Style_Fill({
						color : '#ffcc33'
					})
				})
			})
		});


	var sketch;
	var measureTooltipElement;
	var measureTooltip;
	
	var pointerMoveHandler = function (evt) {
		if (evt.dragging) {
			return;
		}		
		if (sketch) {
			var geom = (sketch.getGeometry());
		}
	};

	var layer = getLayerByName('layerMeasureLength');
	if (typeof(layer) != 'undefined') {
		map.removeLayer(getLayerByName('layerMeasureLength'));	
	}
	map.addLayer(vector);
	
	map.on('pointermove', pointerMoveHandler);

	var formatLength = function (line) {
		var length = 0;
		var coordinates = line.getCoordinates();
		var sourceProj = map.getView().getProjection();
		// geodesic
		//var wgs84Sphere = new ol.Sphere(6378137);
		for (var i = 0, ii = coordinates.length - 1; i < ii; ++i) {
			var c1 = transform(coordinates[i], sourceProj, 'EPSG:4326');
			var c2 = transform(coordinates[i + 1], sourceProj, 'EPSG:4326');
			length += getDistance(c1, c2);
		}
		var output;
		if (length >= 1000 && length <= 10000) {
			output = (Math.round(length / 1000 * 100) / 100) + ' ' + 'km';
		} else if (length >= 10000 && length <= 100000) {
			output = (Math.round(length / 1000 * 10) / 10) + ' ' + 'km';
		} else if (length < 1000) {
			output = Math.round(length) + ' ' + 'm';
		} else {
			output = Math.round(length / 1000) + ' ' + 'km';
		}
		return output;
	};

	function addInteraction() {
		draw = new ol_Interaction_Draw({
			source : source,
			type : 'LineString',
			style : new ol_Style({
				fill : new ol_Style_Fill({
					color : 'rgba(255, 255, 255, 0.0)'
				}),
				stroke : new ol_Style_Stroke({
					color : 'rgba(255, 0, 0, 1.0)',
					lineDash : [10, 10],
					width : 3
				}),
				image : new ol_Style_Circle({
					radius : 5,
					stroke : new ol_Style_Stroke({
						color : 'rgba(255, 0, 0, 1.0)'
					}),
					fill : new ol_Style_Fill({
						color : 'rgba(255, 255, 255, 0.2)'
					})
				})
			})
		});
		map.addInteraction(draw);
		
		createMeasureTooltip();
		
		var listener;
		draw.on('drawstart',
			function (evt) {
			// set sketch
			sketch = evt.feature;
			var tooltipCoord = evt.coordinate;
			
			listener = sketch.getGeometry().on('change', function (evt) {
					var geom = evt.target;
					var output;
					
					var azimuth;
					var lineCoordinates = geom.getCoordinates();
					var coords1 = { "x" : lineCoordinates[lineCoordinates.length-2][0], "y" : lineCoordinates[lineCoordinates.length-2][1]};
					var coords2 = { "x" : lineCoordinates[lineCoordinates.length-1][0], "y" : lineCoordinates[lineCoordinates.length-1][1]};
					
					var radians = Math.atan((coords2.y - coords1.y) / (coords2.x - coords1.x));
					var ang = radians * 180 / Math.PI;

					var xx = coords2.x - coords1.x;
					var yy = coords2.y - coords1.y;
					if (xx > 0) {
						azimuth = 90 - (Math.atan(yy/xx) * 180 / Math.PI);
					} else if (xx < 0) {
						azimuth = 270 - (Math.atan(yy/xx) * 180 / Math.PI);
					} else if (xx == 0) {
						if (yy > 0) {
							azimuth = 0;
						} else {
							azimuth = 180;
						}
					}

					output = formatLength(geom) + "  " + azimuth.toFixed(0) + "&deg;";
					tooltipCoord = geom.getLastCoordinate();
					
					measureTooltipElement.innerHTML = output;
					measureTooltip.setPosition(tooltipCoord);
				});
		}, this);
		
		draw.on('drawend',
			function (evt) {
			//measureTooltipElement.className = 'tooltip tooltip-static';
			
			//move label to linestring center
			var linestring =  evt.feature.getGeometry();
			var coordinates = linestring.getCoordinates();
			if (coordinates.length > 2) {
				measureTooltipElement.innerHTML = measureTooltipElement.innerHTML.split("  ")[0];
			}
			measureTooltip.setPosition(linestring.getCoordinateAt(0.5));
			
			//measureTooltip.setOffset([0, -7]);
			measureTooltip.setOffset([0, -7]);
			// unset sketch
			sketch = null;
			// unset tooltip so that a new one can be created
			measureTooltipElement = null;
			createMeasureTooltip();
			unByKey(listener);
		}, this);
	}
	function createMeasureTooltip() {
		if (measureTooltipElement) {
			measureTooltipElement.parentNode.removeChild(measureTooltipElement);
		}
		measureTooltipElement = document.createElement('div');
		measureTooltipElement.className = 'tooltip tooltip-measure';
		measureTooltip = new ol_Overlay({
				id: 'Measure',
				element : measureTooltipElement,
				offset : [0, -15],
				positioning : 'bottom-center'
			});
		map.addOverlay(measureTooltip);
	}
	addInteraction();
}
function initializeDialogWindowsAndMenus() {
	// show top bar menu if window size really small
	$("#topBar_menu_button").click(function() {
		$("#topBar_menu").fadeIn();
		setTimeout(function () {
			$("#topBar_menu").fadeOut();
		}, 2500);
	});
	
	// unlock max polygon area
	$("#unlock").click(function() {
		maxPolygonSize = 1e12;
	});	
	
	// guided tour button
	$("#tourButton").click(function() {
		// tour definition
		var tour = {
			id: "tour1",
			onClose: function() {
				// remove all highlighted items on exit
				$("#pixelAnalysisButton").removeClass("tourHighlight");
				$("#analysisConfigWindow_generateChartButton").removeClass("tourHighlight");
				$("#areaAnalysisButton").removeClass("tourHighlight");				
				removeInteractions();
				activeControl = '';
			},
			i18n: {
				// translations
				nextBtn: labels.tour_nextBtn.html,
				prevBtn: labels.tour_prevBtn.html,
				doneBtn: labels.tour_doneBtn.html,
				closeTooltip: labels.tour_closeTooltip.html
			},
			// tour steps
			steps: [{
					title: labels.tour_1_title.html,
					content: labels.tour_1_content.html,
					target: "zoomOutButton",
					placement: "right",
					yOffset: -15
				}, {
					title: labels.tour_2_title.html,
					content: labels.tour_2_content.html,
					target: "rulerButton",
					placement: "right",
					showPrevButton: true,
					xOffset: 0,
					yOffset: -15,
				}, {
					title: labels.tour_3_title.html,
					content: labels.tour_3_content.html,
					target: "pixelAnalysisButton",
					placement: "right",
					onShow: function () {
						$("#pixelAnalysisButton").addClass("tourHighlight");
					},
					onPrev: function () {
						$("#pixelAnalysisButton").removeClass("tourHighlight");
					},				
					showPrevButton: true,
					xOffset: 0,
					yOffset: -15,
					showNextButton: false
				}, {
					title: labels.tour_4_title.html,
					content: labels.tour_4_content.html,
					target: "analysisConfigWindow",
					placement: "right"					
				}, {
					title: labels.tour_5_title.html,
					content: labels.tour_5_content.html,
					target: "analysisConfigWindow_dmspCentroid",
					showPrevButton: true,
					placement: "bottom"
				}, {
					title: labels.tour_6_title.html,
					content: labels.tour_6_content.html,
					target: "analysisConfigWindow_rasterColumn_chosen",
					placement: "right",
					showPrevButton: true,
					yOffset: -15,
					onPrev: function () {
						$("#analysisConfigWindowContent").animate({
							scrollTop: 0
						}, 0);
					},
					onNext: function () {
						$("#analysisConfigWindowContent").animate({
							scrollTop: $("#analysisConfigWindowContent").height()
						}, 500);
					}
				}, {
					title: labels.tour_7_title.html,
					content: labels.tour_7_content.html,
					target: "analysisConfigWindow_generateChartButton",
					placement: "top",
					onShow: function () {
						$("#analysisConfigWindow_generateChartButton").addClass("tourHighlight");
					},
					onPrev: function () {
						$("#analysisConfigWindow_generateChartButton").removeClass("tourHighlight");
					},	
					showPrevButton: true,
					delay: 600,
					showNextButton: false
				}, {
					title: labels.tour_8_title.html,
					content: labels.tour_8_content.html,
					target: "chartWindow",
					placement: "left",
					showPrevButton: true,
					yOffset: 50,
					width: 250,
					onNext: function () {
						$("#chartWindowContent").animate({
							scrollTop: $("#chartWindowContent").height()
						}, 0);
					}
				}, {
					title: labels.tour_9_title.html,
					content: labels.tour_9_content.html,
					target: "chartNumbersContainer",
					placement: "top",
					showPrevButton: true,
					delay: 100
				}, {
					title: labels.tour_10_title.html,
					content: labels.tour_10_content.html,
					target: "exportContainer",
					showPrevButton: true,
					placement: "top",
					onNext: function () {
						$("#analysisConfigWindow_closer").click();
					}
				}, {
					title: labels.tour_11_title.html,
					content: labels.tour_11_content.html,
					target: "areaAnalysisButton",
					placement: "right",
					onShow: function () {
						$("#areaAnalysisButton").addClass("tourHighlight");
					},
					onPrev: function () {
						$("#areaAnalysisButton").removeClass("tourHighlight");
					},
					xOffset: 0,
					yOffset: -12,
					showNextButton: false
				}, {
					title: labels.tour_12_title.html,
					content: labels.tour_12_content.html,
					target: "analysisConfigWindow_polygon_tools_copyToClipboard",
					placement: "right",
					xOffset: -5,
					yOffset: -20,
					delay: 500,
					onShow: function () {
						//disable new polygon draw
						var currentInteractions = map.getInteractions();
						currentInteractions.forEach( function (evt) {
							if (evt instanceof ol_Interaction_Draw) {
								map.removeInteraction(evt);
							}
							
						}, this);
						// Select sum as aggregation method, so later on tour can show weighted sum options
						$("#analysisConfigWindow_areaOption1").val("sum").trigger('chosen:updated');
					}

				}, {
					title: labels.tour_13_title.html,
					content: labels.tour_13_content.html,
					target: "analysisConfigWindow_polygon_tools_download",
					placement: "right",
					showPrevButton: true,
					xOffset: -5,
					yOffset: -20
				}, {
					title: labels.tour_14_title.html,
					content: labels.tour_14_content.html,
					target: "analysisConfigWindow_polygon_tools_upload",
					placement: "right",
					showPrevButton: true,
					xOffset: -5,
					yOffset: -20
				}, {
					title: labels.tour_15_title.html,
					content: labels.tour_15_content.html,
					target: "analysisConfigWindow_polygonArea_label",
					placement: "top",
					showPrevButton: true,
					onNext: function () {
						$("#analysisConfigWindowContent").animate({
							scrollTop: $("#analysisConfigWindowContent").height()
						}, 0);
					}
				}, {
					title: labels.tour_16_title.html,
					content: labels.tour_16_content.html,
					target: "analysisConfigWindow_areaOption1_div",
					placement: "top",
					delay: 100,
					showPrevButton: true
				}, {
					title: labels.tour_25_title.html,
					content: labels.tour_25_content.html,
					target: "analysisConfigWindow_mask_div",
					placement: "top",
					onShow: function () {
						$("#analysisConfigWindow_generateChartButton").addClass("tourHighlight");
						// Select sum as aggregation method, so later on tour can show weighted sum options
						$("#analysisConfigWindow_areaOption1").val("sum").trigger('chosen:updated');
					},
					onPrev: function () {
						$("#analysisConfigWindow_generateChartButton").removeClass("tourHighlight");
					},	
					delay: 100,
					showNextButton: false,
					showPrevButton: true
				}, {
					title: labels.tour_17_title.html,
					content: labels.tour_17_content.html,
					target: "chartWindow",
					placement: "left",
					showPrevButton: true,
					yOffset: 50,
					width: 250
				}, {
					title: labels.tour_26_title.html,
					content: labels.tour_26_content.html,
					target: "chartValuesContainer",
					placement: "top",
					showPrevButton: true,
					yOffset: 0,
					width: 250,
					onNext: function () {
						// close config window
						$("#analysisConfigWindow_closer").click();
						// deselect area button
						removeInteractions();
						$("#areaAnalysisButton").css("background-image","url(img/areaAnalysis_off.png)");
						activeControl = '';
					}
				}, {
					title: labels.tour_18_title.html,
					content: labels.tour_18_content.html,
					target: "searchCont",
					placement: "bottom",
					yOffset: -20
				}, {
					title: labels.tour_19_title.html,
					content: labels.tour_19_content.html,
					target: "layerIcon",
					placement: "left",
					showPrevButton: true,
					onNext: function () {
						if ($("#layerConfigWindow").width() < 100) {
							$("#layerIcon").click();
						}
					}
				}, {
					title: labels.tour_20_title.html,
					content: labels.tour_20_content.html,
					target: "layerBing_chosen",
					placement: "left",
					yOffset: -20,
					delay: 500
				}, {
					title: labels.tour_21_title.html,
					content: labels.tour_21_content.html,
					target: "opacityCtrl",
					placement: "left",
					showPrevButton: true,
					yOffset: -20
				}, {
					title: labels.tour_22_title.html,
					content: labels.tour_22_content.html,
					target: "layerStyle_chosen",
					placement: "left",
					showPrevButton: true,
					yOffset: -20
				}, {
					title: labels.tour_23_title.html,
					content: labels.tour_23_content.html,
					target: "layerGraticuleCtrlCont_label",
					placement: "left",
					showPrevButton: true,
					yOffset: -20
				}, {
					title: labels.tour_24_title.html,
					content: labels.tour_24_content.html,
					target: "layerTree",
					placement: "left",
					showPrevButton: true,
					yOffset: -20
				}
			]
		};

		// Start the tour from begining and close config window if open
		if ($("#analysisConfigWindow").is(":visible")) {
			$("#analysisConfigWindow_closer").click();
		}		
		hopscotch.startTour(tour, 0);
	});
	
	// set export dropdown menus in chart window
	$('#exportItem').chosen({disable_search_threshold: 10, width: "110px" }).change(function(e) {
		var item = $('#exportItem').chosen().val();
		$('#exportFormat').empty();
		if (item == 'chart') {			
			$('#exportFormat').append($('<option>', {value: "svg",    text: 'svg (vector)'}));
			$('#exportFormat').append($('<option>', {value: "eps",    text: 'eps (vector)'}));
			$('#exportFormat').append($('<option>', {value: "png",    text: 'png (raster)'}));
			$('#exportFormat').append($('<option>', {value: "pdf",    text: 'pdf (vector)'}));
		} else {
			$('#exportFormat').append($('<option>', {value: "csv",    text: 'csv'}));
			$('#exportFormat').append($('<option>', {value: "excel",    text: 'excel'}));
			$('#exportFormat').append($('<option>', {value: "json",    text: 'json'}));	
		}
		
		$("#exportFormat").trigger("chosen:updated");
	});
	
	$('#exportFormat').chosen({disable_search_threshold: 10, width: "110px"}).on('chosen:showing_dropdown', function () {
		$("#chartWindowContent").animate({ scrollTop: $("#chartWindowContent").height() }, 2000);
	});
	
	// layer style control
	$('#layerStyle').chosen({disable_search_threshold: 10}).change(function(e) {
		var layer = getLayerByName('LayerLights');
		if (typeof layer != "undefined") {
			var layerSource = layer.getSource();
			
			let style = getLayerStyle(currentLayerLights);
			
			layerSource.updateParams({
				'STYLES': style
			});
		}
	});
	
	// basemap control
	$('#layerBing').chosen({disable_search_threshold: 10, width: "calc(100% - 18px)"}).change(function(e) {
		var bingLayers = ["LayerBingCanvasDark","LayerBingAerial","LayerBingRoad"];
		for (let i = 0; i < bingLayers.length; i++) {
			var layer = getLayerByName(bingLayers[i]);
			if (bingLayers[i] == $("#layerBing").chosen().val()) {
				layer.setVisible(true);
			} else {
				layer.setVisible(false);
			}
		}
	});
	
	// grid checkbox control
	$("#layerGraticuleCtrl").checkboxradio();
	$("#layerGraticuleCtrl").change(function() {
		if(this.checked) {
			drawGraticule();
		} else {
			map.removeLayer(getLayerByName('layerGraticule'));	
		}
	});
	
	//make dialog windows draggable and bring to front when active
	$(".draggable").draggable({ 
		handle: "h3",
		opacity: 0.4,
		stack: ".draggable"
	});
	
	// make chart window resizable
	$("#chartWindow").resizable({
        stop: function() {
			// trigger chart resize by resizing its container
			$("#canvasContainer").trigger("resize");			
		}
    });
	
	// toggles between decimal and deg/min/sec
	$(".degFormat").click(function() {
		$('.degFormat').toggle(0);
	});
	
	// close buttons
	$("#analysisConfigWindow_closer").click(function() {
		if (activeControl.indexOf("pixel") > -1) {
			// remove layer when doing pixel analysis
			map.removeLayer(getLayerByName('layerAnalysisArea'));				
		} else {
			// remove only features when doing area analysis
			let layer = getLayerByName('layerAnalysisArea');
			layer.getSource().clear();
		}
		$("#analysisConfigWindow").fadeOut();
		
		// also close chart if visible
		if ($("#chartWindow").is(":visible")) {
			$("#chartWindow").fadeOut();
		}
		// end tour if config window is closed by the user while on tour mode
		// except when tour at certain position
		var tourStep = hopscotch.getCurrStepNum();
		if (tourStep != 0 && tourStep != 10 && tourStep != 19) {
			hopscotch.endTour(true);
			$("#analysisConfigWindow_generateChartButton").removeClass("tourHighlight");
		}
	});
	
	$("#chartWindow_closer").click(function() {
		// close chart
		$("#chartWindow").fadeOut();
		
		// end tour if chart window is closed by the user while on tour mode
		var tourStep = hopscotch.getCurrStepNum();
		var tourStepsSkip = [7,8,9,17,18];
		if ($.inArray(tourStep, tourStepsSkip) != -1) {
			hopscotch.endTour(true);
		}
	});	
	
	//set year range slider					
	var minYear = 3000
	var maxYear = 0;
	var viirs_type = [];
	var dmsp_type = [];
	for (Object.key in layerList) {
		//year
		if (parseInt(layerList[Object.key].datestart.substring(0,4)) < minYear) {
			minYear = parseInt(layerList[Object.key].datestart.substring(0,4));
		}
		if (parseInt(layerList[Object.key].dateend.substring(0,4)) > maxYear) {
			maxYear = parseInt(layerList[Object.key].dateend.substring(0,4));
		}
		//sat. series
		if (Object.key.indexOf("dmsp_u") > -1) {
			if ($.inArray(layerList[Object.key].sattypes, dmsp_type) == -1) {
				dmsp_type.push(layerList[Object.key].sattypes);
			}
		} else if (Object.key.indexOf("viirs") > -1) {
			var fdfdf = $.inArray(layerList[Object.key].sattypes, viirs_type);
			if ($.inArray(layerList[Object.key].sattypes, viirs_type) == -1) {
				viirs_type.push(layerList[Object.key].sattypes);
			}							
		}							
	}

	// handle polygon tools clicks
	$("#analysisConfigWindow_polygon_tools_upload_input > input[type='file']").change(function() {		
		readTextFile(this);
	});
	$("#analysisConfigWindow_polygon_tools_upload_input > input[type=file]").click(function(){
		//to always trigger change event if filename is the same.
        $(this).val("");
    });
	
	$(".analysisConfigWindow_polygon_tool").click(function(evt) {
		var toolId = $(this)[0].id;
		if (toolId.indexOf("copyToClipboard") > 1) {
			// copy to clipboard
			window.getSelection().selectAllChildren(document.getElementById("analysisConfigWindow_polygon"));
			document.execCommand("copy");
			// deselect text
			window.getSelection().removeAllRanges();
			window.getSelection().empty();
			
		} else if (toolId.indexOf("download") > 1) {
			// file download
			var layer = getLayerByName('layerAnalysisArea');			
			var feature = layer.getSource().getFeatureById("drawnPolygon");

			var format = new ol_Format_WKT();
			var geometryWKT = format.writeFeature(feature, {
					dataProjection: 'EPSG:4326',
					featureProjection: 'EPSG:3857'
			});
			
			var FileSaver = require('file-saver');
			var blob = new Blob([geometryWKT], {type: "text/plain;charset=utf-8"});
			FileSaver.saveAs(blob, "polygon.txt");
			
		} else if (toolId.indexOf("upload") > 1) {
			// file upload
			evt.preventDefault();		
			$("#analysisConfigWindow_polygon_tools_upload_input > input[type='file']").click();				
		}
	});	
	
	
	
	$( function() {
		// analysisConfigWindow date interval slider
		$( "#analysisConfigWindow_dateIntervalSlider" ).slider({
			range: true,
			min: minYear,
			max: maxYear,
			values: [ 1992, maxYear],
			slide: function( event, ui ) {
				$("#analysisConfigWindow_displayYears").html(ui.values[0] + " - " + ui.values[1]);
			}
		});
		$( "#analysisConfigWindow_displayYears" ).html($("#analysisConfigWindow_dateIntervalSlider" ).slider("values", 0) + " - " + $( "#analysisConfigWindow_dateIntervalSlider" ).slider("values", 1));
		
		// layer opacity slider
		$( "#opacityCtrl" ).slider({
			range: false,
			min: 0,
			max: 100,
			value: 75,
			slide: function( event, ui ) {
				setLayerOpacity(ui.value);
				$("#opacityCtrlValue").html(ui.value + " %");
			}
		});
		setLayerOpacity($("#opacityCtrl" ).slider("value"));
		$("#opacityCtrlValue").html($("#opacityCtrl" ).slider("value") + " %");
	});
	
	$('#analysisConfigWindow_rasterColumn').chosen({disable_search_threshold: 10, width: "calc(100% - 18px)"});
	
	//populate sat. series select boxes
	for (let i = 0; i < dmsp_type.length; i++) {
		$('#analysisConfigWindow_dmspOption1').append($("<option />").val(dmsp_type[i]).text(dmsp_type[i]));
	}
	for (let i = 0; i < viirs_type.length; i++) {
		$('#analysisConfigWindow_viirsOption1').append($("<option />").val(viirs_type[i]).text(viirs_type[i].toUpperCase()));
	}
	$('#analysisConfigWindow_dmspOption1').chosen({disable_search_threshold: 10, width: "calc(100% - 18px)"});
	$('#analysisConfigWindow_viirsOption1').chosen({disable_search_threshold: 10, width: "calc(100% - 18px)"});
	$('#analysisConfigWindow_viirsOption2').chosen({disable_search_threshold: 10, width: "calc(100% - 18px)"});
	$('#analysisConfigWindow_viirsOption3').chosen({disable_search_threshold: 10, width: "calc(100% - 18px)"});
	
	
	
	//form show/hide gymnastics...
	$("#analysisConfigWindow_rasterColumn").change(function() {
		//draw polygon that displays individual pixels only if area is small enough (1500 sq. km)
		displayRasterPolygons();
		
		if (this.value == "viirs") {
			$("#analysisConfigWindow_viirsOption1_div").show(500);
			$("#analysisConfigWindow_option1_div").show(500);
			$("#analysisConfigWindow_viirsOption2_div").show(500);
			$("#analysisConfigWindow_dmspOption1_div").hide(500);
			if ($("#analysisConfigWindow_viirsOption2").val() == "monthly") {
				$("#analysisConfigWindow_viirsOption3_div").show(500);
				$("#analysisConfigWindow_option3_div").show(500);
			}
			$("#analysisConfigWindow_mask_div").show(500);			
		} else if (this.value == "dmsp_u") {											
			$(".analysisConfigWindow_viirsOptions").hide(500);
			$("#analysisConfigWindow_option3_div").hide(500);
			$("#analysisConfigWindow_dmspOption1_div").show(500);
			$("#analysisConfigWindow_option1_div").show(500);
			$("#analysisConfigWindow_mask_div").hide(500);
		} else {
			$(".analysisConfigWindow_viirsOptions").hide(500);
			$("#analysisConfigWindow_dmspOption1_div").hide(500);
			$("#analysisConfigWindow_mask_div").hide(500);
		}
	});
	
	$("#analysisConfigWindow_viirsOption2").chosen().change(function() {
		if (this.value == "monthly") {
			$("#analysisConfigWindow_option3_div").show(500);
		} else {
			$("#analysisConfigWindow_option3_div").hide(500);
		}	
	});

	// mask option
	$("#analysisConfigWindow_mask").chosen({disable_search_threshold: 10, width: "calc(100% - 18px)"}).change(function() {
		if (activeControl.indexOf("area") > -1) {
			displayRasterPolygons();
		}	
	});
	
	// area option
	$("#analysisConfigWindow_areaOption1").chosen({disable_search_threshold: 10, width: "calc(100% - 18px)"});
	
	// scrolls form on activating select dropdown menu
	$("#analysisConfigWindow_dmspOption1").chosen().on('chosen:showing_dropdown', function () {
		$("#analysisConfigWindowContent").animate({ scrollTop: $("#analysisConfigWindowContent").height() }, 2000);		
	});
	
	$("#analysisConfigWindow_viirsOption2").chosen().on('chosen:showing_dropdown', function () {
		$("#analysisConfigWindowContent").animate({ scrollTop: $("#analysisConfigWindowContent").height() }, 2000);		
	});
	
	$("#analysisConfigWindow_viirsOption3").chosen().on('chosen:showing_dropdown', function () {
		$("#analysisConfigWindowContent").animate({ scrollTop: $("#analysisConfigWindowContent").height() }, 2000);		
	});
	
	$("#analysisConfigWindow_areaOption1").chosen().on('chosen:showing_dropdown', function () {
		$("#analysisConfigWindowContent").animate({ scrollTop: $("#analysisConfigWindowContent").height() }, 2000);		
	});
	
	$("#analysisConfigWindow_mask").chosen().on('chosen:showing_dropdown', function () {
		$("#analysisConfigWindowContent").animate({ scrollTop: $("#analysisConfigWindowContent").height() }, 2000);		
	});
	
	// Chart request button
	$("#analysisConfigWindow_generateChartButton").button().click(function() {
		if (!$('#loadingIconGenerateChart').is(":visible")) {
			generateChartRequest();
			$("#analysisConfigWindow_generateChartButton").removeClass("tourHighlight");
		}
	});
	
	// export button
	$("#export_button").click(function() {
		if ($('#exportItem').chosen().val() == 'chart') {
			exportChart();
		} else {
			exportData();
		}	
	});
	
	// change trendline type on container click
	$('input[type=radio][name=t_type]').change(function() {
		var datasets = SVGChart.config.data.datasets;
		
		var trendType = 0;
		if ($("#chartValues_0").is(':checked') && this.value == 'exponential') {
			trendType = 1
		} else if ($("#chartValues_1").is(':checked') && this.value == 'exponential') {
			trendType = 3
		} else if ($("#chartValues_0").is(':checked') && this.value == 'linear') {
			trendType = 2
		} else if ($("#chartValues_1").is(':checked') && this.value == 'linear') {
			trendType = 4
		}
	
		for (let i = 0; i < datasets.length; i++) {
			var label = datasets[i].label;
			
			// hide all trendline except correct one
			if (label == "Trendline1" || label == "Trendline2" || label == "Trendline3" || label == "Trendline4" || label == "Trendline") {
				if (label == "Trendline" + trendType) {
					SVGChart.config.data.datasets[i].hidden = false;
				} else {
					SVGChart.config.data.datasets[i].hidden = true;
				}
				
			}
			if (label == "Trendline" && $("#chartTrendlineType_N").is(':checked')) {
				SVGChart.config.data.datasets[i].hidden = true;
				$("#chartNumbersContainer").fadeOut();
			}
			if (label == "Trendline" && !$("#chartTrendlineType_N").is(':checked')) {
				SVGChart.config.data.datasets[i].hidden = false;
				$("#chartNumbersContainer").fadeIn();
			}
		}
		
		// hide all equations and display correct one
		var equationsDivs = $("#chartNumbers").children();
		for (let i = 0; i < equationsDivs.length; i++) {
			$(equationsDivs[i]).hide();			
		}
		$("#chartNumbers_eq" + trendType).show();
		
		// update chart
		SVGChart.update();
	});
	
	// change radiance value weigting
	$('input[type=radio][name=v_type]').change(function() {
		var datasets = SVGChart.config.data.datasets;
		
		var trendType = 0;
		if ($("#chartTrendlineType_E").is(':checked') && this.value == '1') {
			trendType = 1
		} else if ($("#chartTrendlineType_L").is(':checked') && this.value == '1') {
			trendType = 2
		} else if ($("#chartTrendlineType_E").is(':checked') && this.value == '0') {
			trendType = 3
		} else if ($("#chartTrendlineType_L").is(':checked') && this.value == '0') {
			trendType = 4
		}
			
		for (let i = 0; i < datasets.length; i++) {
			var label = datasets[i].label;
			
			// swap y (unweighted) and z (weighted) values on the chart
			if (label.indexOf("Trendline") == -1) {
				for (let j = 0; j < datasets[i].data.length; j++) {
					
					let dataset_y = datasets[i].data[j].y;
					let dataset_z = datasets[i].data[j].z;
					datasets[i].data[j].y = dataset_z;
					datasets[i].data[j].z = dataset_y;					
				}				
			}
			
			// hide all trendline except correct one
			if (label == "Trendline1" || label == "Trendline2" || label == "Trendline3" || label == "Trendline4") {
				if (label == "Trendline" + trendType) {
					SVGChart.config.data.datasets[i].hidden = false;
				} else {
					SVGChart.config.data.datasets[i].hidden = true;
				}
				
			}
	
		}

		// hide all equations and display correct one
		var equationsDivs = $("#chartNumbers").children();
		for (let i = 0; i < equationsDivs.length; i++) {
			$(equationsDivs[i]).hide();			
		}
		$("#chartNumbers_eq" + trendType).show();
		
		// update chart
		SVGChart.update();
	});	
	
	
	// turn on latest yearly VIIRS layer
	$(function () {
		let yearly = [];
		let layers = Object.keys(layerList);
		// find yearly viirs layers
		for (let i = 0; i < layers.length; i++) {
			let layer = layers[i];
			if (layer.indexOf("viirs_") > -1) {
				if (layer.slice(-2) == "00") {
					yearly.push(layers[i]);
				}
				
			}
		}
		//pick last one
		$('#layerTree').jstree('select_node', 'jstree_'+ yearly[yearly.length-1]);
	});
	
	
	
}
function generateChartRequest() {
	//show loading icon
	$('#loadingIconGenerateChart').fadeToggle();
	// disable generate button
	
	$('#resultError').html("");
	//collect form data and verify minimum requirements are met
	var sattypes;
	var rasterColumnPrefix = $("#analysisConfigWindow_rasterColumn").val();
	var viirsOption2;
	var months;
	
	if ( rasterColumnPrefix == "dmsp_u" ) {				
		sattypes = $('#analysisConfigWindow_dmspOption1').val();
		//select all series if none are selected
		if (sattypes.length == 0) {
			sattypes = $.map($('#analysisConfigWindow_dmspOption1 option') ,function(option) {
				return option.value;
			});
		}				
	} else if ( rasterColumnPrefix == "viirs" ) {
		sattypes = $('#analysisConfigWindow_viirsOption1').val();
		//select all series if none are selected
		if (sattypes.length == 0) {
			sattypes = $.map($('#analysisConfigWindow_viirsOption1 option') ,function(option) {
				return option.value;
			});
		}
		viirsOption2 = $("#analysisConfigWindow_viirsOption2").val();
		//select all months if none are selected
		if (viirsOption2 == "monthly") {
			months = $('#analysisConfigWindow_viirsOption3').val();
			if (months.length == 0) {
				months = $.map($('#analysisConfigWindow_viirsOption3 option') ,function(option) {
					return option.value;
				});
			}

		}
		
	}
	
	//make a selection from layerList
	var layerListCopy = layerList;
	var rasterColumns = [];
	
	for (Object.key in layerList) {
		//check satellite match
		if (Object.key.indexOf(rasterColumnPrefix) > -1) {
			//check if times overlap
			var datestart = Date.parse(layerList[Object.key].datestart);
			var dateend = Date.parse(layerList[Object.key].dateend);			
			var dateCritStart = Date.parse($("#analysisConfigWindow_displayYears").html().split(" - ")[0] + "-01-01");
			var dateCritEnd = Date.parse($("#analysisConfigWindow_displayYears").html().split(" - ")[1] + "-12-31");					
			if (datestart <= dateCritEnd && dateend >= dateCritStart) {						
				if ( rasterColumnPrefix == "dmsp_u" ) {
					//check sat. types
					var sattype = layerList[Object.key].sattypes;
					var satTypeMatch = $.inArray(sattype, sattypes);
					if (satTypeMatch > -1) {
						rasterColumns.push(Object.key);
					}						
				} else if ( rasterColumnPrefix == "viirs" ) {
					//check sat. types
					var sattype = layerList[Object.key].sattypes;
					var satTypeMatch = $.inArray(sattype, sattypes);
					if (satTypeMatch > -1) {
						//check period (annual or monthly)
						var periodVIIRS = layerList[Object.key].period;
						if (viirsOption2 == "monthly") {
							if (viirsOption2 == periodVIIRS) {
								var monthVIIRS = layerList[Object.key].datestart.substring(5,7);
								var monthsMatch = $.inArray(monthVIIRS, months);
								if (monthsMatch > -1) {
									rasterColumns.push(Object.key);
								}
							}																			
						} else if (viirsOption2 == "annual") {
							if (viirsOption2 == periodVIIRS) {
								rasterColumns.push(Object.key);
							}
							
						}						
					}							
				} else if ( rasterColumnPrefix == "dmsp_c" ) {
					rasterColumns.push(Object.key);
				}
				
			}
			
		}				
	}
	// check if date interval and sat. series overlap ie. produces any valid raster columns
	if (rasterColumns.length == 0) {
		// display error		
		$('#resultError').html(labels.resultError_1.html);
		
		// clear error after 5 seconds
		setTimeout(function () {		
			$('#resultError').fadeOut(500);
			setTimeout(function () {$('#resultError').html(""); $('#resultError').show(0);}, 500);		
		}, 5000);
		
		$('#loadingIconGenerateChart').fadeToggle();
		
		// hide chart
		if ($("#chartWindow").is(":visible")) {
			$("#chartWindow").fadeToggle();
		}
		// scroll to error message on bottom
		$("#analysisConfigWindowContent").animate({ scrollTop: $("#analysisConfigWindowContent").height() }, "slow");
		
		return;
	}
	
	//create POST request			
	formData = new FormData();
	formData.append('format', 'json');	
	formData.append('rastercolumns', rasterColumns.join(";"));
	
	var queryType;
	if (activeControl.indexOf("area") > -1) {
		queryType = "area";
	} else {
		queryType = "point";
	}
	
	

	formData.append('querytype', queryType);
	
	if (queryType == 'area') {		
		formData.append('geometry', "LINESTRING(" + $("#analysisConfigWindow_polygon").html().replace(/,/g, '').replace(/<br>/g, ',') + ")");		
		queryType = $("#analysisConfigWindow_areaOption1").val();
		
	} else {
		formData.append('geometry', $("#analysisConfigWindow_click_d").html().replace(" &nbsp;",""));			
	}
	
	let mask = $("#analysisConfigWindow_mask").val();
	if (mask != "none") {
		formData.append('mask', $("#analysisConfigWindow_mask").val());
	}
	

	$.ajax({
		url: serviceUrl3,
		type: 'POST',
		processData: false,
		contentType: false,
		//dataType: 'json',
		data: formData,
		error: function (data) {
			// handle error
			$('#loadingIconGenerateChart').fadeToggle();
			showErrorPopup("Error", "Error");
		},
		success: function (data) {
			startChart(data, queryType);						
		}
	});
	
	//clear canvas
	try {										
		datasets = [];
		chartValues = [];
		graphData = {};
		SVGChart.destroy();
	} catch(err){
	
	}
	$("#canvas").remove();	
	$("#canvasContainer").html("&nbsp;");				
	$("#canvasContainer").append("<canvas id=\"canvas\"></canvas>");
}

function startChart(json, type) {
	
	//display no data message if no data 
	Chart.plugins.register({
		afterDatasetDraw: function(chart) {
			var chartEmpty = true;
			
			if (getMaxChartValue() != null) {
				chartEmpty = false;
			}
			
			if (chartEmpty == true) {
				// No data is present
				var ctx = chart.chart.ctx;
				var width = chart.chart.width;
				var height = chart.chart.height
				
				//chart.clear();
				ctx.save();
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.font = 'bold 30px arial';
				ctx.fillText(labels.resultError_3.html, width / 2, height / 2);
				ctx.restore();
			}
		}
	});
	
	//processData(data);
	
	var statisticsObj = json.statistics;

	//if error
	if (typeof json["result time"] == 'undefined') {
		$("#resultError").html(labels.resultError_2.html);
		
		// clear error after 5 seconds
		setTimeout(function () {		
			$('#resultError').fadeOut(500);
			setTimeout(function () {$('#resultError').html(""); $('#resultError').show(0);}, 500);		
		}, 5000);
		
		$('#loadingIconGenerateChart').fadeToggle();
		
		// hide chart
		if ($("#chartWindow").is(":visible")) {
			$("#chartWindow").fadeToggle();
		}
		// scroll to error message on bottom
		$("#analysisConfigWindowContent").animate({ scrollTop: $("#analysisConfigWindowContent").height() }, "slow");
		
		return;
	}

	
	//reset for new chart
	data_dmsp_f10 = [];
	data_dmsp_f12 = [];
	data_dmsp_f14 = [];
	data_dmsp_f15 = [];
	data_dmsp_f16 = [];
	data_dmsp_f18 = [];
	data_dmsp_cal = [];
	data_viirs_npp = [];
	data_viirs_npp2 = [];
	chartMinXValue = Date.parse('2025-01-01');
	chartMaxXValue = 0;
	
	for (var key in statisticsObj) {
		var rasterColumnName = key;
		var rasterColumnValue;
		var rasterColumnValueWeighted;
		var rasterPixelCount;
		
		if (type == 'point'){
			rasterColumnValue = statisticsObj[key];
		} else if (type == 'sum'){
			rasterColumnValue = statisticsObj[key][1];
			rasterColumnValueWeighted = statisticsObj[key][3];
			rasterPixelCount = statisticsObj[key][0];
		} else if (type == 'mean'){
			rasterColumnValue = statisticsObj[key][2];
			rasterPixelCount = statisticsObj[key][0];
		}
		
		
		
		//DMSP
		var seriesName;
		if (rasterColumnName.indexOf("dmsp") > -1) {
			seriesName = "DMSP"
			if (rasterColumnName.indexOf("_u_") > -1) {
				seriesName += " (uncal.) ";
				seriesName += "F" + rasterColumnName.substring(rasterColumnName.lastIndexOf("_")+2,rasterColumnName.lastIndexOf("_")+4);
			} else {
				//DMSP calibrated
				seriesName += " (cal.)";
			}
		} else {
		// VIIRS
			seriesName = "VIIRS "
			seriesName += (rasterColumnName.substring(rasterColumnName.indexOf("_")+1,rasterColumnName.lastIndexOf("_"))).toUpperCase();
		}
		
		var XYdata = {};
		
		for (var i = 0; i < 1; i++) {
			if (i == 0) {
			
				var d1 = Date.parse(layerList[rasterColumnName].datestart)
				var d2 = Date.parse(layerList[rasterColumnName].dateend)
				var d3 = new Date((d1+d2)/2)
				
				XYdata.x = d3.toISOString();	
				XYdata.y = rasterColumnValue;
				XYdata.z = rasterColumnValueWeighted;
				XYdata.label = layerList[rasterColumnName].datestart + " - " + layerList[rasterColumnName].dateend;
				XYdata.count = rasterPixelCount;
			} else if (i == 1){
				//insert a 3rd point to get unconnected lines
				XYdata.x = layerList[rasterColumnName].dateend + " 23:59:59";
				XYdata.y = null;
				XYdata.z = null;
			}
			
			
										
			if (seriesName.indexOf("F10") > -1) {
				data_dmsp_f10.push(XYdata);							
			} else if (seriesName.indexOf("F12") > -1) {
				data_dmsp_f12.push(XYdata);
			} else if (seriesName.indexOf("F14") > -1) {
				data_dmsp_f14.push(XYdata);
			} else if (seriesName.indexOf("F15") > -1) {
				data_dmsp_f15.push(XYdata);
			} else if (seriesName.indexOf("F16") > -1) {
				data_dmsp_f16.push(XYdata);
			} else if (seriesName.indexOf("F18") > -1) {
				data_dmsp_f18.push(XYdata);
			} else if (seriesName.indexOf("cal.") > -1) {
				data_dmsp_cal.push(XYdata);
			} else if (seriesName.indexOf(" NPP") > -1) {
				data_viirs_npp.push(XYdata);
			} else {
				data_viirs_npp2.push(XYdata);
			}
			
			chartValues.push(rasterColumnValue);
			XYdata = {};

			if (chartMinXValue > Date.parse(layerList[rasterColumnName].datestart)) {
				chartMinXValue = Date.parse(layerList[rasterColumnName].datestart);
			}
			if (chartMaxXValue < Date.parse(layerList[rasterColumnName].dateend)) {
				chartMaxXValue = Date.parse(layerList[rasterColumnName].dateend);
			}
		}					
	}
	
	//mark VIIRS skewed results by nodata in SUM and MEAN requests
	if (type != "point" && seriesName.indexOf("VIIRS") > -1) {
		var maxPixelCountsNPP = 0;
		for (var i = 0; i < data_viirs_npp.length; i++) {
			if (maxPixelCountsNPP < data_viirs_npp[i].count) {
				maxPixelCountsNPP = data_viirs_npp[i].count;
			}
			
		}				
		for (var i = 0; i < data_viirs_npp.length; i++) {
			if (maxPixelCountsNPP > data_viirs_npp[i].count) {
				var diff = maxPixelCountsNPP - data_viirs_npp[i].count;
				data_viirs_npp[i].count = data_viirs_npp[i].count + " (+"+ diff +" nodata!)";
			}
			
		}
		
		var maxPixelCountsNPP2 = 0;
		for (var i = 0; i < data_viirs_npp2.length; i++) {
			if (maxPixelCountsNPP2 < data_viirs_npp2[i].count) {
				maxPixelCountsNPP2 = data_viirs_npp2[i].count;
			}	
		}
		for (var i = 0; i < data_viirs_npp2.length; i++) {
			if (maxPixelCountsNPP2 > data_viirs_npp2[i].count) {
				var diff = maxPixelCountsNPP2 - data_viirs_npp2[i].count;
				data_viirs_npp2[i].count = data_viirs_npp2[i].count + " (+"+ diff +" nodata!)";
			}
		}				
	}
	
	//use only series that have data
	var AllSeries = [data_dmsp_f10, data_dmsp_f12, data_dmsp_f14, data_dmsp_f15, data_dmsp_f16, data_dmsp_f18, data_dmsp_cal, data_viirs_npp, data_viirs_npp2];

	for (var i = 0; i < AllSeries.length; i++) {
		
		if (AllSeries[i].length > 0) {
			// set transparency of a point to 10% when criteria met
			// for VIIRS area analysis
			let color = getColor(seriesNames[i]);
			let colorArr = [];
			for (var j = 0; j < AllSeries[i].length; j++) {
				let count = AllSeries[i][j].count;
				if (typeof count != 'undefined') {
					if (count != null) {
						if (count.toString().indexOf("nodata") > -1) {
							let countSplit = count.split(" ");
							// if 10% pixels are nodata, mark them differently 
							let nodata_content = parseInt((countSplit[1]).replace("(+","")) / (parseInt((countSplit[1]).replace("(+","")) + parseInt(countSplit[0]));				
							if (nodata_content > 0.1 ) {
								colorArr.push(color.replace("1)","0.1)"));
								AllSeries[i][j].trendline = false;
							} else {
								colorArr.push(color);
								AllSeries[i][j].trendline = true;
							}					
						} else {
							colorArr.push(color);
							AllSeries[i][j].trendline = true;
						}
					}
				} else {
					colorArr.push(color);
					AllSeries[i][j].trendline = true;
				}
			}
			
			var datasetObj = {
				label: seriesNames[i],
				backgroundColor: getColor(seriesNames[i]),
				borderColor: getColor(seriesNames[i]),
				pointStyle: getStyle(seriesNames[i]),
				pointBackgroundColor: colorArr,
				pointBorderColor: colorArr,
				radius: 6,
				pointRadius: 6,
				pointHitRadius: 6,
				pointHoverRadius: 9,
				pointHoverBorderWidth: 2,
				fill: false,
				data: AllSeries[i],
				spanGaps: true,
				//cubicInterpolationMode: 'default',
				//steppedLine: true,
				lineTension: 0.1,
				showLine: false //no line between datapoints
			};
			datasets.push(datasetObj);
		}
	}
	
	// set radiance weighted values off by default
	$("#chartValues_0").prop("checked", true);
	$("#chartValues_1").prop("checked", false);
	
//add trendline if at least 3 datapoints exist

	var x_trend = [];
	var x_trend_all = [];
	var y_trend = [];
	var y_trend_w = [];
	
	for (var j = 0; j < AllSeries.length; j++){
		for (var i = 0; i < AllSeries[j].length; i++){
			if (AllSeries[j][i].length == 0) {
				continue;
			}
			if (AllSeries[j][i].trendline == false) {
				continue;
			}
			var uniqueX = jQuery.inArray( AllSeries[j][i].x, x_trend);
			
			if (uniqueX == -1) {
				if (AllSeries[j][i].y != null) {				
					x_trend.push(AllSeries[j][i].x);
					y_trend.push(AllSeries[j][i].y);
					y_trend_w.push(AllSeries[j][i].z);
				}
				x_trend_all.push(AllSeries[j][i].x);
			} else {
				if (AllSeries[j][i].y != null) {
					var X_value = AllSeries[j][i].x;
					var Y_index = x_trend.findIndex(function(age) {return age == X_value;});
					var oldY = y_trend[Y_index];
					var newY = (AllSeries[j][i].y + oldY)/2
					y_trend[Y_index] = newY;
				}
				if (AllSeries[j][i].z != null) {
					var X_value = AllSeries[j][i].x;
					var Y_index = x_trend.findIndex(function(age) {return age == X_value;});
					var oldY = y_trend_w[Y_index];
					var newY = (AllSeries[j][i].z + oldY)/2
					y_trend_w[Y_index] = newY;
				}
			}			
		}
	}	
	
	// if 3, do trendline
	if (x_trend.length >= 3){
					
		var dataReg = [];
		var dataReg_w = [];
		for (var i = 0; i < x_trend.length; i++){
			// same epoch as excel 1900
			dataReg.push([Math.round(Date.parse(x_trend[i])/86400000 + 25568.5),y_trend[i]]);
			dataReg_w.push([Math.round(Date.parse(x_trend[i])/86400000 + 25568.5),y_trend_w[i]]);
		}
		
		//Exponential regression for original and weighted data
		const resultRegExp = regression.exponential(dataReg, {
			precision: 16,
		});

		const resultRegExp_w = regression.exponential(dataReg_w, {
			precision: 16,
		});
		
		//Linear regression for original and weighted data
		const resultRegLin = regression.linear(dataReg, {
			precision: 16,
		});

		const resultRegLin_w = regression.linear(dataReg_w, {
			precision: 16,
		});	
		
		// create trendline datasets
		$("#chartNumbers").empty();
		$("#chartTrendlineType_E").prop("disabled", false);	
		$("#chartTrendlineType_E").prop("checked", true);
		
		for (var j = 0; j < 2; j++){
			var trendline = [];
			var trendline_w = [];
			var prevY = 0;
			var prevY_w = 0;
			var prevX = 0;
			var prevX_w = 0;
			var changePerDay = [];
			var changePerDay_w = [];
			var changePerYear = 0;
			var changePerYear_w = 0;
					
			for (var i = 0; i < x_trend_all.length; i++){
				
				//let a = resultRegExp.equation[0];
				//let b = resultRegExp.equation[1];
				let x = Math.round(Date.parse(x_trend_all[i])/86400000 + 25568.5);	
					//x = x - Math.round(Date.parse(x_trend_all[0])/86400000 + 25568.5) + 1;		
				let xy_obj = {};
				let xy_obj_w = {};
				xy_obj.x = x_trend_all[i];
				xy_obj_w.x = x_trend_all[i];
				
				if (j == 0) {
					xy_obj.y = resultRegExp.predict(x)[1];
					xy_obj_w.y = resultRegExp_w.predict(x)[1];
					
				} else {
					xy_obj.y = resultRegLin.predict(x)[1];
					xy_obj_w.y = resultRegLin_w.predict(x)[1];
				}
				
				xy_obj.label = ""; 
				xy_obj_w.label = ""; 
				trendline.push(xy_obj);
				trendline_w.push(xy_obj_w);
				
				
				if (i > 0) {
					let a = (xy_obj.y - prevY)/(x - prevX);
					let a_w = (xy_obj_w.y - prevY_w)/(x - prevX_w);
					changePerDay.push(a);
					changePerDay_w.push(a_w);
				}
				prevY = xy_obj.y;
				prevY_w = xy_obj_w.y;
				prevX = x;
				prevX_w = x;
			}	
			var changePerDayAvg =  changePerDay.map(function(x,i,arr){return x/arr.length}).reduce(function(a,b){return a + b});
			var changePerDayAvg_w =  changePerDay_w.map(function(x,i,arr){return x/arr.length}).reduce(function(a,b){return a + b});
			
			var chartNumbersHTML = ""
				if (j == 0) {
					//original
					changePerYear = (resultRegExp.predict(Math.round(Date.parse(x_trend_all[0])/86400000 + 25568.5 + 364.25))[1]/resultRegExp.predict(Math.round(Date.parse(x_trend_all[0])/86400000 + 25568.5))[1]) - 1;
					chartNumbersHTML += "<div id='chartNumbers_eq1'><span id='chartNumbers_equation1' class='label eq1' title='"+ labels.chartNumbers_equation1.title +"'>Y = " + formatSciNumber(resultRegExp.equation[0].toExponential(2))  + " * e<sup>"+ formatSciNumber(resultRegExp.equation[1].toExponential(2)) +" * x</sup></span><br/>";		
					chartNumbersHTML += "<span id='chartNumbers_coef1' class='label eq1' title='"+ labels.chartNumbers_coef.title +"'>R² = "+ Math.round(resultRegExp.r2 * 100)/100 +"</span></br>";
					chartNumbersHTML += "<span id='chartNumbers_delta1' class='label eq1' title='"+ labels.chartNumbers_delta.title +"'>&Delta;: " + Math.round(changePerYear * 10000)/100 + "% / </span><span id='chartNumbers_delta_year1' class='label  eq1'>"+ labels.chartNumbers_delta_year1.html +"</span></div>";
					//weighted
					changePerYear_w = (resultRegExp_w.predict(Math.round(Date.parse(x_trend_all[0])/86400000 + 25568.5 + 364.25))[1]/resultRegExp_w.predict(Math.round(Date.parse(x_trend_all[0])/86400000 + 25568.5))[1]) - 1;
					chartNumbersHTML += "<div id='chartNumbers_eq3' style='display:none;><span id='chartNumbers_equation3' class='label eq1' title='"+ labels.chartNumbers_equation1.title +"'>Y = " + formatSciNumber(resultRegExp_w.equation[0].toExponential(2))  + " * e<sup>"+ formatSciNumber(resultRegExp_w.equation[1].toExponential(2)) +" * x</sup></span><br/>";		
					chartNumbersHTML += "<span id='chartNumbers_coef3' class='label eq1' title='"+ labels.chartNumbers_coef.title +"'>R² = "+ Math.round(resultRegExp.r2 * 100)/100 +"</span></br>";
					chartNumbersHTML += "<span id='chartNumbers_delta3' class='label eq1' title='"+ labels.chartNumbers_delta.title +"'>&Delta;: " + Math.round(changePerYear_w * 10000)/100 + "% / </span><span id='chartNumbers_delta_year3' class='label  eq1'>"+ labels.chartNumbers_delta_year3.html +"</span></div>";	
				} else {
					//original
					changePerYear = resultRegLin.predict(Math.round(Date.parse(x_trend_all[0])/86400000 + 25568.5 + 364.25))[1] - resultRegLin.predict(Math.round(Date.parse(x_trend_all[0])/86400000 + 25568.5))[1];
					chartNumbersHTML += "<div id='chartNumbers_eq2' style='display:none;'><span id='chartNumbers_equation2' class='label eq2' title='"+ labels.chartNumbers_equation2.title +"'>Y = " + formatSciNumber(resultRegLin.equation[0].toExponential(2)) + " * x + "+ formatSciNumber(resultRegLin.equation[1].toExponential(2)) +"</span><br/>";
					chartNumbersHTML += "<span id='chartNumbers_coef2' class='label eq2'  title='"+ labels.chartNumbers_coef.title +"'>R² = "+ Math.round(resultRegLin.r2 * 100)/100 +"</span></br>";
					chartNumbersHTML += "<span id='chartNumbers_delta2' class='label eq2' title='"+ labels.chartNumbers_delta.title +"'>&Delta;: " + formatSciNumber(changePerYear.toExponential(2)) + " " + getScaleLabel() + " / </span><span id='chartNumbers_delta_year2' class='label eq2'>"+ labels.chartNumbers_delta_year2.html +"</span></div>";
					//weighted
					changePerYear_w = resultRegLin_w.predict(Math.round(Date.parse(x_trend_all[0])/86400000 + 25568.5 + 364.25))[1] - resultRegLin_w.predict(Math.round(Date.parse(x_trend_all[0])/86400000 + 25568.5))[1];
					chartNumbersHTML += "<div id='chartNumbers_eq4' style='display:none;'><span id='chartNumbers_equation4' class='label eq2' title='"+ labels.chartNumbers_equation2.title +"'>Y = " + formatSciNumber(resultRegLin_w.equation[0].toExponential(2)) + " * x + "+ formatSciNumber(resultRegLin_w.equation[1].toExponential(2)) +"</span><br/>";
					chartNumbersHTML += "<span id='chartNumbers_coef4' class='label eq2'  title='"+ labels.chartNumbers_coef.title +"'>R² = "+ Math.round(resultRegLin.r2 * 100)/100 +"</span></br>";
					chartNumbersHTML += "<span id='chartNumbers_delta4' class='label eq2' title='"+ labels.chartNumbers_delta.title +"'>&Delta;: " + formatSciNumber(changePerYear_w.toExponential(2)) + " " + getScaleLabel() + " / </span><span id='chartNumbers_delta_year4' class='label eq2'>"+ labels.chartNumbers_delta_year4.html +"</span></div>";
					chartNumbersHTML = chartNumbersHTML.replace("+ -", "- ");
				}			
		
			$("#chartNumbers").append(chartNumbersHTML);

			// create lineon chart
			var datasetObj = {
				backgroundColor: "rgba(255, 0, 0, 0.3)",
				borderColor: "rgba(255, 0, 0, 0.3)",
				pointStyle: "dash",
				radius: 2,
				pointRadius: 2,
				pointHitRadius: 2,
				pointHoverRadius: 2,
				pointHoverBorderWidth: 2,
				fill: false,
				data: trendline,
				spanGaps: true,
				//cubicInterpolationMode: 'default',
				//steppedLine: true,
				lineTension: 0.1,
				borderDash: [10, 10]
			};
			var datasetObj_w = {
				backgroundColor: "rgba(255, 0, 0, 0.3)",
				borderColor: "rgba(255, 0, 0, 0.3)",
				pointStyle: "dash",
				radius: 2,
				pointRadius: 2,
				pointHitRadius: 2,
				pointHoverRadius: 2,
				pointHoverBorderWidth: 2,
				fill: false,
				data: trendline_w,
				spanGaps: true,
				//cubicInterpolationMode: 'default',
				//steppedLine: true,
				lineTension: 0.1,
				borderDash: [10, 10]
			};
			
			//hide all trendline lines at start, except exponential original
			if (j == 1) {
				datasetObj.hidden = true;
				datasetObj_w.hidden = true;
				
				datasetObj.label = "Trendline2"; // linear
				datasetObj_w.label = "Trendline4"; // linear
			} else {
				datasetObj_w.hidden = true;
				datasetObj.label = "Trendline1"; // exponential
				datasetObj_w.label = "Trendline3"; // exponential
			}
			// hide exponential and switch to linear if exponential not possible because of negative values
			if (isNaN(resultRegExp.r2)) {
				if (j == 1) {
					datasetObj.hidden = false;
					datasetObj_w.hidden = true;
					
					// set trendline radio button to linear and disable trendline radio buttons	)
					$("#chartTrendlineType_E").prop("disabled", true);
					$("#chartTrendlineType_L").prop("checked", true);
					$("#chartNumbers_eq1").hide();
					$("#chartNumbers_eq1_w").hide();
					$("#chartNumbers_eq2").show();
					$("#chartNumbers_eq2_w").hide();
				} else {
					datasetObj.hidden = true;
					datasetObj_w.hidden = true;					
				}			
			}
			
			datasets.push(datasetObj);
			datasets.push(datasetObj_w);			
		}
	

		// show trendline attributes below chart
		$("#chartNumbersContainer").fadeIn();
		
		// fake trendline legend
		datasets.push({
			label: labels.chartTrendline.html,
			backgroundColor: "rgba(255, 0, 0, 0.3)",
			borderColor: "rgba(255, 0, 0, 0.3)",
			pointStyle: "dash",
			radius: 2,
			pointRadius: 2,
			pointHitRadius: 2,
			pointHoverRadius: 2,
			pointHoverBorderWidth: 2,
			fill: false,
			spanGaps: true,
			lineTension: 0.1,
			borderDash: [10, 10]
		});
		// show trendline windows below chart
		$("#chartNumbersContainer").fadeIn();
		$("#chartTrendlineTypeContainer").fadeIn();
		$("#chartValuesContainer").fadeIn();
	} else {
		// hide trendline windows below chart
		$("#chartNumbersContainer").fadeOut();
		$("#chartTrendlineTypeContainer").fadeOut();
		$("#chartValuesContainer").fadeOut();
	}

	// show export options below chart if at least one datapoint exists
	if (x_trend.length > 0){
		$("#exportContainer").fadeIn();
	} else {
		$("#exportContainer").fadeOut();
	}

	
	var ctx = document.getElementById('canvas').getContext('2d');

	graphData = {
		type: 'line',
		data: { datasets: datasets },
		options: {
		    animation: {
				duration: 0
			},
			responsive: true,
			title: {
				display: true,
				text: getTitle(),
				fontSize: 16
			},
			legend: {
				position: 'right',
				onClick: function(e, legendItem) {
					//do nothing onclick
				},
				labels: {
					usePointStyle: true,
					filter: function(item, chart) {
						// Remove trendline from legend
						if (item.text == "Trendline1" || item.text == "Trendline2" || item.text == "Trendline3" || item.text == "Trendline4") {
							return false;
						} else {
							if (item.text == "Trendline" && $("#chartTrendlineType_N").is(':checked') == true) {
								return false;
							}
							return true;
						}
						
					}
				}							
			},
			tooltips: {
				callbacks: {
					title: function(tooltipItems, data) { 						
						if (tooltipItems.length > 0) {
							var datasetIndex = tooltipItems[0].datasetIndex;
							var index = tooltipItems[0].index;										
							var dataset = datasets[datasetIndex]
							var title = dataset.data[index].label;
							return title;
						} else {
							return;
						}
						
					},
					footer: function(tooltipItems, data) {
						//show footer with pixels aggregated when sum or mean
						if (tooltipItems.length > 0) {
							var datasetIndex = tooltipItems[0].datasetIndex;
							var index = tooltipItems[0].index;								
							var dataset = datasets[datasetIndex]
							var footer = "     " + labels.chartPopup_footer.html + ": " + dataset.data[index].count;
							if (typeof dataset.data[index].count != 'undefined') {
								return footer;
							}							
						} else {
							return;
						}								
					}
				},
				filter: function (tooltipItem, data) {
					// do not show tooltips for trendline
				   var label = data.datasets[tooltipItem.datasetIndex].label
				   if (label == "Trendline1" || label == "Trendline2" || label == "Trendline3" || label == "Trendline4") {
					 return false;
				   } else {
					 return true;
				   }
				},
				position: 'nearest',
				intersect: false,
				footerFontStyle: 'normal',
				footerFontSize: 10,
				footerMarginTop: 8
			},
			hover: {
				mode: 'nearest',
				intersect: false
			},
			scales: {
				xAxes: [{								
					type: 'time',
					time: {
						unit: 'year',
						unitStepSize: 1,
						displayFormats: {
							year: 'YYYY'
						},
						min: chartMinXValue - 100000000,
						max: chartMaxXValue + 100000000
					},
					ticks: {
						autoSkip: true
					},
					scaleLabel: {
						display: true,
						labelString: labels.chartScaleLabel_4.html
					}
				}],   
				yAxes: [{
					type: 'linear',
					ticks: {
						autoSkip: true,
						beginAtZero: false,
						suggestedMax: chartYLimit()[0],
						//min: chartYLimit()[1],
						callback: function(value, index, values) {									
							return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
						}
					},
					scaleLabel: {
						display: true,
						labelString: getScaleLabel()
					}
				}]
			},
			onClick: chartClickEvent
		}
	};					
	
	SVGChart = new Chart(ctx, graphData);
	//show chart
	if (!$("#chartWindow").is(":visible")) {
		$("#chartWindow").fadeToggle();
	}
	
	
	
	//set canvas size
	var chartWidth = $("#chartWindowContent").width();
	$(".chart").css("width", chartWidth-22 + "px")
	$(".chart").css("height", Math.round(chartWidth/2) + "px")
	// Guided tour
	if (hopscotch.getCurrStepNum() == 6 || hopscotch.getCurrStepNum() == 16) {
		hopscotch.nextStep();
	}
	//hide loading icon
	$('#loadingIconGenerateChart').fadeToggle();
	
	//hide Radiance values property window if pixel mode is selected
	if (type == 'point' || type == 'mean'){
		$("#chartValuesContainer").hide();		
	} else {
		$("#chartValuesContainer").show();
	}
	
}

//color for each series
function getColor(satType) {
	var color;
	switch(satType) {
		case "DMSP F10":
			color = "rgba(0, 153, 51, 1)";
			break;
		case "DMSP F12":
			color = "rgba(0, 153, 153, 1)";
			break;
		case "DMSP F14":
			color = "rgba(255, 127, 0, 1)";
			break;
		case "DMSP F15":
			color = "rgba(128, 128, 128, 1)";
			break;
		case "DMSP F16":
			color = "rgba(255, 0, 0, 1)";
			break;
		case "DMSP F18":
			color = "rgba(255, 0, 255, 1)";
			break;
		case "VIIRS NPP":
			color = "rgba(0, 0, 255, 1)";
			break;
		case "DMSP (cal.)":
			color = "rgba(0, 0, 0, 1)";
			break;
		default:
			color = "rgba(0, 127, 255, 1)";
	}
	return color;
}

//symbols for each series
function getStyle(satType) {
	var style;
	switch(satType) {
		case "DMSP F10":
			style = "circle";
			break;
		case "DMSP F12":
			style = "cross";
			break;
		case "DMSP F14":
			style = "crossRot";
			break;
		case "DMSP F15":
			style = "triangle";
			break;
		case "DMSP F16":
			style = "rectRounded";
			break;
		case "DMSP F18":
			style = "star";
			break;
		case "VIIRS NPP":
			style = "rectRot";
			break;
		case "DMSP (cal.)":
			style = "star";
			break;
		default:
			color = "dash";
	}
	return style;
}

function getMaxChartValue() {			
	chartValues.sort(function(a, b) { return a - b });	
	var max = chartValues[chartValues.length-1];
	chartMaxYValue = max;
	return max;
}

function getMinChartValue() {
	var min;				
	chartValues.sort(function(a, b) { return a - b });				
	for (var i = 0; i < chartValues.length; i++) {
		if (chartValues[i] != null) {
			min = chartValues[i];
			break; 
		}
	}
	chartMinYValue = min;				
	return min;
}
function chartYLimit() {
	var max = getMaxChartValue();
	var min = getMinChartValue();
	var range = (max - min)*0.1;
	max = max + range;
	min = min - range;
	return [max, min];
}

function getTitle() {
	var title = "";
	var layerType;
	var area;
	if ($("#analysisConfigWindow_rasterColumn").val() == 'viirs'){
		layerType = "DNB"
	} else {
		layerType = "DMSP"
	}

	if (activeControl == 'pixelAnalysis'){
		title = labels.chartTitle_1_1.html + " " + layerType + " " + labels.chartTitle_1_2.html + " " + formatDecimalCoordinate($("#analysisConfigWindow_click_d").html()) +".";
	} else {
		area = $("#analysisConfigWindow_polygonArea").html().replace(")","").split(": ");
		// get polygon area if selected pixel area not available (ie. polygon too large)
		if (typeof area[1] == 'undefined') {
			area[1] = area[0];		
		}
		if ($("#analysisConfigWindow_areaOption1").val() == "sum") {
			title = labels.chartTitle_2_1.html + " " + area[1] + " " + labels.chartTitle_2_2.html + " " + formatDecimalCoordinate($("#analysisConfigWindow_PolygonCentroid_d").html()) +".";
		} else {
			title = labels.chartTitle_3_1.html + " " + area[1] + " " + labels.chartTitle_3_2.html + " " + formatDecimalCoordinate($("#analysisConfigWindow_PolygonCentroid_d").html()) +".";
		}
	}		
	return title;
}
function getScaleLabel() {
	var scaleLabel = "";
	if ($("#analysisConfigWindow_rasterColumn").val() == 'dmsp_u'){
		scaleLabel = labels.chartScaleLabel_1.html;
	} else if ($("#analysisConfigWindow_rasterColumn").val() == 'viirs'){
		scaleLabel = labels.chartScaleLabel_2.html;
	} else if ($("#analysisConfigWindow_rasterColumn").val() == 'dmsp_c'){
		scaleLabel =  labels.chartScaleLabel_3.html;
	}		
	return scaleLabel;						
}
//toggles setting Y axis from zero
function chartClickEvent(e, array) {
	if (YaxisMode == "default") {
		SVGChart.options.scales.yAxes[0].type = 'linear';
		SVGChart.options.scales.yAxes[0].ticks.beginAtZero = true;
		YaxisMode = "zero"
	} else if (YaxisMode == "zero") {
		//can't show logaritmic scale if any value below zero
		SVGChart.options.scales.yAxes[0].ticks.beginAtZero = false;
		if (chartMinYValue >= 0) {
			
			SVGChart.options.scales.yAxes[0].type = 'logarithmic';
		}			
		YaxisMode = "logarithmic"
	} else if (YaxisMode == "logarithmic") {
		SVGChart.options.scales.yAxes[0].ticks.beginAtZero = false;
		SVGChart.options.scales.yAxes[0].type = 'linear';
		YaxisMode = "default"
	}
		
	SVGChart.update();
}

//exports first to SVG, 
//then if needed sends SVG to server for other formats
function exportChart() {	
	//show loading icon
	$('#loadingIconExport').fadeIn();
	$('#exportArrow').css('background-size','0px');
	var svgCtx = C2S(1000,500);
	graphData.options.responsive = false;
	graphData.options.animation = false;
	SVGChart = new Chart(svgCtx, graphData);
	
	svgString = svgCtx.getSerializedSvg(true);
	graphData.options.responsive = true;
	delete graphData.options.animation;
	
	//clear canvas
	$("#canvas").remove();		
	$("#canvasContainer").append("<canvas id=\"canvas\"></canvas>");
	
	//recreate chart
	var ctx = document.getElementById('canvas').getContext('2d');
	SVGChart = new Chart(ctx, graphData);
	
	//stops the animation when starting a new instance
	SVGChart.render({
		duration: 0
	});
	
	var exportFormat = $('#exportFormat').chosen().val();
	var svgBlob = new Blob([svgString], {'type': "image/svg+xml"});
	
	if (exportFormat == 'svg') {
		// use FileSaver to download the file
		var FileSaver = require('file-saver');
		FileSaver.saveAs(svgBlob, "Data." + exportFormat);

		//hide loading icon
		$('#loadingIconExport').hide();
		$('#exportArrow').css('background-size','contain');
	} else {	
		//prepare form for POST request
		var svgFormData = new FormData();
		svgFormData.append('svg', svgBlob);
		svgFormData.append('format', exportFormat);

		$.ajax({
			url: serviceUrl2,
			type: 'POST',
			processData: false,
			contentType: false,
			dataType: 'json',
			data: svgFormData,
			success: function (data) {
				var link = data.link;
				//create link, click on it, delete link
				var downloadLink = document.createElement("a");
				downloadLink.href = serviceUrl + link;
				downloadLink.download = "Chart." + exportFormat;
				document.body.appendChild(downloadLink);
				downloadLink.click();
				document.body.removeChild(downloadLink);
				//hide loading icon
				$('#loadingIconExport').hide();
				$('#exportArrow').css('background-size','contain');
			}
		});
	}
}
//Data export
function exportData() {
	//show loading icon
	$('#loadingIconExport').fadeIn();
	$('#exportArrow').css('background-size','0px');
	
	var exportFormat = $('#exportFormat').chosen().val();
	formData.set('format', exportFormat);
	$.ajax({
		url: serviceUrl3,
		type: 'POST',
		processData: false,
		contentType: false,
		data: formData,
		success: function (data) {
			
			
			var FileSaver = require('file-saver');
			var blob;
			// use FileSaver
			if (exportFormat == 'csv') {
				blob = new Blob([data], {type: "text/plain;charset=utf-8"});
				FileSaver.saveAs(blob, "Data." + exportFormat);
			} else if (exportFormat == 'json') {
				blob = new Blob([JSON.stringify(data, null, 4)], {type: "text/plain;charset=utf-8"});
				FileSaver.saveAs(blob, "Data." + exportFormat);	
			//create link, click on it, delete link
			} else if (exportFormat == 'excel') {
				var downloadLink = document.createElement("a");
				downloadLink.setAttribute('href', serviceUrl + data);
				exportFormat = "xlsx";
				downloadLink.setAttribute('download', "Data." + exportFormat);
				downloadLink.style.display = 'none';
				document.body.appendChild(downloadLink);
				downloadLink.click();
				document.body.removeChild(downloadLink);				
			}

			//hide loading icon
			$('#loadingIconExport').hide();
			$('#exportArrow').css('background-size','contain');
		}
	});				
}
function applyLanguage(language) {

	$.ajax({
		type: "GET",
		url: "labels.json",
		dataType: "json",
		success: function(data) {
			// get all available languages
			languages = Object.keys(data);
			labels = data[language];
			var labelList = $(".label");
			$("#topBar_language_label_2").html(language);
			// gets through all class='label' and applies suitable language string from labels.json
			for (var i = 0; i < labelList.length; i++) {
				if (labelList[i].id != "") { // skip those without id
					var elem = labels[labelList[i].id];
					if (labelList[i].nodeName == "INPUT") {
						$("#" + labelList[i].id).attr("placeholder", elem["placeholder"] );
					} else {
						for (Object.key in elem) {
							if (Object.key == "html") {
								if (typeof elem[Object.key] == 'object') {
									$("#" + labelList[i].id).html(elem[Object.key][0]);
								} else {
									if (labelList[i].nodeName == "OPTION") {
										var fdfsdf = "";
									}
									$("#" + labelList[i].id).html(elem[Object.key]);
								}			
							} else if (Object.key == "title") {
								$("#" + labelList[i].id).attr("title", elem[Object.key]);
							} else if (Object.key == "placeholder") {
								$("#" + labelList[i].id).attr("data-placeholder", elem[Object.key]);
							}
						}				
					}
				}
			}
			
			monthNames = labels.months;
			
			// layer list for layer display
			treeView = makeLayerTreeView();

			// statistics window reset on language change
			$("#statisticsHeader").html("");
			$("#usageStatistics_select").val("month");
			
			// update select dropdown menus for chosen to work correctly
			let dropdowns = $("select");
			for (var i = 0; i < dropdowns.length; i++) {
				$(dropdowns[i]).trigger("chosen:updated");
			}

		}
	});	

}
function analysisConfigWindow(mode) {
// switches between pixel and area mode
	if (mode == "pixel") {
		$("#analysisConfigWindowContent_label").html(labels.analysisConfigWindowContent_label.html[0])		
		$("#analysisConfigWindow_polygon").parent().hide();
		$("#analysisConfigWindow_PolygonCentroid").parent().hide();
		$("#analysisConfigWindow_polygonArea").parent().hide();			
		$("#analysisConfigWindow_areaOption1").parent().hide();
		$("#analysisConfigWindow_viirsArea").parent().show();
		$("#analysisConfigWindow_viirsCentroid").parent().show();
		$("#analysisConfigWindow_click").parent().show();
		
	} else {
		$("#analysisConfigWindowContent_label").html(labels.analysisConfigWindowContent_label.html[1])		
		$("#analysisConfigWindow_polygon").parent().show();
		$("#analysisConfigWindow_PolygonCentroid").parent().show();
		$("#analysisConfigWindow_polygonArea").parent().show();
		$("#analysisConfigWindow_areaOption1").parent().show();
		$("#analysisConfigWindow_viirsArea").parent().hide();
		$("#analysisConfigWindow_viirsCentroid").parent().hide();
		$("#analysisConfigWindow_click").parent().hide();	
	}
}


function drawGraticule() {
	// draws graticule over the light layer if below zoom 9
	var layer = getLayerByName('layerGraticule');
	if (typeof layer == 'undefined') {
		var graticule = new VectorLayer({
			name: "layerGraticule",
			zIndex: 2,
			source: new VectorSource({
				features: []
			}),		
			style : new ol_Style({
				stroke : new ol_Style_Stroke({
					color : 'rgba(255, 0, 0, 0.2)',
					width : 1
				})
			})
		});
		
		map.addLayer(graticule);
		layer = getLayerByName('layerGraticule');
		
	} else {
		layer.getSource().clear();
	}
	
	// do not show if too far zoomed out
	if (map.getView().getZoom() < 9) {
		return;
	}
		
	//get center
	var center = map.getView().getCenter();
	var centerPoint = new ol_Geom_Point(center);
	centerPoint = centerPoint.transform('EPSG:3857', 'EPSG:4326');
	// snap to viirs/dmsp grid and recenter
	var radianceLayer = $("#layerTree").jstree("get_selected"); 
	if (radianceLayer.length == 0) {
		return;
	} else {
		radianceLayer = radianceLayer[0];
		
	}

	var gridSize;
	if (radianceLayer.indexOf("viirs") != -1) {
		gridSize = 0.0041666667;
		var newcenterlon = Math.floor(centerPoint.getCoordinates()[0] / gridSize)*gridSize + gridSize/2;
		var newcenterlat = Math.floor(centerPoint.getCoordinates()[1] / gridSize)*gridSize + gridSize/2;
	} else if (radianceLayer.indexOf("dmsp") != -1) {
		gridSize = 0.0083333333;
		var newcenterlon = Math.floor(centerPoint.getCoordinates()[0] / gridSize)*gridSize + gridSize/2;
		var newcenterlat = Math.floor(centerPoint.getCoordinates()[1] / gridSize)*gridSize + gridSize/2;
	}
	
	
	var centerPoint2 = new ol_Geom_Point([newcenterlon, newcenterlat]);
	
	//limit graticule by extent
	var extent = map.getView().calculateExtent(map.getSize());
	var sw = new ol_Geom_Point([extent[0],extent[1]]);
	sw = sw.transform('EPSG:3857', 'EPSG:4326');
	var ne = new ol_Geom_Point([extent[2],extent[3]]);
	ne = ne.transform('EPSG:3857', 'EPSG:4326');
	
	var numVertical = Math.round(((Math.abs(centerPoint2.getCoordinates()[1] - ne.getCoordinates()[1]) / gridSize)+3)*3);
	
	//horizontal
	for (var i = -numVertical; i < numVertical+1; i++) {
		var feature = new ol_Feature();
		var points = [[sw.getCoordinates()[0], centerPoint2.getCoordinates()[1]+i*gridSize], [ne.getCoordinates()[0], centerPoint2.getCoordinates()[1]+i*gridSize]];
		var line = new ol_Geom_LineString(points);
		line = line.transform('EPSG:4326', 'EPSG:3857');	
		feature.setGeometry(line);
		layer.getSource().addFeature(feature);
	}
	//vertical
	for (var i = -numVertical; i < numVertical+1; i++) {
		var feature = new ol_Feature();
		var points = [[centerPoint2.getCoordinates()[0]+i*gridSize, ne.getCoordinates()[1]], [centerPoint2.getCoordinates()[0]+i*gridSize, sw.getCoordinates()[1]]];
		var line = new ol_Geom_LineString(points);
		line = line.transform('EPSG:4326', 'EPSG:3857');	
		feature.setGeometry(line);
		layer.getSource().addFeature(feature);
	}
	
}
function usageStatistics(period) {
	// row number estimator
	var statWindowHeight = $('#topBar_statisticsContentWindow').height();	
	var rows = Math.floor((statWindowHeight - 170) / 27);

	// generate use statistics table
	var periodLabel = "";
	switch(period) {
		case 'day':
			periodLabel = labels.usageStatistics_select_1.html;
			break;
		case 'week':
			periodLabel = labels.usageStatistics_select_2.html;
			break;
		case 'month':
			periodLabel = labels.usageStatistics_select_3.html;
			break;
		case 'year':
			periodLabel = labels.usageStatistics_select_4.html;
			break;
	}
	// set header
	var tableHeaderFooter = "<tr><th>"+periodLabel+"</th><th>"+labels.usageStatistics_table_pixel.html+"</th><th>"+labels.usageStatistics_table_area.html+"</th><th>"+labels.usageStatistics_table_export.html+"</th></tr>";
	$('#statisticsHeader').html(tableHeaderFooter);
	
	var columnDefs = [
			{ "data": period, width: "100px", "targets": 0 },
			{ "data": "point", "targets": 1 },
			{ "data": "area", "targets": 2 },
			{ "data": "csv", "targets": 3 }
	];
	// request and datatables constructor
	$('#usageStatistics_data').DataTable( {
		searching: false,
		destroy: true,
		lengthChange: false,
		pageLength: rows,
		ajax: {
			url: serviceUrl4 + '?aggregation=' + period,
			dataSrc: 'counters'
		},
		language: {
			// show spinner on data fetch
			loadingRecords: "<div style='height:32px;width:32px;display: inline-block;'><object data='img/loading.svg' type='image/svg+xml'></object></div>",
			paginate: {
				previous:  labels.usageStatistics_table_previous.html,
				next: labels.usageStatistics_table_next.html
			},
			info:  labels.usageStatistics_table_bottom_info.html
		},
		columnDefs: columnDefs,
		order: [[ 0, 'desc' ]]
	});
}
function displayRasterPolygons() {
	//draw polygon that displays individual pixels if area is small enough (1000 sq. km)
	// calculate area of drawn polygon
	var coordinates_string_array = $("#analysisConfigWindow_polygon").html().split("<br>");
	var coordinates_array = [];
	var ring = [];
	for (var i = 0; i < coordinates_string_array.length; i++) {
		var coords = coordinates_string_array[i].split(", ");
		coordinates_array.push([parseFloat(coords[0]),parseFloat(coords[1])])
	}
	ring.push(coordinates_array);
	var poly = new ol_Geom_Polygon(ring)
	var polygonArea = getArea(poly);
	
	if (polygonArea < 1e9) {
		
		// make request
		var rasterpolygonsForm = new FormData();
		rasterpolygonsForm.append("geometry", "LINESTRING(" + $("#analysisConfigWindow_polygon").html().replace(/,/g, '').replace(/<br>/g, ',') + ")");
		let satellite = $("#analysisConfigWindow_rasterColumn").val().split("_")[0];
		rasterpolygonsForm.append("satellite", satellite);
		if (satellite == 'viirs') {
			let mask = $("#analysisConfigWindow_mask").val();
			if (mask != "none") {
				rasterpolygonsForm.append('mask', $("#analysisConfigWindow_mask").val());
			}
		}
		
		$.ajax({
			url: serviceUrl5,
			type: 'POST',
			processData: false,
			contentType: false,
			data: rasterpolygonsForm,
			success: function (data) {
			
				// remove old feature if it exists
				var layer = getLayerByName('layerAnalysisArea');			
				var oldFeature = layer.getSource().getFeatureById("rasterPolygon");	
				if (oldFeature != null) {
					layer.getSource().removeFeature(oldFeature);
				}
				
				// abort if error
				if (typeof data.error != "undefined") {
					if (data.error.indexOf("TopologyException") > -1) {
						// invalid polygon message
						$("#analysisConfigWindow_polygonArea").html("<span style='color:red;'>" + labels.resultError_2.html + "</span>").attr("title","");
						showErrorPopup(labels.resultError_4.html, labels.resultError_2.html);
					}
					return;
				}
				
				// abort if no geometry returned (not a single pixel selected by the polygon)
				if (data.geom == "") {
					showErrorPopup(labels.resultError_4.html, labels.resultError_6.html);
					return;
				}
				
				// Continue guided tour
				if (hopscotch.getCurrStepNum() == 10) {
					$("#analysisConfigWindow").fadeToggle(function() {
						hopscotch.nextStep();
					});				
				}
				
				// make feature
				var format = new ol_Format_WKT();			
				var feature = format.readFeature(data.geom, {
					dataProjection: 'EPSG:4326',
					featureProjection: 'EPSG:3857'
				});					
				
				// feature style
				var style = new ol_Style({
					fill : new ol_Style_Fill({
						color : 'rgba(255, 0, 0, 0.2)'
					}),
					stroke: new ol_Style_Stroke({ color: 'rgba(255, 0, 0, 1.0)', width: 1 }),
				});					
				feature.setStyle(style);
				// set feature id to find it easier
				feature.setId("rasterPolygon");
				// add feature to layer
				layer.getSource().addFeature(feature);
				
				// calculate total selected pixel area
				var poly = feature.getGeometry().clone();
				poly = poly.transform('EPSG:3857', 'EPSG:4326');
				var prevLabel = $("#analysisConfigWindow_polygonArea").html().split(" (")[0];
				var area = getArea(poly);
				// handle multipolygon differently
				if (poly.getType() == "MultiPolygon") {
					area = 0;
					var polys = poly.getPolygons();
					for (var i = 0; i < polys.length; i++) {
						var single_poly = poly.getPolygon(i);
						var temp_area = getArea(single_poly);
						if (!isNaN(temp_area)) {
							area += temp_area;
						}
					}
				}
				$("#analysisConfigWindow_polygonArea").html(prevLabel + " (<span id='analysisConfigWindow_polygonArea_selected_label' class='label'>"+ labels.analysisConfigWindow_polygonArea_selected_label.html +"</span>: " + formatDecimalNumberArea(area) + " km&#178;)" );
			}
		});		
	}

}
function formatSciNumber(number) {
	// scientific number html formater
	if (!isNaN(number)) {
		var arr = number.split("e");
		return arr[0] + " × 10<sup>" + (arr[1]).replace("+","") + "</sup>";		
	} else {
		return number;
	}

}
function readTextFile(filePath) {
	// reads an uploaded WKT polygon text file and draws it on map
	var output = ""; //placeholder for text output
	var feature;
	if(filePath.files && filePath.files[0]) {
		var reader = new FileReader();
		reader.onload = function (e) {
			output = e.target.result;		
			// check if polygon file
			try {
				// try to make a feature
				var format = new ol_Format_WKT();			
				feature = format.readFeature(output, {
					dataProjection: 'EPSG:4326',
					featureProjection: 'EPSG:3857'
				});
			} catch(err) { 
				// show error
				showErrorPopup(labels.resultError_4.html, labels.resultError_5.html);							
				return false;
			}
			// make sure it's a polygon geometry
			if (feature.getGeometry().getType() == "Polygon") {
				drawFeature(feature);
			} else {
				// show error
				showErrorPopup(labels.resultError_4.html, labels.resultError_5.html);
				return false;
			}
			
			
	
		};
		reader.readAsText(filePath.files[0]);
	}     
	return true;
} 

function drawFeature(feature) {
	var featureGeometry = feature.getGeometry();
	var geom = featureGeometry.clone().transform('EPSG:3857', 'EPSG:4326');
	
	// if too large (100.000 sq. km), display warning
	var area_m = getArea(geom);	
	var textWarning = "";
	if (area_m > maxPolygonSize) {
		textWarning = labels.warning_2.html + " " + maxPolygonSize/1e6 + " km².";
	}
	if (area_m > 1e11  && maxPolygonSize == 1e12) {
		textWarning = labels.warning_1.html;
	}
	if (area_m > maxPolygonSize || maxPolygonSize == 1e12) {

		let style = new ol_Style({
			fill : new ol_Style_Fill({
				color : 'rgba(255, 0, 0, 0.1)'
			}),
			stroke : new ol_Style_Stroke({
				color : 'rgba(255, 0, 0, 1.0)',
				width : 3
			}),
			text: new ol_Style_Text({
				text: textWarning,
				font: 'bold 14px Arial',
				overflow: true,
				textAlign: 'left',
				offsetX: -100,
				fill: new ol_Style_Fill({ color: 'rgba(255, 0, 0, 1.0)' }),
				stroke: new ol_Style_Stroke({
					color: '#000', width: 2
				})
			})
		});
		feature.setStyle(style);
	} else {
		let style = new ol_Style({
			fill : new ol_Style_Fill({
				color : 'rgba(255, 0, 0, 0.1)'
			}),
			stroke : new ol_Style_Stroke({
				color : 'rgba(255, 0, 0, 1.0)',
				width : 3
			})
		});
		feature.setStyle(style);		
	}
	
	// set feature id to find it easier
	feature.setId("drawnPolygon");
	
	var layer = getLayerByName('layerAnalysisArea');
	
	// clears previous polygon when uploading file
	if ($("#analysisConfigWindow_polygon_tools_upload_input > input[type='file']").val() != "") {	
		layer.getSource().clear();
	}
	
	// add feature to layer 	
	layer.getSource().addFeature(feature);
	
	// clear previous polygon, zoom to polygon with offset and open analysisConfigWindow			
	var extent = layer.getSource().getExtent();
	
	// clear drawn vector when drawing by mouse, skip if uploaded
	if ($("#analysisConfigWindow_polygon_tools_upload_input > input[type='file']").val() == "") {
		layer.getSource().clear();
	} else {
		// resets input field
		$("#analysisConfigWindow_polygon_tools_upload_input > input[type='file']").val("");
	}
	
	// add padding because of the menu
	var padding = [0, 0, 0, 300];
	
	// check if layer config window is open and then offset
	if ($("#layerConfigWindow").width() > 100) {
		padding = [0, $("#layerConfigWindow").width(), 0, 300];
	}
	
	// disable Generate chart button if polygon area too large
	if (textWarning == labels.warning_2.html + " " + maxPolygonSize/1e6 + " km².") {
		$("#analysisConfigWindow_generateChartButton").prop('disabled', true);
	} else {
		$("#analysisConfigWindow_generateChartButton").prop('disabled', false);
	}

	map.getView().fit(extent, {
		duration: 500,
		padding: padding,
		maxZoom: 13,
		callback: showAreaAnalysisConfigWindow(geom)
	});		
}

//show modal popup with error message
function showErrorPopup(title, message) {
	$("#map").append("<div id='dialog-message' title='"+ title +"'><p><span class='ui-icon ui-icon-alert' style='float:left; margin:0 7px 0px 0;'></span>"+ message +"</p></div>");			
	$( function() {
		$( "#dialog-message" ).dialog({
			modal: true,
			resizable: false
		});
	});
}