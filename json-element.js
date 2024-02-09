/**
 * @typedef {object} Patch
 * A JSON Patch operation as specified by IETF RFC 6902
 *
 * @property {"add" | "replace" | "remove"} op
 * @property {string} path
 * @property {unknown} [value]
 */

/**
 * @typedef {CustomEvent<{ patches?: Patch[] }>} JSONChangeEvent
 * An event emitted when the JSON changes, optionally containing an array of JSON Patch operations.
 */

/**
 * @template T
 * @typedef {(value: string | null, els: JSONElement[]) => T | undefined} ValueGetter
 */

/** @typedef {boolean | number | string | null | typeof Boolean | typeof Number | typeof String | typeof Object | typeof JSONElement | typeof Array | Array<typeof Object | typeof JSONElement> | ValueGetter<any>} SchemaInput */

const LITERAL_TYPES = new Set(["boolean", "number", "string", "null"]);

/**
 * @template {boolean | number | string | null} T
 * @param {SchemaInput} schema
 * @returns {schema is T} */
const isLiteralSchema = schema => LITERAL_TYPES.has(typeof schema);

/** @param {SchemaInput} schema */
const isArraySchema = schema => Array.isArray(schema) || schema === Array;

/** @param {SchemaInput} schema */
const isObjectSchema = schema =>
  /** @type {typeof Object} */ (schema)?.prototype instanceof JSONElement || schema === Object;

/** @param {SchemaInput} schema */
const isCompositeSchema = schema =>
  isObjectSchema(schema) ||
  isArraySchema(schema) ||
  (typeof schema === "function" && schema.length >= 2);

/** @type {ValueGetter<string>} */
const string = value => value || undefined;

/** @type {ValueGetter<boolean>} */
const boolean = value => value !== null;

/** @type {ValueGetter<number>} */
const number = value => {
  if (value === null) return;

  const num = Number(value);
  if (Number.isNaN(num)) return;

  return num;
};

/** @type {ValueGetter<any>} */
const object = (_, [el]) => el?.json;

/** @type {ValueGetter<any[]>} */
const array = (_, els) => els.map(el => el.json);

/**
 * @template {SchemaInput} T
 * @param {T} schema
 * @returns {ValueGetter<any>}
 */
function compile(schema) {
  if (isLiteralSchema(schema)) return () => schema;
  else if (schema === Boolean) return boolean;
  else if (schema === Number) return number;
  else if (schema === String) return string;
  else if (isObjectSchema(schema)) return object;
  else if (isArraySchema(schema)) return array;
  else if (typeof schema === "function") return /** @type ValueGetter<any> */ (schema);

  throw new Error(`Invalid schema input ${schema}`);
}

/**
 * @template {SchemaInput[]} T
 * @param {T} schemata
 */
export function Enum(...schemata) {
  const fns = schemata.map(schema => compile(schema));

  /**
   * @param {string | null} value
   * @param {JSONElement[]} els
   */
  return (value, els) => {
    for (const fn of fns) {
      const result = fn(value, els);
      if (result !== undefined) return result;
    }
  };
}

export default class JSONElement extends HTMLElement {
  static tag = "json-webcomponent";

  static register(tag = this.tag) {
    const ce = customElements.get(tag);
    if (ce === this) return;
    else if (ce) return console.warn(`<${tag}> already registered!`);

    customElements.define(tag, this);
  }

  /** @type {Record<string, any>} */
  static schema = {};

  /**
   * @param {any} _prev
   * @param {any} _next
   * @param {string} [_path]
   * @returns {Patch[]}
   */
  static diff(_prev, _next, _path) {
    console.warn(`Import and call enableDiff() to generate diffs.`);
    return [];
  }

  static get observedAttributes() {
    return Object.keys(this.schema);
  }

  /** Whether a task is queued to emit a `json-change` event */
  #queued = false;

  /** @type {any} The previous JSON value for diffing */
  #prev = null;

  /** @type {Record<string, ValueGetter<any>>} */
  #schema = {};

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });

    this.addEventListener("json-change", this);
    root.addEventListener("slotchange", this);

    const schema = /** @type {typeof JSONElement} */ (this.constructor).schema;
    for (const [key, value] of Object.entries(schema)) {
      this.#schema[key] = compile(value);
      if (!isCompositeSchema(value)) continue;

      const slot = document.createElement("slot");
      slot.name = key;
      root.append(slot);
    }
  }

  attributeChangedCallback() {
    this.#queue();
  }

  connectedCallback() {
    this.#queue();
  }

  /** @param {JSONChangeEvent} ev */
  handleEvent(ev) {
    switch (ev.type) {
      case "slotchange": {
        this.#queue();
        break;
      }

      // batch multiple `json-change` events from descendants
      case "json-change": {
        const target = ev.target;

        // if this element dispatched the event, let it through
        if (target === this) return;
        if (!(target instanceof JSONElement)) return;

        // prevent any other handlers from handling the event
        ev.stopImmediatePropagation();

        // queue a `json-change` event dispatch
        this.#queue();
        break;
      }
    }
  }

  /** Queues a `json-change` event dispatch */
  #queue() {
    // if there are no changes, queue a microtask to notify
    if (!this.#queued) queueMicrotask(() => this.#notify());
    this.#queued = true;
  }

  /** Sends a `json-change` event */
  #notify() {
    /** @type {Patch[] | undefined} */
    let patches;
    if (this.hasAttribute("diff")) {
      const json = this.json;
      patches = diff(this.#prev, json);
      this.#prev = json;
    }

    // create a new event with the batched changes
    /** @type {JSONChangeEvent} */
    const ev = new CustomEvent("json-change", {
      detail: { patches },
      bubbles: true
    });

    this.#queued = false;
    this.dispatchEvent(ev);
  }

  get json() {
    /** @type {any} */
    const json = {};

    for (const [key, fn] of Object.entries(this.#schema)) {
      const slotted = isCompositeSchema(fn) ? this.#slotted(key) : [];
      const value = fn(this.getAttribute(key), slotted);
      if (value !== undefined) json[key] = value;
    }

    return json;
  }

  #slotted(name = "") {
    let selector = "slot";
    if (name) selector += `[name=${name}]`;

    /** @type {HTMLSlotElement | null | undefined} */
    const slot = this.shadowRoot?.querySelector(selector);

    const els = slot?.assignedElements() || [];
    return els.filter(
      /** @type {(el: Element) => el is JSONElement} */ (el => el instanceof JSONElement)
    );
  }
}

/** @param {any} obj */
function keys(obj) {
  if (Array.isArray(obj)) return new Array(obj.length).fill(0).map((_, i) => "" + i);
  return Object.keys(obj);
}

/**
 * @param {string} path
 * @param {string} prop
 */
function append(path, prop) {
  return path + "/" + prop.replace(/~/g, "~0").replace(/\//g, "~1");
}

/** @param {any} x */
function isScalar(x) {
  return typeof x !== "object" || x === null;
}

/**
 * @param {any} prev
 * @param {any} next
 * @param {string} [path]
 * @returns {Patch[]}
 */
function diff(prev, next, path = "") {
  // if prev and next are strictly equal, don't bother checking further
  if (prev === next) return [];

  // if at least one value is a scalar, replace it
  if (isScalar(prev) || isScalar(next)) return [{ op: "replace", path, value: next }];

  /** @type {Patch[]} */
  const patches = [];

  // check for additions and changes
  for (const prop of keys(next)) {
    const newPath = append(path, prop);

    // if the key wasn't present in prev, add it
    if (typeof prev[prop] === "undefined") {
      patches.push({ op: "add", path: newPath, value: next[prop] });
    }

    // …otherwise, if both prev and next are objects or arrays, recurse into them and add any nested patches
    else if (typeof next[prop] === "object" && typeof prev[prop] === "object") {
      patches.push(...diff(prev[prop], next[prop], newPath));
    }

    // …otherwise, if the values aren't equal, replace them
    else if (prev[prop] !== next[prop]) {
      patches.push({ op: "replace", path: newPath, value: next[prop] });
    }
  }

  // check for deletions
  for (const prop of keys(prev)) {
    // if the key isn't present in next, remove it
    if (typeof next[prop] === "undefined") {
      patches.push({ op: "remove", path: append(path, prop) });
    }
  }

  return patches;
}

/** Enable elements to include JSON Patch operations in `json-change` event details. */
export function enableDiff() {
  JSONElement.diff = diff;
}
