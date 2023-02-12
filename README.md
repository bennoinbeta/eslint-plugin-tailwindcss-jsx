<img src="https://raw.githubusercontent.com/bennodev19/eslint-plugin-tailwindcss-jsx/main/.github/banner.jpg" alt="prettier-plugin-tailwindcss" />

An [ESLint](https://eslint.org/) plugin for [Tailwind CSS](https://tailwindcss.com/) v3.0+ that enforces best practices and consistency with focus on [ReactJS](https://reactjs.org/) `.jsx` & `.tsx`.

## Installation

To get started, just install `eslint-plugin-tailwindcss-jsx` as a dev-dependency:
```sh
npm install -D eslint eslint-plugin-tailwindcss-jsx
```

### Resources
- [Docs](https://eslint.org/docs/latest/extend/custom-rules)
- [Blog](https://medium.com/bigpicture-one/writing-custom-typescript-eslint-rules-with-unit-tests-for-angular-project-f004482551db)
- [Blog](https://developers.mews.com/how-to-write-custom-eslint-rules/)
- [AST Explorer](https://astexplorer.net/)

### Debug via Jest Test
- [StackOverflow](https://stackoverflow.com/questions/33247602/how-do-you-debug-jest-tests)

1. Start `Javascript Debug` Terminal
2. Set Debug Point
3. Run test via `pnpm run test --watch`
   ```bash
   $ pnpm run test -- extract-tailwind --watch
   ```