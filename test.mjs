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
    const { default: JSONElement, enableDiff } = await import("./json-element.js");
    enableDiff();

    class TestBasic extends JSONElement {
      diff = true;
      static tag = "test-basic";

      static schema = {
        string: String,
        number: Number
      };
    }

    TestBasic.register();
  });

  await t.test("serializes strings and numbers", () => {
    document.body.innerHTML = `<test-basic string="test" number="10"></test-basic>`;
    const instance = document.querySelector("test-basic");

    assert.deepStrictEqual(instance.json, { string: "test", number: 10 });
  });

  await t.test("emits a `json-change` event on initialization", () => {
    return new Promise(async resolve => {
      document.body.innerHTML = `<test-basic string="test" number="10"></test-basic>`;
      const instance = document.querySelector("test-basic");

      instance?.addEventListener("json-change", () => {
        assert.deepStrictEqual(instance.json, { string: "test", number: 10 });
        resolve();
      });
    });
  });

  await t.test("includes a JSON patch for elements with diff set", async () => {
    return new Promise(async resolve => {
      document.body.innerHTML = `<test-basic string="test" number="10"></test-basic>`;
      const instance = document.querySelector("test-basic");

      instance?.addEventListener("json-change", ev => {
        const patches = ev.detail.patches;
        assert.deepStrictEqual(patches[0], {
          op: "replace",
          path: "",
          value: { string: "test", number: 10 }
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
      document.body.innerHTML = `<test-basic string="test" number="10"></test-basic>`;
      const instance = document.querySelector("test-basic");
      await customElements.whenDefined("test-basic");

      instance?.addEventListener("json-change", () => {
        assert.deepStrictEqual(instance.json, { string: "othertest", number: 100 });
        resolve();
      });

      instance?.setAttribute("string", "othertest");
      instance?.setAttribute("number", 100);
    });
  });

  await t.test(
    "includes an array of JSON patch operations for elements with `diff` set",
    async () => {
      return new Promise(async resolve => {
        document.body.innerHTML = `<test-basic string="test" number="10"></test-basic>`;
        const instance = document.querySelector("test-basic");
        await customElements.whenDefined("test-basic");

        instance?.addEventListener("json-change", ev => {
          const patches = ev.detail.patches;
          assert.deepStrictEqual(patches[0], {
            op: "replace",
            path: "/string",
            value: "othertest"
          });
          assert.deepStrictEqual(patches[1], { op: "replace", path: "/number", value: 100 });
          resolve();
        });

        instance?.setAttribute("string", "othertest");
        instance?.setAttribute("number", 100);
      });
    }
  );
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
        <test-basic slot="object" string="one" number="1"></test-basic>
      </test-object>
    `;
    const instance = document.querySelector("test-object");

    assert.deepStrictEqual(instance.json, {
      object: { string: "one", number: 1 }
    });
  });

  await t.test("serializes nested arrays", () => {
    document.body.innerHTML = `
      <test-array>
        <test-basic slot="array" string="one" number="1"></test-basic>
        <test-basic slot="array" string="two" number="2"></test-basic>
      </test-array>
    `;
    const instance = document.querySelector("test-array");

    assert.deepStrictEqual(instance.json, {
      array: [
        { string: "one", number: 1 },
        { string: "two", number: 2 }
      ]
    });
  });

  await t.test("emits a `json-change` event when a child changes", async () => {
    return new Promise(async resolve => {
      document.body.innerHTML = `
        <test-array id="array">
          <test-basic slot="array" string="one" number="1"></test-basic>
          <test-basic slot="array" string="two" number="2"></test-basic>
        </test-array>
      `;
      const instance = document.querySelector("test-array");
      await customElements.whenDefined("test-array");
      await customElements.whenDefined("test-basic");

      instance?.addEventListener("json-change", ev => {
        assert.deepStrictEqual(instance.json, {
          array: [
            { string: "one test", number: 1 },
            { string: "two", number: 2 }
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
          <test-basic slot="array" string="one" number="1"></test-basic>
          <test-basic slot="array" string="two" number="2"></test-basic>
        </test-array>
      `;
      const instance = document.querySelector("test-array");
      await customElements.whenDefined("test-array");
      await customElements.whenDefined("test-basic");

      instance?.addEventListener("json-change", ev => {
        assert.deepStrictEqual(instance.json, {
          array: [
            { string: "one", number: 1 },
            { string: "two", number: 2 },
            { string: "three", number: 3 }
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

  await t.test("emits a `json-change` event when a child is removed", async () => {
    return new Promise(async resolve => {
      document.body.innerHTML = `
        <test-array id="array">
          <test-basic slot="array" string="one" number="1"></test-basic>
          <test-basic slot="array" string="two" number="2"></test-basic>
        </test-array>
      `;
      const instance = document.querySelector("test-array");
      await customElements.whenDefined("test-array");
      await customElements.whenDefined("test-basic");

      instance?.addEventListener("json-change", ev => {
        assert.deepStrictEqual(instance.json, {
          array: [{ string: "two", number: 2 }]
        });
        resolve();
      });

      const child = document.querySelector("test-basic");
      instance?.removeChild(child);
    });
  });
});
