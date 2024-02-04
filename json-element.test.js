import { test, expect } from "bun:test";

/** @type {Array<[string, any, any, any]>} */
const cases = [
  // top level
  ["top-level scalar, noop", 1, 1, []],
  ["top-level scalar, replace", 1, 2, [{ op: "replace", path: "", value: 2 }]],
  ["top-level array, noop", [1], [1], []],
  ["top-level array, add", [], [1], [{ op: "add", path: "/0", value: 1 }]],
  ["top-level array, replace", [1], [2], [{ op: "replace", path: "/0", value: 2 }]],
  ["top-level array, remove", [1], [], [{ op: "remove", path: "/0" }]],
  [
    "top-level array, cascading remove",
    [1, 2, 3],
    [2, 3],
    [
      { op: "replace", path: "/0", value: 2 },
      { op: "replace", path: "/1", value: 3 },
      { op: "remove", path: "/2" }
    ]
  ],
  ["top-level object, noop", { foo: "foo" }, { foo: "foo" }, []],
  [
    "top-level object, add",
    { foo: "foo" },
    { foo: "foo", bar: "bar" },
    [{ op: "add", path: "/bar", value: "bar" }]
  ],
  [
    "top-level object, replace",
    { foo: "foo" },
    { foo: "qux" },
    [{ op: "replace", path: "/foo", value: "qux" }]
  ],
  ["top-level object, remove", { foo: "foo" }, {}, [{ op: "remove", path: "/foo" }]],

  // second level
  ["second-level scalar, noop", { foo: 1 }, { foo: 1 }, []],
  [
    "second-level scalar, replace",
    { foo: 1 },
    { foo: 2 },
    [{ op: "replace", path: "/foo", value: 2 }]
  ],
  ["second-level array, noop", { foo: [1] }, { foo: [1] }, []],
  ["second-level array, add", { foo: [] }, { foo: [1] }, [{ op: "add", path: "/foo/0", value: 1 }]],
  [
    "second-level array, replace",
    { foo: [1] },
    { foo: [2] },
    [{ op: "replace", path: "/foo/0", value: 2 }]
  ],
  ["second-level array, remove", { foo: [1] }, { foo: [] }, [{ op: "remove", path: "/foo/0" }]],
  [
    "second-level array, cascading remove",
    { foo: [1, 2, 3] },
    { foo: [2, 3] },
    [
      { op: "replace", path: "/foo/0", value: 2 },
      { op: "replace", path: "/foo/1", value: 3 },
      { op: "remove", path: "/foo/2" }
    ]
  ],
  ["second-level object, noop", { foo: { bar: "baz" } }, { foo: { bar: "baz" } }, []],
  [
    "second-level object, add",
    { foo: { bar: "baz" } },
    { foo: { bar: "baz", qux: "thud" } },
    [{ op: "add", path: "/foo/qux", value: "thud" }]
  ],
  [
    "second-level object, replace",
    { foo: { bar: "baz" } },
    { foo: { bar: "qux" } },
    [{ op: "replace", path: "/foo/bar", value: "qux" }]
  ],
  ["second-level object, remove", { foo: "foo" }, {}, [{ op: "remove", path: "/foo" }]]
];

test.each(cases)("%s", (_, a, b, expected) => {
  expect(diff(a, b)).toEqual(expected);
});

/** @param {any} obj */
function keys(obj) {
  if (Array.isArray(obj)) return new Array(obj.length).fill(0).map((_, i) => "" + i);
  return Object.keys(obj);
}

/** @param {string} path @param {string} prop */
function append(path, prop) {
  return path + "/" + prop.replace(/~/g, "~0").replace(/\//g, "~1");
}

function diff(prev, next, path = "") {
  // if prev and next aren't equal and at least one is a scalar, replace it
  if (prev !== next && typeof prev !== "object" && typeof next !== "object") {
    return [{ op: "replace", path, value: next }];
  }

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
