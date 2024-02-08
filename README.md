# JSONElement

JSONElement is a web component for writing declarative code in JavaScript apps. It's focused on replacing imperative "effect" APIs such as `useEffect` in React, `$effect` in Svelte or `attributeChangedCallback` in web components.

## Getting Started

JSONElement doesn't provide any custom elements that you use directly. Instead, you use it to create your own custom elements that reflect a schema.

For example, here's how you might use JSONElement to represent the JSON on the [GeoJson homepage](https://geojson.org):

```html
<geojson-feature>
  <geojson-point slot="geometry" longitude="125.6" latitude="10.1"></geojson-point>
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
    longitude: Number,
    latitude: Number
  };

  get json() {
    const { lon, lat, ...json } = super.json;
    return { ...json, coordinates: [longitude, latitude] };
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
