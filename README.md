# JSONElement

JSONElement is a web component for declaratively building JSON in JavaScript apps. It's focused on replacing imperative "effect" APIs such as `useEffect` in React, `$effect` in Svelte or `attributeChangedCallback` in web components.

As an example, let's say you're using a JavaScript library like [MapLibre](https://maplibre.org) to show a list of locations on a map on a webpage. You might do this by adding a bunch of data attributes to related elements and querying the DOM for them…

```html
<ul>
  <li class="place" data-lon="-81.56" data-lat="28.38">Disney World Orlando</li>
  <li class="place" data-lon="-81.56" data-lat="28.38">Disneyland Anaheim</li>
</ul>
<div id="map"></div>
<script type="module">
  const data = {
    type: "FeatureCollection",
    features: [...document.querySelectorAll(".place")].map(el => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [Number(el.dataset.lon), Number(el.dataset.lat)] },
      properties: { name: place.innerHTML }
    }))
  };

  const map = new maplibre.Map({ container: "map" });
  map.addSource("places", { type: "geojson", data });
</script>
```

…or maybe by including a big JSON blob in the markup:

```html
<ul>
  <li class="place">Disney World Orlando</li>
  <li class="place">Disneyland Anaheim</li>
</ul>
<div id="mapw"></div>
<script type="application/json" id="places">
  {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "geometry": { "type": "Point", "coordinates": [-81.56, 28.38] },
        "properties": { "name": "Disney World Orlando" }
      },
      {
        "type": "Feature",
        "geometry": { "type": "Point", "coordinates": [-117.91, 33.81] },
        "properties": { "name": "Disney land Anaheim" }
      }
    ]
  }
</script>
<script type="module">
  const data = JSON.parse(document.querySelector("#places").textContent);

  const map = new maplibre.Map({ container: "map" });
  map.addSource("places", { type: "geojson", data });
</script>
```

Instead, JSONElement lets you build that JSON data declaratively, directly in the markup:

```html
<ul>
  <li class="place">Disney World Orlando</li>
  <li class="place">Disneyland Anaheim</li>
</ul>
<div id="map"></div>
<geojson-featurecollection id="places">
  <geojson-feature slot="features">
    <geojson-properties slot="properties" name="Disney World Orlando"></geojson-properties>
    <geojson-point slot="geometry" lon="-81.56" lat="28.38"></geojson-point>
  </geojson-feature>
  <geojson-feature slot="features">
    <geojson-properties slot="properties" name="Disneyland Anaheim"></geojson-properties>
    <geojson-point slot="geometry" lon="-117.91" lat="33.81"></geojson-point>
  </geojson-feature>
</geojson-featurecollection>
<script type="module">
  const map = new maplibre.Map({ container: "map" });
  map.addSource("places", { type: "geojson", data: document.querySelector("#places").json });
</script>
```

Wrapping the library in a web component can make things even simpler, with no imperative JavaScript required at all:

```html
<ul>
  <li class="place">Disney World Orlando</li>
  <li class="place">Disneyland Anaheim</li>
</ul>
<map-libre class="map">
  <maplibre-source slot="sources" id="places" type="geojson">
    <geojson-featurecollection>
      <geojson-feature slot="features">
        <geojson-properties slot="properties" name="Disney World Orlando"></geojson-properties>
        <geojson-point slot="geometry" lon="-81.56" lat="28.38"></geojson-point>
      </geojson-feature>
      <geojson-feature slot="features">
        <geojson-properties slot="properties" name="Disneyland Anaheim"></geojson-properties>
        <geojson-point slot="geometry" lon="-117.91" lat="33.81"></geojson-point>
      </geojson-feature>
    </geojson-featurecollection>
  </maplibre-source>
</map-libre>
```

## Getting Started

JSONElement doesn't provide any custom elements that you use directly. Instead, you use it to create your own custom elements that reflect a schema.

For example, here's how you might use JSONElement to represent the JSON on the [GeoJson homepage](https://geojson.org):

```html
<geojson-feature>
  <geojson-point slot="geometry" lon="125.6" lat="10.1"></geojson-point>
  <geojson-properties slot="properties" name="Dinagat Islands"></geojson-properties>
</geojson-feature>
```

This involves three custom elements: `<geojson-feature>`, `<geojson-point>` and `<geojson-properties>`.

```js
import JSONElement from "./json-element.js";

class GeoJsonFeature extends JSONElement {
  static tag = "geojson-feature";

  static get schema() {
    return {
      type: "Feature",
      geometry: GeoJsonPoint,
      properties: GeoJsonProperties
    };
  }
}

class GeoJsonPoint extends JSONElement {
  static tag = "geojson-point";

  static schema = {
    type: "Point",
    lon: Number,
    lat: Number
  };

  get json() {
    const { lon, lat, ...json } = super.json;
    return { ...json, coordinates: [lon, lat] };
  }
}

class GeoJsonProperties extends JSONElement {
  static tag = "geojson-properties";

  static schema = {
    name: String
  };
}

GeoJsonFeature.register();
GeoJsonPoint.register();
GeoJsonProperties.register();
```

There are three main properties to change in a `JSONElement` subclass:

- `tag` is a static string property that determines the custom element tag name.
- `schema` is a static object property that determines the keys and value types of the resulting JSON.
- `json` is an instance getter that returns the actual JSON object. Useful for validating and/or transforming the JSON's structure.

```js
const feature = document.querySelector("geojson-feature");

console.log(feature.json);
```

To be notified of changes to the JSON structure, listen for `json-change` events on the root element:

```js
const feature = document.querySelector("geojson-feature");

feature.addEventListener("json-change", () => {
  console.log(feature.json);
});
```
