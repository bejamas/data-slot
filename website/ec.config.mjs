import { defineEcConfig, definePlugin } from "@astrojs/starlight/expressive-code";
import { addClassName, toText } from "@astrojs/starlight/expressive-code/hast";

const SLOT_LINK_META = "slot-links";
const SLOT_LINK_CLASS = "ec-data-slot-link";
const SLOT_LINK_BLOCK_CLASS = "ec-slot-links";

function getCodeWrapper(lineAst) {
  return lineAst.children.find(
    (child) =>
      child &&
      child.type === "element" &&
      child.tagName === "div" &&
      Array.isArray(child.properties?.className) &&
      child.properties.className.includes("code")
  );
}

const dataSlotLinksPlugin = definePlugin({
  name: "data-slot-links",
  baseStyles: `
    .${SLOT_LINK_BLOCK_CLASS} .${SLOT_LINK_CLASS} {
      color: inherit;
      text-decoration: none;
      border-bottom: 1px solid currentColor;
      transition: opacity 160ms ease;
    }

    .${SLOT_LINK_BLOCK_CLASS} .${SLOT_LINK_CLASS}:hover {
      opacity: 0.72;
    }
  `,
  hooks: {
    postprocessRenderedBlock({ codeBlock, renderData }) {
      if (!codeBlock.metaOptions.getBoolean(SLOT_LINK_META)) return;
      addClassName(renderData.blockAst, SLOT_LINK_BLOCK_CLASS);
    },
    postprocessRenderedLine({ codeBlock, renderData }) {
      if (!codeBlock.metaOptions.getBoolean(SLOT_LINK_META)) return;

      const codeWrapper = getCodeWrapper(renderData.lineAst);
      if (!codeWrapper || !Array.isArray(codeWrapper.children)) return;

      for (let index = 0; index <= codeWrapper.children.length - 3; index += 1) {
        const keyNode = codeWrapper.children[index];
        const equalsNode = codeWrapper.children[index + 1];

        if (toText(keyNode) !== "data-slot" || toText(equalsNode) !== "=") continue;

        const attributeNodes = [keyNode, equalsNode];
        let valueText = "";
        let cursor = index + 2;

        while (cursor < codeWrapper.children.length) {
          const node = codeWrapper.children[cursor];
          attributeNodes.push(node);
          valueText += toText(node);
          cursor += 1;

          if (valueText.startsWith('"') && valueText.endsWith('"') && valueText.length >= 2) {
            break;
          }
        }

        const match = /^"([^"]+)"$/.exec(valueText);
        if (!match) continue;

        codeWrapper.children.splice(index, attributeNodes.length, {
          type: "element",
          tagName: "a",
          properties: {
            href: `#slot-${match[1]}`,
            className: [SLOT_LINK_CLASS],
          },
          children: attributeNodes,
        });
      }
    },
  },
});

export default defineEcConfig({
  plugins: [dataSlotLinksPlugin],
});
