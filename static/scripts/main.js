// Your access token can be found at: https://ion.cesium.com/tokens.
// Replace `your_access_token` with your Cesium ion access token.

//Cesium.Ion.defaultAccessToken = 'your_access_token';

// Initialize the Cesium Viewer in the HTML element with the `cesiumContainer` ID.
const viewer = new Cesium.Viewer('cesiumContainer',
    {
        timeline: true,
        shouldAnimate: false,
        animation: true,
        geocoder: false,
        sceneModePicker: true,
        navigationInstructionsInitiallyVisible: false,
        useBrowserRecommendedResolution: false,
        baseLayerPicker: false,
        baseLayer: Cesium.ImageryLayer.fromProviderAsync(
            Cesium.IonImageryProvider.fromAssetId(3954)
          ),
        terrain: Cesium.Terrain.fromWorldTerrain({
            requestWaterMask: true
        })
    });
//viewer.scene.debugShowFramesPerSecond = true;

function cacheBust(url) {
    return  url + `?v=${Math.random()}`;
}



function goHome() {
    viewer.flyTo(
      viewer.entities,
      {
          offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-90))
      }
    );
}

viewer.homeButton.viewModel.command.beforeExecute.addEventListener(
  function(e) {
     e.cancel = true;
     goHome();
  });

const pinBuilder = new Cesium.PinBuilder();

class DashPatternAnimator {
    pattern;
    patternAnimationIdx;
    lastUpdate;
    rate;
    #callback;

    static rotr16(value, count) {
        // 16 bit right rotate (with wrap)
        if (count < 0)
            return DashPatternAnimator.rotl16(value, -count);
        count %= 16;
        return (value << count) | (value >> (16 - count));
    }

    static rotl16(value, count) {
        // 16 bit left rotate (with wrap)
        if(count < 0)
            return DashPatternAnimator.rotr16(value, -count);
        count %= 16;
        return (value >> count) | (value << (16 - count));
    }

    constructor(pattern = 255, rate = 15.0) {
        this.pattern = pattern;
        this.patternAnimationIdx = 0.0;
        this.lastUpdate = -1;
        this.rate = rate;
        var self = this;
        this.#callback = new Cesium.CallbackProperty(function(time, result) {
            var now = new Date().getTime();
            var deltaT = (self.lastUpdate < 0 ? 0 : now - self.lastUpdate) / 1000.0;
            self.lastUpdate = now;
            self.patternAnimationIdx += deltaT * self.rate;
            while (self.patternAnimationIdx >= 16)
                self.patternAnimationIdx -= 16.0;
            var idx = Math.floor(self.patternAnimationIdx);
            var x = DashPatternAnimator.rotl16(self.pattern, -idx);
            return x;
        }, false);
    }

    getPatternGenerator() {
        return this.#callback;
    }
}

let dashPatternAnimations = new DashPatternAnimator();

function getHeading(long1, lat1, long2, lat2) {
    lat1 = Cesium.Math.toRadians(lat1);
    long1 = Cesium.Math.toRadians(long1);
    lat2 = Cesium.Math.toRadians(lat2);
    long2 = Cesium.Math.toRadians(long2);

    bearing = Math.atan2(
        Math.sin(long2 - long1) * Math.cos(lat2),
        Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(long2 - long1)
    );

    bearing = Cesium.Math.toDegrees(bearing);
    bearing = (bearing + 360) % 360;

    return bearing;
}

function buildTable(properties) {
    desc = '<table class="cesium-infoBox-defaultTable"><tbody>';
    properties.propertyNames.forEach(function(p) {
        desc += '<tr><td>' + p + '</td>';
        desc += '<td>' + properties[p] + '</td>';
    });
    desc += '</tbody></table>';
    return desc;
}

function renderHeatMap(name, dataSource, propertyName, valueMin, valueMax) {
    // TODO
}


class VelocityOrientationProperty {
    #samples;
    #lastValue;
    constructor(samples) {
        this.#samples = samples;
        this.#lastValue = undefined;
    }
    getValue(time, result) {
        const a = this.#samples.getValue(time);
        const b = this.#samples.getValue(Cesium.JulianDate.addSeconds(time, 10, new Cesium.JulianDate()));
        if (a == undefined || b == undefined)
            return this.#lastValue;
        const p1 = new Cesium.Cartographic.fromCartesian(a);
        const p2 = new Cesium.Cartographic.fromCartesian(b);
        const position = this.#samples.getValue(time);
        const heading = Cesium.Math.toRadians(getHeading(p1.longitude, p1.latitude, p2.longitude, p2.latitude));
        const roll = Cesium.Math.toRadians(0);
        const pitch = Cesium.Math.toRadians(90);
        const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
        this.#lastValue = Cesium.Transforms.headingPitchRollQuaternion(
          position,
          hpr
        );
        return this.#lastValue;
    }
};

function renderTimelinePath(name, color, dataSource, modelUri) {
    const entities = dataSource.entities.values;
    const samples = new Cesium.SampledPositionProperty();
    const start = Cesium.JulianDate.fromIso8601(entities[0].properties['date'].getValue());
    const stop = Cesium.JulianDate.fromIso8601(entities[entities.length-1].properties['date'].getValue());

    for (var i = 0; i < entities.length; i++) {
        const entity = entities[i];
        const time = Cesium.JulianDate.fromIso8601(entity.properties['date'].getValue());
        const cart = Cesium.Cartographic.fromCartesian(entity.position.getValue());
        samples.addSample(time, Cesium.Cartographic.toCartesian(cart));
    }
    const entity = viewer.entities.add({
      availability: new Cesium.TimeIntervalCollection([
        new Cesium.TimeInterval({
          start: start,
          stop: stop,
        }),
      ]),

      position: samples,

      orientation: new VelocityOrientationProperty(samples),

      model: {
        uri: modelUri,
        minimumPixelSize: 64,
        scale: 0.005,
    },
  });

  return [start, stop];
}

function renderInfoIcons(name, infos) {
    infos.forEach(function(info) {
        const cartographic = Cesium.Cartographic.fromCartesian(info.position.getValue());
        cartographic.height = 0.2;
        const cameraPin = viewer.entities.add({
          name: name,
          description: info.description,
          position: Cesium.Cartographic.toCartesian(cartographic),
          billboard: {
              image: '/static/icons/information.svg',
              scale: 1.1,
          },
        });
    });
}

function renderCameraIcons(name, color, images) {
    Promise.resolve(
      pinBuilder.fromUrl('/static/icons/attraction.svg', color, 48)
    ).then(function (canvas) {
        images.forEach(function(img) {
            var url = cacheBust('/static/images/' + img[1]);
            const cameraPin = viewer.entities.add({
              name: name,
              description: '<image height=240 width=320 src="' + url + '"></image>',
              position: img[0].position,
              billboard: {
                  image: canvas,
                  verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              },
            });
        });
    });
}

function render3dShipModel(name, modelUri, positions, entities, props) {
    const position = Cesium.Cartesian3.fromDegrees(
      positions[positions.length-2],
      positions[positions.length-1],
      0
    );

    const heading = Cesium.Math.toRadians(getHeading(positions[positions.length-4], positions[positions.length-3], positions[positions.length-2], positions[positions.length-1]));
    const roll = 0;
    const pitch = Cesium.Math.toRadians(90);
    const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
    const orientation = Cesium.Transforms.headingPitchRollQuaternion(
      position,
      hpr
    );
    const lastHeard = Cesium.JulianDate.fromIso8601(entities[entities.length-1].properties['date'].getValue());
    const delta = (Cesium.JulianDate.secondsDifference(Cesium.JulianDate.now(), lastHeard) / 3600.0).toFixed(2);

    const xOffset = name == 'Erebus' ? -60 : 60;
    const yOffset = name == 'Erebus' ? 30 : -30;

    // Create 3d model entity of ship
    model = viewer.entities.add({
      name: name,
      position: entities[entities.length-1].position,
      orientation: orientation,
      model: {
        uri: modelUri,
        scale: 0.005,
        minimumPixelSize: 70,
      },
      label: {
        text: name + ' (' + parseFloat(entities[entities.length-1].properties['distance']).toFixed(2).toString() + ' km, heard ' + delta.toString() + ' hrs ago)',
        font: "16px sans-serif",
        pixelOffset: new Cesium.Cartesian2(xOffset, yOffset),
        eyeOffset: new Cesium.Cartesian3(0, 0, 5.0)
      }
    });

    viewer.entities.add({
      name: name,
      position: entities[0].position,
      label: {
        text: name + ' Start',
        font: "16px sans-serif",
        pixelOffset: new Cesium.Cartesian2(xOffset, yOffset),
        eyeOffset: new Cesium.Cartesian3(0, 0, 5.0)
      }
    });

    if (props) {
        // Duplicate last known good properties into the 3d model but set the
        // final distance from the last known position
        properties = props.properties;
        properties['date'] = entities[entities.length-1].properties['date'];
        properties['distance'] = entities[entities.length-1].properties['distance'];
        properties['quality'] = entities[entities.length-1].properties['quality'];
        model.description = buildTable(properties);
    }
}

function renderPolyline(name, color, positions) {
    // Create polyline of the journey
    viewer.entities.add({
      name: name,
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray(positions),
        width: 4,
        clampToGround: true,
        material: new Cesium.PolylineDashMaterialProperty({
            color: color.withAlpha(0.5),
            gapColor: Cesium.Color.WHITE.withAlpha(0.5),
            dashLength: 32.0,
            dashPattern: dashPatternAnimations.getPatternGenerator()})
      },
    });
}

function renderPoint(color) {
    return new Cesium.PointGraphics({
        color: color,
        pixelSize: 14,
        outlineWidth: 0,
        outlineColor: Cesium.Color.WHITE,
    });
}

function renderDataSource(name, dataSource, color, modelUri, onCompletion) {

    viewer.dataSources.add(dataSource);

    var entities = dataSource.entities.values;
    var positions = [];
    var props = null;
    var images = [];
    var infos = [];

    for (var i = 0; i < entities.length; i++) {
        var entity = entities[i];
        entity.billboard = undefined;
        entity.name = name;
        entity.point = renderPoint(color);
        if (entity.properties.hasProperty('battery')) {
            props = entity;
            infos.push(entity);
        }
        if (entity.properties['image'] != "") {
            images.push([entity, entity.properties['image']]);
        }
        entity.properties.removeProperty('image');
        entity.description = buildTable(entity.properties);
        const cartographic = Cesium.Cartographic.fromCartesian(entity.position.getValue());
        positions.push(Cesium.Math.toDegrees(cartographic.longitude));
        positions.push(Cesium.Math.toDegrees(cartographic.latitude));
    }

    renderCameraIcons(name, color, images);
    renderInfoIcons(name, infos);
    render3dShipModel(name, modelUri, positions, entities, props);
    renderPolyline(name, color, positions);
    [startTime, endTime] = renderTimelinePath(name, color, dataSource, modelUri);
    onCompletion(startTime, endTime);
}

var numDataSources = 0;
var clockStart = new Cesium.JulianDate.fromDate(new Date(2999, 1, 1));
var clockStop = new Cesium.JulianDate.fromDate(new Date(1970, 1, 1));

function onRenderComplete(start, stop) {
    numDataSources++;
    if (Cesium.JulianDate.lessThan(start, clockStart)) {
        clockStart = start;
    }
    if (Cesium.JulianDate.greaterThan(stop, clockStop)) {
        clockStop = stop;
    }
    if (numDataSources == 2) {
        goHome();
        console.log(clockStart.toString(), clockStop.toString());
        viewer.clock.startTime = clockStart.clone();
        viewer.clock.stopTime = clockStop.clone();
        viewer.clock.currentTime = clockStart.clone();
        viewer.clock.clockRange = Cesium.ClockRange.CLAMPED;
        viewer.clock.multiplier = 10000;
        viewer.timeline.zoomTo(clockStart, clockStop);
    }
}

Cesium.GeoJsonDataSource.load(cacheBust('/static/geojson/erebus.geojson'), {})
    .then(
        function (dataSource) {
            renderDataSource('Erebus', dataSource, Cesium.Color.RED, '/static/3d/02_barkas_red.gltf', onRenderComplete);
        }
    );

Cesium.GeoJsonDataSource.load(cacheBust('/static/geojson/terror.geojson'), {})
    .then(
        function (dataSource) {
            renderDataSource('Terror', dataSource, Cesium.Color.BLUE, '/static/3d/02_barkas_blue.gltf', onRenderComplete);
        }
    );
