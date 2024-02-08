// import { test, expect } from "bun:test";
// import { diff } from "./json-element.js";

// /** @type {Array<[string, any, any, any]>} */
// const cases = [
//   // top level
//   ["top-level scalar, noop", 1, 1, []],
//   ["top-level scalar, replace", 1, 2, [{ op: "replace", path: "", value: 2 }]],
//   ["top-level array, noop", [1], [1], []],
//   ["top-level array, add", [], [1], [{ op: "add", path: "/0", value: 1 }]],
//   ["top-level array, replace", [1], [2], [{ op: "replace", path: "/0", value: 2 }]],
//   ["top-level array, remove", [1], [], [{ op: "remove", path: "/0" }]],
//   [
//     "top-level array, cascading remove",
//     [1, 2, 3],
//     [2, 3],
//     [
//       { op: "replace", path: "/0", value: 2 },
//       { op: "replace", path: "/1", value: 3 },
//       { op: "remove", path: "/2" }
//     ]
//   ],
//   ["top-level object, noop", { foo: "foo" }, { foo: "foo" }, []],
//   [
//     "top-level object, add",
//     { foo: "foo" },
//     { foo: "foo", bar: "bar" },
//     [{ op: "add", path: "/bar", value: "bar" }]
//   ],
//   [
//     "top-level object, replace",
//     { foo: "foo" },
//     { foo: "qux" },
//     [{ op: "replace", path: "/foo", value: "qux" }]
//   ],
//   ["top-level object, remove", { foo: "foo" }, {}, [{ op: "remove", path: "/foo" }]],

//   // second level
//   ["second-level scalar, noop", { foo: 1 }, { foo: 1 }, []],
//   [
//     "second-level scalar, replace",
//     { foo: 1 },
//     { foo: 2 },
//     [{ op: "replace", path: "/foo", value: 2 }]
//   ],
//   ["second-level array, noop", { foo: [1] }, { foo: [1] }, []],
//   ["second-level array, add", { foo: [] }, { foo: [1] }, [{ op: "add", path: "/foo/0", value: 1 }]],
//   [
//     "second-level array, replace",
//     { foo: [1] },
//     { foo: [2] },
//     [{ op: "replace", path: "/foo/0", value: 2 }]
//   ],
//   ["second-level array, remove", { foo: [1] }, { foo: [] }, [{ op: "remove", path: "/foo/0" }]],
//   [
//     "second-level array, cascading remove",
//     { foo: [1, 2, 3] },
//     { foo: [2, 3] },
//     [
//       { op: "replace", path: "/foo/0", value: 2 },
//       { op: "replace", path: "/foo/1", value: 3 },
//       { op: "remove", path: "/foo/2" }
//     ]
//   ],
//   ["second-level object, noop", { foo: { bar: "baz" } }, { foo: { bar: "baz" } }, []],
//   [
//     "second-level object, add",
//     { foo: { bar: "baz" } },
//     { foo: { bar: "baz", qux: "thud" } },
//     [{ op: "add", path: "/foo/qux", value: "thud" }]
//   ],
//   [
//     "second-level object, replace",
//     { foo: { bar: "baz" } },
//     { foo: { bar: "qux" } },
//     [{ op: "replace", path: "/foo/bar", value: "qux" }]
//   ],
//   ["second-level object, remove", { foo: "foo" }, {}, [{ op: "remove", path: "/foo" }]]
// ];

// test.each(cases)("%s", (_, a, b, expected) => {
//   expect(diff(a, b)).toEqual(expected);
// });
