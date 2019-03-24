import * as Figma from 'figma-js';
import * as prettier from 'prettier';

export function createComponent(component: Figma.Component) {
  console.log(component);

  return prettier.format('', {
    printWidth: 100,
    arrowParens: 'always',
    singleQuote: true,
    trailingComma: 'es5',
  });
}
