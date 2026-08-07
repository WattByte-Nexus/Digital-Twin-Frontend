const RAW_PALETTE =
  "white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const COLOR_UTILITY =
  "bg|text|border(?:-[xytrblse])?|divide|outline|ring|shadow|fill|stroke|decoration|from|via|to|caret|accent";
const RAW_PALETTE_UTILITY = new RegExp(
  `(?:^|:)(?:${COLOR_UTILITY})-(?:${RAW_PALETTE})(?:-\\d{1,3})?(?:\\/[\\w.\\[\\]%-]+)?$`,
);
const ARBITRARY_COLOR_UTILITY = new RegExp(
  `(?:^|:)(?:${COLOR_UTILITY})-\\[`,
  "i",
);
const RAW_CSS_COLOR = /#[\da-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch)\s*\(/i;
const SEMANTIC_COLOR_FUNCTION =
  /\b(?:rgb|rgba|hsl|hsla|oklch)\s*\(\s*var\(\s*--[^)]*\)[^)]*\)/gi;
const COLOR_ATTRIBUTES = new Set([
  "color",
  "fill",
  "floodColor",
  "lightingColor",
  "stopColor",
  "stroke",
]);
const COLOR_STYLE_PROPERTIES = new Set([
  "accentColor",
  "background",
  "backgroundColor",
  "borderBlockColor",
  "borderBottomColor",
  "borderColor",
  "borderInlineColor",
  "borderLeftColor",
  "borderRightColor",
  "borderTopColor",
  "boxShadow",
  "caretColor",
  "color",
  "fill",
  "outlineColor",
  "stroke",
  "textDecorationColor",
  "textShadow",
]);

function staticString(node) {
  if (!node) return null;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? node.quasis[0]?.value.raw ?? "";
  }
  return null;
}

function staticStrings(node) {
  const value = staticString(node);
  if (value !== null) return [{ node, value }];
  if (!node) return [];

  if (node.type === "ConditionalExpression") {
    return [...staticStrings(node.consequent), ...staticStrings(node.alternate)];
  }
  if (node.type === "LogicalExpression") {
    return [...staticStrings(node.left), ...staticStrings(node.right)];
  }
  if (
    node.type === "TSAsExpression" ||
    node.type === "TSSatisfiesExpression" ||
    node.type === "TSNonNullExpression"
  ) {
    return staticStrings(node.expression);
  }

  return [];
}

function propertyName(node) {
  if (!node || node.computed) return null;
  if (node.key.type === "Identifier") return node.key.name;
  return staticString(node.key);
}

function rawUtilities(value) {
  return value
    .split(/\s+/)
    .filter(
      (token) =>
        RAW_PALETTE_UTILITY.test(token) ||
        (ARBITRARY_COLOR_UTILITY.test(token) && isRawCssColor(token)),
    );
}

function isRawCssColor(value) {
  return RAW_CSS_COLOR.test(value.replace(SEMANTIC_COLOR_FUNCTION, ""));
}

function jsxAttributeName(node) {
  return node.name.type === "JSXIdentifier" ? node.name.name : null;
}

function jsxAttributeValues(node) {
  if (!node.value) return [];
  if (node.value.type === "Literal") return staticStrings(node.value);
  if (node.value.type === "JSXExpressionContainer") {
    return staticStrings(node.value.expression);
  }
  return [];
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require semantic theme tokens instead of raw palette utilities and presentation colors.",
    },
    schema: [],
    messages: {
      rawCssColor:
        "Use a semantic theme token instead of the hard-coded color '{{value}}'. Define its light and dark values in packages/ui/src/globals.css.",
      rawUtilities:
        "Use semantic theme utilities instead of raw palette utilities: {{utilities}}.",
    },
  },

  create(context) {
    function checkUtilityString(node, value) {
      const utilities = [...new Set(rawUtilities(value))];
      if (utilities.length === 0) return;

      context.report({
        node,
        messageId: "rawUtilities",
        data: { utilities: utilities.join(", ") },
      });
    }

    function checkCssColor(node, value) {
      if (!isRawCssColor(value)) return;
      context.report({ node, messageId: "rawCssColor", data: { value } });
    }

    return {
      Literal(node) {
        const value = staticString(node);
        if (value !== null) checkUtilityString(node, value);
      },

      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          checkUtilityString(quasi, quasi.value.cooked ?? quasi.value.raw);
        }
      },

      JSXAttribute(node) {
        const name = jsxAttributeName(node);
        if (!name) return;

        if (COLOR_ATTRIBUTES.has(name)) {
          for (const value of jsxAttributeValues(node)) {
            checkCssColor(value.node, value.value);
          }
          return;
        }

        if (
          name !== "style" ||
          node.value?.type !== "JSXExpressionContainer" ||
          node.value.expression.type !== "ObjectExpression"
        ) {
          return;
        }

        for (const property of node.value.expression.properties) {
          if (property.type !== "Property") continue;
          const name = propertyName(property);
          if (!name || !COLOR_STYLE_PROPERTIES.has(name)) continue;
          for (const value of staticStrings(property.value)) {
            checkCssColor(value.node, value.value);
          }
        }
      },
    };
  },
};

export default rule;
