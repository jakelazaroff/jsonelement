# JSONElement

[![npm version](https://badge.fury.io/js/@jakelazaroff%2Fjsonelement.svg)](https://badge.fury.io/js/@jakelazaroff%2Fjsonelement)

JSONElement is a web component for declaratively building JSON in JavaScript apps. It's focused on replacing imperative "effect" APIs such as `useEffect` in React, `$effect` in Svelte or `attributeChangedCallback` in web components.

You use `JSONElement` by creating your own custom elements that inherit from it to define schemas. Here's a simple example of how you might use it to define a GeoJson object:

```js
class GeoJsonProperties extends JSONElement {
  static tag = "geojson-properties";

  static schema = {
    name: String
  };
}
```

You'd use that element in your HTML like this:

```html
<geojson-properties name="Disney World Orlando"></geojson-properties>
```

Here's how that element might fit into a larger schema, wrapping a JavaScript library like [MapLibre](https://maplibre.org) to show locations on a map without writing any imperative JavaScript:

```html
<map-libre>
  <maplibre-source id="places" type="geojson">
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

Compare that to this longer and more imperative React code…

```jsx
import maplibre from "maplibre-gl";

interface Place {
  name: string;
  lon: number;
  lat: number;
}

function Map({ places }: { places: Place[] }) {
  const map = useRef<maplibre.Map>();

  useEffect(() => {
    if (!map.current) return;

    const data = {
      type: "FeatureCollection",
      features: places.map(el => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [Number(place.lon), Number(place.lat)] },
        properties: { name: place.innerHTML }
      }))
    };

    const source = map.getSource(places);
    if (source) source.setData(data);
    else map.addSource("places", { type: "geojson", data });
  }, [places]);

  return (
      <div
        ref={el => {
          if (!el) map.current?.remove();
          map.current = new maplibre.Map({ container: el });
        }}
      >
      </div>
  );
}
```

…or this vanilla JavaScript code that queries for the relevant data in the DOM.

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

In both React and HTML with vanilla JavaScript, you need to switch between two different languages. You also need to use imperative, side-effectful code to instantiate the map. None of the above is easily taken out of context or composed elsewhere.

Of course, under the hood in the first example the `maplibre-*` element is built using code like in the latter two. That's where `JSONElement` comes in: you can use it to easily transform elements in the DOM to build more declarative components.

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

There are three main properties in a `JSONElement` subclass:

- `tag` is a static string property that determines the custom element tag name.
- `schema` is a static object property that determines the keys and value types of the resulting JSON.
- `json` is an instance property that returns the actual JSON.

To get a component's JSON, just check the `json` property:

```js
const feature = document.querySelector("geojson-feature");

console.log(feature.json);
```

Any time the JSON changes, components will emit a `json-change` event. You can listen to these on the root element of the `JSONElement` tree:

```js
const feature = document.querySelector("geojson-feature");

feature.addEventListener("json-change", () => {
  console.log(feature.json);
});
```

If you need to know what changed, `JSONElement` can include an array of [JSON Patch](https://jsonpatch.com) objects with the `json-change` event. This must be explicitly enabled by calling the `enableDiff` function from the package, and then setting a `diff` attribute on the element emitting the event:

```js
import JSONElement, { enableDiff } from "./json-element.js";
enableDiff();
```

```html
<geojson-feature diff>
  <!-- ... -->
</geojson-feature>
```

`json-change` events will now contain a `patches` property on their event detail, which is an array of JSON Patch objects describing the change.

```js
const feature = document.querySelector("geojson-feature");

feature.addEventListener("json-change", event => {
  console.log(event.detail.patches);
});
```

## Writing Schemas

Each JSONElement subclass has a schema that tells it how to convert its attributes and children into JavaScript objects. The schema is defined as an object on the static property `schema`. Each key corresponds to both the element's attribute or slot and the key in the resulting JavaScript object, while each value determines how it's read from the DOM.

Here's an example:

```js
class ExampleSchema extends JSONElement {
  static tag = "example-schema";

  static schema = {
    literal: "string literal",
    bool: Boolean,
    num: Number,
    str: String,
    one: Object,
    many: Array,
    custom: value => `Custom value: ${value}`
  };
}
```

Writing the markup for that schema might look something like this…

```html
<example-schema bool num="10" str="hello" custom="example!">
  <other-element slot="one" text="single object"></other-element>
  <other-element slot="many" text="uno"></other-element>
  <other-element slot="many" text="dos"></other-element>
  <other-element slot="many" text="tres"></other-element>
</example-schema>
```

…which would generate this JSON:

```json
{
  "literal": "string literal",
  "bool": true,
  "num": 10,
  "str": "hello",
  "one": { "text": "single object" },
  "many": [{ "text": "uno" }, { "text": "dos" }, { "text": "tres" }],
  "custom": "Custom value: example!"
}
```

There are seven types of schema values:

### Literal

If the schema value is a boolean, number, string or null literal, it will be included in the JSON with no need to add it to the markup.

```js
class ExampleLiteral {
  static tag = "example-literal";

  static schema = {
    one: "hello, world",
    two: 2,
    three: true,
    four: null
  };
}
```

### Boolean

If the schema value is the global `Boolean` function, the JSON value will be the corresponding attribute coerced to a boolean.

```js
class ExampleBoolean {
  static tag = "example-boolean";

  static schema = {
    one: Boolean
  };
}
```

### Number

If the schema value is the global `Number` function, the JSON value will be the corresponding attribute coerced to a number.

```js
class ExampleNumber {
  static tag = "example-number";

  static schema = {
    one: Number
  };
}
```

### String

If the schema value is the global `String` function, the JSON value will be the corresponding attribute coerced to a string.

```js
class ExampleString {
  static tag = "example-string";

  static schema = {
    one: String
  };
}
```

### Object

If the schema value is the global `Object` function, the JSON value will be the `json` property of the first element in the corresponding slot.

You can also use a subclass of `JSONElement` instead. This won't have any effect on the output, but it may make it easier to remember how different `JSONElement` subclasses relate to each other.

```js
class ExampleObject {
  static tag = "example-object";

  static get schema() {
    return {
      one: Object,
      two: ExampleObjectNested
    };
  }
}

class ExampleObjectNested {
  static tag = "example-object-nested";

  static schema = {};
}
```

### Array

If the schema value is the global `Array` function, the JSON value will be an array with the `json` properties of all elements in the corresponding slot.

You can also use an actual array containing subclasses of of `JSONElement` instead. As with objects, this won't have any effect on the output.

```js
class ExampleArray {
  static tag = "example-array";

  static get schema() {
    return {
      one: Array,
      two: [ExampleArrayNested]
    };
  }
}

class ExampleArrayNested {
  static tag = "example-array-nested";

  static schema = {};
}
```

### Custom

You can use a custom function if you need more control over the output. It will be called with two arguments: the string or null value of the attribute at the corresponding key, and an array of any elements in the slot named after the key.

If the function only uses the attribute, it should only take a single argument; this will prevent `JSONElement` from creating a slot for any nested elements.

```js
class ExampleCustom {
  static tag = "example-custom";

  static schema = {
    attribute: value => `Hello, ${value}!`,
    elements: (_, els) => els.map(el => `This element has ${Object.keys(el.json).length} keys!`)
  };
}
```

## Type safety

By default, the type of `JSONElement` subclasses' `json` property is `any`. If you want a stricter type, you can create a getter overriding the `json` property and use a third-party library such as [Valibot](https://valibot.dev) or [Zod](https://zod.dev) to validate the resulting JSON:

```js
import { boolean, number, object, parse, string } from "valibot";

class ExampleValidation {
  static tag = "example-validation";

  static schema = {
    one: String,
    two: Number,
    three: Boolean
  };

  get json() {
    const validator = object({
      one: string(),
      two: number(),
      three: boolean()
    });

    return parse(validator, super.json);
  }
}
```
