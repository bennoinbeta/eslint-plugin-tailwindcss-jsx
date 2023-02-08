/**
 * @fileoverview Rule to extract TailwindCss class names
 * @author BennoDev
 *
 * Structure based on: https://eslint.org/docs/latest/extend/custom-rules
 */

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

import { createEslintRule } from '../../utils/create-eslint-rule';
import { RULE_NAME } from './constants';
import {
  buildInlineClassName,
  buildOutsourcedClassName,
  outsourceIdentifierFromClassName as outsourceExtractIdentifierFromClassName,
  getTailwindConfigPath,
  getTailwindContext,
  sortTailwindClassList,
  splitClassName,
} from './tailwindcss';
import { TOptions, TMessageIds, TConfig } from './types';
import { TTailwindContext } from 'tailwindcss/lib/lib/setupContextUtils';
import { RuleFix } from '@typescript-eslint/utils/dist/ts-eslint';
import { TSESTree } from '@typescript-eslint/utils';
import {
  extractClassNamesFromJSXAttribute,
  isClassAttribute as isClassNameAttribute,
} from './ast';

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

export default createEslintRule<TOptions, TMessageIds>({
  name: RULE_NAME,
  // https://eslint.org/docs/latest/extend/custom-rules#rule-basics
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Extract Tailwind classes from className HTML attribute.',
      recommended: 'warn',
    },
    schema: [
      {
        type: 'object',
        required: [],
        properties: {
          tailwindConfigPath: {
            type: 'string',
          },
          classNameRegex: {
            type: 'object',
            oneOf: [
              {
                type: 'object',
                required: ['regex'],
                properties: {
                  regex: {
                    type: 'array',
                    items: {
                      instanceof: 'RegExp',
                    },
                  },
                  overwrite: {
                    type: 'boolean',
                  },
                },
              },
              {
                instanceof: 'RegExp',
              },
            ],
          },
          callees: {
            type: 'array',
            items: { type: 'string', minLength: 0 },
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ], // No options
    messages: {
      invalidInline:
        'Invalid inline TailwindCSS class names with extracted key.',
      invalidOrder: 'Invalid TailwindCSS class names order!',
    },
    fixable: 'code',
  },
  defaultOptions: [{}],
  create: (context) => {
    let config: TConfig | null = null;
    if (context.options.length > 0) {
      config = context.options[0];
    }

    const extractedTailwindClasses: Record<string, string[]> = {};

    // Get TailwindCSS context based on TailwindCSS config path specified in config
    const tailwindConfigPath = getTailwindConfigPath(
      config?.tailwindConfigPath,
      context?.getCwd != null ? context.getCwd() : undefined
    );
    let tailwindContext: TTailwindContext | null = null;
    if (tailwindConfigPath != null) {
      tailwindContext = getTailwindContext(tailwindConfigPath);
    } else {
      console.warn("Failed to resolve path to 'tailwind.config.js'!");
    }
    if (tailwindContext == null) {
      console.warn(
        `Failed to load 'tailwind.config.js' from '${tailwindConfigPath}'!`
      );
    }

    // Get class name regex from config
    let classNameRegex: RegExp[] = [/\b(class|className)\b/g];
    if (config != null && config.classNameRegex != null) {
      const configClassRegex = config.classNameRegex;
      if (configClassRegex instanceof RegExp) {
        classNameRegex = [configClassRegex];
      } else {
        classNameRegex = configClassRegex.overwrite
          ? configClassRegex.regex
          : classNameRegex.concat(configClassRegex.regex);
      }
    }

    // Get callees from config
    const callees: string[] = config?.callees ?? ['clsx', 'ctl', 'classnames'];

    return {
      // Start at the "JSXAttribute" AST Node Type,
      // as we know that the "className" is a JSX attribute
      JSXAttribute: (node) => {
        // Check whether JSXAttribute Node contains class names
        if (!isClassNameAttribute(node, classNameRegex)) return;

        // Extract class names from Node
        const classNameExtractions = extractClassNamesFromJSXAttribute(node);

        for (const classNameExtraction of classNameExtractions) {
          const start = classNameExtraction.start;
          const end = classNameExtraction.end;

          // Split className into classes & spaces and extract outsource identifier
          const { className, identifier } =
            outsourceExtractIdentifierFromClassName(classNameExtraction.value);

          // TODO handle deep
          // https://astexplorer.net/#/gist/5228f6df207afd9abdc39f94ad8a3f03/f6d8d3e11fe2470ed123dbedde717727fe5b8f0a

          // Split className to classes and whitespaces
          const splitted = splitClassName(className);
          if (splitted == null || splitted.classes.length <= 0) {
            continue;
          }

          // Just sort if no identifier present
          if (identifier == null && tailwindContext != null) {
            const sortedClasses = sortTailwindClassList(
              splitted.classes,
              tailwindContext
            );

            if (sortedClasses.join('') !== splitted.classes.join('')) {
              context.report({
                node,
                messageId: 'invalidOrder',
                fix: (fixer) => {
                  return fixer.replaceTextRange(
                    [start, end],
                    buildInlineClassName(sortedClasses, splitted.whitespaces)
                  );
                },
              });
            }
          }

          // TODO fix
          // Sort and extract if identifier present
          if (identifier != null) {
            // Store classes to extract them in another event listener
            if (tailwindContext != null) {
              extractedTailwindClasses[identifier] = sortTailwindClassList(
                splitted.classes,
                tailwindContext
              );
            } else {
              extractedTailwindClasses[identifier] = splitted.classes;
            }

            // Report the required extraction
            context.report({
              node,
              messageId: 'invalidInline',
              fix: (fixer) => {
                const fixers: RuleFix[] = [];

                // Fix "Replace class names with identifier"
                fixers.push(
                  fixer.replaceText(node, `className={${identifier}}`)
                );

                // Fix "Extract class names to identifier"
                const ast = context.getSourceCode().ast;
                const lastNode = ast.body[ast.body.length - 1];
                const toInsertCode = `\n\n${buildOutsourcedClassName(
                  splitted.classes,
                  identifier,
                  lastNode.loc.start.column + 1
                )}`;

                fixers.push(fixer.insertTextAfter(lastNode, toInsertCode));

                return fixers;
              },
            });
          }
        }
      },
      // Adding the TailwindCSS classes to the end of the file in each JSXAttribute Listener fix() method,
      // didn't work properly if there where multiple fixes to do,
      // so I collect the to do fixes and then add them at the end of the file in a batch on 'Program:exit'.
      // https://github.com/eslint/eslint/discussions/16855
      // 'Program:exit': (node) => {
      //   if (Object.keys(extractedTailwindClasses).length > 0) {
      //     context.report({
      //       node,
      //       messageId: 'invalidInline',
      //       fix: (fixer) => {
      //         const ast = context.getSourceCode().ast;

      //         // Add TailwindCss classes to end of the file (in a batch)
      //         const lastNode = ast.body[ast.body.length - 1];
      //         const toInsertCode = Object.keys(extractedTailwindClasses).reduce(
      //           (previousValue, identifier) => {
      //             const classes = extractedTailwindClasses[identifier];

      //             // Add new code block with a constant declaration for the extracted Tailwind class
      //             if (classes != null) {
      //               previousValue =
      //                 previousValue +
      //                 `\n\n${buildOutsourcedClassName(
      //                   classes,
      //                   identifier,
      //                   lastNode.loc.start.column + 1
      //                 )}`;
      //             }

      //             // Remove the extracted Tailwind class entry from the stored list
      //             delete extractedTailwindClasses[identifier];

      //             return previousValue;
      //           },
      //           ''
      //         );

      //         return fixer.insertTextAfter(lastNode, toInsertCode);
      //       },
      //     });
      //   }
      // },
    };
  },
});

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

export * from './constants';
export * from './types';
