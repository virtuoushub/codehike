import { transformCodeNodes } from "./code"
import { transformEditorNodes } from "./editor"
import { transformSections } from "./section"
import { transformSpotlights } from "./spotlight"
import { transformScrollycodings } from "./scrollycoding"
import { transformSlideshows } from "./slideshow"
import { valueToEstree } from "./to-estree"
import { CH_CODE_CONFIG_VAR_NAME } from "./unist-utils"
import { transformPreviews } from "./preview"
import { transformInlineCodes } from "./inline-code"
import { EsmNode, SuperNode, visit } from "./nodes"
import { chUsage } from "./ch-usage"

type CodeHikeConfig = {
  theme: any
  lineNumbers?: boolean
  autoImport?: boolean
}

export function remarkCodeHike(
  unsafeConfig: CodeHikeConfig
) {
  return async (tree: SuperNode) => {
    const config = addConfigDefaults(unsafeConfig)
    // TODO add opt-in config
    let hasCodeHikeImport = false
    visit(tree, "mdxjsEsm", (node: EsmNode) => {
      if (
        node.value.startsWith(
          `import { CH } from "@code-hike/mdx`
        )
      ) {
        hasCodeHikeImport = true
      }
    })

    try {
      await transformPreviews(tree)
      await transformScrollycodings(tree, config)
      await transformSpotlights(tree, config)
      await transformSlideshows(tree, config)
      await transformSections(tree, config)
      await transformInlineCodes(tree, config)
      await transformEditorNodes(tree, config)
      await transformCodeNodes(tree, config)
    } catch (e) {
      console.error("error running remarkCodeHike", e)
      throw e
    }

    const usage = chUsage(tree)

    if (usage.length > 0) {
      addConfig(tree, config)

      if (config.autoImport && !hasCodeHikeImport) {
        addSmartImport(tree, usage)
      }
    }
  }
}

function addConfigDefaults(
  config: Partial<CodeHikeConfig> | undefined
): CodeHikeConfig {
  return {
    ...config,
    theme: config?.theme || {},
    autoImport: config?.autoImport === false ? false : true,
  }
}

function addConfig(
  tree: SuperNode,
  config: CodeHikeConfig
) {
  tree.children.unshift({
    type: "mdxjsEsm",
    value: "export const chCodeConfig = {}",
    data: {
      estree: {
        type: "Program",
        body: [
          {
            type: "ExportNamedDeclaration",
            declaration: {
              type: "VariableDeclaration",
              declarations: [
                {
                  type: "VariableDeclarator",
                  id: {
                    type: "Identifier",
                    name: CH_CODE_CONFIG_VAR_NAME,
                  },
                  init: valueToEstree(config),
                },
              ],
              kind: "const",
            },
            specifiers: [],
            source: null,
          },
        ],
        sourceType: "module",
      },
    },
  })
}

function addSmartImport(tree: SuperNode, usage: string[]) {
  const specifiers = [
    "annotations",
    ...usage.map(name => name.slice("CH.".length)),
  ]

  tree.children.unshift({
    type: "mdxjsEsm",
    value: `export const CH = { ${specifiers.join(", ")} }`,
    data: {
      estree: {
        type: "Program",
        body: [
          {
            type: "ExportNamedDeclaration",
            declaration: {
              type: "VariableDeclaration",
              declarations: [
                {
                  type: "VariableDeclarator",
                  id: {
                    type: "Identifier",
                    name: "CH",
                  },
                  init: {
                    type: "ObjectExpression",
                    properties: specifiers.map(
                      specifier => ({
                        type: "Property",
                        method: false,
                        shorthand: true,
                        computed: false,
                        key: {
                          type: "Identifier",
                          name: specifier,
                        },
                        kind: "init",
                        value: {
                          type: "Identifier",
                          name: specifier,
                        },
                      })
                    ),
                  },
                },
              ],
              kind: "const",
            },
            specifiers: [],
            source: null,
          },
        ],
        sourceType: "module",
        comments: [],
      },
    },
  })

  tree.children.unshift({
    type: "mdxjsEsm",
    value: `import { ${specifiers.join(
      ", "
    )} } from "@code-hike/mdx/dist/components.cjs.js"`,
    data: {
      estree: {
        type: "Program",
        body: [
          {
            type: "ImportDeclaration",

            specifiers: specifiers.map(specifier => ({
              type: "ImportSpecifier",
              imported: {
                type: "Identifier",
                name: specifier,
              },
              local: {
                type: "Identifier",
                name: specifier,
              },
            })),
            source: {
              type: "Literal",
              value:
                "@code-hike/mdx/dist/components.cjs.js",
              raw: '"@code-hike/mdx/dist/components.cjs.js"',
            },
          },
        ],
        sourceType: "module",
      },
    },
  })
}

function addImportNode(tree: SuperNode) {
  tree.children.unshift({
    type: "mdxjsEsm",
    value:
      'import { CH } from "@code-hike/mdx/dist/components.cjs.js"',
    data: {
      estree: {
        type: "Program",
        body: [
          {
            type: "ImportDeclaration",
            specifiers: [
              {
                type: "ImportSpecifier",
                imported: {
                  type: "Identifier",
                  name: "CH",
                },
                local: {
                  type: "Identifier",
                  name: "CH",
                },
              },
            ],
            source: {
              type: "Literal",
              value:
                "@code-hike/mdx/dist/components.cjs.js",
              raw: '"@code-hike/mdx/dist/components.cjs.js"',
            },
          },
        ],
        sourceType: "module",
      },
    },
  })
}
