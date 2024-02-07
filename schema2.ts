import JSONElement from "./json-element";

class UndefinedError extends Error {}
class IncorrectTypeError extends Error {}

type SchemaFn<T> = (value: JSONElement, attr: string) => T | undefined;

export class Schema<T, O extends boolean = false> {
  fn: SchemaFn<T>;
  optional: O;

  constructor(fn: SchemaFn<T>, optional: O) {
    this.fn = fn;
    this.optional = optional;
  }

  unwrap(el: JSONElement, attr: string): O extends true ? T | undefined : T {
    const value = this.fn(el, attr);
    if (value === undefined && !this.optional) throw new UndefinedError();
    return value as T;
  }
}

function boolean(el: JSONElement, attr: string) {
  return el.getAttribute(attr) !== null;
}

function number(el: JSONElement, attr: string) {
  const value = el.getAttribute(attr);
  if (value === null) return undefined;

  const n = Number(value);
  if (Number.isNaN(n)) throw new IncorrectTypeError();

  return n;
}

function string(el: JSONElement, attr: string) {
  const value = el.getAttribute(attr);
  if (value == null) return undefined;

  return value;
}

function literal<T extends boolean | number | string | null>(value: T) {
  return () => value;
}

function object<T extends typeof JSONElement>(subclass: T) {
  return (el: JSONElement, attr: string) => {
    const slot = el.shadowRoot?.querySelector(`slot[name=${attr}]`);
    if (!(slot instanceof HTMLSlotElement)) throw new Error(`No matching slot found for ${attr}`);

    const [slotted] = slot.assignedElements();
    if (!(slotted instanceof subclass)) throw new IncorrectTypeError();

    return slotted.json;
  };
}

function array<T extends typeof JSONElement>(input: Schema<JsonOf<T>>) {
  return (el: JSONElement, attr: string) => {
    const slot = el.shadowRoot?.querySelector(`slot[name=${attr}]`);
    if (!(slot instanceof HTMLSlotElement)) throw new Error(`No matching slot found for ${attr}`);

    return slot.assignedElements().map((slotted) => {
      if (!(slotted instanceof JSONElement)) throw new IncorrectTypeError();
      return input.unwrap(slotted, "");
    });
  };
}

function enumeration<T extends SchemaInput[]>(...inputs: T) {
  const schemata = inputs.map((input) => compile(input, true));
  return (el: JSONElement, attr: string) => {
    for (const schema of schemata) {
      const value = schema.unwrap(el, attr);
      if (value) return value as ValueOf<SchemaOutput<T[number]>>;
    }

    return;
  };
}

const LITERAL_TYPES = new Set(["boolean", "number", "string", "null"]);
function isLiteral(input: any): input is boolean | number | string | null {
  return LITERAL_TYPES.has(input);
}

type SchemaLiteral = boolean | number | string | null;
export type SchemaInput =
  | SchemaLiteral
  | typeof Boolean
  | typeof Number
  | typeof String
  | typeof JSONElement
  | [typeof JSONElement]
  | Schema<any, boolean>;

export type JsonOf<T extends typeof JSONElement> = InstanceType<T>["json"];
export type ValueOf<T extends Schema<any, boolean>> = T extends Schema<infer U, infer O>
  ? O extends true
    ? U | undefined
    : U
  : never;

export type SchemaOutput<T extends SchemaInput, O extends boolean = false> = T extends SchemaLiteral
  ? Schema<T, O>
  : T extends typeof Boolean
  ? Schema<boolean, O>
  : T extends typeof Number
  ? Schema<number, O>
  : T extends typeof String
  ? Schema<string, O>
  : T extends typeof JSONElement
  ? Schema<JsonOf<T>, O>
  : T extends [typeof JSONElement]
  ? Schema<JsonOf<T[0]>, O>
  : T extends [Schema<infer U>]
  ? Schema<U, O>
  : never;

export function compile<T extends SchemaInput, O extends boolean>(
  input: T,
  opt: O
): SchemaOutput<T, O> {
  if (input instanceof Schema) return new Schema(input.fn, opt) as SchemaOutput<T, O>;
  else if (isLiteral(input)) return new Schema(literal(input), opt) as SchemaOutput<T, O>;
  else if (input === Boolean) return new Schema(boolean, opt) as SchemaOutput<T, O>;
  else if (input === Number) return new Schema(number, opt) as SchemaOutput<T, O>;
  else if (input === String) return new Schema(string, opt) as SchemaOutput<T, O>;
  else if ((input as any).prototype instanceof JSONElement)
    return new Schema(object(input as typeof JSONElement), opt) as SchemaOutput<T, O>;
  else if (Array.isArray(input) && input[0].prototype instanceof JSONElement)
    return new Schema(array(compile(input[0], false)), opt) as SchemaOutput<T, O>;
  else if (Array.isArray(input) && input[0] instanceof Schema)
    return new Schema(array(input[0]), opt) as SchemaOutput<T, O>;

  throw new Error(`Invalid schema input ${input}`);
}

export function Optional<T extends SchemaInput>(input: T) {
  return compile(input, true);
}

export function Enum<T extends SchemaInput[]>(...inputs: T) {
  return new Schema(enumeration(...inputs), false);
}

class GeoJsonCoordinate extends JSONElement {
  static tag = "geojson-coordinate";

  static schema = { lon: Number, lat: Number };

  get json() {
    const { lon, lat } = super.json;
    return [lon, lat] as [number, number];
  }
}
