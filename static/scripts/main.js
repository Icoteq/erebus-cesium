// Your access token can be found at: https://ion.cesium.com/tokens.
// Replace `your_access_token` with your Cesium ion access token.

//Cesium.Ion.defaultAccessToken = 'your_access_token';

const pinBuilder = new Cesium.PinBuilder();
var numDataSources = 0;
var clockStart = new Cesium.JulianDate.fromDate(new Date(2999, 1, 1));
var clockStop = new Cesium.JulianDate.fromDate(new Date(1970, 1, 1));
var pathEntities = [];

function addToolbarButton(data, onClick) {
    const el = (sel, par) => (par || document).querySelector(sel);
    const elNew = (tag, prop) => Object.assign(document.createElement(tag), prop);
    const elNewNs = (ns, tag, prop) => Object.assign(document.createElementNS(ns, tag), prop);
    const toolbar = el('.cesium-viewer-toolbar');
    const button = elNew('button', {className: 'cesium-button cesium-toolbar-button cesium-home-button',
                                    onclick: onClick});
    const svg = elNewNs('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 17 17');
    const path = elNewNs('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', data);
    svg.appendChild(path);
    button.appendChild(svg);
    console.log(path);
    toolbar.prepend(button);
}

function toggleAnimations() {
    const display = viewer.animation.container.style.display === 'none' ? 'block' : 'none';
    viewer.animation.container.style.display = display;
    viewer.timeline.container.style.display = display;
    viewer.forceResize();
    pathEntities.forEach(x => x.show = !x.show);
}

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

  // Do not display by default
  entity.show = !entity.show;

  return [start, stop, entity];
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
    const result = renderTimelinePath(name, color, dataSource, modelUri);
    onCompletion(result);
}

function onRenderComplete(args) {
    [start, stop, entity] = args;
    numDataSources++;
    pathEntities.push(entity);
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
toggleAnimations();

//viewer.scene.debugShowFramesPerSecond = true;
viewer.homeButton.viewModel.command.beforeExecute.addEventListener(
  function(e) {
     e.cancel = true;
     goHome();
  });

addToolbarButton('M 10.0643 12.2159 C 10.5334 11.7034 11.0001 11.1935 11.6581 10.9742 C 12.5793 10.6671 13.2483 11.052 13.5246 11.2547 C 14.2487 11.7857 14.915 11.0343 14.116 10.4483 C 13.6891 10.1352 12.6709 9.58253 11.3419 10.0255 C 10.6217 10.2656 10.1292 10.7922 9.63703 11.3186 C 9.23691 11.7465 8.83694 12.1742 8.31491 12.4477 C 7.6958 12.772 7.25005 12.4211 7.25005 11.8125 V 11.8004 C 7.25026 11.0022 6.84186 10.5 6.00005 10.5 C 5.50934 10.5 5.00789 10.7582 4.50004 11 C 3.32493 11.5596 2.18205 12.2859 1.1829 13.1134 C 0.972261 13.2885 0.939711 13.6085 1.11594 13.82 C 1.36644 14.1206 1.6967 13.9821 1.94532 13.7821 C 2.35893 13.4492 3.72648 12.3908 4.87908 11.8421 C 5.3556 11.6151 5.74077 11.5 6.00005 11.5 C 6.25002 11.5 6.25002 11.6016 6.25002 11.8396 C 6.248 13.166 7.54027 13.9824 8.77895 13.3335 C 9.2831 13.0694 9.67452 12.6418 10.0643 12.2159 Z M 2.50004 10 C 4.00004 9 5.75496 8 7.50004 8 C 8.25004 8 8.25004 8.375 8.25004 8.75 C 8.25004 9.125 8.25004 9.5 9.00004 9.5 C 11.5275 9.5 14.3632 6.28623 14.5 4 L 12 5 L 9.65805 4.02555 C 9.04629 3.82163 8.73006 4.77031 9.34182 4.97423 L 10.5 5.5 L 9.00004 6 L 5.00004 4.75 C 4.76398 4.67131 4.61132 4.77744 4.50004 5 L 3.00004 8 L 1 9 L 2.50004 10 Z M 5.00004 3 C 5.00004 2.4477 5.44774 2 6.00004 2 C 6.55234 2 7.00004 2.4477 7.00004 3 C 7.00004 3.5523 6.55234 4 6.00004 4 C 5.44774 4 5.00004 3.5523 5.00004 3 Z',
    toggleAnimations);

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
