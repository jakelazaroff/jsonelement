import JSONElement from "./json-element";

class GeoJsonCoordinate extends JSONElement {
  static tag = "geojson-coordinate";

  static schema = { lon: Number, lat: Number };

  get json() {
    const { lon, lat } = super.json;
    return [lon, lat] as [number, number];
  }
}

class GeoJsonProperties extends JSONElement {
  static tag = "geojson-properties";

  static schema = { name: String };
  get json() {
    return super.json as { name: string };
  }
}

abstract class Schema<T> {
  optional = true;
  abstract value(el: JSONElement, attr: string): T | undefined;
}

class LiteralSchema<T extends boolean | number | string | null> extends Schema<T> {
  invariant: T;

  constructor(invariant: T) {
    super();
    this.invariant = invariant;
  }

  value() {
    return this.invariant;
  }
}

class BasicSchema<T> extends Schema<T> {
  invariant: (value: string | null) => T | undefined;

  constructor(invariant: (value: string | null) => T | undefined) {
    super();
    this.invariant = invariant;
  }

  value(el: JSONElement, attr: string) {
    return this.invariant(el.getAttribute(attr));
  }
}

class ObjectSchema<T extends typeof JSONElement, U = InstanceType<T>["json"]> extends Schema<U> {
  invariant: T;

  constructor(invariant: T) {
    super();
    this.invariant = invariant;
  }

  value(el: JSONElement, attr: string) {
    const slot = el.shadowRoot?.querySelector(`slot[name=${attr}]`);
    if (!(slot instanceof HTMLSlotElement)) return;

    const [slotted] = slot.assignedElements();
    if (!(slotted instanceof this.invariant)) return;

    return slotted.json;
  }
}

class ArraySchema<T extends typeof JSONElement, U = InstanceType<T>["json"]> extends Schema<U[]> {
  invariant: T;

  constructor(invariant: T) {
    super();
    this.invariant = invariant;
  }

  value(el: JSONElement, attr: string) {
    const slot = el.shadowRoot?.querySelector(`slot[name=${attr}]`);
    if (!(slot instanceof HTMLSlotElement)) return;

    const [slotted] = slot.assignedElements();
    if (!(slotted instanceof this.invariant)) return;

    return slotted.json;
  }
}

class EnumSchema<T = never> extends Schema<T> {
  invariants: Array<Schema<T>> = [];

  constructor(invariants: Array<Schema<T>> = []) {
    super();
    this.invariants = invariants;
  }

  value(el: JSONElement, attr: string) {
    for (const invariant of this.invariants) {
      const result = invariant.value(el, attr);
      if (result) return result;
    }

    return undefined;
  }

  extend<U>(invariant: Schema<U>) {
    return new EnumSchema<T | U>([...this.invariants, invariant]);
  }
}

class OptionSchema<T> extends Schema<T> {
  invariant: SchemaFor<T>;

  constructor(invariant: SchemaFor<T>) {
    super();
    this.invariant = invariant;
  }

  value(el: JSONElement, attr: string) {
    return this.invariant.value(el, attr);
  }
}

const LITERAL_TYPES = new Set(["boolean", "number", "string", "null"]);

function compile<T>(from: T): SchemaFor<T> {
  // @ts-ignore
  if (from instanceof Schema) return from;
  // @ts-ignore
  else if (LITERAL_TYPES.has(typeof from)) return new LiteralSchema(from);
  // @ts-ignore
  else if (from === Boolean) return new BasicSchema(_bool);
  // @ts-ignore
  else if (from === Number) return new BasicSchema(_num);
  // @ts-ignore
  else if (from === String) return new BasicSchema(_str);
  // @ts-ignore
  else if (from.prototype instanceof JSONElement) return new ObjectSchema(from);
  // @ts-ignore
  else if (Array.isArray(from)) return new ArraySchema(from);
  // @ts-ignore
  else if (typeof from === "function") return new BasicSchema(from);
  // @ts-ignore
  return new BasicSchema(() => undefined);
}

function Optional<T>(from: T) {
  return new OptionSchema(compile(from));
}

function Enum<T extends unknown[]>(...options: T): Schema<ValueOf<SchemaFor<T[number]>>> {
  return options.reduce<EnumSchema<any>>(
    (schema, option) => schema.extend(compile(option)),
    new EnumSchema()
  );
}

const foo = Optional(Enum(String, Boolean));

function unwrap<T>(schema: Schema<T>, el: JSONElement, attr: string): T {
  const value = schema.value(el, attr);
  if (value === undefined && !schema.optional) throw new Error(``);

  return value as T;
}

type SchemaFor<T> = T extends Schema<any>
  ? T // noop if T is already a Schema
  : // literals
  T extends boolean | number | string | null
  ? Schema<T>
  : // strings, numbers and booleans
  T extends BooleanConstructor
  ? Schema<boolean>
  : T extends NumberConstructor
  ? Schema<number>
  : T extends StringConstructor
  ? Schema<string>
  : // nested objects
  T extends typeof JSONElement
  ? Schema<InstanceType<T>["json"]>
  : // nested arrays
  T extends Array<typeof JSONElement>
  ? Schema<Array<InstanceType<T[number]>["json"]>>
  : // nested arrays of schemata
  T extends Array<Schema<infer U>>
  ? Schema<Array<U>>
  : // custom types
  T extends (value: string | null) => infer U | undefined
  ? Schema<U>
  : never;

type ValueOf<T> = T extends Schema<infer U> ? U : never;

function _str(x: string | null) {
  return x || undefined;
}

function _num(x: string | null) {
  if (x === null) return undefined;

  const result = Number(x);
  return Number.isNaN(result) ? undefined : result;
}

function _bool(x: string | null) {
  return x !== null;
}

function _null(x: string | null) {
  return x === null ? null : undefined;
}

// // function _enum<T>(...options: T[]) {
// //   return (x: string | null) => {
// //     for (const option of options) {
// //       switch (typeof option) {
// //         case "boolean":
// //           return _bool(x);
// //         case "string":
// //           return _str(x);
// //         case "number":
// //           return _num(x);
// //         case "function":
// //       }
// //     }
// //   };
// // }

// class Schema<T = never> {
//   optional = false;
//   invariants: Array<Invariant<T>> = [];

//   constructor(invariants: Array<Invariant<T>> = []) {
//     this.invariants = invariants;
//   }

//   value(el: JSONElement, attr: string): T {
//     for (const invariant of this.invariants) {
//       if (LITERAL_TYPES.has(typeof invariant)) return invariant;
//     }
//   }

//   extend<U>(invariant: BasicInvariant<U>) {
//     return new Schema<T | U>([...this.invariants, invariant]);
//   }
// }

// const foo = new Schema().extend(_str).extend(_bool);

// type LiteralInvariant<T extends boolean | number | string | null> = T;
// type BasicInvariant<T> = (x: any) => T | undefined;
// type ObjectInvariant<T extends JSONElement> = T;
// type ArrayInvariant<T extends JSONElement> = [T | Schema<T>];

// // type Invariant<T> = T extends boolean | number | string | null
// //   ? LiteralInvariant<T>
// //   : T extends JSONElement
// //   ? ObjectInvariant<T>
// //   : T extends [Is<JSONElement, infer U>]
// //   ? ArrayInvariant<U>
// //   : T extends (x: any) => infer U | undefined
// //   ? BasicInvariant<U>
// //   : never;

// type Invariant<T> = T extends boolean | number | string | null
//   ? T
//   : T extends (x: any) => infer U | undefined
//   ? BasicInvariant<U>
//   : never;

// function compile<T>() [

// ]

// type ResultOf<T extends Invariant<any>> = T extends Invariant<infer U> ? U : never;
// type TypeOf<T extends Schema<any>> = T extends Schema<infer U> ? U : never;
