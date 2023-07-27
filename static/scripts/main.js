// Your access token can be found at: https://ion.cesium.com/tokens.
// Replace `your_access_token` with your Cesium ion access token.

//Cesium.Ion.defaultAccessToken = 'your_access_token';

// Initialize the Cesium Viewer in the HTML element with the `cesiumContainer` ID.
const viewer = new Cesium.Viewer('cesiumContainer',
    {
        timeline: false,
        animation: false,
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

function renderInfoIcons (name, infos) {
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

function renderCameraIcons (name, color, images) {
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

function render3dShipModel (name, modelUri, positions, entities, props) {
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
        pixelOffset: new Cesium.Cartesian2(0.0, 30),
        eyeOffset: new Cesium.Cartesian3(0, 0, 5.0)
      }
    });

    if (props) {
        // Duplicate last known good properties into the 3d model but set the
        // final distane from the last known position
        properties = props.properties;
        properties['distance'] = entities[entities.length-1].properties['distance']
        properties['quality'] = entities[entities.length-1].properties['quality']
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

function renderDataSource (name, dataSource, color, modelUri, onCompletion) {

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
    onCompletion();
}

var numDataSources = 0;

Cesium.GeoJsonDataSource.load(cacheBust('/static/geojson/erebus.geojson'), {})
    .then(
        function (dataSource) {
            renderDataSource('Erebus', dataSource, Cesium.Color.RED, '/static/3d/02_barkas_red.gltf', function() {
                numDataSources++;
                if (numDataSources == 2) {
                    goHome();
                }
            });
        }
    );

Cesium.GeoJsonDataSource.load(cacheBust('/static/geojson/terror.geojson'), {})
    .then(
        function (dataSource) {
            renderDataSource('Terror', dataSource, Cesium.Color.BLUE, '/static/3d/02_barkas_blue.gltf', function() {
                numDataSources++;
                if (numDataSources == 2) {
                    goHome();
                }
            });
        }
    );
