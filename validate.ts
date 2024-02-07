import JSONElement from "./json-element";

class GeoJsonCoordinate extends JSONElement {
  validate = (_json: any): asserts _json is [number, number] => {};
}

const instance = new GeoJsonCoordinate();

instance.validate; // (_json: any) => _json is [number, number];
instance.json; // [number, number]
