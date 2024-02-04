/** @typedef {import("./json-element.d.ts").Patch} Patch */
/** @typedef {import("./json-element.d.ts").Change} Change */
/** @typedef {import("./json-element.d.ts").JsonChangeEvent} JsonChangeEvent */

const LITERAL_TYPES = new Set(["boolean", "number", "string", "null"]);
const PROPERTY_TYPES = new Set([Boolean, Number, String]);

/** @template T @param {(value: unknown) => T} fn */
export function Optional(fn) {
  return (/** @type {T} */ value) => (value === null ? undefined : fn(value));
}

/** @param {unknown} value */
const isArray = value => Array.isArray(value) || value === Array;

/** @param {unknown} value */
const isObject = value =>
  /** @type {any} */ (value)?.prototype instanceof JSONElement || value === Object;

/** @param {unknown} value */
const isComposite = value => isArray(value) || isObject(value);

/**
 * @param {unknown} obj
 * @returns {obj is JSONElement}
 */
function isJson(obj) {
  return obj instanceof JSONElement;
}

export default class JSONElement extends HTMLElement {
  static tag = "json-webcomponent";
  static register(tag = this.tag) {
    const ce = customElements.get(tag);
    if (ce === this) return;
    else if (ce) return console.warn(`<${tag}> already registered!`);

    customElements.define(tag, this);
  }

  /** @type {Change[]} */
  changes = [];

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });

    this.addEventListener("json-change", this);

    for (const [key, value] of Object.entries(this.schema)) {
      if (!isComposite(value)) continue;

      const slot = document.createElement("slot");
      slot.name = key;
      root.append(slot);
    }
  }

  static get observedAttributes() {
    return Object.keys(this.schema);
  }

  /** @type {Record<string, any>} */
  static get schema() {
    return {};
  }

  /**
   * @param {string} key
   * @param {string | null} prev
   * @param {string | null} value
   */
  attributeChangedCallback(key, prev, value) {
    // if there are no changes, queue a microtask to notify
    if (!this.changes.length) queueMicrotask(() => this.notify());

    /** @type {Change["op"]} */
    let op = "replace";
    if (prev === null) op = "add";
    else if (value === null) op = "remove";
    this.changes.push({ target: this, path: key, value, op });
  }

  /** @param {JsonChangeEvent} ev */
  handleEvent(ev) {
    switch (ev.type) {
      // batch multiple `json-change` events from descendants
      case "json-change": {
        const target = ev.target;

        // if this element dispatched the event, let it through
        if (target === this) return;
        if (!isJson(target)) return;

        // prevent any other handlers from handling the event
        ev.stopImmediatePropagation();

        // if there are no changes, queue a microtask to notify
        if (!this.changes.length) queueMicrotask(() => this.notify());

        // update the paths of any changes from descendants
        let changes = ev.detail.changes.map(change => {
          // use the slot name of the emitting element as a prefix
          let prefix = target.slot + "/";

          // if the slot corresponds to an array in the schema, add the index to the prefix
          if (isArray(this.schema[target.slot])) {
            const index = this.slotted(target.slot).indexOf(target);
            prefix += index + "/";
          }

          return { ...change, path: prefix + change.path };
        });

        // add the changes to the changes array
        this.changes.push(...changes);
      }
    }
  }

  notify() {
    // create a new event with the batched changes
    /** @type {JsonChangeEvent} */
    const ev = new CustomEvent("json-change", {
      detail: { changes: this.changes.slice() },
      bubbles: true
    });

    this.changes = [];
    this.dispatchEvent(ev);
  }

  get schema() {
    return /** @type {typeof JSONElement} */ (this.constructor).schema;
  }

  get json() {
    /** @type {any} */
    const result = {};

    for (const [k, v] of Object.entries(this.schema)) {
      // literals in the schema should go as is
      if (LITERAL_TYPES.has(typeof v)) {
        result[k] = v;
        continue;
      }

      // arrays in the schema should use the corresponding slot elements' json
      if (isArray(v)) {
        const els = this.slotted(k);
        result[k] = els.map(el => el.json);
        continue;
      }

      // objects in the schema should use json from the corresponding slot's first element
      if (isObject(v)) {
        const [el] = this.slotted(k);
        if (el) result[k] = el.json;
        continue;
      }

      // functions in the schema should coerce the corresponding attribute
      if (PROPERTY_TYPES.has(v) || typeof v === "function") {
        const value = v(this.getAttribute(k));
        if (value !== undefined) result[k] = value;
        continue;
      }
    }

    return result;
  }

  slotted(name = "") {
    let selector = "slot";
    if (name) selector += `[name=${name}]`;

    /** @type {HTMLSlotElement | null | undefined} */
    const slot = this.shadowRoot?.querySelector(selector);

    const els = slot?.assignedElements() || [];
    return els.filter(isJson);
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

/**
 * @param {any} prev
 * @param {any} next
 * @param {string} [path]
 * @returns {Patch[]}
 */
function diff(prev, next, path = "") {
  // if prev and next aren't equal and at least one is a scalar, replace it
  if (prev !== next && typeof prev !== "object" && typeof next !== "object") {
    return [{ op: "replace", path, value: next }];
  }

  /** @type {Patch[]} */
  const patches = [];

  // check for additions and changes
  for (const prop of keys(next)) {
    const newPath = append(path, prop);

    // if the key wasn't present in prev, add it
    if (typeof prev[prop] === "undefined") {
      patches.push({ op: "add", path: newPath, value: next[prop] });
    }

    // otherwise, if both prev and next are objects, recurse into them and add any nested patches
    else if (typeof next[prop] === "object" && typeof prev[prop] === "object") {
      patches.push(...diff(prev[prop], next[prop], newPath));
    }

    // otherwise, if the values aren't equal, replace them
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
