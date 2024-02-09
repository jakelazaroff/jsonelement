import assert from "node:assert";
import { before, test } from "node:test";
import { parseHTML } from "linkedom";

before(() => {
  global.window = parseHTML(`<!DOCTYPE html><html><head></head><body></body></html>`);
  global.document = window.document;
  global.customElements = window.customElements;
  global.HTMLElement = window.HTMLElement;
  global.CustomEvent = window.CustomEvent;
});

test("basic tests", async t => {
  before(async () => {
    const { default: JSONElement } = await import("./json-element.js");

    class TestBasic extends JSONElement {
      static tag = "test-basic";

      static schema = {
        literal: "literal",
        string: String,
        number: Number,
        bool: Boolean
      };
    }

    TestBasic.register();
  });

  await t.test("serializes booleans, numbers and strings", () => {
    document.body.innerHTML = `<test-basic string="test" number="10" bool></test-basic>`;
    const instance = document.querySelector("test-basic");

    assert.deepStrictEqual(instance.json, {
      literal: "literal",
      string: "test",
      number: 10,
      bool: true
    });
  });

  await t.test("emits a `json-change` event on initialization", () => {
    return new Promise(async resolve => {
      document.body.innerHTML = `<test-basic string="test" number="10" bool></test-basic>`;
      const instance = document.querySelector("test-basic");

      instance?.addEventListener("json-change", () => {
        assert.deepStrictEqual(instance.json, {
          literal: "literal",
          string: "test",
          number: 10,
          bool: true
        });
        resolve();
      });
    });
  });

  await t.test("emits a `json-change` event when attributes change", () => {
    return new Promise(async resolve => {
      document.body.innerHTML = `<test-basic string="test" number="10"></test-basic>`;
      const instance = document.querySelector("test-basic");
      await customElements.whenDefined("test-basic");

      instance?.addEventListener("json-change", () => {
        assert.strictEqual(instance.json.string, "othertest");
        resolve();
      });

      instance?.setAttribute("string", "othertest");
    });
  });

  await t.test("batches multiple attribute changes into a single `json-change` event", async () => {
    return new Promise(async resolve => {
      document.body.innerHTML = `<test-basic string="test" number="10" bool></test-basic>`;
      const instance = document.querySelector("test-basic");
      await customElements.whenDefined("test-basic");

      instance?.addEventListener("json-change", () => {
        assert.deepStrictEqual(instance.json, {
          literal: "literal",
          string: "othertest",
          number: 100,
          bool: true
        });
        resolve();
      });

      instance?.setAttribute("string", "othertest");
      instance?.setAttribute("number", 100);
    });
  });
});

test("composite", async t => {
  before(async () => {
    const { default: JSONElement, enableDiff } = await import("./json-element.js");
    enableDiff();

    class TestObject extends JSONElement {
      static tag = "test-object";

      static schema = {
        object: Object
      };
    }

    class TestArray extends JSONElement {
      static tag = "test-array";
      diff = true;

      static schema = {
        array: Array
      };
    }

    TestObject.register();
    TestArray.register();
  });

  await t.test("serializes nested objects", () => {
    document.body.innerHTML = `
      <test-object>
        <test-basic slot="object" string="one" number="1" bool></test-basic>
      </test-object>
    `;
    const instance = document.querySelector("test-object");

    assert.deepStrictEqual(instance.json, {
      object: { literal: "literal", string: "one", number: 1, bool: true }
    });
  });

  await t.test("serializes nested arrays", () => {
    document.body.innerHTML = `
      <test-array>
        <test-basic slot="array" string="one" number="1" bool></test-basic>
        <test-basic slot="array" string="two" number="2"></test-basic>
      </test-array>
    `;
    const instance = document.querySelector("test-array");

    assert.deepStrictEqual(instance.json, {
      array: [
        { literal: "literal", string: "one", number: 1, bool: true },
        { literal: "literal", string: "two", number: 2, bool: false }
      ]
    });
  });

  await t.test("emits a `json-change` event when a child changes", async () => {
    return new Promise(async resolve => {
      document.body.innerHTML = `
        <test-array id="array">
          <test-basic slot="array" string="one" number="1" bool></test-basic>
          <test-basic slot="array" string="two" number="2"></test-basic>
        </test-array>
      `;
      const instance = document.querySelector("test-array");
      await customElements.whenDefined("test-array");
      await customElements.whenDefined("test-basic");

      instance?.addEventListener("json-change", ev => {
        assert.deepStrictEqual(instance.json, {
          array: [
            { literal: "literal", string: "one test", number: 1, bool: true },
            { literal: "literal", string: "two", number: 2, bool: false }
          ]
        });
        resolve();
      });

      const child = document.querySelector("test-basic");
      child?.setAttribute("string", "one test");
    });
  });

  await t.test("emits a `json-change` event when a child is added", async () => {
    return new Promise(async resolve => {
      document.body.innerHTML = `
        <test-array id="array">
          <test-basic slot="array" string="one" number="1" bool></test-basic>
          <test-basic slot="array" string="two" number="2"></test-basic>
        </test-array>
      `;
      const instance = document.querySelector("test-array");
      await customElements.whenDefined("test-array");
      await customElements.whenDefined("test-basic");

      instance?.addEventListener("json-change", ev => {
        assert.deepStrictEqual(instance.json, {
          array: [
            { literal: "literal", string: "one", number: 1, bool: true },
            { literal: "literal", string: "two", number: 2, bool: false },
            { literal: "literal", string: "three", number: 3, bool: false }
          ]
        });
        resolve();
      });

      const child = document.createElement("test-basic");
      child.slot = "array";
      child.id = "child";
      child.setAttribute("string", "three");
      child.setAttribute("number", "3");
      instance?.appendChild(child);
    });
  });

  // TODO: uncomment when linkedom supports slotchange events
  // await t.test("emits a `json-change` event when a child is removed", async () => {
  //   return new Promise(async resolve => {
  //     document.body.innerHTML = `
  //       <test-array id="array">
  //         <test-basic slot="array" string="one" number="1"></test-basic>
  //         <test-basic slot="array" string="two" number="2"></test-basic>
  //       </test-array>
  //     `;
  //     const instance = document.querySelector("test-array");
  //     await customElements.whenDefined("test-array");
  //     await customElements.whenDefined("test-basic");

  //     instance?.addEventListener("json-change", ev => {
  //       assert.deepStrictEqual(instance.json, {
  //         array: [{ string: "two", number: 2 }]
  //       });
  //       resolve();
  //     });

  //     const child = document.querySelector("test-basic");
  //     instance?.removeChild(child);
  //   });
  // });
});

test("enumerated", async t => {
  before(async () => {
    const { default: JSONElement, Enum } = await import("./json-element.js");

    class TestEnum extends JSONElement {
      static tag = "test-enum";

      static schema = {
        enum: Enum(String, Object)
      };
    }

    TestEnum.register();
  });

  await t.test("prefers the first item in the enum", () => {
    document.body.innerHTML = `<test-enum enum="test"></test-enum>`;
    const instance = document.querySelector("test-enum");

    assert.deepStrictEqual(instance.json, { enum: "test" });
  });

  await t.test("falls back to the second item in the enum", () => {
    document.body.innerHTML = `<test-enum><test-basic slot="enum"></test-basic></test-enum>`;
    const instance = document.querySelector("test-enum");

    assert.deepStrictEqual(instance.json, { enum: { literal: "literal", bool: false } });
  });
});

test("diff", async t => {
  let JSONElement;

  before(async () => {
    const lib = await import("./json-element.js");
    JSONElement = lib.default;
    lib.enableDiff();
  });

  /**
   * An array of diff test cases
   * @type {[description: string, before: any, after: any, patches: import("./json-element.js").Patch[]][]}
   */
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
    [
      "second-level array, add",
      { foo: [] },
      { foo: [1] },
      [{ op: "add", path: "/foo/0", value: 1 }]
    ],
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

  let i = 0;
  for (const [name, before, after, patches] of cases) {
    await t.test(
      name,
      async () =>
        new Promise(async resolve => {
          const tag = `test-diff-${++i}`;
          class TestDiff extends JSONElement {
            static tag = tag;
            diff = true;

            static get schema() {
              return {
                result: value => (value === "before" ? before : after)
              };
            }

            get json() {
              return super.json.result;
            }
          }

          TestDiff.register();

          document.body.innerHTML = `<${tag} result="before"></${tag}>`;
          await customElements.whenDefined(tag);

          const instance = document.querySelector(tag);

          instance?.addEventListener("json-change", ev => {
            assert.deepStrictEqual(patches, ev.detail.patches);
            resolve();
          });

          setTimeout(() => instance.setAttribute("result", "after"));
        })
    );
  }
});
